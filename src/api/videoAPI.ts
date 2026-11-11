import { supabase } from '@/integrations/supabase/client';
import type { VideoRecord, TranscriptSegment, VideoAskResponse, VideoCitation } from '@/types/video';
import {
  extractYouTubeId,
  parseYouTubeInput,
  extractTimestampCitations,
  formatTimestamp,
  validateTranscriptSegments,
  verifyVideoEvidenceIntegrity,
  isKnownMismatchedVideoRecord,
  CAPTION_CUE_END_TOLERANCE_SECONDS,
} from '@/utils/videoUtils';
import { geminiClient } from '@/utils/geminiClient';

const STORAGE_KEY = 'ming_user_videos';
const SESSION_TIMEOUT_MS = 5000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

export class VideoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'VideoApiError';
    this.status = status;
  }
}

export class VideoAuthError extends VideoApiError {
  readonly isAuthError = true;

  constructor(
    message = 'Authentication required or your session has expired. Please sign in to continue.'
  ) {
    super(message, 401);
    this.name = 'VideoAuthError';
  }
}

export function isVideoAuthError(err: unknown): err is VideoAuthError {
  return Boolean(
    err &&
      typeof err === 'object' &&
      ((err as any).isAuthError === true ||
        (err as any).status === 401 ||
        (err as any).name === 'VideoAuthError')
  );
}

// Never inject hardcoded fake sample videos (e.g. mismatched MIT 18.06 / Gilbert Strang records)
const DEFAULT_SAMPLE_VIDEOS: VideoRecord[] = [];

const LEGACY_CORRUPTED_IDS = new Set([
  'vid_sample_mit_linear_algebra',
  'vid_sample_3blue1brown_calculus',
]);

function sanitizeStoredVideoRecord(video: VideoRecord): { record: VideoRecord; changed: boolean } {
  const integrity = verifyVideoEvidenceIntegrity(video);
  if (!integrity.valid && (video.transcriptStatus === 'ready' || video.transcriptJson)) {
    return {
      changed: true,
      record: {
        ...video,
        transcriptStatus: 'unavailable',
        transcriptJson: null,
        extractionStatus: 'failed',
        errorMessage: video.errorMessage || integrity.error || 'Video evidence integrity verification failed',
      },
    };
  }
  return { record: video, changed: false };
}

export function getStoredVideos(): VideoRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let changed = false;
        const sanitized: VideoRecord[] = [];
        for (const entry of parsed as VideoRecord[]) {
          if (!entry || typeof entry !== 'object') {
            changed = true;
            continue;
          }
          if (LEGACY_CORRUPTED_IDS.has(entry.id) || (entry.userId === 'default_user' && isKnownMismatchedVideoRecord(entry))) {
            changed = true;
            continue;
          }
          const res = sanitizeStoredVideoRecord(entry);
          if (res.changed) changed = true;
          sanitized.push(res.record);
        }
        if (changed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        }
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Failed to parse local videos:', err);
  }
  return DEFAULT_SAMPLE_VIDEOS;
}

export function saveStoredVideo(video: VideoRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredVideos();
    const { record } = sanitizeStoredVideoRecord(video);
    const filtered = current.filter((v) => v.id !== record.id);
    const updated = [record, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save video to localStorage:', err);
  }
}

export function removeStoredVideo(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredVideos();
    const updated = current.filter((v) => v.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to remove video from localStorage:', err);
  }
}

export function findStoredVideo(id: string): VideoRecord | null {
  const list = getStoredVideos();
  return list.find((v) => v.id === id) || null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveValidAccessToken(forceRefresh = false): Promise<string | null> {
  try {
    if (!supabase?.auth) return null;

    if (!forceRefresh && typeof supabase.auth.getSession === 'function') {
      const sessionRes = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS);
      const session = sessionRes?.data?.session;
      if (session?.access_token) {
        const expiresAtMs =
          typeof session.expires_at === 'number' ? session.expires_at * 1000 : null;
        const needsRefresh =
          expiresAtMs !== null && expiresAtMs <= Date.now() + TOKEN_REFRESH_BUFFER_MS;
        if (!needsRefresh) {
          return session.access_token;
        }
      }
    }

    if (typeof supabase.auth.refreshSession === 'function') {
      const refreshedRes = await withTimeout(supabase.auth.refreshSession(), SESSION_TIMEOUT_MS);
      const refreshedToken = refreshedRes?.data?.session?.access_token;
      if (refreshedToken) {
        return refreshedToken;
      }
    }
  } catch {
    // Session unavailable or expired; do not log tokens
  }
  return null;
}

