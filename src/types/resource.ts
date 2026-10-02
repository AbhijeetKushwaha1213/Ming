export type ResourceType = 'NOTE' | 'LINK' | 'PDF' | 'PPTX' | 'VIDEO' | 'AUDIO';

export interface ResourceItem {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  type: ResourceType;
  noteContent?: string | null;
  linkUrl?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  folder?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceInput {
  title: string;
  description?: string;
  type: ResourceType;
  noteContent?: string;
  linkUrl?: string;
  fileUrl?: string;
  storagePath?: string;
  folder?: string;
  tags?: string[];
}

export interface RagChunkLocation {
  source_type: string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  is_diagram?: boolean;
  diagram_caption?: string;
}

export interface RagChunk {
  chunk_id: string;
  score: number;
  text: string;
  topic?: string;
  subtopic?: string;
  source_id?: string;
  document_id?: string;
  user_id?: string;
  location: RagChunkLocation;
  is_diagram?: boolean;
  diagram_caption?: string;
}

export interface RagSearchResponse {
  query: string;
  total_results: number;
  results: RagChunk[];
}

export interface RagIngestResponse {
  success: boolean;
  jobId: string;
  sourceId: string;
  documentId: string;
  sourceType: string;
  topic: string;
  subtopic: string;
  chunkCount: number;
  previewChunks: Array<{
    chunk_id: string;
    page_number?: number | null;
    slide_number?: number | null;
    timestamp_start?: number | null;
    timestamp_end?: number | null;
    snippet: string;
  }>;
}

export interface RagJobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'embedding_and_storing' | 'completed' | 'failed';
  progress?: number;
  chunks_extracted?: number;
  chunk_count?: number;
  error?: string;
}

export interface CitationData {
  chunk_id: string;
  source_id?: string;
  document_id?: string;
  source_type: string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  is_diagram?: boolean;
  diagram_caption?: string;
  citation_label: string;
  snippet?: string;
}

export interface GroundedChatResponse {
  response: string;
  citations: CitationData[];
  grounded: boolean;
  insufficient_evidence: boolean;
  retrieved_count?: number;
}

