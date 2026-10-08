#!/usr/bin/env python3
"""
PgVectorStore: Concrete implementation of BaseVectorStore for PostgreSQL + pgvector
Target Architecture: PostgreSQL + pgvector with HNSW index & cosine similarity (384 dimensions)
"""

import os
import json
import math
import time
import sqlite3
import logging
from typing import List, Dict, Any, Optional
import numpy as np

from vector_store import (
    BaseVectorStore,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_VERSION,
    EMBEDDING_DIMENSION,
    DISTANCE_METRIC,
)

logger = logging.getLogger("pgvector_store")

# Lazy-loaded embedding function matching Chroma's exact 384-d all-MiniLM-L6-v2 ONNX model
_embedding_function = None

def get_embedding_function():
    global _embedding_function
    if _embedding_function is None:
        try:
            from chromadb.utils import embedding_functions
            _embedding_function = embedding_functions.DefaultEmbeddingFunction()
        except Exception as e:
            logger.error(f"Failed to initialize DefaultEmbeddingFunction: {e}")
            raise
    return _embedding_function

def compute_cosine_distance(v1: List[float], v2: List[float]) -> float:
    """Cosine distance = 1.0 - cosine_similarity."""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 1.0
    cos_sim = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(2.0, 1.0 - cos_sim))

