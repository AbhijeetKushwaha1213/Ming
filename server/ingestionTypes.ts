/**
 * Canonical Phase 2 — Knowledge Ingestion Data Models
 * Defines normalized models for multimodal documents, content blocks,
 * semantic chunks, lifecycle statuses, and complete provenance metadata.
 */

export type IngestionLifecycleStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export type TenantType = 'USER_PRIVATE' | 'SYSTEM_PUBLIC' | 'COMMUNITY';

export type SourceType =
  | 'PDF'
  | 'PPT'
  | 'PPTX'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'TEXT'
  | 'NOTE';

export type ExtractionMethod =
  | 'NATIVE_TEXT'
  | 'OCR'
  | 'VISION_DESCRIPTION'
  | 'TRANSCRIPTION'
  | 'TABLE'
  | 'SPEAKER_NOTES';

export interface ProvenanceMetadata {
  user_id: string;
  tenant_type: TenantType;
  resource_id: string;
  document_id: string;
  source_id: string;
  chunk_id: string;
  source_type: SourceType;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  extraction_method: ExtractionMethod;
  content_hash: string;
  chunk_index: number;
  section?: string | null;
  heading?: string | null;
  embedding_model: string;
  embedding_version: string;
  created_at: string;
}

export interface ContentBlock {
  blockId: string;
  type: 'TEXT' | 'SECTION' | 'HEADING' | 'IMAGE' | 'DIAGRAM' | 'TABLE' | 'TRANSCRIPT_SEGMENT' | 'SPEAKER_NOTE';
  text: string;
  extractionMethod: ExtractionMethod;
  confidence?: number;
  pageNumber?: number | null;
  slideNumber?: number | null;
  timestampStart?: number | null;
  timestampEnd?: number | null;
  metadata?: Record<string, any>;
}

export interface SemanticChunk {
  chunkId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  section?: string | null;
  heading?: string | null;
  provenance: ProvenanceMetadata;
}

export interface IngestionDocument {
  documentId: string;
  sourceId: string;
  resourceId: string;
  userId: string;
  tenantType: TenantType;
  title: string;
  sourceType: SourceType;
  mimeType: string;
  fileSize: number;
  contentHash: string;
  lifecycleStatus: IngestionLifecycleStatus;
  blocks: ContentBlock[];
  chunks: SemanticChunk[];
  metadata: {
    pageCount?: number;
    slideCount?: number;
    durationSeconds?: number;
    imageWidth?: number;
    imageHeight?: number;
    extractedAt: string;
    hasOcrFallback?: boolean;
    hasVisionDescriptions?: boolean;
    transcriptionProvider?: string;
    [key: string]: any;
  };
  metrics?: {
    validationLatencyMs?: number;
    extractionLatencyMs?: number;
    ocrLatencyMs?: number;
    visionLatencyMs?: number;
    transcriptionLatencyMs?: number;
    chunkingLatencyMs?: number;
    embeddingLatencyMs?: number;
    vectorStoreLatencyMs?: number;
    totalLatencyMs?: number;
  };
  error?: string | null;
}

export interface IngestionRecord {
  id: string;
  resourceId: string;
  userId: string;
  tenantType: TenantType;
  documentId: string;
  sourceType: SourceType;
  status: IngestionLifecycleStatus;
  contentHash: string;
  chunkCount: number;
  error?: string | null;
  metricsJson?: string | null;
  createdAt: string;
  updatedAt: string;
}
