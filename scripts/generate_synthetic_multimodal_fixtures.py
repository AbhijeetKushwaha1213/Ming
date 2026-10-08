#!/usr/bin/env python3
"""
Generates synthetic representative multimodal test fixtures for Canonical Phase 2 testing.
Generates:
- text.pdf: Native text PDF
- scanned.pdf: Scanned document PDF (bitmap image page)
- mixed.pdf: Mixed PDF (Page 1 native text, Page 2 scanned)
- diagram.pdf: PDF with diagram and caption
- table_math.pdf: PDF with structured table and formulas
- sample.pptx: PowerPoint presentation with bullets, table, and speaker notes
- visual.pptx: Presentation with visual diagram shapes
- legacy.ppt: Binary OLE2 container presentation
- chart.png: Educational PNG image with text and diagram
- diagram.jpg: Educational JPEG image with text
- schema.webp: Educational WEBP image
- lecture.mp4: Valid synthetic MP4 video container
- lecture.wav: Valid PCM audio WAV file
- malformed.pdf: Corrupted/truncated file
- unsupported.xyz: Unsupported format
"""

import os
import io
import wave
import struct
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import pptx
from pptx.util import Inches, Pt

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "test_fixtures" / "multimodal"
os.makedirs(FIXTURES_DIR, exist_ok=True)

def create_simple_pdf_bytes(pages_text: list, images: list = None) -> bytes:
    """Creates a basic standard PDF without heavy external dependencies."""
    # We will use pypdf or minimal raw PDF syntax
    # Raw minimal PDF generator
    objects = []
    xref = []
    
    # Header
    pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    
    def add_object(content: bytes) -> int:
        nonlocal pdf
        obj_id = len(objects) + 1
        offset = len(pdf)
        xref.append(offset)
        obj_bytes = f"{obj_id} 0 obj\n".encode("latin1") + content + b"\nendobj\n"
        pdf += obj_bytes
        objects.append(obj_id)
        return obj_id

    # Font object
    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids = []
    for idx, text in enumerate(pages_text):
        # Escape parenthesis
        escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = (
            f"BT /F1 12 Tf 50 750 Td 14 TL "
            f"({escaped_text}) Tj ET"
        ).encode("latin1")
        
        contents_id = add_object(f"<< /Length {len(stream)} >>\nstream\n".encode("latin1") + stream + b"\nendstream")
        page_dict = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {contents_id} 0 R >>"
        ).encode("latin1")
        page_id = add_object(page_dict)
        page_ids.append(page_id)

    # Pages root
    kids_str = " ".join(f"{pid} 0 R" for pid in page_ids)
    pages_root_id = add_object(f"<< /Type /Pages /Kids [{kids_str}] /Count {len(page_ids)} >>".encode("latin1"))

    # Catalog root
    catalog_id = add_object(f"<< /Type /Catalog /Pages {pages_root_id} 0 R >>".encode("latin1"))

    # Xref & Trailer
    start_xref = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin1")
    for offset in xref:
        pdf += f"{offset:010d} 00000 n \n".encode("latin1")

    pdf += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
        f"startxref\n{start_xref}\n%%EOF\n"
    ).encode("latin1")

    return pdf

