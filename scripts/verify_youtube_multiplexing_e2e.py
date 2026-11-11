#!/usr/bin/env python3
"""
End-to-End Real Pipeline + Browser Verification for Ming YouTube Lecture Ingestion:
  Source: https://youtu.be/za87oqLhGaI
  Video ID: za87oqLhGaI
  Title: 35. intro to multiplexing
  Channel: GATE CSE LECTURES BY AMIT KHURANA

Zero synthetic transcripts, zero transcript seeding, zero URL substitution.
"""

import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import requests
from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = Path(
    os.environ.get("MING_ARTIFACTS_DIR", str(PROJECT_ROOT / "tmp_artifacts"))
)
SCREENSHOTS_DIR = ARTIFACTS_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

TARGET_URL = "https://youtu.be/za87oqLhGaI"
TARGET_VIDEO_ID = "za87oqLhGaI"
UNAVAILABLE_URL = "https://www.youtube.com/watch?v=00000000000"

API_BASE = "http://127.0.0.1:3001"
WEB_BASE = "http://localhost:3000"
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TEST_USER = "youtube_verify_learner"
PROTECTED_USER = "7a1adf6a-5eff-47cb-ae3c-3a21caca8a12"


def load_env_value(key: str) -> str:
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == key:
                return v.strip().strip('"').strip("'")
    return os.environ.get(key, "")


def log(stage: str, msg: str) -> None:
    print(f"[{stage}] {msg}", flush=True)


def snapshot_protected_rows(db_path: Path) -> List[Any]:
    conn = sqlite3.connect(str(db_path))
    rows = conn.execute(
        "SELECT id, title, sourceType, durationSeconds, transcriptStatus, updatedAt FROM videos WHERE userId = ? ORDER BY id",
        (PROTECTED_USER,),
    ).fetchall()
    conn.close()
    return rows


