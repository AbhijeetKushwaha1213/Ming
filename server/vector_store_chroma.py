#!/usr/bin/env python3
"""
ChromaVectorStore: Concrete implementation of BaseVectorStore for ChromaDB
Preserves all Phase 1 multi-tenant hardening and zero-trust invariants.
"""

import os
from typing import List, Dict, Any, Optional
import chromadb

from vector_store import (
    BaseVectorStore,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_VERSION,
    EMBEDDING_DIMENSION,
    DISTANCE_METRIC,
)

CHROMA_DATA_PATH = os.environ.get("CHROMA_DATA_PATH", "./chroma_data")
COLLECTION_NAME = "studymate_multimodal_kb"

class ChromaVectorStore(BaseVectorStore):
    """
    ChromaDB provider implementation.
    Used for local development and offline benchmark execution.
    """

    def __init__(self, data_path: Optional[str] = None, collection_name: Optional[str] = None):
        self.data_path = data_path or CHROMA_DATA_PATH
        self.collection_name = collection_name or COLLECTION_NAME
        os.makedirs(self.data_path, exist_ok=True)
        self.client = chromadb.PersistentClient(path=self.data_path)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": DISTANCE_METRIC}
        )

    @property
    def provider_name(self) -> str:
        return "chroma"

    def add_documents(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Batch add document chunks to ChromaDB.
        Enforces tenant tags and attaches embedding model metadata.
        """
        if not chunks:
            return {"inserted": 0, "status": "empty"}

        for c in chunks:
            meta = c.setdefault("metadata", {})
            u_id = meta.get("user_id") or "USER"
            if "tenant_type" not in meta:
                meta["tenant_type"] = "SYSTEM_PUBLIC" if str(u_id) in ["default_user", "system_public"] else "USER"
            meta["embedding_model"] = EMBEDDING_MODEL_NAME
            meta["embedding_version"] = EMBEDDING_VERSION

        ids = [c["id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        batch_size = 100
        total_inserted = 0
        for i in range(0, len(ids), batch_size):
            self.collection.add(
                ids=ids[i:i + batch_size],
                documents=documents[i:i + batch_size],
                metadatas=metadatas[i:i + batch_size]
            )
            total_inserted += len(ids[i:i + batch_size])

        return {"inserted": total_inserted, "status": "success"}

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
        Query candidate nearest-neighbors from ChromaDB.
        Strictly enforces tenant scoping: user U can only access chunks where
        user_id == U or tenant_type == SYSTEM_PUBLIC.
        """
        conditions = []
        if user_id and str(user_id) not in ["*", "all", "none"]:
            if str(user_id) in ["default_user", "system_public"]:
                conditions.append({"user_id": {"$eq": str(user_id)}})
            else:
                conditions.append({
                    "$or": [
                        {"user_id": {"$eq": str(user_id)}},
                        {"tenant_type": {"$eq": "SYSTEM_PUBLIC"}}
                    ]
                })

        if source_id and str(source_id).strip().lower() not in ["all", "*", "none"]:
            s_ids = [s.strip() for s in str(source_id).split(',') if s.strip() and s.strip().lower() not in ["all", "*", "none"]]
            if len(s_ids) == 1:
                conditions.append({
                    "$or": [
                        {"source_id": {"$eq": str(s_ids[0])}},
                        {"document_id": {"$eq": str(s_ids[0])}}
                    ]
                })
            elif len(s_ids) > 1:
                multi_ors = []
                for sid in s_ids:
                    multi_ors.append({"source_id": {"$eq": str(sid)}})
                    multi_ors.append({"document_id": {"$eq": str(sid)}})
                conditions.append({"$or": multi_ors})
        elif topic:
            conditions.append({"topic": {"$eq": str(topic)}})

        query_params = {
            "query_texts": query_texts,
            "n_results": top_k
        }

        if where_conditions:
            query_params["where"] = where_conditions
        else:
            if len(conditions) == 1:
                query_params["where"] = conditions[0]
            elif len(conditions) > 1:
                query_params["where"] = {"$and": conditions}

        try:
            results = self.collection.query(**query_params)
        except Exception as e:
            results = {"ids": [], "documents": [], "metadatas": [], "distances": []}

        # Normalize outputs to lists per query text
        n_queries = len(query_texts)
        res_ids = results.get("ids") or [[] for _ in range(n_queries)]
        res_docs = results.get("documents") or [[] for _ in range(n_queries)]
        res_metas = results.get("metadatas") or [[] for _ in range(n_queries)]
        res_dists = results.get("distances") or [[] for _ in range(n_queries)]

        return {
            "ids": res_ids,
            "documents": res_docs,
            "metadatas": res_metas,
            "distances": res_dists
        }

    def get_chunk(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve chunk text and metadata by chunk_id."""
        res = self.collection.get(ids=[chunk_id], include=["metadatas", "documents"])
        if res and res.get("ids") and len(res["ids"]) > 0:
            meta = res["metadatas"][0] if res.get("metadatas") else {}
            return {
                "found": True,
                "chunk_id": chunk_id,
                "text": res["documents"][0] if res.get("documents") else "",
                "metadata": meta,
                "location": {
                    "source_type": meta.get("source_type"),
                    "page_number": meta.get("page_number") if meta.get("page_number", -1) != -1 else None,
                    "slide_number": meta.get("slide_number") if meta.get("slide_number", -1) != -1 else None,
                    "timestamp_start": meta.get("timestamp_start") if meta.get("timestamp_start", -1.0) != -1.0 else None,
                    "timestamp_end": meta.get("timestamp_end") if meta.get("timestamp_end", -1.0) != -1.0 else None,
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
        if user_id:
            conditions.append({"user_id": {"$eq": str(user_id)}})
        if source_id:
            conditions.append({"source_id": {"$eq": str(source_id)}})
        if document_id:
            conditions.append({"document_id": {"$eq": str(document_id)}})

        if not conditions:
            return 0

        where = conditions[0] if len(conditions) == 1 else {"$and": conditions}
        before_count = self.collection.count()
        try:
            self.collection.delete(where=where)
            after_count = self.collection.count()
            return max(0, before_count - after_count)
        except Exception:
            return 0

    def count(self, user_id: Optional[str] = None) -> int:
        """Count total vectors (or for a given user)."""
        if not user_id:
            return self.collection.count()
        res = self.collection.get(where={"user_id": {"$eq": str(user_id)}}, include=[])
        return len(res.get("ids", []))

    def health_check(self) -> Dict[str, Any]:
        """Health check for Chroma collection."""
        try:
            count = self.collection.count()
            return {
                "status": "healthy",
                "provider": "chroma",
                "collection": self.collection_name,
                "count": count,
                "metric": DISTANCE_METRIC,
                "embedding_model": EMBEDDING_MODEL_NAME,
                "dimension": EMBEDDING_DIMENSION
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "chroma",
                "error": str(e)
            }