async function getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const token = await resolveValidAccessToken(forceRefresh);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function fetchWithTimeout(
  endpoint: string,
  options: RequestInit,
  authHeaders: Record<string, string>,
  timeoutMs: number
): Promise<{ res: Response; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    return { res, data };
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Authenticated API client wrapper:
 * - Awaits Supabase session initialization and refreshes expired/expiring tokens.
 * - On 401, attempts one silent session refresh + retry before surfacing VideoAuthError.
 */
async function request<T>(endpoint: string, options: RequestInit = {}, timeoutMs = 4500): Promise<T> {
  const authHeaders = await getAuthHeaders(false);
  let { res, data } = await fetchWithTimeout(endpoint, options, authHeaders, timeoutMs);

  if (res.status === 401) {
    const refreshedHeaders = await getAuthHeaders(true);
    if (
      refreshedHeaders.Authorization &&
      refreshedHeaders.Authorization !== authHeaders.Authorization
    ) {
      const retried = await fetchWithTimeout(endpoint, options, refreshedHeaders, timeoutMs);
      res = retried.res;
      data = retried.data;
    }
  }

  if (res.status === 401) {
    throw new VideoAuthError(
      data?.error || 'Authentication required or your session has expired. Please sign in to continue.'
    );
  }

  if (!res.ok) {
    const errMsg = data?.error || res.statusText || 'Request failed';
    throw new VideoApiError(errMsg, res.status);
  }

  return data as T;
}

function parseTranscriptInput(raw?: string | TranscriptSegment[]): TranscriptSegment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    // Parse timestamp lines: e.g. [01:20] Topic explanation
    const lines = trimmed.split('\n');
    const segs: TranscriptSegment[] = [];
    let start = 0;
    for (const line of lines) {
      const match = line.match(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/);
      if (match) {
        const h = match[3] ? parseInt(match[1], 10) : 0;
        const m = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
        const s = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
        const time = h * 3600 + m * 60 + s;
        const text = line.replace(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/, '').trim();
        if (text) {
          segs.push({
            start,
            end: time > start ? time : start + 60,
            text,
          });
          start = time;
        }
      }
    }
    return segs;
  }
  return [];
}

export async function fetchUserVideos(): Promise<VideoRecord[]> {
  try {
    const data = await request<{ success: boolean; videos: VideoRecord[] }>('/api/videos', {}, 3000);
    if (data && Array.isArray(data.videos)) {
      const sanitized = data.videos
        .filter((v) => v && !LEGACY_CORRUPTED_IDS.has(v.id))
        .map((v) => sanitizeStoredVideoRecord(v).record);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        } catch {
          // Ignore storage quota warnings
        }
      }
      return sanitized;
    }
  } catch (err) {
    if (isVideoAuthError(err) || err instanceof VideoApiError) {
      throw err;
    }
    // API server genuinely unreachable - fall back to sanitized local cache
    console.info('API unreachable; using sanitized local video cache');
  }

  return getStoredVideos();
}

export async function fetchVideoById(id: string): Promise<VideoRecord> {
  try {
    const data = await request<{ success: boolean; video: VideoRecord }>(
      `/api/videos/${encodeURIComponent(id)}`,
      {},
      3000
    );
    if (data?.video) {
      const { record } = sanitizeStoredVideoRecord(data.video);
      saveStoredVideo(record);
      return record;
    }
  } catch (err: any) {
    if (
      isVideoAuthError(err) ||
      err instanceof VideoApiError ||
      (err?.message && (/access denied/i.test(err.message) || /not found or access denied/i.test(err.message)))
    ) {
      throw err;
    }
  }

  const found = findStoredVideo(id);
  if (found) return found;

  throw new Error(`Video not found or access denied: ${id}`);
}

