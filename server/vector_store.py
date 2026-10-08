#!/usr/bin/env python3
"""
VectorStore Provider Abstraction Interface
Supports:
- ChromaVectorStore (local development & benchmark default)
- PgVectorStore (production PostgreSQL + pgvector)
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import os
import logging

logger = logging.getLogger("vector_store")

# Immutable Embedding Model Specification
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_VERSION = "v1"
EMBEDDING_DIMENSION = 384
DISTANCE_METRIC = "cosine"

class BaseVectorStore(ABC):
    """
    Abstract VectorStore provider interface.
    All RAG operations in Ming depend on this interface rather than a concrete database.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the vector store backend (e.g. 'chroma', 'pgvector')."""
        pass

    @abstractmethod
    def add_documents(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Batch add or upsert document chunks into vector storage.
        Each chunk must have:
        - id: str
        - text: str
        - metadata: dict containing user_id, tenant_type, source_id, etc.
        """
        pass

    @abstractmethod
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
        Query candidate nearest-neighbors for multiple query variants.
        Returns a dict with:
        {
            "ids": [[chunk_id_1, ...], ...],
            "documents": [[text_1, ...], ...],
            "metadatas": [[meta_1, ...], ...],
            "distances": [[dist_1, ...], ...]
        }
        where each outer list entry corresponds to a query variant.
        """
        pass

    @abstractmethod
    def get_chunk(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve chunk text, full metadata, and existence status by chunk_id.
        """
        pass

    @abstractmethod
    def delete_by(
        self,
        user_id: Optional[str] = None,
        source_id: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> int:
        """
        Delete vectors matching specified owner or source identifiers.
        Returns number of deleted chunks.
        """
        pass

    @abstractmethod
    def count(self, user_id: Optional[str] = None) -> int:
        """
        Count total vectors stored (optionally scoped to a user).
        """
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """
        Health and configuration diagnostic check.
        """
        pass


def get_vector_store(provider_override: Optional[str] = None) -> BaseVectorStore:
    """
    Factory function returning the configured VectorStore provider.
    Selection via environment variable VECTOR_STORE:
    - 'chroma' (default)
    - 'pgvector'
    
    If 'pgvector' is chosen but PostgreSQL/pgvector configuration is missing,
    this function fails closed with a clear configuration error.
    It NEVER silently falls back to Chroma in production.
    """
    provider = (provider_override or os.environ.get("VECTOR_STORE", "chroma")).strip().lower()

    if provider == "chroma":
        from vector_store_chroma import ChromaVectorStore
        return ChromaVectorStore()

    elif provider == "pgvector":
        # Validate configuration at startup
        db_url = os.environ.get("DATABASE_URL", "").strip()
        supabase_url = os.environ.get("SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", "")).strip()
        pgvector_url = os.environ.get("PGVECTOR_URL", "").strip()
        pgvector_local = os.environ.get("PGVECTOR_TEST_LOCAL", "").strip()

        has_pg_config = (
            db_url.startswith("postgres://") or
            db_url.startswith("postgresql://") or
            bool(supabase_url) or
            bool(pgvector_url) or
            pgvector_local == "1"
        )

        if not has_pg_config:
            raise RuntimeError(
                "VECTOR_STORE is configured to 'pgvector', but required PostgreSQL/pgvector "
                "configuration is missing (DATABASE_URL, SUPABASE_URL, or PGVECTOR_URL must be set). "
                "Failing closed: cannot silently downgrade to Chroma in production."
            )

        from vector_store_pgvector import PgVectorStore
        return PgVectorStore()

    else:
        raise ValueError(f"Unsupported VECTOR_STORE provider: '{provider}'. Valid options: 'chroma', 'pgvector'.")
