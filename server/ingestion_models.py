#!/usr/bin/env python3
"""
Canonical Phase 2: Knowledge Ingestion Data Models (Python)
Normalized representation for multimodal documents, content blocks,
semantic chunks, and full provenance tracking.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

@dataclass
class ProvenanceMetadata:
    user_id: str
    tenant_type: str  # USER_PRIVATE | SYSTEM_PUBLIC | COMMUNITY
    resource_id: str
    document_id: str
    source_id: str
    chunk_id: str
    source_type: str  # PDF | PPT | PPTX | IMAGE | VIDEO | AUDIO | TEXT
    extraction_method: str  # NATIVE_TEXT | OCR | VISION_DESCRIPTION | TRANSCRIPTION | TABLE | SPEAKER_NOTES
    content_hash: str
    chunk_index: int
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_version: str = "v1"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    section: Optional[str] = None
    heading: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Filter None values to avoid polluting metadata with empty fields
        return {k: v for k, v in d.items() if v is not None}

@dataclass
class ContentBlock:
    block_id: str
    block_type: str  # TEXT | SECTION | HEADING | IMAGE | DIAGRAM | TABLE | TRANSCRIPT_SEGMENT | SPEAKER_NOTE
    text: str
    extraction_method: str  # NATIVE_TEXT | OCR | VISION_DESCRIPTION | TRANSCRIPTION | TABLE | SPEAKER_NOTES
    confidence: float = 1.0
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class SemanticChunk:
    chunk_id: str
    chunk_index: int
    text: str
    token_count: int
    provenance: ProvenanceMetadata
    section: Optional[str] = None
    heading: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["provenance"] = self.provenance.to_dict()
        return d

@dataclass
class IngestionDocument:
    document_id: str
    source_id: str
    resource_id: str
    user_id: str
    tenant_type: str
    title: str
    source_type: str
    mime_type: str
    file_size: int
    content_hash: str
    lifecycle_status: str  # PENDING | PROCESSING | COMPLETED | PARTIAL | FAILED
    blocks: List[ContentBlock] = field(default_factory=list)
    chunks: List[SemanticChunk] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "source_id": self.source_id,
            "resource_id": self.resource_id,
            "user_id": self.user_id,
            "tenant_type": self.tenant_type,
            "title": self.title,
            "source_type": self.source_type,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "content_hash": self.content_hash,
            "lifecycle_status": self.lifecycle_status,
            "blocks": [b.to_dict() for b in self.blocks],
            "chunks": [c.to_dict() for c in self.chunks],
            "metadata": self.metadata,
            "metrics": self.metrics,
            "error": self.error,
        }
