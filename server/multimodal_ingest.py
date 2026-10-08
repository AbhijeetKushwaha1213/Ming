#!/usr/bin/env python3
"""
Canonical Phase 2: Unified Multimodal Ingestion Pipeline
Integrates:
- Secure File Validation
- Media Extractors (PDF, PPT/PPTX, Standalone Images, Video/Audio)
- IngestionDocument normalization
- Structural Semantic Chunking
- 19-Field Provenance Tracking
- SHA-256 Idempotency
- Vector Store Insertion (pgvector & Chroma)
- Performance Latency Benchmarking
"""

import os
import sys
import time
import hashlib
import json
import logging
from typing import Dict, Any, Optional, List

# Ensure server directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from file_validator import validate_file, FileValidationError
from pdf_extractor import extract_pdf_blocks
from pptx_extractor import extract_pptx_blocks
from image_extractor import extract_image_blocks
from transcription import extract_transcription_blocks
from semantic_chunker import chunk_document_blocks
from ingestion_models import IngestionDocument, ContentBlock, SemanticChunk
from vector_store import get_vector_store

logger = logging.getLogger("multimodal_ingest")

def compute_file_sha256(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def ingest_multimodal_document(
    file_path: str,
    user_id: str,
    tenant_type: str = "USER_PRIVATE",
    source_type_hint: Optional[str] = None,
    declared_filename: Optional[str] = None,
    source_id: Optional[str] = None,
    document_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    topic: Optional[str] = None,
    subtopic: Optional[str] = None,
    custom_transcript: Optional[str] = None,
    force_reprocess: bool = False
) -> Dict[str, Any]:
    """
    Executes the complete canonical Phase 2 multimodal ingestion workflow.
    """
    t_start_total = time.time()
    metrics: Dict[str, float] = {}

    # 1. Validation
    t0 = time.time()
    validation_info = validate_file(file_path, declared_filename=declared_filename)
    metrics["validation_latency_ms"] = round((time.time() - t0) * 1000, 2)

    media_type = validation_info["media_type"]
    source_type = validation_info["source_type"]
    mime_type = validation_info["mime_type"]
    file_size = validation_info["size_bytes"]
    filename = declared_filename or os.path.basename(file_path)

    # 2. Compute Content Hash
    content_hash = compute_file_sha256(file_path)

    doc_id = document_id or f"doc_{user_id}_{content_hash[:12]}"
    src_id = source_id or f"src_{user_id}_{content_hash[:12]}"
    res_id = resource_id or doc_id

    # 3. Extract Content Blocks
    t0 = time.time()
    blocks: List[ContentBlock] = []

    if media_type == "PDF":
        blocks = extract_pdf_blocks(file_path)
    elif media_type in ("PPTX", "PPT"):
        blocks = extract_pptx_blocks(file_path)
    elif media_type in ("PNG", "JPEG", "WEBP"):
        blocks = extract_image_blocks(file_path, mime_type=mime_type)
    elif media_type in ("MP4", "WEBM", "MP3", "WAV"):
        blocks = extract_transcription_blocks(file_path, mime_type=mime_type, custom_transcript=custom_transcript, topic=topic)
    elif media_type == "TEXT":
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            txt = f.read()
        blocks = [ContentBlock(
            block_id=f"txt_1",
            block_type="TEXT",
            text=txt,
            extraction_method="NATIVE_TEXT",
            confidence=1.0,
            metadata={"file_name": filename}
        )]
    else:
        raise FileValidationError(f"Unsupported media type for ingestion: {media_type}", code="UNSUPPORTED_TYPE")

    metrics["extraction_latency_ms"] = round((time.time() - t0) * 1000, 2)

    # 4. Semantic Chunking with Full Provenance
    t0 = time.time()
    chunks = chunk_document_blocks(
        blocks=blocks,
        user_id=user_id,
        tenant_type=tenant_type,
        resource_id=res_id,
        document_id=doc_id,
        source_id=src_id,
        source_type=source_type,
        content_hash=content_hash
    )
    metrics["chunking_latency_ms"] = round((time.time() - t0) * 1000, 2)

    # 5. Check Idempotency against Vector Store
    vector_store = get_vector_store()
    is_idempotent_existing = False

    if not force_reprocess and chunks:
        try:
            first_chunk_id = chunks[0].chunk_id
            chunk_check = vector_store.get_chunk(first_chunk_id)
            if chunk_check and chunk_check.get("found"):
                meta = chunk_check.get("metadata", {})
                if meta.get("user_id") == user_id:
                    is_idempotent_existing = True
        except Exception:
            pass

    # 6. Embed and Insert into Vector Store (if not idempotent duplicate or forced)
    t0 = time.time()
    inserted_count = 0
    if chunks and (not is_idempotent_existing or force_reprocess):
        # Clean up prior records if force_reprocess
        if force_reprocess:
            try:
                vector_store.delete_by(user_id=user_id, source_id=src_id)
            except Exception:
                pass

        # Prepare payload conforming to BaseVectorStore.add_documents
        chunks_payload = []
        for c in chunks:
            meta = c.provenance.to_dict()
            if topic:
                meta["topic"] = topic
            if subtopic:
                meta["subtopic"] = subtopic
            chunks_payload.append({
                "id": c.chunk_id,
                "text": c.text,
                "metadata": meta
            })

        vector_store.add_documents(chunks_payload)
        inserted_count = len(chunks)

    metrics["vector_insertion_latency_ms"] = round((time.time() - t0) * 1000, 2)
    metrics["total_latency_ms"] = round((time.time() - t_start_total) * 1000, 2)

    # 7. Build normalized IngestionDocument
    lifecycle_status = "COMPLETED"
    if not chunks:
        lifecycle_status = "PARTIAL"

    doc = IngestionDocument(
        document_id=doc_id,
        source_id=src_id,
        resource_id=res_id,
        user_id=user_id,
        tenant_type=tenant_type,
        title=filename,
        source_type=source_type,
        mime_type=mime_type,
        file_size=file_size,
        content_hash=content_hash,
        lifecycle_status=lifecycle_status,
        blocks=blocks,
        chunks=chunks,
        metadata={
            "declared_filename": filename,
            "media_type": media_type,
            "topic": topic,
            "subtopic": subtopic,
            "is_idempotent_existing": is_idempotent_existing,
            "inserted_count": inserted_count,
            "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        metrics=metrics,
        error=None
    )

    return doc.to_dict()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Multimodal Ingestion Pipeline")
    parser.add_argument("--file", required=True, help="Path to input file")
    parser.add_argument("--user-id", required=True, help="Authenticated user ID")
    parser.add_argument("--tenant-type", default="USER_PRIVATE", help="Tenant type")
    parser.add_argument("--source-id", default=None, help="Source resource ID")
    parser.add_argument("--document-id", default=None, help="Document ID")
    parser.add_argument("--topic", default=None, help="Curriculum topic")
    parser.add_argument("--subtopic", default=None, help="Curriculum subtopic")
    parser.add_argument("--transcript", default=None, help="Custom transcript text or subtitles")
    parser.add_argument("--force-reprocess", action="store_true", help="Force re-extraction and re-embedding")

    args = parser.parse_args()
    try:
        res = ingest_multimodal_document(
            file_path=args.file,
            user_id=args.user_id,
            tenant_type=args.tenant_type,
            source_id=args.source_id,
            document_id=args.document_id,
            topic=args.topic,
            subtopic=args.subtopic,
            custom_transcript=args.transcript,
            force_reprocess=args.force_reprocess
        )
        print(json.dumps(res, indent=2))
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        err_res = {
            "lifecycle_status": "FAILED",
            "error": str(e),
            "file": args.file
        }
        print(json.dumps(err_res))
        sys.exit(1)