def generate_fixtures():
    print(f"Generating synthetic multimodal fixtures in {FIXTURES_DIR}...")

    # 1. Text PDF
    text_pdf_path = FIXTURES_DIR / "text.pdf"
    p1 = "Operating Systems and Virtual Memory Architecture. Virtual memory maps logical addresses to physical RAM using page tables."
    p2 = "Page replacement algorithms such as LRU, FIFO, and Clock algorithm manage page frames when working set exceeds available memory."
    with open(text_pdf_path, "wb") as f:
        f.write(create_simple_pdf_bytes([p1, p2]))

    # 2. Scanned PDF (Pure image rendered with PIL and saved as PDF)
    scanned_pdf_path = FIXTURES_DIR / "scanned.pdf"
    img_scan = Image.new("RGB", (600, 800), color=(255, 255, 255))
    draw_scan = ImageDraw.Draw(img_scan)
    draw_scan.text((50, 50), "Scanned Laboratory Notes: Optical Document Scanning Test", fill=(0, 0, 0))
    draw_scan.text((50, 100), "Experiment 4: Quantum Entanglement and Bell Inequality Violations", fill=(20, 20, 20))
    img_scan.save(str(scanned_pdf_path), "PDF", resolution=100.0)

    # 3. Mixed PDF (Page 1 native text, Page 2 scanned image)
    mixed_pdf_path = FIXTURES_DIR / "mixed.pdf"
    from pypdf import PdfWriter, PdfReader
    writer = PdfWriter()
    with open(text_pdf_path, "rb") as f_text:
        r_text = PdfReader(f_text)
        writer.add_page(r_text.pages[0])
    with open(scanned_pdf_path, "rb") as f_scan:
        r_scan = PdfReader(f_scan)
        writer.add_page(r_scan.pages[0])
    with open(mixed_pdf_path, "wb") as f_out:
        writer.write(f_out)

    # 4. Diagram PDF
    diagram_pdf_path = FIXTURES_DIR / "diagram.pdf"
    with open(diagram_pdf_path, "wb") as f:
        f.write(create_simple_pdf_bytes([
            "Neural Network Architectures. Figure 1: Convolutional Neural Network Feature Extraction Pipeline with Pooling."
        ]))

    # 5. Table & Equation PDF
    table_pdf_path = FIXTURES_DIR / "table_math.pdf"
    with open(table_pdf_path, "wb") as f:
        f.write(create_simple_pdf_bytes([
            "Mathematical Formulations: E = mc^2 and Shannon Entropy H(X) = -sum(p(x) * log2(p(x))). Table 1: Complexity Comparison Matrix."
        ]))

    # 6. Sample PPTX (Presentation with title, bullets, table, and speaker notes)
    sample_pptx_path = FIXTURES_DIR / "sample.pptx"
    prs = pptx.Presentation()
    # Slide 1: Title & Bullets
    slide_layout = prs.slide_layouts[1]
    s1 = prs.slides.add_slide(slide_layout)
    s1.shapes.title.text = "Distributed Systems Fundamentals"
    tf = s1.shapes.placeholders[1].text_frame
    tf.text = "Core Challenges in Distributed Computing"
    p = tf.add_paragraph()
    p.text = "Network Partitions and the CAP Theorem"
    p.level = 1
    p2 = tf.add_paragraph()
    p2.text = "Byzantine Fault Tolerance and Consensus"
    p2.level = 1
    s1.notes_slide.notes_text_frame.text = "Emphasize to students that network partitions are unavoidable in real WAN deployments."

    # Slide 2: Table
    s2 = prs.slides.add_slide(prs.slide_layouts[5])
    s2.shapes.title.text = "Database Isolation Levels"
    rows, cols = 3, 3
    table_shape = s2.shapes.add_table(rows, cols, Inches(1), Inches(2), Inches(6), Inches(2))
    table = table_shape.table
    table.cell(0, 0).text = "Level"
    table.cell(0, 1).text = "Dirty Read"
    table.cell(0, 2).text = "Phantom Read"
    table.cell(1, 0).text = "Read Committed"
    table.cell(1, 1).text = "Prevented"
    table.cell(1, 2).text = "Allowed"
    table.cell(2, 0).text = "Serializable"
    table.cell(2, 1).text = "Prevented"
    table.cell(2, 2).text = "Prevented"
    s2.notes_slide.notes_text_frame.text = "Quiz question next week will test the difference between Repeatable Read and Serializable."
    prs.save(str(sample_pptx_path))

    # 7. Visual PPTX (Presentation with shapes/diagrams)
    visual_pptx_path = FIXTURES_DIR / "visual.pptx"
    prs2 = pptx.Presentation()
    s_vis = prs2.slides.add_slide(prs2.slide_layouts[5])
    s_vis.shapes.title.text = "Microservices Event-Driven Architecture"
    shape = s_vis.shapes.add_shape(1, Inches(2), Inches(2), Inches(3), Inches(2))
    shape.name = "Diagram: Event Broker Flow"
    s_vis.notes_slide.notes_text_frame.text = "Explain the event broker message bus in the center of the diagram."
    prs2.save(str(visual_pptx_path))

    # 8. Legacy .ppt Binary Container (OLE2 Compound Document)
    legacy_ppt_path = FIXTURES_DIR / "legacy.ppt"
    ole_header = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 504
    # Append simulated legacy slide text records in UTF-16LE and ASCII
    legacy_content = (
        b"PowerPoint Document Record Stream\n"
        b"Legacy Slide 1: Introduction to Compilers and Lexical Analysis\n"
        b"Tokens, Lexemes, and Regular Expressions for Scanner Generation\n"
        b"Legacy Slide 2: Syntax Analysis and Context-Free Grammars\n"
        b"LL(1) and LR(1) Parsers with Shift-Reduce Operations\n"
    )
    with open(legacy_ppt_path, "wb") as f:
        f.write(ole_header + legacy_content)

    # 9. Educational PNG image with text
    chart_png_path = FIXTURES_DIR / "chart.png"
    img = Image.new("RGB", (600, 300), color=(240, 245, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 580, 280], outline=(40, 80, 150), width=3)
    draw.text((40, 40), "Algorithm Time Complexity Comparison", fill=(20, 30, 40))
    draw.text((40, 80), "QuickSort: O(N log N) Average Case", fill=(30, 60, 100))
    draw.text((40, 120), "BubbleSort: O(N^2) Quadratic Time", fill=(150, 40, 30))
    draw.text((40, 160), "Binary Search: O(log N) Logarithmic Time", fill=(20, 120, 40))
    img.save(str(chart_png_path), format="PNG", description="Algorithmic Big-O Complexity Comparison Chart")

    # 10. Educational JPEG image
    diagram_jpg_path = FIXTURES_DIR / "diagram.jpg"
    img_jpg = Image.new("RGB", (500, 300), color=(255, 255, 255))
    draw_jpg = ImageDraw.Draw(img_jpg)
    draw_jpg.rectangle([30, 30, 470, 270], outline=(100, 100, 100), width=2)
    draw_jpg.text((50, 50), "TCP Three-Way Handshake Diagram", fill=(0, 0, 0))
    draw_jpg.text((50, 100), "Client -> SYN -> Server", fill=(0, 50, 150))
    draw_jpg.text((50, 150), "Server -> SYN-ACK -> Client", fill=(150, 50, 0))
    draw_jpg.text((50, 200), "Client -> ACK -> Server (Established)", fill=(0, 120, 50))
    img_jpg.save(str(diagram_jpg_path), format="JPEG", comment=b"TCP Handshake Protocol Architecture")

    # 11. Educational WEBP image
    schema_webp_path = FIXTURES_DIR / "schema.webp"
    img_webp = Image.new("RGB", (400, 250), color=(235, 240, 235))
    draw_webp = ImageDraw.Draw(img_webp)
    draw_webp.text((30, 30), "Relational Schema Normalization: 1NF, 2NF, 3NF, BCNF", fill=(10, 40, 10))
    img_webp.save(str(schema_webp_path), format="WEBP")

    # 12. Short Video: Valid MP4 container with ftypisom
    video_mp4_path = FIXTURES_DIR / "lecture.mp4"
    # Minimal ISO Base Media File Format (MP4) structure
    ftyp_box = struct.pack(">I4s4sI", 24, b"ftyp", b"isom", 512) + b"isomiso2mp41"
    moov_box = struct.pack(">I4s", 8, b"moov")
    mdat_box = struct.pack(">I4s", 16, b"mdat") + b"sample_video_payload"
    with open(video_mp4_path, "wb") as f:
        f.write(ftyp_box + moov_box + mdat_box)

    # 13. Short Audio: Valid WAV PCM file
    audio_wav_path = FIXTURES_DIR / "lecture.wav"
    sample_rate = 8000
    duration_s = 2.0
    num_frames = int(sample_rate * duration_s)
    with wave.open(str(audio_wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        # Generate silence/tone bytes
        audio_data = struct.pack(f"<{num_frames}h", *([0] * num_frames))
        w.writeframes(audio_data)

    # 14. Malformed PDF (corrupt non-text magic bytes)
    malformed_path = FIXTURES_DIR / "malformed.pdf"
    with open(malformed_path, "wb") as f:
        f.write(b"\x00\x01\x02\x03\xff\xfe\x07\x08\x00\x11\x22\x33")

    # 15. Unsupported file (.xyz)
    unsupported_path = FIXTURES_DIR / "unsupported.xyz"
    with open(unsupported_path, "wb") as f:
        f.write(b"UNKNOWN_PROPRIETARY_BINARY_PAYLOAD")

    print(f"Successfully generated all 15 multimodal fixtures in {FIXTURES_DIR}")

if __name__ == "__main__":
    generate_fixtures()
