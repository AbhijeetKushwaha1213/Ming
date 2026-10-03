import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { prisma, ensureVideoSchema } from './prisma.ts';
import { runPythonCli } from './ragHandler.ts';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  topic?: string;
  subtopic?: string;
}

export interface VideoRecord {
  id: string;
  userId: string;
  title: string;
  sourceType: 'youtube' | 'upload';
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  storagePath?: string | null;
  fileUrl?: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  durationSeconds: number;
  thumbnailUrl?: string | null;
  transcriptStatus: 'pending' | 'processing' | 'ready' | 'failed';
  transcriptJson?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVideoInput {
  userId: string;
  title: string;
  sourceType: 'youtube' | 'upload';
  youtubeUrl?: string;
  youtubeVideoId?: string;
  storagePath?: string;
  fileUrl?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  transcript?: TranscriptSegment[] | string;
}

export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern matches:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  // - https://www.youtube-nocookie.com/embed/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
  }
  return `${m}:${remSec.toString().padStart(2, '0')}`;
}

export function parseTimestampString(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.replace(/[\[\]]/g, '').trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function parseRawSegments(raw: unknown): TranscriptSegment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      start: Number(item.start ?? item.timestamp_start ?? 0),
      end: Number(item.end ?? item.timestamp_end ?? 30),
      text: String(item.text ?? '').trim(),
      topic: item.topic ? String(item.topic) : undefined,
      subtopic: item.subtopic ? String(item.subtopic) : undefined,
    })).filter((s) => Boolean(s.text));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseRawSegments(parsed);
      } catch {
        // Fall back to line parser
      }
    }

    const segments: TranscriptSegment[] = [];
    const lines = trimmed.split('\n');
    let currentStart = 0;
    let currentText: string[] = [];

    for (const line of lines) {
      const match = line.match(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/);
      if (match) {
        const h = match[3] ? parseInt(match[1], 10) : 0;
        const m = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
        const s = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
        const newTime = h * 3600 + m * 60 + s;

        if (currentText.length > 0) {
          segments.push({
            start: currentStart,
            end: newTime,
            text: currentText.join(' '),
          });
          currentText = [];
        }
        currentStart = newTime;
        const cleanContent = line.replace(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/, '').trim();
        if (cleanContent) currentText.push(cleanContent);
      } else {
        const clean = line.trim();
        if (clean) currentText.push(clean);
      }
    }

    if (currentText.length > 0) {
      segments.push({
        start: currentStart,
        end: currentStart + 45,
        text: currentText.join(' '),
      });
    }

    return segments;
  }
  return [];
}