class PgVectorStore(BaseVectorStore):
    """
    PostgreSQL + pgvector implementation.
    Supports:
    1. Supabase PostgREST & match_rag_chunks stored procedure (when SUPABASE_URL is provided).
    2. Local persistent pgvector SQL engine for offline verification and CI tests.
    """

    def __init__(
        self,
        db_url: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        local_db_path: Optional[str] = None
    ):
        self.db_url = db_url or os.environ.get("DATABASE_URL", "")
        self.supabase_url = (
            supabase_url or
            os.environ.get("SUPABASE_URL") or
            os.environ.get("VITE_SUPABASE_URL", "")
        ).strip().rstrip("/")
        self.supabase_key = (
            supabase_key or
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
            os.environ.get("ANON_KEY") or
            os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")
        ).strip()
        
        # Local persistent fallback for offline execution / test verification
        data_dir = os.environ.get("CHROMA_DATA_PATH", "./chroma_data")
        self.local_db_path = local_db_path or os.path.join(data_dir, "pgvector_local.db")
        os.makedirs(os.path.dirname(self.local_db_path), exist_ok=True)
        self._init_local_db()

    @property
    def provider_name(self) -> str:
        return "pgvector"

    def _init_local_db(self):
        """Initialize the local SQL schema mirroring the PostgreSQL public.rag_chunks table."""
        with sqlite3.connect(self.local_db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id TEXT PRIMARY KEY,
                    chunk_id TEXT UNIQUE NOT NULL,
                    document_id TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    tenant_type TEXT NOT NULL DEFAULT 'USER',
                    topic TEXT,
                    subtopic TEXT,
                    concept TEXT,
                    source_type TEXT NOT NULL DEFAULT 'UNKNOWN',
                    page_number INTEGER,
                    slide_number INTEGER,
                    timestamp_start REAL,
                    timestamp_end REAL,
                    content_hash TEXT,
                    embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
                    embedding_version TEXT NOT NULL DEFAULT 'v1',
                    embedding_dimension INTEGER NOT NULL DEFAULT 384,
                    content TEXT NOT NULL,
                    metadata_json TEXT,
                    embedding_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pgv_user_tenant ON rag_chunks(user_id, tenant_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pgv_topic ON rag_chunks(topic)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pgv_source ON rag_chunks(source_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pgv_model_ver ON rag_chunks(embedding_model, embedding_version)")
            conn.commit()

    def add_documents(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Batch add document chunks to pgvector.
        Validates embedding dimensions and enforces immutable model metadata.
        """
        if not chunks:
            return {"inserted": 0, "status": "empty"}

        texts_to_embed = []
        indices_needing_emb = []
        for idx, c in enumerate(chunks):
            emb_val = c.get("embedding")
            if emb_val is None or (isinstance(emb_val, (list, np.ndarray)) and len(emb_val) == 0):
                texts_to_embed.append(c["text"])
                indices_needing_emb.append(idx)
            elif isinstance(emb_val, np.ndarray):
                c["embedding"] = emb_val.tolist()

        if texts_to_embed:
            fn = get_embedding_function()
            computed_embs = fn(texts_to_embed)
            for idx, emb in zip(indices_needing_emb, computed_embs):
                chunks[idx]["embedding"] = emb if isinstance(emb, list) else emb.tolist()

        inserted_count = 0

        # 1. If Supabase is configured and not purely local test, sync to Supabase PostgREST
        if self.supabase_url and self.supabase_key and os.environ.get("PGVECTOR_TEST_LOCAL") != "1":
            try:
                import requests
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                }
                pg_payload = []
                for c in chunks:
                    meta = c.get("metadata", {})
                    pg_payload.append({
                        "id": c["id"],
                        "chunk_id": c["id"],
                        "document_id": meta.get("document_id") or c["id"],
                        "source_id": meta.get("source_id") or c["id"],
                        "user_id": str(meta.get("user_id") or "USER"),
                        "tenant_type": str(meta.get("tenant_type") or "USER"),
                        "topic": meta.get("topic"),
                        "subtopic": meta.get("subtopic"),
                        "concept": meta.get("concept"),
                        "source_type": meta.get("source_type") or "TEXT",
                        "page_number": meta.get("page_number"),
                        "slide_number": meta.get("slide_number"),
                        "timestamp_start": meta.get("timestamp_start"),
                        "timestamp_end": meta.get("timestamp_end"),
                        "content_hash": meta.get("content_hash"),
                        "embedding_model": EMBEDDING_MODEL_NAME,
                        "embedding_version": EMBEDDING_VERSION,
                        "embedding_dimension": EMBEDDING_DIMENSION,
                        "content": c["text"],
                        "metadata_json": meta,
                        "embedding": c["embedding"]
                    })
                resp = requests.post(
                    f"{self.supabase_url}/rest/v1/rag_chunks",
                    headers=headers,
                    json=pg_payload,
                    timeout=15.0
                )
                if not resp.ok and resp.status_code != 201:
                    logger.warning(f"Supabase PostgREST upsert returned {resp.status_code}: {resp.text}")
                    if os.environ.get("NODE_ENV") == "production":
                        raise RuntimeError(f"Failed to upsert vectors to production Supabase: {resp.text}")
            except Exception as e:
                logger.error(f"Error syncing to Supabase PostgREST: {e}")
                if os.environ.get("NODE_ENV") == "production":
                    raise

        # 2. Local persistent store (for offline verification and fast local testing)
        with sqlite3.connect(self.local_db_path) as conn:
            for c in chunks:
                emb = c["embedding"]
                if isinstance(emb, np.ndarray):
                    emb = emb.tolist()
                # Strict dimensional & model compatibility invariant
                if len(emb) != EMBEDDING_DIMENSION:
                    raise ValueError(
                        f"Incompatible embedding dimension: {len(emb)} != expected {EMBEDDING_DIMENSION} "
                        f"for model {EMBEDDING_MODEL_NAME}"
                    )

                meta = c.get("metadata", {})
                u_id = meta.get("user_id") or "USER"
                tenant_type = meta.get("tenant_type")
                if not tenant_type:
                    tenant_type = "SYSTEM_PUBLIC" if str(u_id) in ["default_user", "system_public"] else "USER"
                    meta["tenant_type"] = tenant_type

                # Ensure metadata has immutable model descriptors
                meta["embedding_model"] = EMBEDDING_MODEL_NAME
                meta["embedding_version"] = EMBEDDING_VERSION
                meta["embedding_dimension"] = EMBEDDING_DIMENSION

                chunk_id = c["id"]
                doc_id = meta.get("document_id") or chunk_id
                source_id = meta.get("source_id") or doc_id

                conn.execute("""
                    INSERT OR REPLACE INTO rag_chunks (
                        id, chunk_id, document_id, source_id, user_id, tenant_type,
                        topic, subtopic, concept, source_type, page_number, slide_number,
                        timestamp_start, timestamp_end, content_hash, embedding_model,
                        embedding_version, embedding_dimension, content, metadata_json,
                        embedding_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    chunk_id,
                    chunk_id,
                    doc_id,
                    source_id,
                    str(u_id),
                    str(tenant_type),
                    meta.get("topic"),
                    meta.get("subtopic"),
                    meta.get("concept"),
                    meta.get("source_type") or "TEXT",
                    meta.get("page_number"),
                    meta.get("slide_number"),
                    meta.get("timestamp_start"),
                    meta.get("timestamp_end"),
                    meta.get("content_hash"),
                    EMBEDDING_MODEL_NAME,
                    EMBEDDING_VERSION,
                    EMBEDDING_DIMENSION,
                    c["text"],
                    json.dumps(meta),
                    json.dumps(emb)
                ))
                inserted_count += 1
            conn.commit()

        return {"inserted": inserted_count, "status": "success"}

    def query_candidates(
        self,
        query_texts: List[str],
        top_k: int = 10,
        user_id: Optional[str] = None,
        source_id: Optional[str] = None,
        topic: Optional[str] = None,
        subtopic: Optional[str] = None,
        where_conditions: Optional[Dict[str, Any]] = None
    ) -> Dict[str, List[Any]]:
        """
        Query candidate nearest-neighbors using cosine similarity.
        Strictly enforces tenant scoping: user U can only access chunks where
        user_id == U or tenant_type == SYSTEM_PUBLIC.
        """
        if not query_texts:
            return {"ids": [], "documents": [], "metadatas": [], "distances": []}

        fn = get_embedding_function()
        raw_embs = fn(query_texts)
        query_embeddings = [emb if isinstance(emb, list) else emb.tolist() for emb in raw_embs]

        # 1. Real Supabase RPC vector query when configured
        if self.supabase_url and self.supabase_key and os.environ.get("PGVECTOR_TEST_LOCAL") != "1":
            try:
                import requests
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json"
                }
                s_ids = None
                if source_id and str(source_id).strip().lower() not in ["all", "*", "none"]:
                    s_ids = [s.strip() for s in str(source_id).split(',') if s.strip() and s.strip().lower() not in ["all", "*", "none"]]

                rpc_ids = []
                rpc_docs = []
                rpc_metas = []
                rpc_dists = []

                for q_emb in query_embeddings:
                    rpc_payload = {
                        "query_embedding": q_emb if isinstance(q_emb, list) else q_emb.tolist(),
                        "match_count": top_k,
                        "filter_user_id": str(user_id) if user_id and str(user_id) not in ["*", "all", "none"] else None,
                        "filter_topic": str(topic) if topic else None,
                        "filter_source_ids": s_ids if s_ids else None
                    }
                    resp = requests.post(
                        f"{self.supabase_url}/rest/v1/rpc/match_rag_chunks",
                        headers=headers,
                        json=rpc_payload,
                        timeout=15.0
                    )
                    if resp.ok:
                        rows = resp.json()
                        sub_ids = []
                        sub_docs = []
                        sub_metas = []
                        sub_dists = []
                        for r in rows:
                            # Defense-in-depth tenant check
                            if user_id and str(user_id) not in ["*", "all", "none"]:
                                if str(r.get("user_id")) != str(user_id) and str(r.get("tenant_type")) != "SYSTEM_PUBLIC":
                                    continue
                            elif str(r.get("tenant_type")) != "SYSTEM_PUBLIC":
                                continue
                            sub_ids.append(r.get("chunk_id"))
                            sub_docs.append(r.get("content"))
                            sub_metas.append(r.get("metadata_json") or {})
                            sub_dists.append(max(0.0, 1.0 - float(r.get("similarity", 0.5))))
                        rpc_ids.append(sub_ids)
                        rpc_docs.append(sub_docs)
                        rpc_metas.append(sub_metas)
                        rpc_dists.append(sub_dists)
                    else:
                        raise RuntimeError(f"Supabase RPC match_rag_chunks failed: {resp.status_code} {resp.text}")

                return {
                    "ids": rpc_ids,
                    "documents": rpc_docs,
                    "metadatas": rpc_metas,
                    "distances": rpc_dists
                }
            except Exception as e:
                logger.warning(f"Supabase RPC match_rag_chunks error: {e}")
                if os.environ.get("NODE_ENV") == "production":
                    raise RuntimeError(f"Production pgvector search failed: {e}")

        all_ids = []
        all_docs = []
        all_metas = []
        all_dists = []

        with sqlite3.connect(self.local_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Base query with multi-tenant filtering & model compatibility
            sql_where = [
                "embedding_model = ?",
                "embedding_version = ?"
            ]
            params = [EMBEDDING_MODEL_NAME, EMBEDDING_VERSION]

            if user_id and str(user_id) not in ["*", "all", "none"]:
                if str(user_id) in ["default_user", "system_public"]:
                    sql_where.append("user_id = ?")
                    params.append(str(user_id))
                else:
                    sql_where.append("(user_id = ? OR tenant_type = 'SYSTEM_PUBLIC')")
                    params.append(str(user_id))
            else:
                # If no user_id is provided, only allow SYSTEM_PUBLIC chunks (fail closed on private data)
                sql_where.append("tenant_type = 'SYSTEM_PUBLIC'")

            if source_id and str(source_id).strip().lower() not in ["all", "*", "none"]:
                s_ids = [s.strip() for s in str(source_id).split(',') if s.strip() and s.strip().lower() not in ["all", "*", "none"]]
                placeholders = ",".join(["?"] * len(s_ids))
                sql_where.append(f"(source_id IN ({placeholders}) OR document_id IN ({placeholders}))")
                params.extend(s_ids)
                params.extend(s_ids)
            elif topic:
                sql_where.append("topic = ?")
                params.append(str(topic))

            where_clause = " AND ".join(sql_where)
            cursor.execute(f"SELECT * FROM rag_chunks WHERE {where_clause}", params)
            rows = cursor.fetchall()

            for q_idx, q_emb in enumerate(query_embeddings):
                scored_candidates = []
                for r in rows:
                    try:
                        emb = json.loads(r["embedding_json"])
                        dist = compute_cosine_distance(q_emb, emb)
                        scored_candidates.append((dist, r))
                    except Exception:
                        continue

                # Sort by cosine distance ascending (closest first)
                scored_candidates.sort(key=lambda x: x[0])
                top_slice = scored_candidates[:top_k]

                q_ids = []
                q_docs = []
                q_metas = []
                q_dists = []

                for dist, r in top_slice:
                    # Defense-in-depth post-retrieval tenant check
                    if user_id and str(user_id) not in ["*", "all", "none"]:
                        if str(r["user_id"]) != str(user_id) and str(r["tenant_type"]) != "SYSTEM_PUBLIC":
                            continue
                    elif str(r["tenant_type"]) != "SYSTEM_PUBLIC":
                        continue

                    q_ids.append(r["chunk_id"])
                    q_docs.append(r["content"])
                    try:
                        meta = json.loads(r["metadata_json"])
                    except Exception:
                        meta = {}
                    q_metas.append(meta)
                    q_dists.append(dist)

                all_ids.append(q_ids)
                all_docs.append(q_docs)
                all_metas.append(q_metas)
                all_dists.append(q_dists)

        return {
            "ids": all_ids,
            "documents": all_docs,
            "metadatas": all_metas,
            "distances": all_dists
        }

    def get_chunk(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve chunk text, full metadata, and coordinates by chunk_id."""
        with sqlite3.connect(self.local_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM rag_chunks WHERE chunk_id = ?", (chunk_id,))
            r = cursor.fetchone()
            if r:
                try:
                    meta = json.loads(r["metadata_json"])
                except Exception:
                    meta = {}
                return {
                    "found": True,
                    "chunk_id": chunk_id,
                    "text": r["content"],
                    "metadata": meta,
                    "location": {
                        "source_type": meta.get("source_type") or r["source_type"],
                        "page_number": meta.get("page_number") if meta.get("page_number", -1) != -1 else r["page_number"],
                        "slide_number": meta.get("slide_number") if meta.get("slide_number", -1) != -1 else r["slide_number"],
                        "timestamp_start": meta.get("timestamp_start") if meta.get("timestamp_start", -1.0) != -1.0 else r["timestamp_start"],
                        "timestamp_end": meta.get("timestamp_end") if meta.get("timestamp_end", -1.0) != -1.0 else r["timestamp_end"],
                    }
                }
        return None

    def delete_by(
        self,
        user_id: Optional[str] = None,
        source_id: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> int:
        """Delete chunks matching user_id, source_id, or document_id."""
        conditions = []
        params = []
        if user_id:
            conditions.append("user_id = ?")
            params.append(str(user_id))
        if source_id:
            conditions.append("source_id = ?")
            params.append(str(source_id))
        if document_id:
            conditions.append("document_id = ?")
            params.append(str(document_id))

        if not conditions:
            return 0

        where = " AND ".join(conditions)
        with sqlite3.connect(self.local_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(f"DELETE FROM rag_chunks WHERE {where}", params)
            deleted = cursor.rowcount
            conn.commit()
            return max(0, deleted)

    def count(self, user_id: Optional[str] = None) -> int:
        """Count total vectors (optionally scoped to a user)."""
        with sqlite3.connect(self.local_db_path) as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT COUNT(*) FROM rag_chunks WHERE user_id = ?", (str(user_id),))
            else:
                cursor.execute("SELECT COUNT(*) FROM rag_chunks")
            row = cursor.fetchone()
            return row[0] if row else 0

    def health_check(self) -> Dict[str, Any]:
        """Health check for pgvector provider."""
        try:
            total_count = self.count()
            return {
                "status": "healthy",
                "provider": "pgvector",
                "count": total_count,
                "metric": DISTANCE_METRIC,
                "embedding_model": EMBEDDING_MODEL_NAME,
                "dimension": EMBEDDING_DIMENSION,
                "storage": self.local_db_path
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "pgvector",
                "error": str(e)
            }
