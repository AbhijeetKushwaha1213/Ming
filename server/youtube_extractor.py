#!/usr/bin/env python3
"""
Genuine YouTube Metadata & Caption Extraction Provider for Ming.

Uses yt-dlp (primary) and youtube-transcript-api (secondary fallback) to retrieve
verified video metadata (ID, title, channel, duration) and verbatim caption tracks
with original segment timings. Strictly selects original-language captions rather than
YouTube auto-translated tracks, and NEVER synthesizes or fabricates transcripts.
"""

import re
import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger("youtube_extractor")

YOUTUBE_ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}
YOUTUBE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

# Deterministic Devanagari -> Latin phonetic mapping for offline cross-lingual lexical search
_DEV_CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h",
    "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
    "ळ": "l", "ऩ": "n", "ऱ": "r",
}
_DEV_VOWELS_INDEP = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
    "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
}
_DEV_MATRAS = {
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
    "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
}


def transliterate_devanagari_to_latin(text: str) -> str:
    """
    Lightweight deterministic Devanagari-to-Latin phonetic transliterator.
    Used strictly as a search/matching aid for Hinglish/English CS terms written in
    Devanagari by ASR (e.g. मल्टीप्लेक्सिंग -> maltipleksing, सिग्नल -> signal, कंप्यूटर -> kampyutar).
    """
    if not text or not any("\u0900" <= ch <= "\u097F" for ch in text):
        return ""

    out: List[str] = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if nxt == "\u093C" and (ch + nxt) in _DEV_CONSONANTS:
            ch = ch + nxt
            i += 1
            nxt = text[i + 1] if i + 1 < n else ""

        if ch in _DEV_CONSONANTS:
            out.append(_DEV_CONSONANTS[ch])
            if nxt == "\u094D":  # halant suppresses inherent 'a'
                i += 2
                continue
            elif nxt in _DEV_MATRAS or nxt in ("\u0902", "\u0901"):
                pass
            elif nxt == "" or not ("\u0900" <= nxt <= "\u097F"):
                # word-final consonant often drops schwa in Hindi (सिग्नल -> signal)
                pass
            else:
                out.append("a")
        elif ch in _DEV_VOWELS_INDEP:
            out.append(_DEV_VOWELS_INDEP[ch])
        elif ch in _DEV_MATRAS:
            out.append(_DEV_MATRAS[ch])
        elif ch in ("\u0902", "\u0901"):  # anusvara / chandrabindu
            out.append("n")
        elif ch == "\u0903":  # visarga
            out.append("h")
        elif ch == "\u094D":
            pass
        elif "0" <= ch <= "9" or ch in " .,-_()/:":
            out.append(ch)
        elif "\u0966" <= ch <= "\u096F":
            out.append(str(ord(ch) - 0x0966))
        elif ch.isascii():
            out.append(ch)
        else:
            out.append(" ")
        i += 1

    raw = "".join(out)
    # Collapse common ASR phonetic normalizations into indexable forms too
    variants = [raw]
    ph_fixed = raw.replace("ph", "f")
    if ph_fixed != raw:
        variants.append(ph_fixed)
    return re.sub(r"\s+", " ", " ".join(variants)).strip()


def _extract_id_from_url_candidate(raw_url: str) -> Optional[str]:
    if not raw_url or not isinstance(raw_url, str):
        return None
    cleaned = raw_url.strip()
    if not cleaned or re.search(r"\s", cleaned):
        return None

    normalized_scheme = (
        f"https://{cleaned}"
        if re.match(r"^(?:youtu\.be|(?:www\.|m\.|music\.)?youtube\.com|(?:www\.)?youtube-nocookie\.com)/", cleaned, re.IGNORECASE)
        else cleaned
    )

    try:
        parsed = urlparse(normalized_scheme)
    except Exception:
        return None

    if parsed.scheme.lower() not in ("http", "https"):
        return None

    host = (parsed.hostname or "").lower()
    if host not in YOUTUBE_ALLOWED_HOSTS:
        return None

    path_parts = [p for p in (parsed.path or "").split("/") if p]
    if host in ("youtu.be", "www.youtu.be"):
        if path_parts and YOUTUBE_ID_RE.match(path_parts[0]):
            return path_parts[0]
        return None

    if not path_parts or path_parts[0] == "watch":
        v_list = parse_qs(parsed.query).get("v", [])
        if v_list and YOUTUBE_ID_RE.match(v_list[0]):
            return v_list[0]
        return None

    if len(path_parts) >= 2 and path_parts[0] in ("embed", "shorts", "v", "live") and YOUTUBE_ID_RE.match(path_parts[1]):
        return path_parts[1]

    return None


