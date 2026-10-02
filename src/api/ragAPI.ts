import type { RagSearchResponse, RagIngestResponse, RagJobStatus, RagChunk, CitationData, GroundedChatResponse } from '@/types/resource';

export type { CitationData, GroundedChatResponse };

const API_BASE = '/api/rag';

export async function ingestSource(params: {
  file?: File;
  url?: string;
  text?: string;
  transcript?: string;
  topic?: string;
  subtopic?: string;
  userId?: string;
  title?: string;
  sourceType?: string;
}): Promise<RagIngestResponse> {
  const { file, url, text, transcript, topic = 'General', subtopic = 'Main', userId = 'default_user', title, sourceType } = params;

  let base64Data: string | undefined;
  let fileName: string | undefined;

  if (file) {
    fileName = file.name;
    base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:*;base64, prefix
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const payload = {
    userId,
    title: title || fileName || (url ? new URL(url).pathname : 'Source Document'),
    topic,
    subtopic,
    sourceType: sourceType || (fileName?.endsWith('.pdf') ? 'PDF' : fileName?.match(/\.pptx?$/i) ? 'PPTX' : fileName?.match(/\.(mp4|webm|mp3|wav|m4a)$/i) ? 'VIDEO' : url ? 'VIDEO' : 'TEXT'),
    base64Data,
    fileName,
    url,
    text,
    transcript,
  };

  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ingest failed (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function getIngestStatus(jobId: string): Promise<RagJobStatus> {
  const res = await fetch(`${API_BASE}/status/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function searchChunks(
  query: string,
  options?: { topK?: number; topic?: string; userId?: string; sourceId?: string }
): Promise<RagSearchResponse> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      topK: options?.topK || 5,
      topic: options?.topic,
      userId: options?.userId,
      sourceId: options?.sourceId,
    }),
  });

  if (!res.ok) {
    throw new Error(`RAG search failed: ${res.statusText}`);
  }

  return res.json();
}

export async function getChunk(chunkId: string): Promise<{ found: boolean; chunk_id: string; text: string; metadata: any; location: any }> {
  const res = await fetch(`${API_BASE}/chunk/${encodeURIComponent(chunkId)}`);
  if (!res.ok) {
    throw new Error(`Get chunk failed: ${res.statusText}`);
  }
  return res.json();
}

export async function getSourceLocation(chunkId: string): Promise<{
  chunk_id: string;
  source_id: string;
  document_id: string;
  source_type: string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  citation_label: string;
  preview: string;
}> {
  const res = await fetch(`${API_BASE}/source-location/${encodeURIComponent(chunkId)}`);
  if (!res.ok) {
    throw new Error(`Source location retrieval failed: ${res.statusText}`);
  }
  return res.json();
}

export async function askGroundedTutor(params: {
  message: string;
  userId?: string;
  topic?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  language?: 'english' | 'hinglish' | 'hindi';
}): Promise<GroundedChatResponse> {
  const { message, userId, topic, conversationHistory, language = 'english' } = params;

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: message,
        userId,
        topic,
        conversationHistory,
        language,
      }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend /api/rag/chat call failed, using client retrieval fallback:', err);
  }

  // Client-side fallback if backend /api/rag/chat endpoint is unreachable
  // Step 1: Retrieve chunks using authenticated user_id
  const searchRes = await searchChunks(message, {
    userId,
    topic,
    topK: 5,
  });

  const relevant = (searchRes.results || []).filter((r) => r.score >= 0.28);
  if (!relevant.length) {
    return {
      response:
        'The uploaded course materials do not contain sufficient information to answer this question. Please upload relevant course materials (such as lecture slides, PDFs, or video recordings) for this topic.',
      citations: [],
      grounded: false,
      insufficient_evidence: true,
      retrieved_count: searchRes.results?.length || 0,
    };
  }

  // Format citations from top relevant chunks
  const citations: CitationData[] = relevant.slice(0, 3).map((c) => {
    const loc = c.location || { source_type: 'TEXT' };
    const label = loc.page_number
      ? `Page ${loc.page_number}`
      : loc.slide_number
      ? `Slide ${loc.slide_number}`
      : loc.timestamp_start !== null && loc.timestamp_start !== undefined
      ? `${Math.floor(loc.timestamp_start / 60)}m${Math.floor(loc.timestamp_start % 60)}s`
      : 'Source Excerpt';

    return {
      chunk_id: c.chunk_id,
      source_id: c.source_id,
      document_id: c.document_id,
      source_type: loc.source_type || 'TEXT',
      page_number: loc.page_number,
      slide_number: loc.slide_number,
      timestamp_start: loc.timestamp_start,
      timestamp_end: loc.timestamp_end,
      citation_label: label,
      snippet: c.text?.slice(0, 180) + (c.text?.length > 180 ? '...' : ''),
    };
  });

  const top = relevant[0];
  const loc = top.location || { source_type: 'TEXT' };
  const label = loc.page_number
    ? `Page ${loc.page_number}`
    : loc.slide_number
    ? `Slide ${loc.slide_number}`
    : loc.timestamp_start !== null && loc.timestamp_start !== undefined
    ? `${Math.floor(loc.timestamp_start / 60)}m${Math.floor(loc.timestamp_start % 60)}s`
    : 'Course Excerpt';

  return {
    response: `### 📚 Course Material Evidence\n\nAccording to your course materials on **${top.topic || 'Topic'}** (${label}):\n${top.text} [${top.chunk_id}]`,
    citations,
    grounded: true,
    insufficient_evidence: false,
    retrieved_count: relevant.length,
  };
}

