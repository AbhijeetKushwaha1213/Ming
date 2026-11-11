/**
 * Video Utilities for Ming Video Learning Module
 */

export interface YouTubeParseResult {
  valid: boolean;
  videoId: string | null;
  canonicalUrl: string | null;
  error?: string;
  wasMarkdown?: boolean;
}

const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractVideoIdFromUrlObject(urlObj: URL): string | null {
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return null;
  }

  const host = urlObj.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) {
    return null;
  }

  const pathParts = urlObj.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    if (pathParts.length >= 1 && YOUTUBE_ID_RE.test(pathParts[0])) {
      return pathParts[0];
    }
    return null;
  }

  if (pathParts.length === 0 || pathParts[0] === 'watch') {
    const vParam = urlObj.searchParams.get('v');
    if (vParam && YOUTUBE_ID_RE.test(vParam)) {
      return vParam;
    }
    return null;
  }

  if (
    pathParts.length >= 2 &&
    (pathParts[0] === 'embed' ||
      pathParts[0] === 'shorts' ||
      pathParts[0] === 'v' ||
      pathParts[0] === 'live') &&
    YOUTUBE_ID_RE.test(pathParts[1])
  ) {
    return pathParts[1];
  }

  return null;
}

function parseSingleYouTubeUrlCandidate(rawUrl: string): { videoId: string; canonicalUrl: string } | null {
  const cleaned = rawUrl.trim();
  if (!cleaned || /\s/.test(cleaned)) {
    return null;
  }

  const normalizedScheme = /^(youtu\.be|(?:www\.|m\.|music\.)?youtube\.com|(?:www\.)?youtube-nocookie\.com)\//i.test(cleaned)
    ? `https://${cleaned}`
    : cleaned;

  try {
    const parsed = new URL(normalizedScheme);
    const id = extractVideoIdFromUrlObject(parsed);
    if (!id) return null;
    return {
      videoId: id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  } catch {
    return null;
  }
}

function looksLikeUrlText(text: string): boolean {
  const t = text.trim();
  return (
    /^https?:\/\//i.test(t) ||
    /(?:^|\s)(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\b/i.test(t) ||
    /\.[a-z]{2,}\//i.test(t)
  );
}

/**
 * Parses and normalizes user-submitted YouTube URLs or Markdown links:
 * - Standard YouTube URLs -> canonical https://www.youtube.com/watch?v=<id>
 * - Valid Markdown links [label](https://youtu.be/<id>) or <https://youtu.be/<id>> -> normalized canonical URL
 * - Rejects malformed Markdown syntax, mismatched link text vs destination URLs, and non-YouTube domains.
 */
export function parseYouTubeInput(
  input: string,
  options: { allowBareId?: boolean } = {}
): YouTubeParseResult {
  const { allowBareId = false } = options;

  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      videoId: null,
      canonicalUrl: null,
      error: 'Please enter a YouTube video URL.',
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      valid: false,
      videoId: null,
      canonicalUrl: null,
      error: 'Please enter a YouTube video URL.',
    };
  }

  // Handle angle-bracket Markdown autolink: <https://youtu.be/...>
  if (trimmed.startsWith('<') || trimmed.endsWith('>')) {
    const autoMatch = trimmed.match(/^<([^<>\s]+)>$/);
    if (!autoMatch) {
      return {
        valid: false,
        videoId: null,
        canonicalUrl: null,
        error: 'Malformed Markdown link. Paste a clean YouTube URL or a complete [title](https://youtu.be/...) link.',
      };
    }
    const inner = parseSingleYouTubeUrlCandidate(autoMatch[1]);
    if (!inner) {
      return {
        valid: false,
        videoId: null,
        canonicalUrl: null,
        error: 'Invalid YouTube URL inside link brackets.',
      };
    }
    return {
      valid: true,
      videoId: inner.videoId,
      canonicalUrl: inner.canonicalUrl,
      wasMarkdown: true,
    };
  }

  // Handle Markdown links: [title](https://youtu.be/...)
  if (trimmed.includes('[') || trimmed.includes(']')) {
    const mdMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (!mdMatch) {
      return {
        valid: false,
        videoId: null,
        canonicalUrl: null,
        error: 'Malformed Markdown link. Use a complete [title](https://youtu.be/...) format or paste a plain YouTube URL.',
      };
    }

    const label = mdMatch[1].trim();
    let destRaw = mdMatch[2].trim();
    // Support optional title inside Markdown destination: (https://youtu.be/id "title")
    const destWithTitleMatch = destRaw.match(/^<([^>\s]+)>|^(\S+)(?:\s+["'(].*["')])?$/);
    if (!destWithTitleMatch) {
      return {
        valid: false,
        videoId: null,
        canonicalUrl: null,
        error: 'Malformed Markdown link destination URL.',
      };
    }
    destRaw = destWithTitleMatch[1] || destWithTitleMatch[2] || '';

    const destParsed = parseSingleYouTubeUrlCandidate(destRaw);
    if (!destParsed) {
      return {
        valid: false,
        videoId: null,
        canonicalUrl: null,
        error: 'Invalid Markdown YouTube link. Destination must be a valid YouTube video URL.',
      };
    }

    // If the Markdown visible label itself looks like a URL, ensure it doesn't disagree or spoof another domain/video
    if (label && looksLikeUrlText(label)) {
      const labelParsed = parseSingleYouTubeUrlCandidate(label);
      if (!labelParsed || labelParsed.videoId !== destParsed.videoId) {
        return {
          valid: false,
          videoId: null,
          canonicalUrl: null,
          error: 'Markdown link label and destination point to different URLs or videos.',
        };
      }
    }

    return {
      valid: true,
      videoId: destParsed.videoId,
      canonicalUrl: destParsed.canonicalUrl,
      wasMarkdown: true,
    };
  }

  if (trimmed.includes('(') || trimmed.includes(')')) {
    return {
      valid: false,
      videoId: null,
      canonicalUrl: null,
      error: 'Malformed link syntax. Paste a plain YouTube URL without unmatched parentheses.',
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      videoId: null,
      canonicalUrl: null,
      error: 'Invalid YouTube URL. Enter a single YouTube link without surrounding text.',
    };
  }

  if (YOUTUBE_ID_RE.test(trimmed)) {
    if (!allowBareId) {
      return {
        valid: false,
        videoId: null,
        canonicalUrl: null,
        error: 'Please enter a full YouTube URL (e.g. https://youtu.be/za87oqLhGaI or https://www.youtube.com/watch?v=...).',
      };
    }
    return {
      valid: true,
      videoId: trimmed,
      canonicalUrl: `https://www.youtube.com/watch?v=${trimmed}`,
      wasMarkdown: false,
    };
  }

  const parsedUrl = parseSingleYouTubeUrlCandidate(trimmed);
  if (!parsedUrl) {
    return {
      valid: false,
      videoId: null,
      canonicalUrl: null,
      error: 'Invalid YouTube URL. Only genuine youtube.com and youtu.be video links are accepted.',
    };
  }

  return {
    valid: true,
    videoId: parsedUrl.videoId,
    canonicalUrl: parsedUrl.canonicalUrl,
    wasMarkdown: false,
  };
}

export function normalizeYouTubeUrl(url: string, allowBareId = false): string | null {
  return parseYouTubeInput(url, { allowBareId }).canonicalUrl;
}

export function extractYouTubeId(url: string, allowBareId = true): string | null {
  return parseYouTubeInput(url, { allowBareId }).videoId;
}

export function isValidYouTubeUrl(url: string, allowBareId = false): boolean {
  return parseYouTubeInput(url, { allowBareId }).valid;
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

export function parseTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.replace(/[\[\]]/g, '').trim();
  const parts = cleaned.split(':').map(Number);
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

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  return formatTimestamp(seconds);
}

/**
 * Finds all timestamp citations in format `[mm:ss]` or `[hh:mm:ss]` or `[12:00]`
 */
export function extractTimestampCitations(text: string): Array<{ raw: string; seconds: number; label: string }> {
  if (!text) return [];
  const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const citations: Array<{ raw: string; seconds: number; label: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const timeStr = match[1];
    const seconds = parseTimestamp(timeStr);
    citations.push({
      raw,
      seconds,
      label: timeStr,
    });
  }

  return citations;
}

export interface TranscriptValidationResult {
  valid: boolean;
  error?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    topic?: string;
    subtopic?: string;
  }>;
}

export const MEDIA_START_TOLERANCE_SECONDS = 1.5;
export const CAPTION_CUE_END_TOLERANCE_SECONDS = 3.0;

/**
 * Validates transcript segments against media duration and source integrity.
 * Materially invalid timestamps (e.g. beyond container rounding + trailing caption display window)
 * are REJECTED, NEVER clamped.
 * Synthetic placeholder outlines masquerading as verbatim transcripts are also rejected.
 */
export function validateTranscriptSegments(
  rawSegments: any[],
  durationSeconds?: number
): TranscriptValidationResult {
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return { valid: false, error: 'Transcript segment list is empty or not an array' };
  }

  const duration = durationSeconds && durationSeconds > 0 ? Number(durationSeconds) : null;
  const sanitized: Array<{
    start: number;
    end: number;
    text: string;
    topic?: string;
    subtopic?: string;
  }> = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const s = rawSegments[i];
    if (!s || typeof s !== 'object') {
      return { valid: false, error: `Segment ${i + 1} is not a valid object` };
    }

    const start = Number(s.start ?? s.timestamp_start);
    const end = Number(s.end ?? s.timestamp_end);
    const text = String(s.text ?? '').trim();

    if (!isFinite(start) || start < 0) {
      return { valid: false, error: `Segment ${i + 1} has invalid or negative start timestamp (${start})` };
    }
    if (!isFinite(end) || end <= start) {
      return { valid: false, error: `Segment ${i + 1} end timestamp (${end}) must be strictly greater than start (${start})` };
    }
    if (!text) {
      return { valid: false, error: `Segment ${i + 1} has empty transcript text` };
    }

    // Strict bounds check: reject out-of-bounds segments; NEVER clamp!
    // Allows documented integer-duration rounding (<= 1.5s) and trailing ASR caption window fadeout (<= 3.0s).
    if (duration !== null) {
      if (start > duration + MEDIA_START_TOLERANCE_SECONDS) {
        return {
          valid: false,
          error: `Segment ${i + 1} start (${formatTimestamp(start)} / ${start}s) exceeds verified media duration (${formatTimestamp(duration)} / ${duration}s)`,
        };
      }
      if (end > duration + CAPTION_CUE_END_TOLERANCE_SECONDS) {
        return {
          valid: false,
          error: `Segment ${i + 1} end (${formatTimestamp(end)} / ${end}s) exceeds verified media duration (${formatTimestamp(duration)} / ${duration}s)`,
        };
      }
    }

    // Check for known synthetic placeholder outlines
    const subtopic = String(s.subtopic || '');
    if (
      subtopic === 'Detailed Walkthrough' ||
      subtopic === 'Summary & Practice' ||
      subtopic === 'Step-by-Step Flow' ||
      subtopic === 'Core Mechanisms' ||
      /Overview of core architectural concepts, prerequisites/i.test(text) ||
      /Core principles, definitions, and foundational concepts explained in/i.test(text) ||
      /Step-by-step mathematical derivation, code walkthrough/i.test(text) ||
      /Review, examination takeaways, summary points, and best practices for/i.test(text)
    ) {
      return {
        valid: false,
        error: `Segment ${i + 1} contains synthetic placeholder template text masquerading as verbatim transcript evidence`,
      };
    }

    sanitized.push({
      start,
      end,
      text,
      topic: s.topic ? String(s.topic) : undefined,
      subtopic: s.subtopic ? String(s.subtopic) : undefined,
    });
  }

  // Ensure chronological order
  for (let i = 1; i < sanitized.length; i++) {
    if (sanitized[i].start < sanitized[i - 1].start) {
      return {
        valid: false,
        error: `Segment ${i + 1} start (${sanitized[i].start}s) is earlier than preceding segment start (${sanitized[i - 1].start}s)`,
      };
    }
  }

  return { valid: true, segments: sanitized };
}