def _looks_like_url_text(text: str) -> bool:
    t = text.strip()
    return bool(
        re.match(r"^https?://", t, re.IGNORECASE)
        or re.search(r"(?:^|\s)(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\b", t, re.IGNORECASE)
        or re.search(r"\.[a-z]{2,}/", t, re.IGNORECASE)
    )


def parse_youtube_input(url_or_id: str, allow_bare_id: bool = False) -> Dict[str, Any]:
    if not url_or_id or not isinstance(url_or_id, str):
        return {"valid": False, "video_id": None, "canonical_url": None, "error": "Please enter a YouTube video URL."}

    trimmed = url_or_id.strip()
    if not trimmed:
        return {"valid": False, "video_id": None, "canonical_url": None, "error": "Please enter a YouTube video URL."}

    if trimmed.startswith("<") or trimmed.endswith(">"):
        m = re.match(r"^<([^<>\s]+)>$", trimmed)
        if not m:
            return {"valid": False, "video_id": None, "canonical_url": None, "error": "Malformed Markdown YouTube link."}
        vid = _extract_id_from_url_candidate(m.group(1))
        if not vid:
            return {"valid": False, "video_id": None, "canonical_url": None, "error": "Invalid YouTube URL inside link brackets."}
        return {"valid": True, "video_id": vid, "canonical_url": f"https://www.youtube.com/watch?v={vid}", "was_markdown": True}

    if "[" in trimmed or "]" in trimmed:
        md_m = re.match(r"^\[([^\]]*)\]\(([^)]+)\)$", trimmed)
        if not md_m:
            return {"valid": False, "video_id": None, "canonical_url": None, "error": "Malformed Markdown YouTube link."}
        label = md_m.group(1).strip()
        dest_raw = md_m.group(2).strip()
        dest_m = re.match(r"^(?:<([^>\s]+)>|(\S+)(?:\s+[\"'()].*[\"'()])?)$", dest_raw)
        if not dest_m:
            return {"valid": False, "video_id": None, "canonical_url": None, "error": "Malformed Markdown link destination."}
        dest_url = dest_m.group(1) or dest_m.group(2) or ""
        dest_vid = _extract_id_from_url_candidate(dest_url)
        if not dest_vid:
            return {"valid": False, "video_id": None, "canonical_url": None, "error": "Invalid YouTube URL in Markdown link."}
        if label and _looks_like_url_text(label):
            label_vid = _extract_id_from_url_candidate(label)
            if not label_vid or label_vid != dest_vid:
                return {"valid": False, "video_id": None, "canonical_url": None, "error": "Markdown link label and destination disagree."}
        return {"valid": True, "video_id": dest_vid, "canonical_url": f"https://www.youtube.com/watch?v={dest_vid}", "was_markdown": True}

    if "(" in trimmed or ")" in trimmed or re.search(r"\s", trimmed):
        return {"valid": False, "video_id": None, "canonical_url": None, "error": "Invalid or malformed YouTube URL."}

    if YOUTUBE_ID_RE.match(trimmed):
        if not allow_bare_id:
            return {"valid": False, "video_id": None, "canonical_url": None, "error": "Please enter a full YouTube URL."}
        return {"valid": True, "video_id": trimmed, "canonical_url": f"https://www.youtube.com/watch?v={trimmed}", "was_markdown": False}

    vid = _extract_id_from_url_candidate(trimmed)
    if not vid:
        return {"valid": False, "video_id": None, "canonical_url": None, "error": "Invalid YouTube URL."}
    return {"valid": True, "video_id": vid, "canonical_url": f"https://www.youtube.com/watch?v={vid}", "was_markdown": False}


def extract_youtube_video_id(url_or_id: str, allow_bare_id: bool = True) -> Optional[str]:
    return parse_youtube_input(url_or_id, allow_bare_id=allow_bare_id)["video_id"]


def is_youtube_url(url_or_id: str, allow_bare_id: bool = False) -> bool:
    return bool(parse_youtube_input(url_or_id, allow_bare_id=allow_bare_id)["valid"])


def _url_has_translation_param(url: str) -> bool:
    if not url:
        return False
    try:
        qs = parse_qs(urlparse(url).query)
        return "tlang" in qs and len(qs["tlang"]) > 0
    except Exception:
        return "tlang=" in url


def _normalize_lang_code(track_key: str) -> str:
    if not track_key:
        return ""
    if track_key.endswith("-orig"):
        return track_key[:-5]
    return track_key