export async function addYouTubeVideo(
  title: string,
  youtubeUrl: string,
  transcript?: string | TranscriptSegment[]
): Promise<VideoRecord> {
  const parsedUrl = parseYouTubeInput(youtubeUrl, { allowBareId: false });
  if (!parsedUrl.valid || !parsedUrl.canonicalUrl || !parsedUrl.videoId) {
    throw new Error(parsedUrl.error || 'Invalid YouTube URL. Please enter a usable YouTube video link.');
  }

  const canonicalUrl = parsedUrl.canonicalUrl;
  const rawTitle = title.trim();
  const parsedSegments = parseTranscriptInput(transcript);

  let validatedSegments: TranscriptSegment[] | null = null;
  if (parsedSegments.length > 0) {
    const validation = validateTranscriptSegments(parsedSegments);
    if (!validation.valid) {
      throw new Error(`Invalid transcript provided: ${validation.error}`);
    }
    validatedSegments = validation.segments!;
  }

  const data = await request<{ success: boolean; video: VideoRecord }>(
    '/api/videos',
    {
      method: 'POST',
      body: JSON.stringify({
        title: rawTitle,
        sourceType: 'youtube',
        youtubeUrl: canonicalUrl,
        transcript: validatedSegments || undefined,
      }),
    },
    10000
  );

  if (data?.video?.id) {
    const { record } = sanitizeStoredVideoRecord(data.video);
    saveStoredVideo(record);
    return record;
  }

  throw new Error('Failed to create video record on server.');
}