def main() -> int:
    test_secret = load_env_value("MING_TEST_SECRET")
    if not test_secret:
        raise RuntimeError("MING_TEST_SECRET missing from .env")

    db_path = PROJECT_ROOT / "prisma" / "dev.db"
    baseline_protected = snapshot_protected_rows(db_path)
    log("BASELINE", f"Protected user rows count before run: {len(baseline_protected)}")

    report: Dict[str, Any] = {
        "source_url": TARGET_URL,
        "video_id": TARGET_VIDEO_ID,
    }

    # ------------------------------------------------------------------
    # 1. Direct Provider Probe (youtube_extractor.py CLI)
    # ------------------------------------------------------------------
    log("STEP 1", "Verifying youtube_extractor.py live caption & metadata output...")
    venv_python = PROJECT_ROOT / ".venv" / "bin" / "python"
    proc = subprocess.run(
        [str(venv_python), "server/youtube_extractor.py", TARGET_URL],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        timeout=45,
    )
    assert proc.returncode == 0, f"Extractor failed: {proc.stderr}"
    ext_data = json.loads(proc.stdout)
    assert ext_data["success"] is True
    assert ext_data["video_id"] == TARGET_VIDEO_ID
    assert ext_data["caption_language"] == "hi"
    assert ext_data["caption_kind"] == "asr"
    assert ext_data["is_auto_generated"] is True
    assert ext_data["segment_count"] >= 45
    log(
        "STEP 1",
        f"Provider={ext_data['caption_provider']} title='{ext_data['title']}' "
        f"channel='{ext_data['channel']}' duration={ext_data['duration_seconds']}s "
        f"({ext_data['duration_source']}) cues={ext_data['segment_count']} "
        f"tail=[{ext_data['tail_segment']['start']}..{ext_data['tail_segment']['end']}]",
    )
    report["provider_probe"] = {
        "title": ext_data["title"],
        "channel": ext_data["channel"],
        "duration_seconds": ext_data["duration_seconds"],
        "duration_source": ext_data["duration_source"],
        "caption_language": ext_data["caption_language"],
        "caption_language_name": ext_data["caption_language_name"],
        "caption_kind": ext_data["caption_kind"],
        "is_auto_generated": ext_data["is_auto_generated"],
        "caption_provider": ext_data["caption_provider"],
        "segment_count": ext_data["segment_count"],
        "first_segment": ext_data["sample_segments"][0],
        "tail_segment": ext_data["tail_segment"],
    }

    auth_headers = {
        "Content-Type": "application/json",
        "x-ming-test-key": test_secret,
        "x-ming-user-id": TEST_USER,
    }

    # Cleanup ONLY isolated test-user videos before starting clean UI run
    existing_resp = requests.get(f"{API_BASE}/api/videos", headers=auth_headers, timeout=10)
    assert existing_resp.status_code == 200, f"GET /api/videos failed: {existing_resp.text}"
    for v in existing_resp.json().get("videos", []):
        requests.delete(f"{API_BASE}/api/videos/{v['id']}", headers=auth_headers, timeout=10)
    log("CLEANUP", f"Cleared prior temporary rows strictly for isolated test user '{TEST_USER}'.")

    # ------------------------------------------------------------------
    # 2. Honest Unavailable / Captionless Handling Check (No Fabrication)
    # ------------------------------------------------------------------
    log("STEP 2", "Verifying unavailable-transcript path does NOT synthesize placeholders...")
    unavail_post = requests.post(
        f"{API_BASE}/api/videos",
        headers=auth_headers,
        json={"title": "", "sourceType": "youtube", "youtubeUrl": UNAVAILABLE_URL},
        timeout=10,
    )
    assert unavail_post.status_code == 201, f"Unavailable test POST failed: {unavail_post.text}"
    unavail_id = unavail_post.json()["video"]["id"]

    settled_unavail = None
    for _ in range(30):
        r = requests.get(f"{API_BASE}/api/videos/{unavail_id}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        v = r.json()["video"]
        if v["transcriptStatus"] != "processing" and v["status"] != "processing":
            settled_unavail = v
            break
        time.sleep(1.5)
    assert settled_unavail is not None, "Unavailable video check timed out while processing"
    assert settled_unavail["transcriptStatus"] == "unavailable", f"Expected unavailable, got {settled_unavail['transcriptStatus']}"
    assert settled_unavail.get("transcriptJson") is None
    log(
        "STEP 2",
        f"Confirmed honest unavailable state: transcriptStatus={settled_unavail['transcriptStatus']}, "
        f"extractionStatus={settled_unavail.get('extractionStatus')}, transcriptJson=None",
    )
    # Remove this negative-check row so the real browser walkthrough cleanly centers za87oqLhGaI
    requests.delete(f"{API_BASE}/api/videos/{unavail_id}", headers=auth_headers, timeout=10)
    report["unavailable_check"] = {
        "transcriptStatus": settled_unavail["transcriptStatus"],
        "extractionStatus": settled_unavail.get("extractionStatus"),
        "errorMessage": settled_unavail.get("errorMessage"),
    }

    # ------------------------------------------------------------------
    # 3. Full Browser E2E via Normal Learner UI (+ Add Video -> AI Tutor -> Layout)
    # ------------------------------------------------------------------
    log("STEP 3", "Launching Chrome via Playwright for full normal UI walkthrough...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.0)

        user_session = {
            "id": TEST_USER,
            "user_id": TEST_USER,
            "name": "YouTube Verify Learner",
            "email": "ytverify@ming.local",
            "userType": "college",
            "college": "Engineering",
            "branch": "CSE",
            "semester": 5,
        }
        init_script = f"""
            const sessionObj = {json.dumps(user_session)};
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {{
                localStorage.setItem('studymate-offline-session', JSON.stringify(sessionObj));
                localStorage.setItem('studymate_cached_profile', JSON.stringify(sessionObj));
                localStorage.setItem('ming_auth_token', 'test_verified_jwt_yt_learner');
                localStorage.setItem('ming_auth_user', JSON.stringify(sessionObj));
                localStorage.setItem('studymate_user_type', 'college');
                localStorage.setItem('ming_user_videos', JSON.stringify([]));
            }}
            // Spy on HTMLIFrameElement.prototype.contentWindow ONLY for YouTube embed iframes
            // so cross-origin postMessage(seekTo) commands are recorded without SecurityError
            window.__mingPostMessages = [];
            try {{
                const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
                if (desc && desc.get) {{
                    const nativeGet = desc.get;
                    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {{
                        configurable: true,
                        get: function() {{
                            const win = nativeGet.call(this);
                            if (!win) return win;
                            const src = (this.getAttribute && this.getAttribute('src')) || '';
                            if (!src.includes('youtube.com/embed')) return win;
                            return {{
                                postMessage: function(msg, targetOrigin, transfer) {{
                                    window.__mingPostMessages.push(msg);
                                    return win.postMessage(msg, targetOrigin, transfer);
                                }}
                            }};
                        }}
                    }});
                }}
            }} catch (e) {{}}
        """
        context.add_init_script(init_script)

        page = context.new_page()

        # Route ONLY same-origin /api/** requests with authenticated test headers (never leak custom headers to YouTube iframe)
        def handle_api_route(route):
            req_headers = dict(route.request.headers)
            req_headers["x-ming-test-key"] = test_secret
            req_headers["x-ming-user-id"] = TEST_USER
            route.continue_(headers=req_headers)

        page.route("http://localhost:3000/api/**", handle_api_route)

        page.goto(f"{WEB_BASE}/dashboard?tab=video-learning", wait_until="networkidle")
        page.wait_for_selector("button:has-text('Add Video'), button:has-text('Add Your First Video')", timeout=15000)

        # Open Add Video modal
        add_btn = page.locator("button:has-text('+ Add Video'), button:has-text('+ Add Your First Video')").first
        add_btn.click()
        page.wait_for_selector("#yt-url", timeout=5000)

        # Fill ONLY the confirmed YouTube URL (leave title blank so YouTube metadata auto-populates, and NO transcript!)
        page.fill("#yt-url", TARGET_URL)
        page.wait_for_selector("text=za87oqLhGaI", timeout=5000)
        page.screenshot(path=str(SCREENSHOTS_DIR / "yt_01_add_video_modal.png"))

        submit_btn = page.locator("button[type='submit']:has-text('Add YouTube Video')")
        submit_btn.click()

        # Wait for UI polling to finish real yt-dlp extraction + English gloss + Chroma indexing
        log("STEP 3", "Submitted URL via UI modal; waiting for background ingestion & UI polling to settle...")
        page.wait_for_selector("h2:has-text('35. intro to multiplexing')", timeout=60000)
        page.wait_for_selector("text=GATE CSE LECTURES BY AMIT KHURANA", timeout=15000)
        page.wait_for_selector("text=52 segments", timeout=15000)
        page.wait_for_selector("text=मल्टीप्लेक्सिंग के बारे में", timeout=15000)

        time.sleep(1.5)
        page.screenshot(path=str(SCREENSHOTS_DIR / "yt_02_ingested_za87oqLhGaI_transcript.png"))
        log("STEP 3", "✅ UI shows '35. intro to multiplexing', channel 'GATE CSE LECTURES BY AMIT KHURANA', '52 segments', and verbatim Hindi cues.")

        # Ask Supported Question in AI Video Tutor UI
        supported_question = "What does multiplexing mean and why is it used?"
        chat_input = page.locator("input[placeholder*='Ask a question about this lecture']")
        chat_input.fill(supported_question)
        page.keyboard.press("Enter")

        log("STEP 3", f"Asking AI Video Tutor: '{supported_question}'...")
        # Wait for grounded response (avoid flaky spinner race on fast responses)
        page.wait_for_selector("button[title^='Jump to video at']", timeout=70000)
        page.wait_for_selector("text=Analyzing lecture video transcript", state="detached", timeout=10000)
        time.sleep(0.8)

        # Verify grounded citations rendered and timestamps are within duration + tolerance
        citation_buttons = page.locator("button[title^='Jump to video at']")
        cit_count = citation_buttons.count()
        assert cit_count > 0, "Expected at least 1 verified timestamp citation button for supported question!"

        citation_details = []
        for idx in range(cit_count):
            btn = citation_buttons.nth(idx)
            label = btn.inner_text().strip()
            title_attr = btn.get_attribute("title") or ""
            citation_details.append({"label": label, "title": title_attr})
            m = re.search(r"\[(\d+):(\d{2})\]", label)
            if m:
                secs = int(m.group(1)) * 60 + int(m.group(2))
                assert secs <= 223, f"Citation timestamp {label} ({secs}s) exceeds video duration bounds!"

        log("STEP 3", f"✅ Rendered {cit_count} citation pill(s): {citation_details}")
        page.screenshot(path=str(SCREENSHOTS_DIR / "yt_03_supported_qa_citations.png"))

        # Test clicking the first citation pill & verify YouTube seek command dispatched + transcript highlights
        page.evaluate("window.__mingPostMessages = []")
        first_cit = citation_buttons.first
        clicked_label = first_cit.inner_text().strip()
        first_cit.click()
        time.sleep(0.6)
        post_msgs = page.evaluate("window.__mingPostMessages || []")
        seek_dispatched = any('"seekTo"' in str(m) for m in post_msgs)
        assert seek_dispatched, f"Clicking citation {clicked_label} did not send seekTo command to YouTube player! msgs={post_msgs}"
        active_highlight_count = page.locator("div.border-l-primary").count()
        assert active_highlight_count >= 1, "Clicking citation did not highlight corresponding active segment in transcript!"
        log("STEP 3", f"✅ Clicked citation {clicked_label} -> VideoPlayer dispatched YouTube seekTo ({len(post_msgs)} msgs) & highlighted transcript segment")

        # Check iframe allowfullscreen attribute
        yt_iframe = page.locator(f"iframe[src*='{TARGET_VIDEO_ID}']").first
        assert yt_iframe.count() == 1
        allow_fs = yt_iframe.get_attribute("allowfullscreen")
        assert allow_fs is not None, "YouTube iframe missing allowfullscreen attribute!"
        log("STEP 3", "✅ Confirmed YouTube iframe embed present with allowfullscreen enabled.")

        # Ask Unsupported Question in AI Video Tutor UI
        unsupported_question = "What does the lecture say about BGP routing protocol?"
        chat_input.fill(unsupported_question)
        page.keyboard.press("Enter")
        log("STEP 3", f"Asking unsupported question: '{unsupported_question}'...")
        page.wait_for_selector("text=Evidence Unavailable in Video", timeout=45000)
        page.wait_for_selector("text=Analyzing lecture video transcript", state="detached", timeout=10000)
        time.sleep(0.8)
        # Ensure citation count did not increase after unsupported refusal
        assert citation_buttons.count() == cit_count, (
            f"Unsupported answer unexpectedly added citation buttons ({citation_buttons.count()} vs {cit_count})!"
        )
        page.screenshot(path=str(SCREENSHOTS_DIR / "yt_04_unsupported_refusal.png"))
        log("STEP 3", "✅ Unsupported question produced honest 'Evidence Unavailable in Video' refusal with 0 new citations.")

        # Check Layout: Default Mode vs Expand Left Pane Mode
        chat_container = page.locator("div[class*='lg:w-[420px]']").first
        video_box = page.locator("div[class*='aspect-video']").first
        default_chat_bbox = chat_container.bounding_box()
        default_video_bbox = video_box.bounding_box()
        page.screenshot(path=str(SCREENSHOTS_DIR / "yt_05_default_layout.png"))

        expand_btn = page.locator("button:has-text('Expand Left Pane')")
        expand_btn.click()
        page.wait_for_selector("button:has-text('Standard View')", timeout=5000)
        time.sleep(0.6)

        expanded_chat_bbox = chat_container.bounding_box()
        expanded_video_bbox = video_box.bounding_box()
        page.screenshot(path=str(SCREENSHOTS_DIR / "yt_06_expanded_left_layout.png"))

        width_diff = abs(expanded_chat_bbox["width"] - default_chat_bbox["width"])
        x_diff = abs(expanded_chat_bbox["x"] - default_chat_bbox["x"])
        vid_growth = expanded_video_bbox["width"] - default_video_bbox["width"]
        aspect_exp = expanded_video_bbox["width"] / expanded_video_bbox["height"]

        assert width_diff < 5.0 and abs(expanded_chat_bbox["width"] - 420.0) < 5.0
        assert x_diff < 5.0
        assert vid_growth > 100.0
        assert abs(aspect_exp - 1.778) < 0.05
        # Verify existing chat turns stayed mounted during layout expand toggle
        assert page.locator(f"text={supported_question}").count() >= 1
        assert page.locator(f"text={unsupported_question}").count() >= 1

        log(
            "STEP 3",
            f"✅ Expand Left Pane preserved 420px chat (diff={width_diff:.1f}px), "
            f"grew 16:9 video (+{vid_growth:.1f}px), and preserved active Q&A conversation.",
        )

        # Also inspect the persisted Q&A API responses directly cleanly via GET/POST audit
        list_after = requests.get(f"{API_BASE}/api/videos", headers=auth_headers, timeout=10).json()["videos"]
        yt_record = next(v for v in list_after if v.get("youtubeVideoId") == TARGET_VIDEO_ID)
        report["ui_ingested_record"] = {
            "id": yt_record["id"],
            "title": yt_record["title"],
            "channelName": yt_record.get("channelName"),
            "durationSeconds": yt_record["durationSeconds"],
            "durationSource": yt_record.get("durationSource"),
            "captionLanguage": yt_record.get("captionLanguage"),
            "captionLanguageName": yt_record.get("captionLanguageName"),
            "captionKind": yt_record.get("captionKind"),
            "isAutoGenerated": yt_record.get("isAutoGenerated"),
            "captionProvider": yt_record.get("captionProvider"),
            "extractionStatus": yt_record.get("extractionStatus"),
            "transcriptStatus": yt_record["transcriptStatus"],
            "segmentCount": len(json.loads(yt_record["transcriptJson"])),
        }
        report["browser_citations_rendered"] = citation_details
        report["layout_geometry"] = {
            "default_video": default_video_bbox,
            "expanded_video": expanded_video_bbox,
            "default_chat_width": default_chat_bbox["width"],
            "expanded_chat_width": expanded_chat_bbox["width"],
        }

        browser.close()

    # ------------------------------------------------------------------
    # 4. Direct API Q&A Inspection & Database Integrity Verification
    # ------------------------------------------------------------------
    log("STEP 4", "Inspecting API Q&A payload & verifying SQLite provenance + protected user rows...")
    ask_ok = requests.post(
        f"{API_BASE}/api/videos/{report['ui_ingested_record']['id']}/ask",
        headers=auth_headers,
        json={"question": "What does multiplexing mean and why is it used?"},
        timeout=50,
    ).json()
    ask_bad = requests.post(
        f"{API_BASE}/api/videos/{report['ui_ingested_record']['id']}/ask",
        headers=auth_headers,
        json={"question": "What does the lecture say about BGP routing protocol?"},
        timeout=50,
    ).json()
    ask_oob = requests.post(
        f"{API_BASE}/api/videos/{report['ui_ingested_record']['id']}/ask",
        headers=auth_headers,
        json={"question": "What did the instructor say at 8:00?"},
        timeout=50,
    ).json()

    assert ask_ok["grounded"] is True and len(ask_ok["citations"]) > 0
    assert ask_bad["grounded"] is False and ask_bad["insufficient_evidence"] is True and len(ask_bad["citations"]) == 0
    assert ask_oob["grounded"] is False and ask_oob["insufficient_evidence"] is True and len(ask_oob["citations"]) == 0

    report["api_qa_supported"] = ask_ok
    report["api_qa_unsupported"] = ask_bad
    report["api_qa_out_of_bounds_time"] = ask_oob

    after_protected = snapshot_protected_rows(db_path)
    assert after_protected == baseline_protected, "Protected user rows in prisma/dev.db changed unexpectedly!"
    log("STEP 4", f"✅ Verified prisma/dev.db protected user rows untouched ({len(after_protected)} rows).")

    out_path = ARTIFACTS_DIR / "YOUTUBE_MULTIPLEXING_E2E_OUTPUT.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log("DONE", f"Full verification report JSON written to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