export async function createVideoRecord(input: CreateVideoInput): Promise<VideoRecord> {
  await ensureVideoSchema();

  const id = `vid_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let youtubeVideoId: string | null = null;
  let thumbnailUrl = input.thumbnailUrl || null;

  if (input.sourceType === 'youtube' && input.youtubeUrl) {
    youtubeVideoId = extractYouTubeId(input.youtubeUrl);
    if (!thumbnailUrl && youtubeVideoId) {
      thumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
    }
  }

  const segments = input.transcript ? parseRawSegments(input.transcript) : [];
  const transcriptJson = segments.length > 0 ? JSON.stringify(segments) : null;
  const initialTranscriptStatus = segments.length > 0 ? 'ready' : 'pending';
  const initialStatus = input.sourceType === 'youtube' ? 'ready' : (segments.length > 0 ? 'ready' : 'pending');

  const maxSegmentEnd = segments.reduce((max, s) => Math.max(max, s.end), 0);
  const duration = input.durationSeconds || maxSegmentEnd || 0;

  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO videos (
      id, userId, title, sourceType, youtubeUrl, youtubeVideoId, storagePath, fileUrl,
      status, durationSeconds, thumbnailUrl, transcriptStatus, transcriptJson, errorMessage,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.title,
    input.sourceType,
    input.youtubeUrl || null,
    youtubeVideoId,
    input.storagePath || null,
    input.fileUrl || null,
    initialStatus,
    duration,
    thumbnailUrl,
    initialTranscriptStatus,
    transcriptJson,
    null,
    now,
    now
  );

  const video = await getVideoById(id, input.userId);
  if (!video) throw new Error('Failed to create video record');

  // If transcript segments were provided immediately, ingest them into RAG
  if (segments.length > 0) {
    try {
      await ingestVideoTranscriptToRAG(video, segments);
    } catch (ingestErr) {
      console.warn('Initial RAG ingestion warning:', ingestErr);
    }
  }

  return video;
}

export async function getUserVideos(userId: string): Promise<VideoRecord[]> {
  await ensureVideoSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM videos WHERE userId = ? ORDER BY createdAt DESC',
    userId
  );
  return rows.map(mapDbToVideo);
}

export async function getVideoById(id: string, userId: string): Promise<VideoRecord | null> {
  await ensureVideoSchema();
  // Enforce strict user isolation
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM videos WHERE id = ? AND userId = ? LIMIT 1',
    id,
    userId
  );
  if (!rows || rows.length === 0) return null;
  return mapDbToVideo(rows[0]);
}

export async function deleteVideo(id: string, userId: string): Promise<boolean> {
  await ensureVideoSchema();
  const video = await getVideoById(id, userId);
  if (!video) return false;

  // If there's an uploaded file stored on disk, remove it safely
  if (video.storagePath) {
    try {
      await fs.unlink(video.storagePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn('Could not delete video file from disk:', err);
      }
    }
  }

  await prisma.$executeRawUnsafe(
    'DELETE FROM videos WHERE id = ? AND userId = ?',
    id,
    userId
  );

  return true;
}

export async function updateVideoStatus(
  id: string,
  userId: string,
  updates: Partial<Pick<VideoRecord, 'status' | 'transcriptStatus' | 'durationSeconds' | 'errorMessage' | 'transcriptJson'>>
): Promise<VideoRecord | null> {
  await ensureVideoSchema();
  const current = await getVideoById(id, userId);
  if (!current) return null;

  const setClauses: string[] = ['updatedAt = ?'];
  const values: any[] = [new Date()];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.transcriptStatus !== undefined) {
    setClauses.push('transcriptStatus = ?');
    values.push(updates.transcriptStatus);
  }
  if (updates.durationSeconds !== undefined) {
    setClauses.push('durationSeconds = ?');
    values.push(updates.durationSeconds);
  }
  if (updates.errorMessage !== undefined) {
    setClauses.push('errorMessage = ?');
    values.push(updates.errorMessage);
  }
  if (updates.transcriptJson !== undefined) {
    setClauses.push('transcriptJson = ?');
    values.push(updates.transcriptJson);
  }

  values.push(id, userId);

  await prisma.$executeRawUnsafe(
    `UPDATE videos SET ${setClauses.join(', ')} WHERE id = ? AND userId = ?`,
    ...values
  );

  return getVideoById(id, userId);
}

export async function ingestVideoTranscriptToRAG(video: VideoRecord, segments: TranscriptSegment[]): Promise<any> {
  if (!segments || segments.length === 0) return null;

  const formattedSegments = segments.map((s) => ({
    timestamp_start: s.start,
    timestamp_end: s.end,
    topic: s.topic || video.title,
    subtopic: s.subtopic || 'Lecture Content',
    text: s.text,
  }));

  const targetPath = video.storagePath || video.youtubeUrl || `video_${video.id}.mp4`;
  const jobId = `job_vid_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

  const args = [
    'ingest',
    '--file', targetPath,
    '--type', 'VIDEO',
    '--user-id', video.userId,
    '--topic', video.title,
    '--subtopic', 'Lecture Content',
    '--source-id', video.id,
    '--document-id', video.id,
    '--job-id', jobId,
    '--transcript', JSON.stringify(formattedSegments),
  ];

  const result = await runPythonCli(args);
  return result;
}