export async function uploadVideoFile(
  title: string,
  file: File,
  onProgress?: (progressPercent: number) => void,
  transcript?: string | TranscriptSegment[]
): Promise<VideoRecord> {
  const cleanTitle = title.trim() || file.name.replace(/\.[^/.]+$/, '');
  const parsedSegments = parseTranscriptInput(transcript);

  let validatedSegments: TranscriptSegment[] | null = null;
  if (parsedSegments.length > 0) {
    const validation = validateTranscriptSegments(parsedSegments);
    if (!validation.valid) {
      throw new Error(`Invalid transcript provided: ${validation.error}`);
    }
    validatedSegments = validation.segments!;
  }

  return new Promise((resolve, reject) => {
    if (onProgress) onProgress(30);

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(90, Math.round((event.loaded / event.total) * 90));
        onProgress(percent);
      }
    };

    reader.onload = async () => {
      try {
        if (onProgress) onProgress(95);

        const fileDataUrl = reader.result as string;
        const base64Data = fileDataUrl.includes(',') ? fileDataUrl.split(',')[1] : fileDataUrl;

        const data = await request<{ success: boolean; video: VideoRecord }>(
          '/api/videos',
          {
            method: 'POST',
            body: JSON.stringify({
              title: cleanTitle,
              sourceType: 'upload',
              fileName: file.name,
              base64Data,
              transcript: validatedSegments || undefined,
            }),
          },
          30000
        );

        if (data?.video) {
          if (onProgress) onProgress(100);
          const { record } = sanitizeStoredVideoRecord(data.video);
          saveStoredVideo(record);
          resolve(record);
          return;
        }
        reject(new Error('Failed to upload video to server.'));
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read selected video file.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function deleteVideoById(id: string): Promise<boolean> {
  try {
    await request<{ success: boolean }>(
      `/api/videos/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
      3000
    );
    removeStoredVideo(id);
    return true;
  } catch (err: any) {
    if (
      isVideoAuthError(err) ||
      err instanceof VideoApiError ||
      (err?.message && (/access denied/i.test(err.message) || /not found or access denied/i.test(err.message)))
    ) {
      throw err;
    }
    throw err;
  }
}

export async function processVideoById(
  id: string,
  transcript?: string | TranscriptSegment[]
): Promise<VideoRecord> {
  const data = await request<{ success: boolean; video: VideoRecord }>(
    `/api/videos/${encodeURIComponent(id)}/process`,
    {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    },
    60000
  );
  if (data?.video) {
    const { record } = sanitizeStoredVideoRecord(data.video);
    saveStoredVideo(record);
    return record;
  }

  throw new Error('Failed to process video or extract verified transcript.');
}

export async function fetchVideoTranscript(id: string): Promise<TranscriptSegment[]> {
  const localVideo = findStoredVideo(id);
  if (localVideo?.transcriptJson) {
    const integrity = verifyVideoEvidenceIntegrity(localVideo);
    if (integrity.valid) {
      try {
        const parsed = JSON.parse(localVideo.transcriptJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
  }

  try {
    const data = await request<{ success: boolean; segments: TranscriptSegment[] }>(
      `/api/videos/${encodeURIComponent(id)}/transcript`,
      {},
      3000
    );
    return data.segments || [];
  } catch (err) {
    if (isVideoAuthError(err)) {
      throw err;
    }
  }

  return [];
}

function filterCitationsForVideo(
  citations: VideoCitation[],
  videoId: string,
  durationSeconds?: number | null
): VideoCitation[] {
  if (!Array.isArray(citations)) return [];
  const dur = Number(durationSeconds || 0);
  return citations.filter((c) => {
    if (!c) return false;
    const citSource = c.source_id || c.document_id;
    if (citSource && String(citSource) !== videoId) {
      return false;
    }
    const seek = Number(c.seek_seconds ?? c.timestamp_start ?? 0);
    if (!isFinite(seek) || seek < 0) return false;
    if (dur > 0 && seek > dur + CAPTION_CUE_END_TOLERANCE_SECONDS) {
      return false;
    }
    return true;
  });
}

export async function askVideoQuestion(
  id: string,
  question: string,
  history: Array<{ role: string; content: string }> = [],
  language = 'english',
  signal?: AbortSignal
): Promise<VideoAskResponse> {
  const localVideo = findStoredVideo(id);

  // 1. Try server endpoint first
  try {
    const data = await request<VideoAskResponse>(
      `/api/videos/${encodeURIComponent(id)}/ask`,
      {
        method: 'POST',
        signal,
        body: JSON.stringify({
          question,
          conversationHistory: history,
          language,
        }),
      },
      65000
    );
    if (data && data.response) {
      const validCitations = filterCitationsForVideo(
        data.citations || [],
        id,
        localVideo?.durationSeconds
      );
      if (data.grounded && validCitations.length === 0) {
        return {
          ...data,
          citations: [],
          grounded: false,
          insufficient_evidence: true,
        };
      }
      return {
        ...data,
        citations: validCitations,
      };
    }
  } catch (serverErr: any) {
    if (signal?.aborted || serverErr?.name === 'AbortError') {
      throw serverErr;
    }
    if (isVideoAuthError(serverErr) || serverErr instanceof VideoApiError) {
      throw serverErr;
    }
    const msg = String(serverErr?.message || '');
    if (/not found|access denied|unauthorized/i.test(msg)) {
      throw serverErr;
    }
    // Network unreachable: continue to integrity-gated local offline fallback
  }

  // 2. Client-side Grounded Gemini Fallback (strictly gated on evidence integrity)
  const video = localVideo;
  const videoTitle = video?.title || 'Lecture Video';
  const integrity = video ? verifyVideoEvidenceIntegrity(video) : { valid: false };

  let segments: TranscriptSegment[] = [];
  if (video && integrity.valid && video.transcriptStatus === 'ready' && video.transcriptJson) {
    try {
      const parsed = JSON.parse(video.transcriptJson);
      const validation = validateTranscriptSegments(parsed, video.durationSeconds);
      if (validation.valid && validation.segments) {
        segments = validation.segments;
      }
    } catch {}
  }

  // If NO verified transcript is available:
  if (segments.length === 0) {
    try {
      const conceptualPrompt = `You are Ming Video AI Tutor. The student is asking about "${videoTitle}".
NOTE: A verified transcript is NOT available for this lecture.
CRITICAL RULES:
1. Provide helpful conceptual guidance about the topic "${videoTitle}".
2. STRICTLY DO NOT cite any timestamps or time intervals (do NOT use [mm:ss]).
3. Explicitly state that this explanation is based on general course concepts rather than verbatim lecture recording evidence.`;

      const geminiRes = await geminiClient.generateContent({
        message: question,
        systemPrompt: conceptualPrompt,
        topic: videoTitle,
        context: history,
      });

      return {
        success: true,
        videoId: id,
        question,
        response: geminiRes.response || `General conceptual guidance for "${videoTitle}": Consult verified course notes for exact definitions.`,
        citations: [],
        grounded: false,
        insufficient_evidence: true,
      };
    } catch {
      return {
        success: true,
        videoId: id,
        question,
        response: `A verified transcript is not available for "${videoTitle}". I cannot provide timestamp-grounded evidence from this video.`,
        citations: [],
        grounded: false,
        insufficient_evidence: true,
      };
    }
  }

  // Verified transcript IS available:
  const transcriptContext = segments
    .map((s) => `[${formatTimestamp(s.start)} - ${formatTimestamp(s.end)}] ${s.text}`)
    .join('\n');

  const systemPrompt = `You are Ming Video AI Tutor, an expert educational tutor.
The student is watching a video titled: "${videoTitle}".
Below is the verified timestamped transcript of this video:
${transcriptContext}

CRITICAL RULES:
1. Answer the student's question clearly and pedagogically, grounded STRICTLY in the transcript excerpt above.
2. For claims backed by the transcript, cite the exact timestamp in format [mm:ss] corresponding to the segments provided.
3. NEVER fabricate timestamps outside the transcript time ranges.
4. If the transcript does not contain sufficient information to answer the question, clearly state that the lecture transcript does not cover that point.`;

  try {
    const geminiRes = await geminiClient.generateContent({
      message: question,
      systemPrompt,
      topic: videoTitle,
      context: history,
    });

    const aiText = geminiRes.response || 'I analyzed the video and here are the key insights.';
    const rawCitations = extractTimestampCitations(aiText);

    // Revalidate citations against video duration and actual segments
    const validCitations: VideoCitation[] = [];
    for (const c of rawCitations) {
      const sec = c.seconds;
      if (sec < 0) continue;
      if (video?.durationSeconds && video.durationSeconds > 0 && sec > video.durationSeconds + CAPTION_CUE_END_TOLERANCE_SECONDS) {
        continue;
      }
      const matchingSegment = segments.find(
        (s) => sec >= s.start - 2.0 && sec <= s.end + 2.0
      );
      if (!matchingSegment) continue;

      validCitations.push({
        chunk_id: `chunk_${validCitations.length + 1}`,
        source_id: id,
        source_type: 'video',
        timestamp_start: sec,
        timestamp_end: Math.min(sec + 30, video?.durationSeconds || sec + 30),
        seek_seconds: sec,
        formatted_timestamp: c.label,
        citation_label: `Video [${c.label}]`,
        snippet: matchingSegment.text.slice(0, 100),
      });
    }

    const isGrounded = validCitations.length > 0;
    let finalResponseText = aiText;

    if (!isGrounded) {
      finalResponseText = `The lecture "${videoTitle}" does not contain verified transcript evidence to answer this question. The cited references fall outside the verified lecture content.`;
    } else {
      const rejectedTimes = new Set(
        rawCitations
          .filter((rc) => !validCitations.some((vc) => vc.seek_seconds === rc.seconds))
          .map((rc) => rc.label)
      );

      if (rejectedTimes.size > 0) {
        const blocks = aiText.split(/\n{2,}/);
        const filteredBlocks = blocks.filter((block) => {
          for (const label of rejectedTimes) {
            if (block.includes(`[${label}]`) || block.includes(`(${label})`)) return false;
          }
          return true;
        });

        if (filteredBlocks.length > 0) {
          finalResponseText = filteredBlocks.join('\n\n');
        } else {
          finalResponseText = `The lecture "${videoTitle}" does not contain verified transcript evidence to answer this question. The cited claims fall outside the verified lecture content.`;
          return {
            success: true,
            videoId: id,
            question,
            response: finalResponseText,
            citations: [],
            grounded: false,
            insufficient_evidence: true,
          };
        }
      }
    }

    return {
      success: true,
      videoId: id,
      question,
      response: finalResponseText,
      citations: validCitations,
      grounded: isGrounded,
      insufficient_evidence: !isGrounded,
      evidence_coverage_score: isGrounded ? 0.9 : 0.0,
    };
  } catch {
    return {
      success: true,
      videoId: id,
      question,
      response: `This lecture on "${videoTitle}" explains the foundational principles of the topic. Refer to the transcript and video sections to review the key points.`,
      citations: [],
      grounded: false,
      insufficient_evidence: true,
    };
  }
}
