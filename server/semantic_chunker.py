#!/usr/bin/env python3
"""
Canonical Phase 2: Semantic Chunker & Complete Provenance System
Chunks extracted content blocks based on media-specific structural boundaries:
- PDF: page → section → paragraph
- PPT: slide → content block
- Video/Audio: timestamped semantic segments
- Image: OCR / visual semantic units

Ensures deterministic chunk IDs and attaches complete, unpolluted provenance.
"""

import hashlib
import re
from typing import List, Dict, Any, Optional
from ingestion_models import ContentBlock, SemanticChunk, ProvenanceMetadata

def compute_chunk_hash(user_id: str, source_id: str, chunk_index: int, text: str, page_or_slide_or_time: str) -> str:
    seed = f"{user_id}:{source_id}:{chunk_index}:{page_or_slide_or_time}:{text[:64]}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:24]

def chunk_document_blocks(
    blocks: List[ContentBlock],
    user_id: str,
    tenant_type: str,
    resource_id: str,
    document_id: str,
    source_id: str,
    source_type: str,
    content_hash: str,
    max_chunk_chars: int = 1000,
    overlap_chars: int = 150
) -> List[SemanticChunk]:
    chunks: List[SemanticChunk] = []
    chunk_idx = 0

    # 1. PPT / PPTX: slide-by-slide chunking
    if source_type in ("PPT", "PPTX"):
        # Group blocks by slide_number
        slides_map: Dict[int, List[ContentBlock]] = {}
        for b in blocks:
            s_num = b.slide_number or 1
            slides_map.setdefault(s_num, []).append(b)

        for s_num in sorted(slides_map.keys()):
            slide_blocks = slides_map[s_num]
            # Gather heading/title if available
            title = None
            for b in slide_blocks:
                if b.block_type == "HEADING":
                    title = b.text.replace("Title:", "").strip()
                    break

            # Combine slide body, bullets, tables
            slide_texts = []
            for b in slide_blocks:
                slide_texts.append(b.text)
            
            combined_text = "\n\n".join(slide_texts).strip()
            if not combined_text:
                continue

            chunk_idx += 1
            cid = f"chk_{compute_chunk_hash(user_id, source_id, chunk_idx, combined_text, f's{s_num}')}"
            prov = ProvenanceMetadata(
                user_id=user_id,
                tenant_type=tenant_type,
                resource_id=resource_id,
                document_id=document_id,
                source_id=source_id,
                chunk_id=cid,
                source_type=source_type,
                page_number=None,
                slide_number=s_num,
                timestamp_start=None,
                timestamp_end=None,
                extraction_method=slide_blocks[0].extraction_method,
                content_hash=content_hash,
                chunk_index=chunk_idx,
                heading=title,
                section=f"Slide {s_num}"
            )
            chunks.append(SemanticChunk(
                chunk_id=cid,
                chunk_index=chunk_idx,
                text=combined_text,
                token_count=len(combined_text.split()),
                provenance=prov,
                section=f"Slide {s_num}",
                heading=title
            ))

    # 2. PDF: page → section → paragraph chunking
    elif source_type == "PDF":
        # Group by page_number
        pages_map: Dict[int, List[ContentBlock]] = {}
        for b in blocks:
            p_num = b.page_number or 1
            pages_map.setdefault(p_num, []).append(b)

        for p_num in sorted(pages_map.keys()):
            page_blocks = pages_map[p_num]
            for b in page_blocks:
                # If diagram or figure, preserve as dedicated visual semantic chunk
                if b.block_type in ("IMAGE", "DIAGRAM") or b.extraction_method == "VISION_DESCRIPTION":
                    chunk_idx += 1
                    cid = f"chk_{compute_chunk_hash(user_id, source_id, chunk_idx, b.text, f'p{p_num}_vis')}"
                    prov = ProvenanceMetadata(
                        user_id=user_id,
                        tenant_type=tenant_type,
                        resource_id=resource_id,
                        document_id=document_id,
                        source_id=source_id,
                        chunk_id=cid,
                        source_type=source_type,
                        page_number=p_num,
                        slide_number=None,
                        timestamp_start=None,
                        timestamp_end=None,
                        extraction_method="VISION_DESCRIPTION",
                        content_hash=content_hash,
                        chunk_index=chunk_idx,
                        section=f"Page {p_num} Visual Figure"
                    )
                    chunks.append(SemanticChunk(
                        chunk_id=cid,
                        chunk_index=chunk_idx,
                        text=b.text,
                        token_count=len(b.text.split()),
                        provenance=prov,
                        section=f"Page {p_num} Visual Figure"
                    ))
                    continue

                # Paragraph and section splitting for text
                paragraphs = [p.strip() for p in b.text.split("\n\n") if p.strip()]
                if not paragraphs:
                    paragraphs = [b.text.strip()]

                current_buf = []
                current_len = 0
                for para in paragraphs:
                    if current_len + len(para) > max_chunk_chars and current_buf:
                        text_to_chunk = "\n\n".join(current_buf)
                        chunk_idx += 1
                        cid = f"chk_{compute_chunk_hash(user_id, source_id, chunk_idx, text_to_chunk, f'p{p_num}')}"
                        prov = ProvenanceMetadata(
                            user_id=user_id,
                            tenant_type=tenant_type,
                            resource_id=resource_id,
                            document_id=document_id,
                            source_id=source_id,
                            chunk_id=cid,
                            source_type=source_type,
                            page_number=p_num,
                            slide_number=None,
                            timestamp_start=None,
                            timestamp_end=None,
                            extraction_method=b.extraction_method,
                            content_hash=content_hash,
                            chunk_index=chunk_idx,
                            section=f"Page {p_num}"
                        )
                        chunks.append(SemanticChunk(
                            chunk_id=cid,
                            chunk_index=chunk_idx,
                            text=text_to_chunk,
                            token_count=len(text_to_chunk.split()),
                            provenance=prov,
                            section=f"Page {p_num}"
                        ))
                        current_buf = [para]
                        current_len = len(para)
                    else:
                        current_buf.append(para)
                        current_len += len(para) + 2

                if current_buf:
                    text_to_chunk = "\n\n".join(current_buf)
                    chunk_idx += 1
                    cid = f"chk_{compute_chunk_hash(user_id, source_id, chunk_idx, text_to_chunk, f'p{p_num}')}"
                    prov = ProvenanceMetadata(
                        user_id=user_id,
                        tenant_type=tenant_type,
                        resource_id=resource_id,
                        document_id=document_id,
                        source_id=source_id,
                        chunk_id=cid,
                        source_type=source_type,
                        page_number=p_num,
                        slide_number=None,
                        timestamp_start=None,
                        timestamp_end=None,
                        extraction_method=b.extraction_method,
                        content_hash=content_hash,
                        chunk_index=chunk_idx,
                        section=f"Page {p_num}"
                    )
                    chunks.append(SemanticChunk(
                        chunk_id=cid,
                        chunk_index=chunk_idx,
                        text=text_to_chunk,
                        token_count=len(text_to_chunk.split()),
                        provenance=prov,
                        section=f"Page {p_num}"
                    ))

    # 3. Video / Audio: timestamped semantic segments
    elif source_type in ("VIDEO", "AUDIO"):
        for b in blocks:
            chunk_idx += 1
            cid = f"chk_{compute_chunk_hash(user_id, source_id, chunk_idx, b.text, f't{b.timestamp_start}')}"
            prov = ProvenanceMetadata(
                user_id=user_id,
                tenant_type=tenant_type,
                resource_id=resource_id,
                document_id=document_id,
                source_id=source_id,
                chunk_id=cid,
                source_type=source_type,
                page_number=None,
                slide_number=None,
                timestamp_start=b.timestamp_start,
                timestamp_end=b.timestamp_end,
                extraction_method="TRANSCRIPTION",
                content_hash=content_hash,
                chunk_index=chunk_idx,
                section=b.metadata.get("subtopic") if b.metadata else None
            )
            chunks.append(SemanticChunk(
                chunk_id=cid,
                chunk_index=chunk_idx,
                text=b.text,
                token_count=len(b.text.split()),
                provenance=prov,
                section=b.metadata.get("subtopic") if b.metadata else None
            ))

    # 4. Standalone Image & Text fallback
    else:
        for b in blocks:
            chunk_idx += 1
            cid = f"chk_{compute_chunk_hash(user_id, source_id, chunk_idx, b.text, 'img_or_txt')}"
            prov = ProvenanceMetadata(
                user_id=user_id,
                tenant_type=tenant_type,
                resource_id=resource_id,
                document_id=document_id,
                source_id=source_id,
                chunk_id=cid,
                source_type=source_type,
                page_number=b.page_number or 1 if source_type == "IMAGE" else None,
                slide_number=None,
                timestamp_start=None,
                timestamp_end=None,
                extraction_method=b.extraction_method,
                content_hash=content_hash,
                chunk_index=chunk_idx,
                section="Image Analysis" if source_type == "IMAGE" else "Text Document"
            )
            chunks.append(SemanticChunk(
                chunk_id=cid,
                chunk_index=chunk_idx,
                text=b.text,
                token_count=len(b.text.split()),
                provenance=prov,
                section="Image Analysis" if source_type == "IMAGE" else "Text Document"
            ))

    return chunks
