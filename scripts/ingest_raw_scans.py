#!/usr/bin/env python3
"""
Ingest Raw Scanned PDFs into ChromaDB and SQLite resources table.
Registers:
- doc_raw_para (raw_paragraph_scan.pdf)
- doc_raw_col (raw_unequal_two_column_scan.pdf)
- doc_raw_eq (raw_equation_scan.pdf)
- doc_raw_malformed (raw_malformed_metadata_scan.pdf)
"""

import sys
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "server"))

from server.multimodal_ingest import ingest_multimodal_document
from server.vector_store import get_vector_store

RAW_SCANS_DIR = BASE_DIR / "test_fixtures" / "exact_evidence" / "raw_scans"
DB_PATH = BASE_DIR / "prisma" / "dev.db"
TEST_USER = "student_evidence_test"

def register_sqlite_resource(doc_id: str, title: str, file_path: Path):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO resources (id, userId, title, type, fileUrl, storagePath, tagsJson)
        VALUES (?, ?, ?, 'PDF', ?, ?, '["RAW_SCAN", "EXACT_EVIDENCE"]')
    """, (doc_id, TEST_USER, title, f"/api/resources/{doc_id}/file", str(file_path.resolve())))
    conn.commit()
    conn.close()
    print(f"[+] Registered resource {doc_id} in SQLite: {title}")

def main():
    print("============================================================")
    print("Ingesting 4 Raw Scanned PDFs for Provider Verification")
    print("============================================================\n")

    fixtures = [
        ("doc_raw_para", "src_raw_para", "raw_paragraph_scan.pdf", "Black Hole Thermodynamics", "Bekenstein-Hawking Entropy"),
        ("doc_raw_col", "src_raw_col", "raw_unequal_two_column_scan.pdf", "Astrophysical Degeneracy", "Pauli Exclusion & Relativistic EoS"),
        ("doc_raw_eq", "src_raw_eq", "raw_equation_scan.pdf", "Fermi Gas Dynamics", "Non-Relativistic Polytrope"),
        ("doc_raw_malformed", "src_raw_malformed", "raw_malformed_metadata_scan.pdf", "Archival Manuscripts", "Corrupted Metadata Test")
    ]

    for doc_id, src_id, filename, topic, subtopic in fixtures:
        pdf_path = RAW_SCANS_DIR / filename
        register_sqlite_resource(doc_id, filename, pdf_path)
        print(f"\n--- Ingesting {filename} via Multimodal Ingestion Pipeline ---")
        doc_res = ingest_multimodal_document(
            file_path=str(pdf_path),
            user_id=TEST_USER,
            tenant_type="USER_PRIVATE",
            source_id=src_id,
            document_id=doc_id,
            topic=topic,
            subtopic=subtopic,
            force_reprocess=True
        )
        print(f"Status: {doc_res.get('lifecycle_status')}, Chunks: {len(doc_res.get('chunks', []))}, Blocks: {len(doc_res.get('blocks', []))}")

    print("\n============================================================")
    print("Ingestion of All Raw Scanned PDFs Completed Successfully!")
    print("============================================================")

if __name__ == "__main__":
    main()

