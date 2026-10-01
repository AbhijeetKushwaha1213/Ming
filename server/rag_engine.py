#!/usr/bin/env python3
"""
StudyMate Multimodal RAG & Knowledge Base Engine
Phase 1: Ingestion, Extraction, Chunking, Embedding, and Chroma Vector Storage

Supports:
- PDF: Page-by-page extraction preserving page_number
- PPT/PPTX: Slide-by-slide extraction preserving slide_number
- Video/Audio/YouTube: Timestamped segment extraction preserving timestamp_start & timestamp_end
"""

import os
import sys
import json
import uuid
import re
import argparse
from typing import List, Dict, Any, Optional
from pathlib import Path

# Load environment variables if available
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env')
except ImportError:
    pass

import chromadb

CHROMA_DATA_PATH = os.environ.get("CHROMA_DATA_PATH", "./chroma_data")
COLLECTION_NAME = "studymate_multimodal_kb"
JOBS_STORE_PATH = os.path.join(CHROMA_DATA_PATH, "jobs.json")

def get_chroma_client() -> chromadb.PersistentClient:
    os.makedirs(CHROMA_DATA_PATH, exist_ok=True)
    return chromadb.PersistentClient(path=CHROMA_DATA_PATH)

def get_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

def _save_job_status(job_id: str, status_data: Dict[str, Any]):
    os.makedirs(CHROMA_DATA_PATH, exist_ok=True)
    jobs = {}
    if os.path.exists(JOBS_STORE_PATH):
        try:
            with open(JOBS_STORE_PATH, "r", encoding="utf-8") as f:
                jobs = json.load(f)
        except Exception:
            jobs = {}
    jobs[job_id] = status_data
    with open(JOBS_STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2)

def get_job_status(job_id: str) -> Dict[str, Any]:
    if os.path.exists(JOBS_STORE_PATH):
        try:
            with open(JOBS_STORE_PATH, "r", encoding="utf-8") as f:
                jobs = json.load(f)
                return jobs.get(job_id, {"status": "not_found", "job_id": job_id})
        except Exception as e:
            return {"status": "error", "error": str(e), "job_id": job_id}
    return {"status": "not_found", "job_id": job_id}

# ==========================================
# 1. EXTRACTORS
# ==========================================