/**
 * Checks if stored segments are synthetic placeholders or exceed media duration
 */
export function isSyntheticOrInvalidTranscript(
  rawSegments: any[],
  durationSeconds?: number
): boolean {
  const result = validateTranscriptSegments(rawSegments, durationSeconds);
  return !result.valid;
}

export interface RuntimeVideoObservation {
  embedVideoId?: string | null;
  durationSeconds?: number | null;
  videoTitle?: string | null;
}

export interface VideoEvidenceIntegrityResult {
  valid: boolean;
  error?: string;
  reasons: string[];
  expectedYouTubeId?: string | null;
  effectiveDurationSeconds?: number;
}

const KNOWN_LEGACY_CORRUPTED_IDS = new Set([
  'vid_sample_mit_linear_algebra',
  'vid_sample_3blue1brown_calculus',
]);

/**
 * Detects legacy hardcoded or source-mismatched records (e.g., MIT 18.06 label paired with
 * Gilbert Strang 7:33 interview ID `7UJ4CFRGd-U` and fabricated 39:42 / 8:00 transcript).
 */
export function isKnownMismatchedVideoRecord(
  video: {
    id?: string;
    title?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    durationSeconds?: number | null;
  },
  rawSegments?: any[]
): string | null {
  if (!video) return 'Missing video record';
  if (video.id && KNOWN_LEGACY_CORRUPTED_IDS.has(video.id)) {
    return 'Legacy unverified sample record with fabricated transcript metadata';
  }

  const urlId = video.youtubeUrl ? extractYouTubeId(video.youtubeUrl, false) : null;
  const ytId = video.youtubeVideoId || urlId;

  if (ytId === '7UJ4CFRGd-U') {
    const title = String(video.title || '');
    const dur = Number(video.durationSeconds || 0);
    if (/MIT\s*18\.06|Geometry of Linear Equations/i.test(title)) {
      return 'Source mismatch: video ID 7UJ4CFRGd-U is a 7:34 interview, not MIT 18.06 Lecture 1';
    }
    if (dur > 480) {
      return `Duration mismatch: stored duration (${formatTimestamp(dur)}) exceeds 7UJ4CFRGd-U actual runtime (~7:34)`;
    }
    if (Array.isArray(rawSegments)) {
      const hasFabricatedMitLine = rawSegments.some(
        (s) =>
          typeof s?.text === 'string' &&
          /The row picture versus the column picture of linear systems|Fundamental theorem/i.test(s.text)
      );
      if (hasFabricatedMitLine) {
        return 'Transcript mismatch: segments belong to another lecture and not video 7UJ4CFRGd-U';
      }
    }
  }

  return null;
}

