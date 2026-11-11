#!/usr/bin/env python3
"""
Generate Ordinary Image-Only Scanned PDFs for Provider Verification
- No embedded OCR layout structures (for raw scans)
- No JPEG comments or image descriptions
- No annotations or expected text streams
- Includes:
  1. raw_paragraph_scan.pdf (clean single paragraph on Hawking entropy)
  2. raw_unequal_two_column_scan.pdf (narrow left column 27.7%, wide right column 50.8%)
  3. raw_equation_scan.pdf (polytropic equation P = K * rho^(5/3) with prose)
  4. raw_malformed_metadata_scan.pdf (deliberate out-of-page x=150% coordinates to test rejection)
- External expected results dictionary stored independently in EXPECTED_RAW_RESULTS.json
"""

import io
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter, PdfReader

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_SCANS_DIR = BASE_DIR / "test_fixtures" / "exact_evidence" / "raw_scans"
RAW_SCANS_DIR.mkdir(parents=True, exist_ok=True)

def create_image_only_pdf(pil_img: Image.Image, output_path: Path, comment_bytes: bytes = None):
    buf = io.BytesIO()
    if comment_bytes:
        pil_img.save(buf, format="JPEG", comment=comment_bytes)
    else:
        # Save clean PNG without comments or metadata
        pil_img.save(buf, format="PNG")
    buf.seek(0)

    # Convert image to pure raster PDF
    pdf_buf = io.BytesIO()
    clean_img = Image.open(buf)
    clean_img.save(pdf_buf, format="PDF", resolution=100.0)
    pdf_buf.seek(0)

    writer = PdfWriter()
    reader = PdfReader(pdf_buf)
    writer.add_page(reader.pages[0])
    with open(output_path, "wb") as f:
        writer.write(f)