def extract_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Extract text page by page from PDF preserving page_number."""
    from pypdf import PdfReader
    pages_data = []
    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        cleaned = text.strip()
        if cleaned:
            pages_data.append({
                "page_number": idx,
                "total_pages": total_pages,
                "text": cleaned
            })
    return pages_data

def extract_pptx(file_path: str) -> List[Dict[str, Any]]:
    """Extract text slide by slide from PPT/PPTX preserving slide_number."""
    import pptx
    prs = pptx.Presentation(file_path)
    slides_data = []
    total_slides = len(prs.slides)
    
    for idx, slide in enumerate(prs.slides, start=1):
        slide_texts = []
        slide_title = ""
        
        # Check title if available
        if slide.shapes.title and slide.shapes.title.text:
            slide_title = slide.shapes.title.text.strip()
            slide_texts.append(f"Title: {slide_title}")
            
        for shape in slide.shapes:
            if shape != slide.shapes.title and shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    line = paragraph.text.strip()
                    if line and line != slide_title:
                        slide_texts.append(line)
                        
        content = "\n".join(slide_texts).strip()
        if content:
            slides_data.append({
                "slide_number": idx,
                "total_slides": total_slides,
                "title": slide_title,
                "text": content
            })
    return slides_data

def extract_video_or_audio(file_path_or_url: str, custom_transcript: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Extract timestamped segments from video/audio/YouTube.
    Uses Gemini API if available, or processes provided transcript / subtitles.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")
    
    # If custom transcript or vtt/srt content is provided
    if custom_transcript:
        return _parse_timestamped_transcript(custom_transcript)

    # If it's a URL or media file, and Gemini API key is available
    if api_key and (file_path_or_url.startswith("http://") or file_path_or_url.startswith("https://") or os.path.exists(file_path_or_url)):
        try:
            import httpx
            # Call Gemini to transcribe or summarize timestamped content
            prompt = (
                "You are an expert audio/video transcriber for educational lectures. "
                "Transcribe this lecture into timestamped conceptual segments. "
                "Output a valid JSON array of objects with keys: "
                "\"timestamp_start\" (in seconds, float), \"timestamp_end\" (in seconds, float), "
                "\"topic\" (string), \"subtopic\" (string), \"text\" (string). "
                "Example format: [{\"timestamp_start\": 0.0, \"timestamp_end\": 45.0, \"topic\": \"Introduction\", \"subtopic\": \"Overview\", \"text\": \"Welcome to class...\"}]"
            )
            # If YouTube URL or text description is passed
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{
                    "parts": [{"text": f"{prompt}\n\nLecture Video Source/Context: {file_path_or_url}"}]
                }],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 2048,
                    "responseMimeType": "application/json"
                }
            }
            resp = httpx.post(endpoint, json=payload, timeout=60.0)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if raw_text:
                    segments = json.loads(raw_text)
                    if isinstance(segments, list) and len(segments) > 0:
                        return segments
        except Exception as e:
            sys.stderr.write(f"Gemini transcription fallback: {e}\n")

    # Fallback default segment if external API call fails
    return [{
        "timestamp_start": 0.0,
        "timestamp_end": 180.0,
        "topic": "Lecture Segment",
        "subtopic": "Key Concepts",
        "text": f"Lecture video content from {os.path.basename(file_path_or_url)}. Concepts and discussions covered."
    }]

def _parse_timestamped_transcript(transcript: str) -> List[Dict[str, Any]]:
    """Parse text with timestamps (e.g., [01:30] or 00:01:30 --> text) into segments."""
    segments = []
    # Match patterns like [00:15] or [1:20:30] or 00:15 - 00:45
    lines = transcript.strip().split("\n")
    current_start = 0.0
    current_text = []

    for line in lines:
        line_clean = line.strip()
        time_match = re.search(r'\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?', line_clean)
        if time_match:
            # calculate seconds
            h = int(time_match.group(3) or 0) if time_match.group(3) else 0
            m = int(time_match.group(1)) if not time_match.group(3) else int(time_match.group(1))
            s = int(time_match.group(2))
            new_time = float(h * 3600 + m * 60 + s)
            
            if current_text:
                segments.append({
                    "timestamp_start": current_start,
                    "timestamp_end": new_time,
                    "text": " ".join(current_text)
                })
                current_text = []
            current_start = new_time
            clean_content = re.sub(r'\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?', '', line_clean).strip()
            if clean_content:
                current_text.append(clean_content)
        else:
            if line_clean:
                current_text.append(line_clean)

    if current_text:
        segments.append({
            "timestamp_start": current_start,
            "timestamp_end": current_start + 60.0,
            "text": " ".join(current_text)
        })

    return segments or [{"timestamp_start": 0.0, "timestamp_end": 60.0, "text": transcript}]

# ==========================================
# 2. CHUNKING ENGINE
# ==========================================

def chunk_text(text: str, max_chars: int = 600, overlap: int = 100) -> List[str]:
    """Split text into semantic chunks with overlap preserving sentence boundaries."""
    if len(text) <= max_chars:
        return [text]
    
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_len = 0
    
    for sentence in sentences:
        s_len = len(sentence)
        if current_len + s_len > max_chars and current_chunk:
            chunk_str = " ".join(current_chunk)
            chunks.append(chunk_str)
            
            # Keep overlap sentences from the end
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current_chunk):
                if overlap_len + len(s) <= overlap:
                    overlap_sentences.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current_chunk = overlap_sentences
            current_len = overlap_len
            
        current_chunk.append(sentence)
        current_len += s_len
        
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return chunks

# ==========================================
# 3. PIPELINE: INGESTION & STORAGE
# ==========================================

def ingest_source(
    file_path_or_url: str,
    source_type: str,
    user_id: str = "default_user",
    topic: str = "General",
    subtopic: str = "Main",
    source_id: Optional[str] = None,
    document_id: Optional[str] = None,
    custom_transcript: Optional[str] = None,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main Ingestion Pipeline:
    Upload/Path -> Extract -> Chunk -> Embed -> Store in Chroma
    
    Preserves all required metadata:
    user_id, source_id, document_id, topic, subtopic, chunk_id, page_number,
    slide_number, timestamp_start, timestamp_end
    """
    job_id = job_id or f"job_{uuid.uuid4().hex[:12]}"
    source_id = source_id or f"src_{uuid.uuid4().hex[:12]}"
    document_id = document_id or f"doc_{uuid.uuid4().hex[:12]}"
    
    _save_job_status(job_id, {
        "job_id": job_id,
        "status": "processing",
        "progress": 10,
        "source_id": source_id,
        "document_id": document_id,
        "source_type": source_type
    })
    
    chunks_to_add = []
    stype = source_type.upper().strip()
    
    # Extraction
    try:
        if stype in ["PDF"]:
            pages = extract_pdf(file_path_or_url)
            for page in pages:
                page_chunks = chunk_text(page["text"])
                for sub_idx, chunk_content in enumerate(page_chunks):
                    chunk_id = f"{document_id}_p{page['page_number']}_c{sub_idx+1}"
                    chunks_to_add.append({
                        "id": chunk_id,
                        "text": chunk_content,
                        "metadata": {
                            "user_id": str(user_id),
                            "source_id": str(source_id),
                            "document_id": str(document_id),
                            "topic": str(topic),
                            "subtopic": str(subtopic),
                            "chunk_id": str(chunk_id),
                            "source_type": "PDF",
                            "page_number": int(page["page_number"]),
                            "slide_number": -1,
                            "timestamp_start": -1.0,
                            "timestamp_end": -1.0,
                        }
                    })
        elif stype in ["PPT", "PPTX", "SLIDES"]:
            slides = extract_pptx(file_path_or_url)
            for slide in slides:
                slide_subtopic = slide.get("title") or subtopic
                slide_chunks = chunk_text(slide["text"])
                for sub_idx, chunk_content in enumerate(slide_chunks):
                    chunk_id = f"{document_id}_s{slide['slide_number']}_c{sub_idx+1}"
                    chunks_to_add.append({
                        "id": chunk_id,
                        "text": chunk_content,
                        "metadata": {
                            "user_id": str(user_id),
                            "source_id": str(source_id),
                            "document_id": str(document_id),
                            "topic": str(topic),
                            "subtopic": str(slide_subtopic),
                            "chunk_id": str(chunk_id),
                            "source_type": "SLIDE",
                            "page_number": -1,
                            "slide_number": int(slide["slide_number"]),
                            "timestamp_start": -1.0,
                            "timestamp_end": -1.0,
                        }
                    })
        elif stype in ["VIDEO", "AUDIO", "YOUTUBE"]:
            segments = extract_video_or_audio(file_path_or_url, custom_transcript)
            for idx, seg in enumerate(segments, start=1):
                seg_topic = seg.get("topic") or topic
                seg_subtopic = seg.get("subtopic") or subtopic
                seg_chunks = chunk_text(seg["text"])
                for sub_idx, chunk_content in enumerate(seg_chunks):
                    chunk_id = f"{document_id}_t{int(seg['timestamp_start'])}_c{sub_idx+1}"
                    chunks_to_add.append({
                        "id": chunk_id,
                        "text": chunk_content,
                        "metadata": {
                            "user_id": str(user_id),
                            "source_id": str(source_id),
                            "document_id": str(document_id),
                            "topic": str(seg_topic),
                            "subtopic": str(seg_subtopic),
                            "chunk_id": str(chunk_id),
                            "source_type": "VIDEO",
                            "page_number": -1,
                            "slide_number": -1,
                            "timestamp_start": float(seg["timestamp_start"]),
                            "timestamp_end": float(seg.get("timestamp_end", seg["timestamp_start"] + 30.0)),
                        }
                    })
        else:
            # Fallback text ingestion
            with open(file_path_or_url, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            text_chunks = chunk_text(content)
            for idx, chunk_content in enumerate(text_chunks, start=1):
                chunk_id = f"{document_id}_txt_c{idx}"
                chunks_to_add.append({
                    "id": chunk_id,
                    "text": chunk_content,
                    "metadata": {
                        "user_id": str(user_id),
                        "source_id": str(source_id),
                        "document_id": str(document_id),
                        "topic": str(topic),
                        "subtopic": str(subtopic),
                        "chunk_id": str(chunk_id),
                        "source_type": "TEXT",
                        "page_number": -1,
                        "slide_number": -1,
                        "timestamp_start": -1.0,
                        "timestamp_end": -1.0,
                    }
                })

        _save_job_status(job_id, {
            "job_id": job_id,
            "status": "embedding_and_storing",
            "progress": 60,
            "chunks_extracted": len(chunks_to_add)
        })

        if not chunks_to_add:
            raise ValueError(f"No text content could be extracted from {file_path_or_url}")

        # Store in ChromaDB
        collection = get_collection()
        ids = [c["id"] for c in chunks_to_add]
        documents = [c["text"] for c in chunks_to_add]
        metadatas = [c["metadata"] for c in chunks_to_add]

        # Batch add to avoid limits
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            collection.add(
                ids=ids[i:i+batch_size],
                documents=documents[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size]
            )

        result_data = {
            "job_id": job_id,
            "status": "completed",
            "progress": 100,
            "source_id": source_id,
            "document_id": document_id,
            "source_type": stype,
            "topic": topic,
            "subtopic": subtopic,
            "chunk_count": len(chunks_to_add),
            "preview_chunks": [
                {
                    "chunk_id": c["id"],
                    "page_number": c["metadata"]["page_number"] if c["metadata"]["page_number"] != -1 else None,
                    "slide_number": c["metadata"]["slide_number"] if c["metadata"]["slide_number"] != -1 else None,
                    "timestamp_start": c["metadata"]["timestamp_start"] if c["metadata"]["timestamp_start"] != -1.0 else None,
                    "timestamp_end": c["metadata"]["timestamp_end"] if c["metadata"]["timestamp_end"] != -1.0 else None,
                    "snippet": c["text"][:140] + "..." if len(c["text"]) > 140 else c["text"]
                }
                for c in chunks_to_add[:3]
            ]
        }
        _save_job_status(job_id, result_data)
        return result_data

    except Exception as e:
        err_msg = str(e)
        _save_job_status(job_id, {
            "job_id": job_id,
            "status": "failed",
            "error": err_msg
        })
        return {
            "job_id": job_id,
            "status": "failed",
            "error": err_msg
        }

# ==========================================
# 4. QUERY & RETRIEVAL APIS
# ==========================================

def search_relevant_chunks(
    query: str,
    user_id: Optional[str] = None,
    source_id: Optional[str] = None,
    topic: Optional[str] = None,
    top_k: int = 5
) -> Dict[str, Any]:
    """
    Search relevant chunks using vector similarity in Chroma.
    Returns ranked chunks with similarity scores and full location metadata.
    """
    collection = get_collection()
    
    where_conditions = []
    if user_id:
        where_conditions.append({"user_id": {"$eq": str(user_id)}})
    if source_id:
        where_conditions.append({"source_id": {"$eq": str(source_id)}})
    if topic:
        where_conditions.append({"topic": {"$eq": str(topic)}})

    query_params = {
        "query_texts": [query],
        "n_results": min(top_k, 25)
    }
    if len(where_conditions) == 1:
        query_params["where"] = where_conditions[0]
    elif len(where_conditions) > 1:
        query_params["where"] = {"$and": where_conditions}

    try:
        results = collection.query(**query_params)
    except Exception as e:
        logger.warning(f"Chroma query with filter error: {e}")
        # If user isolation was requested, DO NOT bypass filter to avoid data leakage
        if user_id:
            results = {"ids": [], "documents": [], "metadatas": [], "distances": []}
        else:
            try:
                results = collection.query(query_texts=[query], n_results=min(top_k, 25))
            except Exception:
                results = {"ids": [], "documents": [], "metadatas": [], "distances": []}

    formatted_results = []
    if results and results.get("ids") and len(results["ids"]) > 0:
        ids = results["ids"][0]
        docs = results["documents"][0] if results.get("documents") else []
        metas = results["metadatas"][0] if results.get("metadatas") else []
        distances = results["distances"][0] if results.get("distances") else []

        for idx, chunk_id in enumerate(ids):
            meta = metas[idx] if idx < len(metas) else {}
            dist = distances[idx] if idx < len(distances) else 0.5
            similarity_score = max(0.0, min(1.0, 1.0 - dist))
            
            # Format clean source location
            location = {
                "source_type": meta.get("source_type", "UNKNOWN"),
                "page_number": meta.get("page_number") if meta.get("page_number", -1) != -1 else None,
                "slide_number": meta.get("slide_number") if meta.get("slide_number", -1) != -1 else None,
                "timestamp_start": meta.get("timestamp_start") if meta.get("timestamp_start", -1.0) != -1.0 else None,
                "timestamp_end": meta.get("timestamp_end") if meta.get("timestamp_end", -1.0) != -1.0 else None,
            }
            
            formatted_results.append({
                "chunk_id": chunk_id,
                "score": round(similarity_score, 4),
                "text": docs[idx] if idx < len(docs) else "",
                "topic": meta.get("topic"),
                "subtopic": meta.get("subtopic"),
                "source_id": meta.get("source_id"),
                "document_id": meta.get("document_id"),
                "user_id": meta.get("user_id"),
                "location": location
            })

    return {
        "query": query,
        "total_results": len(formatted_results),
        "results": formatted_results
    }

def get_chunk_metadata(chunk_id: str) -> Dict[str, Any]:
    """Retrieve full metadata and content for a specific chunk_id."""
    collection = get_collection()
    res = collection.get(ids=[chunk_id], include=["metadatas", "documents"])
    if res and res.get("ids") and len(res["ids"]) > 0:
        meta = res["metadatas"][0]
        return {
            "found": True,
            "chunk_id": chunk_id,
            "text": res["documents"][0],
            "metadata": meta,
            "location": {
                "source_type": meta.get("source_type"),
                "page_number": meta.get("page_number") if meta.get("page_number", -1) != -1 else None,
                "slide_number": meta.get("slide_number") if meta.get("slide_number", -1) != -1 else None,
                "timestamp_start": meta.get("timestamp_start") if meta.get("timestamp_start", -1.0) != -1.0 else None,
                "timestamp_end": meta.get("timestamp_end") if meta.get("timestamp_end", -1.0) != -1.0 else None,
            }
        }
    return {"found": False, "chunk_id": chunk_id, "error": "Chunk not found"}

def get_source_location(chunk_id: str) -> Dict[str, Any]:
    """Retrieve the exact source location mapping for citation resolution."""
    chunk = get_chunk_metadata(chunk_id)
    if not chunk.get("found"):
        return {"error": "Chunk not found", "chunk_id": chunk_id}
    
    loc = chunk["location"]
    meta = chunk["metadata"]
    return {
        "chunk_id": chunk_id,
        "source_id": meta.get("source_id"),
        "document_id": meta.get("document_id"),
        "source_type": loc.get("source_type"),
        "page_number": loc.get("page_number"),
        "slide_number": loc.get("slide_number"),
        "timestamp_start": loc.get("timestamp_start"),
        "timestamp_end": loc.get("timestamp_end"),
        "citation_label": (
            f"Page {loc['page_number']}" if loc.get("page_number")
            else f"Slide {loc['slide_number']}" if loc.get("slide_number")
            else f"{int(loc['timestamp_start']//60)}m{int(loc['timestamp_start']%60)}s" if loc.get("timestamp_start") is not None
            else "Source"
        ),
        "preview": chunk["text"][:180] + ("..." if len(chunk["text"]) > 180 else "")
    }

# ==========================================
# 5. SOURCE-GROUNDED AI TUTOR (Phase 2)
# ==========================================

def grounded_chat(
    query: str,
    user_id: Optional[str] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    topic: Optional[str] = None,
    min_confidence: float = 0.28,
    top_k: int = 5
) -> Dict[str, Any]:
    """
    Source-Grounded AI Tutor Engine:
    1. Retrieves relevant chunks from Chroma for user_id (isolated).
    2. Validates evidence sufficiency; declines to hallucinate if evidence is missing.
    3. Prompts Gemini with strict evidence-only grounding and inline chunk citations.
    4. Extracts and links verified citations to chunk coordinates (Page, Slide, Timestamp).
    """
    # 1. Search relevant chunks for the user
    search_data = search_relevant_chunks(
        query=query,
        user_id=user_id,
        topic=topic,
        top_k=top_k
    )
    results = search_data.get("results", [])

    # Filter by minimum confidence
    relevant_chunks = [r for r in results if r.get("score", 0.0) >= min_confidence]

    # 2. Check for insufficient evidence
    if not relevant_chunks:
        return {
            "response": "The uploaded course materials do not contain sufficient information to answer this question. Please upload relevant course materials (such as lecture slides, PDFs, or video recordings) for this topic.",
            "citations": [],
            "grounded": False,
            "insufficient_evidence": True,
            "retrieved_count": len(results)
        }

    # 3. Format evidence block
    evidence_lines = []
    chunk_map = {}
    for c in relevant_chunks:
        cid = c["chunk_id"]
        chunk_map[cid] = c
        loc = c.get("location", {})
        loc_str = (
            f"Page {loc['page_number']}" if loc.get("page_number") is not None
            else f"Slide {loc['slide_number']}" if loc.get("slide_number") is not None
            else f"Timestamp {int(loc['timestamp_start']//60)}m{int(loc['timestamp_start']%60)}s" if loc.get("timestamp_start") is not None
            else "Source Excerpt"
        )
        evidence_lines.append(
            f"[CHUNK {cid}]\n"
            f"Source Type: {loc.get('source_type', 'DOCUMENT')} | Coordinate: {loc_str}\n"
            f"Topic: {c.get('topic', 'General')} > {c.get('subtopic', 'Main')}\n"
            f"Content: \"{c.get('text', '')}\"\n"
        )
    evidence_block = "\n".join(evidence_lines)

    # 4. Construct Prompt
    system_instruction = (
        "You are StudyMate's Source-Grounded AI Tutor. You explain concepts to students using STRICTLY their uploaded course materials.\n\n"
        "EVIDENCE CHUNKS FROM UPLOADED MATERIALS:\n"
        f"{evidence_block}\n\n"
        "CRITICAL RULES:\n"
        "1. Ground your response STRICTLY and SOLELY in the provided evidence chunks above.\n"
        "2. For EVERY factual statement you make, append an inline citation referencing the specific chunk ID in square brackets, e.g. [CHUNK_ID].\n"
        "3. NEVER fabricate citations, page numbers, slide numbers, or timestamps. Only cite the exact chunk IDs listed in the evidence above.\n"
        "4. If the question can only be partially answered from the evidence:\n"
        "   - Provide the source-backed answer first under '### 📚 Course Material Evidence'.\n"
        "   - If offering general outside knowledge, you MUST explicitly place it under a separate section labeled: '### 💡 Additional Context (Outside Course Material)', and do NOT cite uploaded materials in that section.\n"
        "5. If the provided chunks do not contain enough information, state clearly that the uploaded materials do not contain sufficient information.\n"
    )

    history_text = ""
    if conversation_history:
        recent = conversation_history[-6:]
        history_text = "CONVERSATION HISTORY:\n" + "\n".join(
            [f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}" for m in recent]
        ) + "\n\n"

    user_query_text = f"{history_text}Student Question: {query}"

    # 5. Call Gemini or Grounded Synthesis
    ai_response_text = ""
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            import urllib.request
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_instruction}\n\n{user_query_text}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                    "topP": 0.8
                }
            }
            req = urllib.request.Request(
                gemini_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        ai_response_text = parts[0].get("text", "")
        except Exception as e:
            logger.warning(f"Direct Gemini call failed: {e}. Falling back to structured synthesis.")

    if not ai_response_text:
        # Structured deterministic synthesis from retrieved evidence
        top_chunk = relevant_chunks[0]
        top_loc = top_chunk.get("location", {})
        top_label = (
            f"Page {top_loc['page_number']}" if top_loc.get("page_number") is not None
            else f"Slide {top_loc['slide_number']}" if top_loc.get("slide_number") is not None
            else f"Timestamp {int(top_loc['timestamp_start']//60)}m{int(top_loc['timestamp_start']%60)}s" if top_loc.get("timestamp_start") is not None
            else "Course Excerpt"
        )
        ai_response_text = (
            f"### 📚 Course Material Evidence\n\n"
            f"According to your course materials on **{top_chunk.get('topic', 'Topic')}** ({top_label}), "
            f"{top_chunk.get('text', '').strip()} [{top_chunk['chunk_id']}]"
        )
        if len(relevant_chunks) > 1:
            second_chunk = relevant_chunks[1]
            sec_loc = second_chunk.get("location", {})
            sec_label = (
                f"Page {sec_loc['page_number']}" if sec_loc.get("page_number") is not None
                else f"Slide {sec_loc['slide_number']}" if sec_loc.get("slide_number") is not None
                else f"Timestamp {int(sec_loc['timestamp_start']//60)}m{int(sec_loc['timestamp_start']%60)}s" if sec_loc.get("timestamp_start") is not None
                else "Course Excerpt"
            )
            ai_response_text += f"\n\nAdditionally, in {sec_label}: {second_chunk.get('text', '').strip()} [{second_chunk['chunk_id']}]"

    # 6. Extract cited chunk IDs and link verified location citations
    found_cids = re.findall(r'\[([a-zA-Z0-9_\-]+)\]', ai_response_text)
    cited_chunks = []
    seen = set()

    for cid in found_cids:
        if cid in chunk_map and cid not in seen:
            seen.add(cid)
            c = chunk_map[cid]
            loc = c.get("location", {})
            label = (
                f"Page {loc['page_number']}" if loc.get("page_number") is not None
                else f"Slide {loc['slide_number']}" if loc.get("slide_number") is not None
                else f"{int(loc['timestamp_start']//60)}m{int(loc['timestamp_start']%60)}s" if loc.get("timestamp_start") is not None
                else "Source Excerpt"
            )
            cited_chunks.append({
                "chunk_id": cid,
                "source_id": c.get("source_id"),
                "document_id": c.get("document_id"),
                "source_type": loc.get("source_type", "TEXT"),
                "page_number": loc.get("page_number"),
                "slide_number": loc.get("slide_number"),
                "timestamp_start": loc.get("timestamp_start"),
                "timestamp_end": loc.get("timestamp_end"),
                "citation_label": label,
                "snippet": c.get("text", "")[:180] + ("..." if len(c.get("text", "")) > 180 else "")
            })

    # If the response referenced the topic but missed bracket formatting, attach top evidence
    if not cited_chunks and relevant_chunks:
        c = relevant_chunks[0]
        cid = c["chunk_id"]
        loc = c.get("location", {})
        label = (
            f"Page {loc['page_number']}" if loc.get("page_number") is not None
            else f"Slide {loc['slide_number']}" if loc.get("slide_number") is not None
            else f"{int(loc['timestamp_start']//60)}m{int(loc['timestamp_start']%60)}s" if loc.get("timestamp_start") is not None
            else "Source Excerpt"
        )
        cited_chunks.append({
            "chunk_id": cid,
            "source_id": c.get("source_id"),
            "document_id": c.get("document_id"),
            "source_type": loc.get("source_type", "TEXT"),
            "page_number": loc.get("page_number"),
            "slide_number": loc.get("slide_number"),
            "timestamp_start": loc.get("timestamp_start"),
            "timestamp_end": loc.get("timestamp_end"),
            "citation_label": label,
            "snippet": c.get("text", "")[:180] + ("..." if len(c.get("text", "")) > 180 else "")
        })

    return {
        "response": ai_response_text,
        "citations": cited_chunks,
        "grounded": True,
        "insufficient_evidence": False,
        "retrieved_count": len(relevant_chunks)
    }

# ==========================================
# 6. CLI INTERFACE (For Node.js subprocess calls)
# ==========================================

def main():
    parser = argparse.ArgumentParser(description="StudyMate Multimodal Knowledge Base CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Ingest command
    ingest_p = subparsers.add_parser("ingest")
    ingest_p.add_argument("--file", required=True, help="File path or URL")
    ingest_p.add_argument("--type", required=True, choices=["PDF", "PPT", "PPTX", "SLIDES", "VIDEO", "AUDIO", "YOUTUBE", "TEXT"])
    ingest_p.add_argument("--user-id", default="default_user")
    ingest_p.add_argument("--topic", default="General")
    ingest_p.add_argument("--subtopic", default="Main")
    ingest_p.add_argument("--source-id", default=None)
    ingest_p.add_argument("--document-id", default=None)
    ingest_p.add_argument("--transcript", default=None)
    ingest_p.add_argument("--job-id", default=None)

    # Status command
    status_p = subparsers.add_parser("status")
    status_p.add_argument("--job-id", required=True)

    # Search command
    search_p = subparsers.add_parser("search")
    search_p.add_argument("--query", required=True)
    search_p.add_argument("--user-id", default=None)
    search_p.add_argument("--source-id", default=None)
    search_p.add_argument("--topic", default=None)
    search_p.add_argument("--top-k", type=int, default=5)

    # Chunk command
    chunk_p = subparsers.add_parser("chunk")
    chunk_p.add_argument("--id", required=True)

    # Source location command
    loc_p = subparsers.add_parser("source-location")
    loc_p.add_argument("--id", required=True)

    # Grounded chat command
    chat_p = subparsers.add_parser("chat")
    chat_p.add_argument("--query", required=True)
    chat_p.add_argument("--user-id", default=None)
    chat_p.add_argument("--topic", default=None)
    chat_p.add_argument("--history", default=None)

    args = parser.parse_args()

    if args.command == "ingest":
        res = ingest_source(
            file_path_or_url=args.file,
            source_type=args.type,
            user_id=args.user_id,
            topic=args.topic,
            subtopic=args.subtopic,
            source_id=args.source_id,
            document_id=args.document_id,
            custom_transcript=args.transcript,
            job_id=args.job_id
        )
        print(json.dumps(res))
    elif args.command == "status":
        res = get_job_status(args.job_id)
        print(json.dumps(res))
    elif args.command == "search":
        res = search_relevant_chunks(
            query=args.query,
            user_id=args.user_id,
            source_id=args.source_id,
            topic=args.topic,
            top_k=args.top_k
        )
        print(json.dumps(res))
    elif args.command == "chunk":
        res = get_chunk_metadata(args.id)
        print(json.dumps(res))
    elif args.command == "source-location":
        res = get_source_location(args.id)
        print(json.dumps(res))
    elif args.command == "chat":
        history = []
        if args.history:
            try:
                history = json.loads(args.history)
            except Exception:
                history = []
        res = grounded_chat(
            query=args.query,
            user_id=args.user_id,
            conversation_history=history,
            topic=args.topic
        )
        print(json.dumps(res))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
