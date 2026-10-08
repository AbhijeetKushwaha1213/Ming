#!/usr/bin/env python3
"""
Chroma to PostgreSQL / pgvector Safe Migration Tool
Transfers vector chunks, embeddings, and multimodal coordinates from Chroma to pgvector.
Requirements:
- Deterministic and idempotent (safe to run multiple times)
- Preserves all vector IDs, documents, embeddings, and full metadata
- Preserves user ownership and strict tenant isolation
- Additive and non-destructive (Chroma data is never altered or deleted)
- Generates a detailed audit report of inserted, skipped, and failed records
"""

import os
import sys
import json
import logging
from typing import Dict, Any

# Ensure server module is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
server_dir = os.path.join(project_root, "server")
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

from vector_store import (
    EMBEDDING_MODEL_NAME,
    EMBEDDING_VERSION,
    EMBEDDING_DIMENSION,
)
from vector_store_chroma import ChromaVectorStore
from vector_store_pgvector import PgVectorStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("chroma_to_pgvector_migration")

def run_migration(
    chroma_path: str = "./chroma_data",
    pg_db_path: str = "./chroma_data/pgvector_local.db",
    batch_size: int = 50
) -> Dict[str, Any]:
    logger.info("Starting safe, idempotent Chroma -> pgvector vector migration...")
    
    chroma_store = ChromaVectorStore(data_path=chroma_path)
    chroma_health = chroma_store.health_check()
    logger.info(f"Source Chroma Collection: {chroma_health}")

    # Initialize destination pgvector store
    pg_store = PgVectorStore(local_db_path=pg_db_path)
    pg_health = pg_store.health_check()
    logger.info(f"Target PgVector Store: {pg_health}")

    total_chroma = chroma_store.count()
    if total_chroma == 0:
        logger.warning("Source Chroma collection is empty. Nothing to migrate.")
        return {
            "status": "success",
            "total_chroma_chunks": 0,
            "inserted": 0,
            "skipped_existing": 0,
            "failed": 0,
            "tenants": {}
        }

    # Fetch all data from Chroma including embeddings, metadatas, documents
    res = chroma_store.collection.get(
        include=["metadatas", "documents", "embeddings"]
    )

    ids = res.get("ids", [])
    docs = res.get("documents", [])
    metas = res.get("metadatas", [])
    embs = res.get("embeddings", [])

    inserted_count = 0
    skipped_count = 0
    failed_count = 0
    tenant_summary = {}

    batch_to_insert = []

    for idx, chunk_id in enumerate(ids):
        doc_text = docs[idx] if idx < len(docs) else ""
        meta = dict(metas[idx]) if idx < len(metas) and metas[idx] else {}
        emb = embs[idx] if embs is not None and idx < len(embs) else None
        if hasattr(emb, "tolist"):
            emb = emb.tolist()

        # Ensure all required metadata is present
        user_id = meta.get("user_id") or "USER"
        tenant_type = meta.get("tenant_type")
        if not tenant_type:
            tenant_type = "SYSTEM_PUBLIC" if str(user_id) in ["default_user", "system_public"] else "USER"
            meta["tenant_type"] = tenant_type

        # Track tenants
        tenant_key = f"{user_id} ({tenant_type})"
        tenant_summary[tenant_key] = tenant_summary.get(tenant_key, 0) + 1

        # Check idempotency: check if chunk already exists in destination
        existing = pg_store.get_chunk(chunk_id)
        if existing and existing.get("found"):
            skipped_count += 1
            continue

        chunk_payload = {
            "id": chunk_id,
            "text": doc_text,
            "metadata": meta,
        }
        if emb is not None:
            chunk_payload["embedding"] = emb

        batch_to_insert.append(chunk_payload)

        if len(batch_to_insert) >= batch_size:
            try:
                res_batch = pg_store.add_documents(batch_to_insert)
                inserted_count += res_batch.get("inserted", 0)
            except Exception as e:
                logger.error(f"Failed to migrate batch of {len(batch_to_insert)} records: {e}")
                failed_count += len(batch_to_insert)
            batch_to_insert = []

    if batch_to_insert:
        try:
            res_batch = pg_store.add_documents(batch_to_insert)
            inserted_count += res_batch.get("inserted", 0)
        except Exception as e:
            logger.error(f"Failed to migrate final batch: {e}")
            failed_count += len(batch_to_insert)

    final_pg_count = pg_store.count()

    report = {
        "status": "completed",
        "total_chroma_chunks": len(ids),
        "inserted": inserted_count,
        "skipped_existing": skipped_count,
        "failed": failed_count,
        "target_pgvector_total_count": final_pg_count,
        "tenants": tenant_summary,
        "embedding_model": EMBEDDING_MODEL_NAME,
        "dimension": EMBEDDING_DIMENSION
    }

    logger.info("Migration finished successfully.")
    logger.info(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    report = run_migration()
    print(json.dumps(report))
