export type VideoSourceType = 'youtube' | 'upload';
export type VideoStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface TranscriptSegment {
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  topic?: string;
  subtopic?: string;
}

export interface VideoRecord {
  id: string;
  userId: string;
  title: string;
  sourceType: VideoSourceType;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  storagePath?: string | null;
  fileUrl?: string | null;
  status: VideoStatus;
  durationSeconds: number;
  thumbnailUrl?: string | null;
  transcriptStatus: TranscriptStatus;
  transcriptJson?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoCitation {
  chunk_id: string;
  source_id?: string;
  document_id?: string;
  source_type: string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  seek_seconds?: number;
  formatted_timestamp?: string;
  citation_label: string;
  snippet?: string;
}

export interface VideoAskResponse {
  success: boolean;
  videoId: string;
  question: string;
  response: string;
  citations: VideoCitation[];
  grounded: boolean;
  insufficient_evidence?: boolean;
  partial_answer?: boolean;
  evidence_coverage_score?: number;
}
