#!/usr/bin/env python3
"""
Generates representative local multimodal fixtures for Canonical Exact Evidence verification:
1. single_page_mixed_equation.pdf: Single PDF page with selectable prose AND embedded raster-image equation with surrounding definitions.
2. vector_equation.pdf: Equation drawn using PDF vector graphics paths (radical & fraction stroke lines).
3. scanned_equation.pdf: Scanned document page with optical symbol ambiguity.
4. custom_page_labels.pdf: PDF where physical page indices (1, 2, 3, 4) differ from displayed labels (i, ii, Ch1-1, Ch1-2).
5. lecture_exact_timestamps.mp4 & lecture_transcript.json: Lecture with known transcript segment timestamps.

All synthetic fixtures are clearly labeled with independent expected results.
"""

import os
import io
import json
import base64
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter, PdfReader
from pypdf.generic import DictionaryObject, NameObject, NumberObject, ArrayObject, create_string_object

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "test_fixtures" / "exact_evidence"
os.makedirs(FIXTURES_DIR, exist_ok=True)

def create_raster_equation_image(formula_text: str = "E = h \\nu", width=500, height=120) -> bytes:
    """Creates a raster image containing rendered mathematical notation."""
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Border
    draw.rectangle([2, 2, width - 3, height - 3], outline=(200, 210, 225), width=2)
    # Background tint
    draw.rectangle([4, 4, width - 5, height - 5], fill=(248, 250, 252))
    
    # Text
    draw.text((25, 20), "Authentic Raster Equation Crop [Formula 1.1]:", fill=(100, 116, 139))
    draw.text((50, 55), formula_text, fill=(15, 23, 42))
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def generate_fixtures():
    print(f"Generating Canonical Exact Evidence Fixtures in {FIXTURES_DIR}...")
    expected_results = {}

    # =========================================================================
    # 1. Single Page Mixed PDF (Selectable Prose + Embedded Raster Equation)
    # =========================================================================
    mixed_path = FIXTURES_DIR / "single_page_mixed_equation.pdf"
    
    # Create embedded raster formula PNG
    eq_png_bytes = create_raster_equation_image("E = h * nu   (Photon Energy Relation)")
    eq_img = Image.open(io.BytesIO(eq_png_bytes))

    # PDF with 1 page containing selectable text and the embedded image
    writer1 = PdfWriter()
    p1 = writer1.add_blank_page(width=612, height=792)

    prose_stream = (
        b"BT /F1 12 Tf 50 730 Td 14 TL "
        b"(Synthetic Grounding Fixture: Single-Page Mixed Multimodal Physics Document.) Tj T* "
        b"(In quantum electrodynamics, photon energy is proportional to electromagnetic radiation frequency.) Tj T* "
        b"(The fundamental relation governing discrete quanta is expressed as:) Tj T* T* T* T* T* T* "
        b"(where E is photon energy in Joules, h denotes Planck constant, and nu is frequency in Hertz.) Tj ET\n"
    )

    # Embed raster image as XObject
    img_name = "ImEq1"
    writer1.add_page(p1)
    
    # We can use pypdf or a clean direct stream assembly to ensure image XObject is bound
    # Clean PDF generation with native image insertion
    pdf_bytes_writer = PdfWriter()
    page = pdf_bytes_writer.add_blank_page(width=612, height=792)
    
    # Add image to page
    pdf_bytes_writer.pages[0].new_image = None
    
    # Save image to temp and load with pypdf or reportlab/raw PDF
    # Direct PDF generation with embedded image XObject
    raw_mixed_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> "
        b"/Contents 6 0 R >> endobj\n"
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"5 0 obj << /Type /XObject /Subtype /Image /Width 500 /Height 120 /ColorSpace /DeviceRGB "
        b"/BitsPerComponent 8 /Filter /DCTDecode /Length " + str(len(eq_png_bytes)).encode('ascii') + b" >>\nstream\n"
        + eq_png_bytes + b"\nendstream\nendobj\n"
        b"6 0 obj << /Length 380 >>\nstream\n"
        b"BT /F1 12 Tf 50 730 Td 14 TL "
        b"(Synthetic Grounding Fixture: Single-Page Mixed Multimodal Physics Document.) Tj T* "
        b"(In quantum electrodynamics, photon energy is proportional to electromagnetic radiation frequency.) Tj T* "
        b"(The fundamental relation governing discrete quanta is expressed as:) Tj ET\n"
        b"q 350 0 0 84 50 560 cm /Im1 Do Q\n"
        b"BT /F1 12 Tf 50 520 Td 14 TL "
        b"(where E is photon energy in Joules, h denotes Planck constant, and nu is frequency in Hertz.) Tj ET\n"
        b"endstream\nendobj\n"
        b"xref\n0 7\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000266 00000 n \n"
        b"0000000336 00000 n \n"
        b"0000000450 00000 n \n"
        b"trailer << /Size 7 /Root 1 0 R >>\nstartxref\n880\n%%EOF\n"
    )
    
    # Use pypdf to normalize and write robustly
    try:
        reader_tmp = PdfReader(io.BytesIO(raw_mixed_pdf))
        writer_norm = PdfWriter()
        writer_norm.add_page(reader_tmp.pages[0])
        with open(mixed_path, "wb") as f:
            writer_norm.write(f)
    except Exception:
        # Fallback to direct bytes
        with open(mixed_path, "wb") as f:
            f.write(raw_mixed_pdf)

    expected_results["single_page_mixed_equation.pdf"] = {
        "fixture_label": "SYNTHETIC: Single-Page Mixed Multimodal PDF",
        "description": "Page 1 contains selectable text prose and parameter definitions, with an embedded raster equation image in between.",
        "physical_page": 1,
        "displayed_page_label": "1",
        "prose_evidence": "In quantum electrodynamics, photon energy is proportional to electromagnetic radiation frequency.",
        "parameter_definitions": "where E is photon energy in Joules, h denotes Planck constant, and nu is frequency in Hertz.",
        "drawing_type": "EMBEDDED_RASTER",
        "equation_notation": "E = h * nu",
        "target_question": "What equation relates photon energy to frequency, and what are its variables?",
        "expected_answer_claim": "Photon energy is given by E = h * nu, where E is energy in Joules, h is Planck constant, and nu is frequency.",
        "expected_citation_coordinates": {
            "page_number": 1,
            "has_precise_coordinates": True,
            "evidence_type": "EQUATION"
        }
    }

    # =========================================================================
    # 2. Vector Path Equation PDF (Drawn with lines and curves, not raster)
    # =========================================================================
    vec_path = FIXTURES_DIR / "vector_equation.pdf"
    
    # In PDF, radical square root symbol and fraction line drawn with vector path operators (m, l, S)
    vec_content_stream = (
        b"BT /F1 12 Tf 50 740 Td 14 TL "
        b"(Synthetic Grounding Fixture: Vector Graphics Path Mathematical Formulation.) Tj T* "
        b"(The relativistic mass of a moving particle increases with velocity relative to the speed of light:) Tj T* "
        b"(Formula 2.1: Relativistic Mass with Lorentz Factor) Tj ET\n"
        b"BT /F1 12 Tf 50 670 Td (m_rel = ) Tj ET\n"
        b"BT /F1 12 Tf 110 682 Td (m_0) Tj ET\n"
        # Fraction division line drawn via vector path
        b"100 675 m 190 675 l 1.5 w S\n"
        # Radical square root sign drawn via vector path
        b"105 658 m 110 658 l 115 645 l 122 668 l 190 668 l 1.5 w S\n"
        b"BT /F1 12 Tf 125 652 Td (1 - v^2 / c^2) Tj ET\n"
        b"BT /F1 12 Tf 50 610 Td 14 TL "
        b"(where m_0 is rest mass, v is particle velocity, and c is the speed of light in vacuum.) Tj ET\n"
    )

    raw_vec_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> "
        b"/Contents 5 0 R >> endobj\n"
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"5 0 obj << /Length " + str(len(vec_content_stream)).encode('ascii') + b" >>\nstream\n"
        + vec_content_stream + b"\nendstream\nendobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000216 00000 n \n"
        b"0000000286 00000 n \n"
        b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n600\n%%EOF\n"
    )

    try:
        reader_tmp = PdfReader(io.BytesIO(raw_vec_pdf))
        writer_vec = PdfWriter()
        writer_vec.add_page(reader_tmp.pages[0])
        with open(vec_path, "wb") as f:
            writer_vec.write(f)
    except Exception:
        with open(vec_path, "wb") as f:
            f.write(raw_vec_pdf)

    expected_results["vector_equation.pdf"] = {
        "fixture_label": "SYNTHETIC: Vector Graphics Path Equation PDF",
        "description": "Page 1 contains an equation whose fraction bar and square root radical are rendered strictly through PDF vector path drawing operators (m, l, S).",
        "physical_page": 1,
        "displayed_page_label": "1",
        "drawing_type": "VECTOR_PATH",
        "extraction_method": "VECTOR_GRAPHICS",
        "prose_evidence": "The relativistic mass of a moving particle increases with velocity relative to the speed of light",
        "equation_notation": "m_rel = m_0 / sqrt(1 - v^2 / c^2)",
        "parameter_definitions": "where m_0 is rest mass, v is particle velocity, and c is the speed of light in vacuum.",
        "target_question": "What is the formula for relativistic mass, and how is it defined?",
        "expected_answer_claim": "Relativistic mass is given by m_rel = m_0 / sqrt(1 - v^2 / c^2), where m_0 is rest mass and c is speed of light."
    }

    # =========================================================================
    # =========================================================================
    # 3. Scanned Multimodal PDF (Two-Column Multiline, Equation with Ambiguity,
    #    Rotated Page, and Degraded Archival Fallback Scan)
    # =========================================================================
    scanned_path = FIXTURES_DIR / "scanned_equation.pdf"
    writer_scanned = PdfWriter()

    # --- Page 1: Two Columns with Multiline Passage (Col 1) & Ambiguous Equation (Col 2) ---
    img1 = Image.new("RGB", (650, 850), color=(252, 252, 250))
    d1 = ImageDraw.Draw(img1)
    d1.rectangle([(10, 10), (640, 840)], outline=(210, 215, 220), width=2)
    d1.text((30, 25), "Archival Manuscript Page 104 - Spectroscopy and Wave Mechanics", fill=(20, 25, 30))
    d1.text((30, 48), "Two-Column Historical Scientific Typeset Archive", fill=(80, 90, 100))
    d1.line([(30, 72), (620, 72)], fill=(180, 190, 200), width=1)
    
    # Column Gutter dividing line
    d1.line([(325, 85), (325, 800)], fill=(215, 220, 225), width=1)

    # Column 1: Wave Mechanics Multiline Passage (3 lines)
    d1.text((35, 95), "COLUMN 1: WAVE PROPAGATION", fill=(70, 80, 95))
    d1.text((35, 125), "Electromagnetic disturbance dynamics:", fill=(30, 35, 45))
    d1.text((35, 155), "In wave mechanics and spectroscopy,", fill=(20, 25, 30))
    d1.text((35, 190), "radiation is characterized by wave vectors", fill=(20, 25, 30))
    d1.text((35, 225), "and spatial frequency in dispersive media.", fill=(20, 25, 30))
    d1.text((35, 270), "Spatial periodicity is quantified by wave", fill=(50, 55, 65))
    d1.text((35, 295), "numbers per unit distance across fronts.", fill=(50, 55, 65))

    # Column 2: Scanned Equation with Ambiguity & Nearby Definitions
    d1.text((345, 95), "COLUMN 2: OPTICAL WAVENUMBER", fill=(70, 80, 95))
    d1.text((345, 125), "Mathematical formulation in vacuum:", fill=(30, 35, 45))
    
    # Equation Box in Column 2 (Authentic Visual Crop Target)
    d1.rectangle([(345, 150), (615, 260)], fill=(244, 246, 249), outline=(190, 200, 215), width=2)
    d1.text((365, 180), "FORMULA (104.2):", fill=(90, 100, 115))
    d1.text((380, 210), "~nu = 1 / lambda", fill=(10, 15, 25))
    
    # Ambiguity note in Column 2
    d1.text((345, 280), "Optical Symbol Ambiguity Warning:", fill=(180, 60, 20))
    d1.text((345, 305), "In older archival typography, symbol ~nu", fill=(70, 75, 85))
    d1.text((345, 325), "may resemble tilde nu (wavenumber) or", fill=(70, 75, 85))
    d1.text((345, 345), "nu_0 (threshold frequency). Inspect crop.", fill=(70, 75, 85))
    d1.text((345, 385), "where lambda denotes vacuum wavelength.", fill=(30, 35, 45))

    p1_layout = {
        "page_layout": "TWO_COLUMN",
        "blocks": [
            {
                "block_id": "p1_col1_wave_passage",
                "block_type": "TEXT",
                "text": "In wave mechanics and spectroscopy, radiation is characterized by wave vectors and spatial frequency in dispersive media. Spatial periodicity is quantified by wave numbers per unit distance across fronts.",
                "regions": [
                    {"x": 5.0, "y": 18.0, "width": 42.0, "height": 3.2, "unit": "percent"},
                    {"x": 5.0, "y": 22.0, "width": 42.0, "height": 3.2, "unit": "percent"},
                    {"x": 5.0, "y": 26.0, "width": 39.0, "height": 3.2, "unit": "percent"}
                ],
                "confidence": 0.98,
                "localization_confidence": 0.98,
                "uncertainty_score": 0.0,
                "uncertainty_note": None
            },
            {
                "block_id": "p1_col2_wavenumber_eq",
                "block_type": "EQUATION",
                "text": "Spectroscopic wavenumber formulation: ~nu = 1 / lambda where lambda denotes vacuum wavelength. In older archival typography, symbol ~nu may resemble tilde nu (wavenumber) or nu_0 (threshold frequency).",
                "equation_notation": "~nu = 1 / lambda",
                "surrounding_context": "Spectroscopic wavenumber is mathematically defined by the relationship ~nu = 1 / lambda where lambda denotes vacuum wavelength in meters.",
                "regions": [
                    {"x": 54.0, "y": 17.5, "width": 41.0, "height": 13.0, "unit": "percent"}
                ],
                "crop_box_percent": {"x": 53.0, "y": 17.0, "width": 42.5, "height": 14.0},
                "confidence": 0.88,
                "localization_confidence": 0.96,
                "uncertainty_score": 0.45,
                "uncertainty_note": "Optical symbol ambiguity detected in scanned notation (~nu vs nu_0); inspect original visual evidence crop."
            }
        ]
    }
    buf1 = io.BytesIO()
    img1.save(buf1, format="JPEG", comment=json.dumps(p1_layout).encode("utf-8"))
    buf1.seek(0)
    pdf_buf1 = io.BytesIO()
    Image.open(buf1).save(pdf_buf1, "PDF", resolution=100.0)
    pdf_buf1.seek(0)
    writer_scanned.add_page(PdfReader(pdf_buf1).pages[0])

    # --- Page 2: Rotated Page (90° Clockwise) ---
    img2 = Image.new("RGB", (650, 850), color=(252, 252, 250))
    d2 = ImageDraw.Draw(img2)
    d2.rectangle([(10, 10), (640, 840)], outline=(210, 215, 220), width=2)
    d2.text((40, 40), "Planck Black-Body Radiation Law (Rotated Orientation Archive)", fill=(20, 25, 30))
    d2.line([(40, 70), (610, 70)], fill=(180, 190, 200), width=1)
    d2.text((40, 120), "Planck's radiation law describes spectral energy density of black-body radiation", fill=(30, 35, 45))
    d2.text((40, 150), "at absolute temperature T. Spectral energy distribution across wavelengths satisfies", fill=(30, 35, 45))
    d2.text((40, 180), "the Planck distribution function.", fill=(30, 35, 45))

    p2_layout = {
        "page_layout": "ROTATED_90",
        "blocks": [
            {
                "block_id": "p2_planck_radiation",
                "block_type": "TEXT",
                "text": "Planck's radiation law describes spectral energy density of black-body radiation at absolute temperature T. Spectral energy distribution across wavelengths satisfies the Planck distribution function.",
                "unrotated_regions": [
                    {"x": 6.0, "y": 14.0, "width": 88.0, "height": 4.5, "unit": "percent"},
                    {"x": 6.0, "y": 18.0, "width": 88.0, "height": 4.5, "unit": "percent"}
                ],
                "confidence": 0.95,
                "localization_confidence": 0.95,
                "uncertainty_score": 0.0,
                "uncertainty_note": None
            }
        ]
    }
    buf2 = io.BytesIO()
    img2.save(buf2, format="JPEG", comment=json.dumps(p2_layout).encode("utf-8"))
    buf2.seek(0)
    pdf_buf2 = io.BytesIO()
    Image.open(buf2).save(pdf_buf2, "PDF", resolution=100.0)
    pdf_buf2.seek(0)
    p2_page = writer_scanned.add_page(PdfReader(pdf_buf2).pages[0])
    p2_page.rotate(90)

    # --- Page 3: Degraded Archival Scan (Honest Fallback) ---
    img3 = Image.new("RGB", (650, 850), color=(240, 238, 232))
    d3 = ImageDraw.Draw(img3)
    # Faded degraded styling
    d3.rectangle([(10, 10), (640, 840)], outline=(195, 190, 180), width=1)
    d3.text((40, 40), "Archival Fragment 3: Degraded Manuscript (Optical Fading)", fill=(120, 115, 105))
    d3.line([(40, 70), (610, 70)], fill=(190, 185, 175), width=1)
    d3.text((40, 130), "Archival Fragment 3: Degraded historical manuscript with severe ink bleeding.", fill=(100, 95, 85))
    d3.text((40, 160), "Line localization confidence is below reliable threshold.", fill=(100, 95, 85))

    p3_layout = {
        "page_layout": "DEGRADED_SCAN",
        "blocks": [
            {
                "block_id": "p3_degraded",
                "block_type": "TEXT",
                "text": "Archival Fragment 3: Degraded historical manuscript with severe ink bleeding. Line localization confidence is below reliable threshold.",
                "degraded": True,
                "localization_confidence": 0.35,
                "confidence": 0.60,
                "uncertainty_score": 0.40,
                "uncertainty_note": "Scanned document page 3: degraded archival scan; precise coordinate highlight unavailable."
            }
        ]
    }
    buf3 = io.BytesIO()
    img3.save(buf3, format="JPEG", comment=json.dumps(p3_layout).encode("utf-8"))
    buf3.seek(0)
    pdf_buf3 = io.BytesIO()
    Image.open(buf3).save(pdf_buf3, "PDF", resolution=100.0)
    pdf_buf3.seek(0)
    writer_scanned.add_page(PdfReader(pdf_buf3).pages[0])

    with open(scanned_path, "wb") as f:
        writer_scanned.write(f)

    expected_results["scanned_equation.pdf"] = {
        "fixture_label": "SYNTHETIC: Scanned Multimodal Document PDF (3 Pages)",
        "description": "Multi-page raster scan: Page 1 has 2 columns (multiline passage in Col 1, ambiguous equation in Col 2); Page 2 is rotated 90 deg; Page 3 is degraded archival fallback.",
        "pages_count": 3,
        "page_1_two_column": {
            "col1_passage": {
                "text": "In wave mechanics and spectroscopy, radiation is characterized by wave vectors and spatial frequency in dispersive media.",
                "regions_count": 3,
                "has_precise_coordinates": True,
                "localization_confidence": 0.98,
                "uncertainty_score": 0.0,
                "column_confined": "x <= 48%"
            },
            "col2_equation": {
                "text": "Spectroscopic wavenumber formulation: ~nu = 1 / lambda",
                "equation_notation": "~nu = 1 / lambda",
                "regions_count": 1,
                "has_precise_coordinates": True,
                "localization_confidence": 0.96,
                "uncertainty_score": 0.45,
                "uncertainty_note": "Optical symbol ambiguity detected in scanned notation (~nu vs nu_0); inspect original visual evidence crop.",
                "column_confined": "x >= 53%"
            }
        },
        "page_2_rotated": {
            "page_rotation": 90,
            "has_precise_coordinates": True,
            "localization_confidence": 0.95,
            "regions_count": 2
        },
        "page_3_degraded": {
            "has_precise_coordinates": False,
            "bounding_box": None,
            "regions": None,
            "localization_confidence": None,
            "uncertainty_note": "Scanned document page 3: degraded archival scan; precise coordinate highlight unavailable.",
            "expected_ui_behavior": "Displays Full-Page Scan notice without drawing an invented highlight overlay."
        },
        "target_question": "What is the formula for spectroscopic wavenumber in the archival manuscript?",
        "expected_answer_claim": "Spectroscopic wavenumber is given by ~nu = 1 / lambda, where lambda is vacuum wavelength."
    }

    # =========================================================================
    # 4. Custom Page Labels PDF (Different Physical Pages vs Displayed Labels)
    # =========================================================================
    custom_labels_path = FIXTURES_DIR / "custom_page_labels.pdf"
    
    writer_cl = PdfWriter()
    
    # Page 1: Preface / Roman 'i'
    p1 = writer_cl.add_blank_page(width=612, height=792)
    # Page 2: Table of Contents / Roman 'ii'
    p2 = writer_cl.add_blank_page(width=612, height=792)
    # Page 3: Chapter 1 / Displayed label 'Ch1-1'
    p3 = writer_cl.add_blank_page(width=612, height=792)
    # Page 4: Chapter 1 Page 2 / Displayed label 'Ch1-2'
    p4 = writer_cl.add_blank_page(width=612, height=792)

    # Add text to each page
    pages_content = [
        "Synthetic Grounding Fixture: Preliminary Preface. Displayed Page Label: i. Overview of Kernel Memory Subsystems.",
        "Table of Contents: Displayed Page Label: ii. Chapter 1: Paging and Multi-Level Translation.",
        "Chapter 1: Multi-Level Page Table Translation. Displayed Page Label: Ch1-1. Physical Page: 3. In 64-bit architectures, 4-level paging maps 48-bit linear addresses to physical frames.",
        "Translation Lookaside Buffers (TLB). Displayed Page Label: Ch1-2. Physical Page: 4. TLB caches recent translations to reduce memory bus latency."
    ]

    # Rebuild with content streams
    writer_cl2 = PdfWriter()
    for idx, text in enumerate(pages_content, start=1):
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 50 740 Td 14 TL ({escaped}) Tj ET".encode('latin1')
        
        # We can construct minimal page objects
        temp_pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
            b"5 0 obj << /Length " + str(len(stream)).encode('ascii') + b" >>\nstream\n"
            + stream + b"\nendstream\nendobj\n"
            b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \n0000000286 00000 n \n"
            b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n500\n%%EOF\n"
        )
        r = PdfReader(io.BytesIO(temp_pdf))
        writer_cl2.add_page(r.pages[0])

    # Configure /PageLabels tree in Catalog
    nums = ArrayObject()
    
    # Physical index 0 (Page 1 & 2): Roman numerals 'i', 'ii'
    d_roman = DictionaryObject()
    d_roman[NameObject('/S')] = NameObject('/r')
    nums.append(NumberObject(0))
    nums.append(d_roman)

    # Physical index 2 (Page 3 & 4): Decimal with prefix 'Ch1-'
    d_ch1 = DictionaryObject()
    d_ch1[NameObject('/S')] = NameObject('/D')
    d_ch1[NameObject('/P')] = create_string_object('Ch1-')
    nums.append(NumberObject(2))
    nums.append(d_ch1)

    labels_dict = DictionaryObject()
    labels_dict[NameObject('/Nums')] = nums
    writer_cl2._root_object[NameObject('/PageLabels')] = labels_dict

    with open(custom_labels_path, "wb") as f:
        writer_cl2.write(f)

    expected_results["custom_page_labels.pdf"] = {
        "fixture_label": "SYNTHETIC: Custom Page Labels PDF",
        "description": "Multi-page document where physical pages 1..4 have displayed labels i, ii, Ch1-1, Ch1-2.",
        "pages": [
            {"physical_index": 1, "displayed_label": "i", "topic": "Preface"},
            {"physical_index": 2, "displayed_label": "ii", "topic": "Table of Contents"},
            {"physical_index": 3, "displayed_label": "Ch1-1", "topic": "Multi-Level Page Table Translation"},
            {"physical_index": 4, "displayed_label": "Ch1-2", "topic": "Translation Lookaside Buffers"}
        ],
        "target_question": "How does 64-bit multi-level paging map linear addresses, and on what page is this documented?",
        "expected_answer_claim": "64-bit architectures utilize 4-level paging to map 48-bit linear addresses to physical frames.",
        "expected_physical_page": 3,
        "expected_displayed_label": "Ch1-1"
    }

    # =========================================================================
    # 5. Lecture Media with Known Transcript Timestamps
    # =========================================================================
    lecture_path = FIXTURES_DIR / "lecture_exact_timestamps.mp4"
    # Copy from multimodal/lecture.mp4
    src_mp4 = FIXTURES_DIR.parent / "multimodal" / "lecture.mp4"
    if src_mp4.exists():
        with open(src_mp4, "rb") as f_in, open(lecture_path, "wb") as f_out:
            f_out.write(f_in.read())
    else:
        # Create minimal 1-second video container
        with open(lecture_path, "wb") as f_out:
            f_out.write(b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2avc1mp41\x00\x00\x00\x08free")

    lecture_transcript = [
        {
            "segment_id": "seg_01",
            "start": 12.0,
            "end": 28.0,
            "text": "Synthetic Grounding Fixture: Welcome to Advanced Operating Systems. Today we analyze multi-level paging and hardware MMU translation.",
            "evidence_type": "TRANSCRIPT",
            "timing_precision": "SEGMENT"
        },
        {
            "segment_id": "seg_02",
            "start": 145.0,
            "end": 180.0,
            "text": "The professor emphasizes: Amdahl's Law defines the maximum theoretical speedup achievable by parallelizing a fixed workload across multi-core processors: S_latency = 1 / ((1 - p) + p / s).",
            "evidence_type": "TRANSCRIPT",
            "timing_precision": "SEGMENT"
        },
        {
            "segment_id": "seg_03_visual_frame",
            "start": 160.0,
            "end": 165.0,
            "text": "On-screen slide diagram displays formula: Speedup(s) = 1 / ((1 - p) + p/s)",
            "evidence_type": "VIDEO_FRAME",
            "timing_precision": "FRAME"
        }
    ]

    with open(FIXTURES_DIR / "lecture_transcript.json", "w") as f:
        json.dump(lecture_transcript, f, indent=2)

    expected_results["lecture_exact_timestamps.mp4"] = {
        "fixture_label": "SYNTHETIC: Lecture Media with Known Transcript Timestamps",
        "description": "Video lecture with verified audio transcript segments and on-screen slide frame OCR.",
        "segments": lecture_transcript,
        "target_question": "What formula defines the maximum theoretical speedup in parallel processors according to the lecture?",
        "expected_answer_claim": "Amdahl's Law states that theoretical speedup is S_latency = 1 / ((1 - p) + p / s).",
        "expected_timestamp_start": 145.0,
        "expected_timestamp_end": 180.0,
        "expected_timing_precision": "SEGMENT",
        "expected_evidence_type": "TRANSCRIPT"
    }

    # Save complete EXPECTED_RESULTS.json
    with open(FIXTURES_DIR / "EXPECTED_RESULTS.json", "w") as f:
        json.dump(expected_results, f, indent=2)

    print(f"Successfully generated all 5 exact evidence fixtures and EXPECTED_RESULTS.json in {FIXTURES_DIR}")

if __name__ == "__main__":
    generate_fixtures()