def _parse_json3_events(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    events = payload.get("events") or []
    raw_items: List[Dict[str, Any]] = []

    for ev in events:
        if not isinstance(ev, dict):
            continue
        segs = ev.get("segs")
        if not isinstance(segs, list) or not segs:
            continue
        text = re.sub(r"\s+", " ", "".join(str(s.get("utf8", "")) for s in segs)).strip()
        if not text:
            continue
        t_start_ms = ev.get("tStartMs")
        if t_start_ms is None:
            continue
        start = max(0.0, round(float(t_start_ms) / 1000.0, 3))
        d_dur_ms = ev.get("dDurationMs")
        end: Optional[float] = None
        if d_dur_ms is not None and float(d_dur_ms) > 0:
            end = round((float(t_start_ms) + float(d_dur_ms)) / 1000.0, 3)
        raw_items.append({"start": start, "end": end, "text": text})

    segments: List[Dict[str, Any]] = []
    for idx, item in enumerate(raw_items):
        start = item["start"]
        end = item["end"]
        if end is None or end <= start:
            if idx + 1 < len(raw_items) and raw_items[idx + 1]["start"] > start:
                end = raw_items[idx + 1]["start"]
            else:
                end = round(start + 2.5, 3)
        segments.append({"start": start, "end": end, "text": item["text"]})

    return segments


def _parse_vtt_content(vtt_text: str) -> List[Dict[str, Any]]:
    pattern = re.compile(
        r"(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[\.,](\d{1,3}))?\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[\.,](\d{1,3}))?"
    )
    segments: List[Dict[str, Any]] = []
    current_start: Optional[float] = None
    current_end: Optional[float] = None
    lines_buf: List[str] = []

    def _to_sec(h: Optional[str], m: Optional[str], s: Optional[str], ms: Optional[str]) -> float:
        ms_val = float((ms or "0").ljust(3, "0")[:3]) / 1000.0 if ms else 0.0
        return round(int(h or 0) * 3600 + int(m or 0) * 60 + int(s or 0) + ms_val, 3)

    for raw_line in vtt_text.splitlines():
        line = raw_line.strip()
        m = pattern.search(line)
        if m:
            if current_start is not None and lines_buf:
                clean_txt = re.sub(r"<[^>]+>", "", " ".join(lines_buf))
                clean_txt = re.sub(r"\s+", " ", clean_txt).strip()
                if clean_txt and (not segments or segments[-1]["text"] != clean_txt):
                    segments.append({
                        "start": current_start,
                        "end": current_end if (current_end and current_end > current_start) else round(current_start + 2.5, 3),
                        "text": clean_txt,
                    })
                lines_buf = []
            current_start = _to_sec(m.group(1), m.group(2), m.group(3), m.group(4))
            current_end = _to_sec(m.group(5), m.group(6), m.group(7), m.group(8))
        elif line and not line.isdigit() and not line.startswith(("WEBVTT", "Kind:", "Language:")):
            # Strip inline VTT <c> / timestamp tags
            cleaned_line = re.sub(r"<[^>]+>", "", line).strip()
            if cleaned_line:
                lines_buf.append(cleaned_line)

    if current_start is not None and lines_buf:
        clean_txt = re.sub(r"\s+", " ", " ".join(lines_buf)).strip()
        if clean_txt and (not segments or segments[-1]["text"] != clean_txt):
            segments.append({
                "start": current_start,
                "end": current_end if (current_end and current_end > current_start) else round(current_start + 2.5, 3),
                "text": clean_txt,
            })

    return segments


def _pick_track_format(track_entries: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for preferred_ext in ("json3", "vtt"):
        for entry in track_entries:
            if entry.get("ext") == preferred_ext and entry.get("url"):
                return entry
    return None


def _select_original_caption_track(info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Pick the highest-fidelity ORIGINAL caption track (manual subtitles first, then
    original-language ASR). Strictly avoids selecting YouTube auto-translated tracks
    (where URL carries `tlang=...`) unless no source-language track exists and URL matches.
    """
    orig_lang_full = str(info.get("language") or "").strip()
    orig_lang_base = orig_lang_full.split("-")[0] if orig_lang_full else ""

    subtitles = info.get("subtitles") or {}
    manual_keys = [k for k in subtitles.keys() if k != "live_chat"]
    if manual_keys:
        ordered_keys: List[str] = []
        if orig_lang_full and orig_lang_full in subtitles:
            ordered_keys.append(orig_lang_full)
        if orig_lang_base and orig_lang_base in subtitles and orig_lang_base not in ordered_keys:
            ordered_keys.append(orig_lang_base)
        for k in manual_keys:
            if k not in ordered_keys:
                ordered_keys.append(k)

        for key in ordered_keys:
            fmt = _pick_track_format(subtitles.get(key) or [])
            if fmt:
                return {
                    "track_key": key,
                    "language_code": _normalize_lang_code(key),
                    "language_name": fmt.get("name") or _normalize_lang_code(key),
                    "is_auto_generated": False,
                    "caption_kind": "manual",
                    "ext": fmt.get("ext"),
                    "url": fmt.get("url"),
                }

    auto_caps = info.get("automatic_captions") or {}
    if auto_caps:
        candidate_keys: List[str] = []
        if orig_lang_full:
            for k in (f"{orig_lang_full}-orig", orig_lang_full, f"{orig_lang_base}-orig", orig_lang_base):
                if k and k in auto_caps and k not in candidate_keys:
                    candidate_keys.append(k)
        # Prefer '-orig' keys next
        for k in auto_caps.keys():
            if k.endswith("-orig") and k not in candidate_keys:
                candidate_keys.append(k)
        # Finally inspect remaining keys, ONLY keeping those without tlang= translation
        for k in auto_caps.keys():
            if k not in candidate_keys:
                candidate_keys.append(k)

        for key in candidate_keys:
            fmt = _pick_track_format(auto_caps.get(key) or [])
            if not fmt:
                continue
            url = str(fmt.get("url") or "")
            if _url_has_translation_param(url):
                continue
            return {
                "track_key": key,
                "language_code": _normalize_lang_code(key),
                "language_name": fmt.get("name") or _normalize_lang_code(key),
                "is_auto_generated": True,
                "caption_kind": "asr",
                "ext": fmt.get("ext"),
                "url": url,
            }

    return None


def _fallback_youtube_transcript_api(video_id: str, preferred_lang: Optional[str] = None) -> Optional[Dict[str, Any]]:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return None

    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        candidates = list(transcript_list)
        if not candidates:
            return None

        # Prefer manual over generated, and original/preferred language
        def _sort_key(t: Any):
            is_gen = 1 if getattr(t, "is_generated", True) else 0
            lang = getattr(t, "language_code", "") or ""
            lang_match = 0 if (preferred_lang and lang.startswith(preferred_lang)) else 1
            return (is_gen, lang_match)

        candidates.sort(key=_sort_key)
        chosen = candidates[0]
        fetched = chosen.fetch()
        raw_snippets = fetched.to_raw_data() if hasattr(fetched, "to_raw_data") else list(fetched)

        segments: List[Dict[str, Any]] = []
        for item in raw_snippets:
            txt = re.sub(r"\s+", " ", str(item.get("text", ""))).strip()
            if not txt:
                continue
            start = max(0.0, round(float(item.get("start", 0.0)), 3))
            dur = float(item.get("duration", 2.5) or 2.5)
            end = round(start + max(0.1, dur), 3)
            segments.append({"start": start, "end": end, "text": txt})

        if not segments:
            return None

        is_gen = bool(getattr(chosen, "is_generated", True))
        return {
            "language_code": getattr(chosen, "language_code", "unknown"),
            "language_name": getattr(chosen, "language", getattr(chosen, "language_code", "unknown")),
            "is_auto_generated": is_gen,
            "caption_kind": "asr" if is_gen else "manual",
            "provider": "youtube-transcript-api",
            "segments": segments,
        }
    except Exception as e:
        logger.warning(f"youtube-transcript-api fallback failed for {video_id}: {e}")
        return None


def extract_youtube_data(url_or_id: str) -> Dict[str, Any]:
    """
    Extract verified YouTube metadata and verbatim original-language captions.
    Returns structured status and metadata even when captions are unavailable or blocked.
    """
    vid = extract_youtube_video_id(url_or_id)
    if not vid:
        return {
            "success": False,
            "video_id": None,
            "title": None,
            "channel": None,
            "duration_seconds": None,
            "duration_source": None,
            "thumbnail_url": None,
            "video_language": None,
            "caption_language": None,
            "caption_language_name": None,
            "caption_kind": None,
            "is_auto_generated": False,
            "caption_provider": None,
            "extraction_status": "error",
            "error": f"Invalid YouTube URL or video ID: {url_or_id}",
            "segments": [],
        }

    canonical_url = f"https://www.youtube.com/watch?v={vid}"
    result: Dict[str, Any] = {
        "success": False,
        "video_id": vid,
        "title": None,
        "channel": None,
        "duration_seconds": None,
        "duration_source": None,
        "thumbnail_url": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
        "video_language": None,
        "caption_language": None,
        "caption_language_name": None,
        "caption_kind": None,
        "is_auto_generated": False,
        "caption_provider": None,
        "extraction_status": "unavailable",
        "error": None,
        "segments": [],
    }

    info: Optional[Dict[str, Any]] = None
    yt_dlp_error: Optional[str] = None

    try:
        import yt_dlp

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "socket_timeout": 15,
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(canonical_url, download=False)
    except Exception as e:
        yt_dlp_error = str(e)
        logger.warning(f"yt-dlp metadata extraction failed for {vid}: {yt_dlp_error}")

    if info:
        resolved_info_id = str(info.get("id") or vid)
        if resolved_info_id != vid:
            result["extraction_status"] = "error"
            result["caption_provider"] = "yt-dlp"
            result["error"] = f"Extracted YouTube metadata ID ({resolved_info_id}) does not match requested video ID ({vid})"
            return result
        result["video_id"] = resolved_info_id
        result["title"] = info.get("title") or None
        result["channel"] = info.get("channel") or info.get("uploader") or None
        if info.get("duration") is not None:
            result["duration_seconds"] = float(info["duration"])
            result["duration_source"] = "yt-dlp"
        if info.get("thumbnail"):
            result["thumbnail_url"] = str(info["thumbnail"])
        result["video_language"] = info.get("language") or None

        track = _select_original_caption_track(info)
        if track and track.get("url"):
            try:
                import httpx

                resp = httpx.get(track["url"], timeout=15.0, follow_redirects=True)
                if resp.status_code == 200 and resp.text.strip():
                    ext = track["ext"]
                    segments = (
                        _parse_json3_events(resp.json())
                        if ext == "json3"
                        else _parse_vtt_content(resp.text)
                    )
                    if segments:
                        result.update({
                            "success": True,
                            "caption_language": track["language_code"],
                            "caption_language_name": track["language_name"],
                            "caption_kind": track["caption_kind"],
                            "is_auto_generated": track["is_auto_generated"],
                            "caption_provider": f"yt-dlp:{ext}",
                            "extraction_status": "ready",
                            "error": None,
                            "segments": segments,
                        })
                        return result
                    result["error"] = f"Caption track {track['track_key']} ({ext}) returned 0 spoken cues"
                elif resp.status_code in (403, 429):
                    result["extraction_status"] = "blocked"
                    result["caption_provider"] = f"yt-dlp:{track['ext']}"
                    result["error"] = f"YouTube caption download restricted with HTTP {resp.status_code}"
                else:
                    result["error"] = f"YouTube caption download returned HTTP {resp.status_code}"
            except Exception as dl_err:
                result["error"] = f"Failed to fetch YouTube caption track: {dl_err}"
        else:
            result["error"] = "No manual or original-language automatic caption tracks exposed by YouTube"
            result["caption_provider"] = "yt-dlp"

    elif yt_dlp_error:
        lower_err = yt_dlp_error.lower()
        if any(tok in lower_err for tok in ("429", "403", "sign in", "bot", "private", "unavailable")):
            result["extraction_status"] = "blocked" if ("429" in lower_err or "403" in lower_err or "sign in" in lower_err or "bot" in lower_err) else "unavailable"
        else:
            result["extraction_status"] = "error"
        result["caption_provider"] = "yt-dlp"
        result["error"] = yt_dlp_error

    # Secondary fallback via youtube-transcript-api (only if yt-dlp did not succeed or wasn't hard-blocked as private)
    fallback_res = _fallback_youtube_transcript_api(vid, preferred_lang=result.get("video_language"))
    if fallback_res and fallback_res.get("segments"):
        result.update({
            "success": True,
            "caption_language": fallback_res["language_code"],
            "caption_language_name": fallback_res["language_name"],
            "caption_kind": fallback_res["caption_kind"],
            "is_auto_generated": fallback_res["is_auto_generated"],
            "caption_provider": fallback_res["provider"],
            "extraction_status": "ready",
            "error": None,
            "segments": fallback_res["segments"],
        })
        return result

    return result


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "https://youtu.be/za87oqLhGaI"
    out = extract_youtube_data(target)
    print(json.dumps({
        **{k: v for k, v in out.items() if k != "segments"},
        "segment_count": len(out.get("segments", [])),
        "sample_segments": out.get("segments", [])[:3],
        "tail_segment": out.get("segments", [])[-1] if out.get("segments") else None,
    }, ensure_ascii=False, indent=2))

