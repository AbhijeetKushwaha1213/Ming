/**
 * Video Utilities for Ming Video Learning Module
 */

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