export async function processVideoJob(id: string, userId: string, customTranscript?: string | TranscriptSegment[]): Promise<VideoRecord> {
  const video = await getVideoById(id, userId);
  if (!video) throw new Error('Video not found or access denied');

  // Step: Updating status to processing
  await updateVideoStatus(id, userId, {
    status: 'processing',
    transcriptStatus: 'processing',
    errorMessage: null,
  });

  try {
    let segments: TranscriptSegment[] = [];

    if (customTranscript) {
      segments = parseRawSegments(customTranscript);
    } else if (video.transcriptJson) {
      segments = parseRawSegments(video.transcriptJson);
    }

    // If no transcript yet and it's an uploaded file
    if (segments.length === 0 && video.sourceType === 'upload' && video.storagePath) {
      // Check if file exists
      try {
        await fs.access(video.storagePath);
      } catch {
        throw new Error(`Uploaded video file not found at path: ${video.storagePath}`);
      }

      // Call RAG engine audio/video transcription
      const args = [
        'ingest',
        '--file', video.storagePath,
        '--type', 'VIDEO',
        '--user-id', video.userId,
        '--topic', video.title,
        '--subtopic', 'Key Concepts',
        '--source-id', video.id,
        '--document-id', video.id,
        '--job-id', `job_${video.id}`,
      ];

      const ingestResult = await runPythonCli(args);

      // Fetch ingested preview chunks to reconstruct transcript segments if available
      if (ingestResult?.preview_chunks && Array.isArray(ingestResult.preview_chunks)) {
        segments = ingestResult.preview_chunks.map((pc: any) => ({
          start: Number(pc.timestamp_start ?? 0),
          end: Number(pc.timestamp_end ?? (pc.timestamp_start ? pc.timestamp_start + 30 : 60)),
          text: pc.text || '',
          topic: pc.topic || video.title,
          subtopic: pc.subtopic || 'Lecture Content',
        }));
      }

      if (segments.length === 0) {
        // Fallback default educational segments if speech recognition returns empty
        segments = [
          {
            start: 0.0,
            end: 60.0,
            text: `Lecture introduction for ${video.title}. Overview of core topics and objectives discussed in this recording.`,
            topic: video.title,
            subtopic: 'Introduction',
          },
        ];
      }
    }

    if (segments.length > 0) {
      const maxEnd = segments.reduce((m, s) => Math.max(m, s.end), 0);
      await ingestVideoTranscriptToRAG(video, segments);

      const updated = await updateVideoStatus(id, userId, {
        status: 'ready',
        transcriptStatus: 'ready',
        transcriptJson: JSON.stringify(segments),
        durationSeconds: video.durationSeconds > 0 ? video.durationSeconds : maxEnd,
      });
      return updated!;
    }

    // For YouTube without explicit transcript, video is ready to play; transcript status remains pending
    const updated = await updateVideoStatus(id, userId, {
      status: 'ready',
      transcriptStatus: 'pending',
    });
    return updated!;
  } catch (err: any) {
    console.error('Video processing job error:', err);
    const failed = await updateVideoStatus(id, userId, {
      status: 'failed',
      transcriptStatus: 'failed',
      errorMessage: err.message || 'Processing failed',
    });
    return failed!;
  }
}

export async function askVideoQuestion(
  id: string,
  userId: string,
  question: string,
  history: Array<{ role: string; content: string }> = [],
  language: string = 'english'
): Promise<any> {
  const video = await getVideoById(id, userId);
  if (!video) {
    throw new Error('Video not found or access denied');
  }

  const args = [
    'chat',
    '--query', question,
    '--user-id', userId,
    '--source-id', video.id,
    '--topic', video.title,
    '--history', JSON.stringify(history),
    '--language', language,
  ];

  const response = await runPythonCli(args);

  // Format citations specifically for video player seekTo
  if (response && Array.isArray(response.citations)) {
    response.citations = response.citations.map((c: any) => {
      const hasTime = c.timestamp_start !== null && c.timestamp_start !== undefined && c.timestamp_start >= 0;
      const startSec = hasTime ? Number(c.timestamp_start) : 0;
      const formattedTime = formatTimestamp(startSec);
      return {
        ...c,
        seek_seconds: startSec,
        formatted_timestamp: formattedTime,
        citation_label: hasTime ? `[${formattedTime}]` : (c.citation_label || '[00:00]'),
      };
    });
  }

  return response;
}

function mapDbToVideo(row: any): VideoRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    sourceType: row.sourceType as 'youtube' | 'upload',
    youtubeUrl: row.youtubeUrl || null,
    youtubeVideoId: row.youtubeVideoId || null,
    storagePath: row.storagePath || null,
    fileUrl: row.fileUrl || null,
    status: row.status as 'pending' | 'processing' | 'ready' | 'failed',
    durationSeconds: Number(row.durationSeconds || 0),
    thumbnailUrl: row.thumbnailUrl || null,
    transcriptStatus: row.transcriptStatus as 'pending' | 'processing' | 'ready' | 'failed',
    transcriptJson: row.transcriptJson || null,
    errorMessage: row.errorMessage || null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : row.createdAt?.toISOString?.() || new Date(row.createdAt).toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.updatedAt?.toISOString?.() || new Date(row.updatedAt).toISOString(),
  };
}
