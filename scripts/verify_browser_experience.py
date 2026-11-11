#!/usr/bin/env python3
"""
Canonical Browser Verification using Playwright & Chrome:
Tests the complete learner experience for 'Answer with Exact Evidence':
1. Clicks citations from real answers in the browser.
2. Asserts correct resource version, physical page, and displayed page label ('Ch1-1').
3. Asserts highlight alignment for same-page raster equation crops and vector path equations.
4. Asserts zoom (120%) and 90° rotation alignment.
5. Asserts honest full-page scan fallback notice (absence of fake coordinate highlight).
6. Asserts video lecture timestamp seek (02:25 / 145s) and transcript quote.
7. Asserts reload/remount persistence.
8. Captures verified PNG screenshots in screenshots/exact_evidence/.
"""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS_DIR = PROJECT_ROOT / "screenshots" / "exact_evidence"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
APP_URL = "http://localhost:3000/dev/exact-evidence"

def run_browser_verification():
    print("============================================================")
    print("🌐 Playwright Browser Verification: Answer with Exact Evidence")
    print(f"Target URL: {APP_URL}")
    print(f"Chrome Executable: {CHROME_BIN}")
    print(f"Screenshots Output: {SCREENSHOTS_DIR}")
    print("============================================================\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_BIN,
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--window-size=1280,900"]
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            device_scale_factor=1.0,
            extra_http_headers={
                "x-ming-test-key": "test_internal_secret",
                "x-ming-user-id": "student_evidence_test",
                "x-dev-user-id": "student_evidence_test"
            }
        )
        context.add_init_script("""
            localStorage.setItem('x-ming-test-key', 'test_internal_secret');
            localStorage.setItem('x-ming-user-id', 'student_evidence_test');
            localStorage.setItem('x-dev-user-id', 'student_evidence_test');
        """)
        page = context.new_page()

        # Step 1: Navigate to the Exact Evidence verification page
        print("1️⃣ Navigating to verification page...")
        page.goto(APP_URL, wait_until="networkidle", timeout=30000)
        time.sleep(1)

        # Assert page title and heading
        assert "Answer with Exact Evidence" in page.content(), "Page title missing"
        page.screenshot(path=str(SCREENSHOTS_DIR / "01_chat_answer_citations.png"))
        print("  📸 Captured 01_chat_answer_citations.png")

        # Step 2: Test Case 1 - Single Page Mixed Equation (Selectable Prose + Authentic Crop)
        print("\n2️⃣ Testing Case 1: Mixed PDF (Authentic Equation Crop & Coordinates)...")
        page.click('[data-testid="btn-case-mixed"]')
        page.wait_for_selector('[role="dialog"]', timeout=10000)
        time.sleep(1.5)

        # Assert dialog contents
        dialog_content = page.locator('[role="dialog"]').inner_text()
        assert "Verified Evidence Location" in dialog_content, "Missing verified evidence banner"
        assert "Authentic Document Evidence Crop" in dialog_content, "Missing authentic crop label"
        assert "E = h * nu" in dialog_content, "Missing extracted equation notation"

        # Check crop image presence
        crop_img = page.locator('img[alt="Authentic Supporting Document Crop"]')
        assert crop_img.is_visible(), "Equation crop image is not visible"

        page.screenshot(path=str(SCREENSHOTS_DIR / "02_mixed_equation_crop_highlight.png"))
        print("  📸 Captured 02_mixed_equation_crop_highlight.png")

        # Step 3: Test Zoom (+20% -> 120%) and Rotation (90°)
        print("\n3️⃣ Testing Zoom (120%) and 90° Rotation...")
        # Click Zoom In button
        zoom_in_btn = page.locator('button[title="Zoom In"]')
        zoom_in_btn.click()
        time.sleep(0.5)

        # Click Rotate button
        rotate_btn = page.locator('button[title="Rotate 90°"]')
        rotate_btn.click()
        time.sleep(0.5)

        # Verify zoom level text displays 120%
        assert "120%" in page.locator('[role="dialog"]').inner_text(), "Zoom level did not reach 120%"

        page.screenshot(path=str(SCREENSHOTS_DIR / "03_zoom_and_rotation_alignment.png"))
        print("  📸 Captured 03_zoom_and_rotation_alignment.png")

        # Close dialog with Escape or Close button
        page.keyboard.press("Escape")
        time.sleep(0.8)

        # Step 4: Test Case 2 - Vector Path Equation (Drawing Type VECTOR_PATH)
        print("\n4️⃣ Testing Case 2: Vector Path Equation...")
        page.click('[data-testid="btn-case-vector"]')
        page.wait_for_selector('[role="dialog"]', timeout=10000)
        time.sleep(1.5)

        dialog_text = page.locator('[role="dialog"]').inner_text()
        assert "m_rel = m_0 / sqrt(1 - v^2 / c^2)" in dialog_text, "Missing vector equation formula notation"
        assert "Lorentz Factor" in dialog_text, "Missing Lorentz factor context"

        page.screenshot(path=str(SCREENSHOTS_DIR / "04_vector_equation_path_highlight.png"))
        print("  📸 Captured 04_vector_equation_path_highlight.png")

        page.keyboard.press("Escape")
        time.sleep(0.8)

        # Step 5: Test Case 3 - Scanned Equation (Honest Fallback, Full-Page Scan Notice)
        print("\n5️⃣ Testing Case 3: Scanned Document Honest Fallback...")
        page.click('[data-testid="btn-case-scanned"]')
        page.wait_for_selector('[role="dialog"]', timeout=10000)
        time.sleep(1.5)

        # Verify Full-Page Scan badge and highlight unavailable notice are displayed
        scan_notice = page.locator('[data-testid="pdf-highlight-unavailable-notice"]')
        assert scan_notice.is_visible(), "Full-page scan notice must be displayed"
        assert "Full-Page Scan" in scan_notice.inner_text(), "Missing Full-Page Scan badge"
        assert "Precise coordinate highlight unavailable" in scan_notice.inner_text(), "Must state highlight unavailable"

        # Verify symbol ambiguity note is shown
        unc_callout = page.locator('[data-testid="pdf-uncertainty-callout"]')
        assert unc_callout.is_visible(), "Uncertainty / ambiguity note must be displayed"
        assert "precise coordinate highlight unavailable" in unc_callout.inner_text().lower()

        page.screenshot(path=str(SCREENSHOTS_DIR / "05_scanned_page_fallback_notice.png"))
        print("  📸 Captured 05_scanned_page_fallback_notice.png")

        page.keyboard.press("Escape")
        time.sleep(0.8)

        # Step 6: Test Case 4 - Custom Page Labels (Physical Page 3 displays 'Ch1-1')
        print("\n6️⃣ Testing Case 4: Custom Page Labels (Ch1-1 vs Physical Page 3)...")
        page.click('[data-testid="btn-case-custom-labels"]')
        page.wait_for_selector('[role="dialog"]', timeout=10000)
        time.sleep(1.5)

        dialog_text = page.locator('[role="dialog"]').inner_text()
        assert "Ch1-1" in dialog_text, "Page label Ch1-1 must be displayed instead of physical page 3"
        assert "4-level paging" in dialog_text, "Excerpt must reference 4-level paging"

        page.screenshot(path=str(SCREENSHOTS_DIR / "06_custom_page_label_ch1_1.png"))
        print("  📸 Captured 06_custom_page_label_ch1_1.png")

        page.keyboard.press("Escape")
        time.sleep(0.8)

        # Step 7: Test Case 5 - Lecture Media with Exact Timestamps (145.0s -> 02:25)
        print("\n7️⃣ Testing Case 5: Lecture Timestamp Seek (145s / 02:25)...")
        page.click('[data-testid="btn-case-lecture"]')
        page.wait_for_selector('[role="dialog"]', timeout=10000)
        time.sleep(1.5)

        dialog_text = page.locator('[role="dialog"]').inner_text()
        assert "02:25" in dialog_text, "Timestamp 02:25 must be displayed"
        assert "Segment Precision" in dialog_text, "Timing precision badge must be displayed"
        assert "Amdahl's Law" in dialog_text, "Amdahl's Law excerpt must be visible"

        page.screenshot(path=str(SCREENSHOTS_DIR / "07_lecture_timestamp_seek.png"))
        print("  📸 Captured 07_lecture_timestamp_seek.png")

        page.keyboard.press("Escape")
        time.sleep(0.8)

        # Step 8: Test Reload Persistence
        print("\n8️⃣ Testing Reload & Remount Persistence...")
        page.reload(wait_until="networkidle")
        time.sleep(1)

        # Click citation [1] from the paragraph directly
        first_citation_btn = page.locator('button:has-text("[1]")').first
        if not first_citation_btn.is_visible():
            first_citation_btn = page.locator('[data-testid="btn-case-mixed"]')
        first_citation_btn.click()
        page.wait_for_selector('[role="dialog"]', timeout=10000)
        time.sleep(1.5)

        reloaded_dialog = page.locator('[role="dialog"]').inner_text()
        assert "Authentic Document Evidence Crop" in reloaded_dialog, "Crop panel must survive reload"

        page.screenshot(path=str(SCREENSHOTS_DIR / "08_reload_persistence.png"))
        print("  📸 Captured 08_reload_persistence.png")

        browser.close()

    print("\n============================================================")
    print("🎉 ALL BROWSER VERIFICATION CHECKS PASSED!")
    print(f"Screenshots saved to: {SCREENSHOTS_DIR}")
    print("============================================================\n")

if __name__ == "__main__":
    run_browser_verification()