def generate_fixtures():
    expected_results = {}

    # =========================================================================
    # 1. Clean Single Paragraph Scan
    # =========================================================================
    w1, h1 = 600, 800
    img1 = Image.new("RGB", (w1, h1), color=(250, 250, 248))
    d1 = ImageDraw.Draw(img1)
    # Subtle page border
    d1.rectangle([(15, 15), (w1 - 15, h1 - 15)], outline=(220, 220, 215), width=1)
    d1.text((50, 50), "Thermodynamics of Quantum Black Holes", fill=(25, 25, 30))
    d1.line([(50, 80), (550, 80)], fill=(200, 200, 195), width=1)

    # Paragraph lines: x = 50 to 550 (x = 8.33% to 91.67%, width = 83.33%)
    # y = 130 to 240 (y = 16.25% to 30.0%, height = 13.75%)
    d1.text((50, 130), "Hawking radiation and black hole thermodynamics establish", fill=(40, 40, 45))
    d1.text((50, 160), "that black hole entropy is strictly proportional to the area", fill=(40, 40, 45))
    d1.text((50, 190), "of its event horizon divided by four Planck areas.", fill=(40, 40, 45))
    d1.text((50, 220), "The proportionality constant is fundamental across quantum gravity.", fill=(40, 40, 45))

    pdf1_path = RAW_SCANS_DIR / "raw_paragraph_scan.pdf"
    create_image_only_pdf(img1, pdf1_path)

    expected_results["raw_paragraph_scan.pdf"] = {
        "fixture_label": "RAW: Clean Paragraph Scan",
        "description": "Pure raster scan without embedded text or metadata.",
        "expected_provider": "Gemini Multimodal Vision (gemini-2.5-flash)",
        "layout_type": "SINGLE_COLUMN",
        "independent_expected_regions": [
            {
                "description": "Black hole entropy paragraph",
                "expected_x_min_percent": 5.0,
                "expected_x_max_percent": 95.0,
                "expected_y_min_percent": 12.0,
                "expected_y_max_percent": 35.0,
                "expected_width_min_percent": 70.0,
                "expected_text_substring": "proportional to the area of its event horizon"
            }
        ],
        "target_question": "What is black hole entropy proportional to according to Hawking radiation?",
        "expected_answer_claim": "Black hole entropy is strictly proportional to the area of its event horizon divided by four Planck areas."
    }

    # =========================================================================
    # 2. Unequal Two-Column Scan
    # =========================================================================
    w2, h2 = 650, 850
    img2 = Image.new("RGB", (w2, h2), color=(252, 252, 250))
    d2 = ImageDraw.Draw(img2)
    d2.rectangle([(15, 15), (w2 - 15, h2 - 15)], outline=(220, 220, 215), width=1)
    d2.text((40, 40), "Astrophysical Degeneracy in Compact Objects", fill=(20, 20, 25))
    d2.line([(40, 70), (610, 70)], fill=(195, 195, 190), width=1)

    # Narrow Left Column: x = 40 to 220 (width = 180px -> 27.7%)
    # x_percent: 6.15% to 33.85%
    d2.text((40, 100), "Column 1: Fundamentals", fill=(30, 30, 35))
    d2.text((40, 130), "Degeneracy pressure", fill=(50, 50, 55))
    d2.text((40, 150), "arises from Pauli", fill=(50, 50, 55))
    d2.text((40, 170), "exclusion in compact", fill=(50, 50, 55))
    d2.text((40, 190), "stellar remnants.", fill=(50, 50, 55))

    # Gutter: x = 220 to 270 (gutter width = 50px -> 7.7%)

    # Wide Right Column: x = 270 to 610 (width = 340px -> 52.3%)
    # x_percent: 41.54% to 93.85%
    d2.text((270, 100), "Column 2: Relativistic Equations of State", fill=(30, 30, 35))
    d2.text((270, 130), "In the ultra-relativistic regime, the equation of state", fill=(50, 50, 55))
    d2.text((270, 150), "transitions such that pressure scales with density to", fill=(50, 50, 55))
    d2.text((270, 170), "the four-thirds power: P = K * rho^(4/3).", fill=(50, 50, 55))
    d2.text((270, 200), "This soft equation of state sets the Chandrasekhar limit.", fill=(50, 50, 55))

    pdf2_path = RAW_SCANS_DIR / "raw_unequal_two_column_scan.pdf"
    create_image_only_pdf(img2, pdf2_path)

    expected_results["raw_unequal_two_column_scan.pdf"] = {
        "fixture_label": "RAW: Unequal Two-Column Scan",
        "description": "Pure raster scan with unequal column widths (Col 1: 27.7%, Col 2: 52.3%). Proves column boundaries come from layout.",
        "expected_provider": "Gemini Multimodal Vision (gemini-2.5-flash)",
        "layout_type": "TWO_COLUMN",
        "independent_expected_regions": [
            {
                "description": "Column 1 Narrow Text (Fundamentals)",
                "column_index": 1,
                "expected_x_min_percent": 4.0,
                "expected_x_max_percent": 35.0,
                "expected_width_max_percent": 32.0,
                "expected_text_substring": "Degeneracy pressure arises from Pauli exclusion"
            },
            {
                "description": "Column 2 Wide Text (Relativistic EoS)",
                "column_index": 2,
                "expected_x_min_percent": 38.0,
                "expected_x_max_percent": 96.0,
                "expected_width_min_percent": 40.0,
                "expected_text_substring": "pressure scales with density to the four-thirds power"
            }
        ],
        "gutter_boundary_rule": "Column 1 lines must never exceed x = 36%; Column 2 lines must never start below x = 38%. Strictly non-bridging.",
        "target_question": "What principle causes degeneracy pressure in compact stellar remnants?",
        "expected_answer_claim": "Degeneracy pressure arises from Pauli exclusion in compact stellar remnants."
    }

    # =========================================================================
    # 3. Scanned Equation Scan with Surrounding Prose
    # =========================================================================
    w3, h3 = 600, 800
    img3 = Image.new("RGB", (w3, h3), color=(251, 251, 249))
    d3 = ImageDraw.Draw(img3)
    d3.rectangle([(15, 15), (w3 - 15, h3 - 15)], outline=(220, 220, 215), width=1)
    d3.text((45, 45), "Degenerate Fermi Gas Dynamics", fill=(20, 20, 25))
    d3.line([(45, 75), (555, 75)], fill=(195, 195, 190), width=1)

    # Prose before equation
    d3.text((45, 110), "For a completely degenerate non-relativistic Fermi gas,", fill=(45, 45, 50))
    d3.text((45, 135), "the hydrostatic degeneracy pressure satisfies the polytrope:", fill=(45, 45, 50))

    # Prominent Equation Box: x = 120 to 480, y = 175 to 225
    d3.rectangle([(100, 170), (500, 230)], outline=(190, 190, 185), fill=(245, 245, 240), width=1)
    d3.text((180, 190), "P = K * rho^(5/3)", fill=(10, 10, 15))

    # Prose after equation
    d3.text((45, 260), "where K is a constant determined by the electron-to-nucleon ratio.", fill=(45, 45, 50))
    d3.text((45, 285), "This balances inward gravitational collapse in stable white dwarfs.", fill=(45, 45, 50))

    pdf3_path = RAW_SCANS_DIR / "raw_equation_scan.pdf"
    create_image_only_pdf(img3, pdf3_path)

    expected_results["raw_equation_scan.pdf"] = {
        "fixture_label": "RAW: Scanned Equation with Surrounding Prose",
        "description": "Pure raster scan with prose and an equation block P = K * rho^(5/3).",
        "expected_provider": "Gemini Multimodal Vision (gemini-2.5-flash)",
        "independent_expected_regions": [
            {
                "description": "Equation Box",
                "expected_type": "EQUATION",
                "expected_x_min_percent": 15.0,
                "expected_x_max_percent": 85.0,
                "expected_y_min_percent": 20.0,
                "expected_y_max_percent": 32.0,
                "expected_notation_contains": "rho"
            }
        ],
        "target_question": "What is the non-relativistic polytropic equation for degeneracy pressure?",
        "expected_answer_claim": "The hydrostatic degeneracy pressure satisfies P = K * rho^(5/3)."
    }

    # =========================================================================
    # 4. Malformed Metadata Scan (Coordinate Validation Rejection)
    # =========================================================================
    w4, h4 = 600, 800
    img4 = Image.new("RGB", (w4, h4), color=(250, 248, 245))
    d4 = ImageDraw.Draw(img4)
    d4.rectangle([(15, 15), (w4 - 15, h4 - 15)], outline=(220, 215, 210), width=1)
    d4.text((40, 40), "Archival Manuscript with Corrupted Coordinate Metadata", fill=(100, 40, 40))
    d4.text((40, 80), "This document tests coordinate validation. Its embedded metadata contains", fill=(50, 50, 50))
    d4.text((40, 110), "out-of-bounds coordinates (x=150%) and negative dimensions.", fill=(50, 50, 50))

    # Deliberately corrupted / malformed coordinates in metadata
    malformed_layout = {
        "page_layout": "CORRUPTED_METADATA",
        "blocks": [
            {
                "block_id": "malformed_block_1",
                "block_type": "TEXT",
                "text": "Archival text with impossible out-of-bounds bounding box coordinates.",
                "regions": [
                    # Out of bounds: x = 150%, width = 40% (x + width = 190% > 100.5%)
                    {"x": 150.0, "y": 20.0, "width": 40.0, "height": 10.0, "unit": "percent"}
                ],
                "confidence": 0.95,
                "localization_confidence": 0.99
            },
            {
                "block_id": "malformed_block_2",
                "block_type": "TEXT",
                "text": "Second block with negative coordinate.",
                "regions": [
                    {"x": -25.0, "y": 40.0, "width": 50.0, "height": 8.0, "unit": "percent"}
                ],
                "confidence": 0.90
            }
        ]
    }
    malformed_comment = json.dumps(malformed_layout).encode("utf-8")
    pdf4_path = RAW_SCANS_DIR / "raw_malformed_metadata_scan.pdf"
    create_image_only_pdf(img4, pdf4_path, comment_bytes=malformed_comment)

    expected_results["raw_malformed_metadata_scan.pdf"] = {
        "fixture_label": "MALFORMED: Embedded Out-of-Bounds Coordinates",
        "description": "Scanned document with corrupt metadata (x=150% and x=-25%). Tests strict coordinate validation.",
        "expected_provider": "PAGE_ONLY_FALLBACK (Honest Degradation)",
        "expected_validation_result": "REJECTED",
        "has_precise_coordinates": False,
        "bounding_box": None,
        "regions": None,
        "expected_uncertainty_note_contains": "coordinate validation failed"
    }

    # Save external expected results JSON
    expected_json_path = RAW_SCANS_DIR / "EXPECTED_RAW_RESULTS.json"
    with open(expected_json_path, "w") as f:
        json.dump(expected_results, f, indent=2)

    print(f"Generated 4 raw scan fixtures and EXPECTED_RAW_RESULTS.json in {RAW_SCANS_DIR}")
    for k in expected_results:
        print(f" - {k}: {expected_results[k]['fixture_label']}")

if __name__ == "__main__":
    generate_fixtures()