/**
 * Verifies end-to-end consistency across stored video metadata, runtime player telemetry,
 * YouTube video identity, and transcript segment timestamps/provenance.
 */
export function verifyVideoEvidenceIntegrity(
  video: {
    id: string;
    title?: string | null;
    sourceType?: string;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    durationSeconds?: number | null;
    transcriptStatus?: string | null;
    transcriptJson?: string | null;
    extractionStatus?: string | null;
  } | null | undefined,
  providedSegments?: any[],
  runtime?: RuntimeVideoObservation | null
): VideoEvidenceIntegrityResult {
  if (!video) {
    return {
      valid: false,
      error: 'No active video selected',
      reasons: ['No active video selected'],
    };
  }

  const reasons: string[] = [];

  // Parse segments if provided or present in transcriptJson
  let parsedSegments: any[] | undefined = Array.isArray(providedSegments) ? providedSegments : undefined;
  let malformedJson = false;

  if (!parsedSegments && video.transcriptJson) {
    try {
      const parsed = JSON.parse(video.transcriptJson);
      if (Array.isArray(parsed)) {
        parsedSegments = parsed;
      } else {
        malformedJson = true;
      }
    } catch {
      malformedJson = true;
    }
  }

  if (malformedJson) {
    reasons.push('Stored transcript JSON is malformed');
  }

  const knownMismatch = isKnownMismatchedVideoRecord(video, parsedSegments);
  if (knownMismatch) {
    reasons.push(knownMismatch);
  }

  const urlYtId = video.youtubeUrl ? extractYouTubeId(video.youtubeUrl, false) : null;
  const expectedYtId = video.youtubeVideoId || urlYtId || null;

  if (video.sourceType === 'youtube') {
    if (video.youtubeUrl && !urlYtId) {
      reasons.push('Stored YouTube URL is malformed or does not reference a valid YouTube video');
    }
    if (video.youtubeUrl && video.youtubeVideoId && urlYtId && urlYtId !== video.youtubeVideoId) {
      reasons.push(
        `Source mismatch: stored youtubeUrl (${urlYtId}) differs from youtubeVideoId (${video.youtubeVideoId})`
      );
    }
    if (runtime?.embedVideoId && expectedYtId && runtime.embedVideoId !== expectedYtId) {
      reasons.push(
        `Embedded player video (${runtime.embedVideoId}) does not match active lecture (${expectedYtId})`
      );
    }
  }

  const storedDuration = Number(video.durationSeconds || 0);
  const runtimeDuration = Number(runtime?.durationSeconds || 0);

  if (storedDuration > 0 && runtimeDuration > 0 && Math.abs(runtimeDuration - storedDuration) > 15) {
    reasons.push(
      `Duration mismatch: embedded player reports ${formatTimestamp(runtimeDuration)} while stored metadata claims ${formatTimestamp(storedDuration)}`
    );
  }

  const effectiveDuration =
    runtimeDuration > 0 && storedDuration > 0
      ? Math.min(runtimeDuration, storedDuration)
      : runtimeDuration > 0
      ? runtimeDuration
      : storedDuration > 0
      ? storedDuration
      : 0;

  // Validate segment metadata and bounds when segments are present
  if (parsedSegments && parsedSegments.length > 0) {
    for (let i = 0; i < parsedSegments.length; i++) {
      const seg = parsedSegments[i];
      const segSource = seg?.sourceId || seg?.source_id || seg?.documentId || seg?.document_id;
      if (segSource && String(segSource) !== video.id) {
        reasons.push(`Transcript segment ${i + 1} belongs to another source (${segSource})`);
        break;
      }
      const segYt = seg?.youtubeVideoId || seg?.youtube_video_id;
      if (segYt && expectedYtId && String(segYt) !== expectedYtId) {
        reasons.push(`Transcript segment ${i + 1} belongs to another YouTube video (${segYt})`);
        break;
      }
    }

    const segValidation = validateTranscriptSegments(
      parsedSegments,
      effectiveDuration > 0 ? effectiveDuration : undefined
    );
    if (!segValidation.valid && segValidation.error) {
      reasons.push(segValidation.error);
    }
  }

  if (video.extractionStatus === 'failed') {
    reasons.push('Video extraction integrity verification failed');
  }

  return {
    valid: reasons.length === 0,
    error: reasons[0],
    reasons,
    expectedYouTubeId: expectedYtId,
    effectiveDurationSeconds: effectiveDuration > 0 ? effectiveDuration : undefined,
  };
}
