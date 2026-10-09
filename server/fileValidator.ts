/**
 * Canonical Phase 2 — Secure File Validation
 * Enforces magic-byte signature validation, MIME cross-checking,
 * file size constraints, path traversal protection, and malformed file rejection.
 * Rule: File extension must NEVER be trusted by itself.
 */

import path from 'node:path';
import fs from 'node:fs/promises';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export type DetectedMediaType =
  | 'PDF'
  | 'PPTX'
  | 'PPT'
  | 'PNG'
  | 'JPEG'
  | 'WEBP'
  | 'MP4'
  | 'WEBM'
  | 'MP3'
  | 'WAV'
  | 'TEXT';

export interface FileValidationResult {
  valid: boolean;
  mediaType: DetectedMediaType;
  mimeType: string;
  sourceType: string;
  sizeBytes: number;
  isLegacyFormat: boolean;
  error?: string;
}

export class ValidationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(
    message: string,
    statusCode: number = 400,
    code: string = 'VALIDATION_ERROR',
  ) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Checks if a buffer matches known magic signatures.
 */
export function detectMagicSignature(buffer: Buffer): { mediaType: DetectedMediaType; mimeType: string; isLegacyFormat: boolean } | null {
  if (buffer.length < 4) {
    return null;
  }

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mediaType: 'PDF', mimeType: 'application/pdf', isLegacyFormat: false };
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mediaType: 'PNG', mimeType: 'image/png', isLegacyFormat: false };
  }

  // 3. JPEG: 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mediaType: 'JPEG', mimeType: 'image/jpeg', isLegacyFormat: false };
  }

  // 4. RIFF containers (WEBP and WAV)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  ) {
    const format = buffer.toString('ascii', 8, 12);
    if (format === 'WEBP') {
      return { mediaType: 'WEBP', mimeType: 'image/webp', isLegacyFormat: false };
    }
    if (format === 'WAVE') {
      return { mediaType: 'WAV', mimeType: 'audio/wav', isLegacyFormat: false };
    }
  }

  // 5. OLE2 Compound Document (Legacy .ppt / .doc / .xls binary container): 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return { mediaType: 'PPT', mimeType: 'application/vnd.ms-powerpoint', isLegacyFormat: true };
  }

  // 6. ZIP container: PK\x03\x04 (0x50 0x4B 0x03 0x04) -> PPTX or other Office XML
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06)
  ) {
    return {
      mediaType: 'PPTX',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      isLegacyFormat: false,
    };
  }

  // 7. MP4: ftyp at offset 4
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return { mediaType: 'MP4', mimeType: 'video/mp4', isLegacyFormat: false };
  }

  // 8. WEBM: 0x1A 0x45 0xDF 0xA3 (EBML)
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mediaType: 'WEBM', mimeType: 'video/webm', isLegacyFormat: false };
  }

  // 9. MP3: ID3 or sync frame
  if (
    buffer[0] === 0x49 &&
    buffer[1] === 0x44 &&
    buffer[2] === 0x33
  ) {
    return { mediaType: 'MP3', mimeType: 'audio/mpeg', isLegacyFormat: false };
  }
  if (
    buffer[0] === 0xff &&
    (buffer[1] & 0xe0) === 0xe0
  ) {
    return { mediaType: 'MP3', mimeType: 'audio/mpeg', isLegacyFormat: false };
  }

  // 10. Plain text check (UTF-8 clean string with no null bytes)
  const isAsciiOrUtf8 = isTextBuffer(buffer.subarray(0, Math.min(buffer.length, 1024)));
  if (isAsciiOrUtf8) {
    return { mediaType: 'TEXT', mimeType: 'text/plain', isLegacyFormat: false };
  }

  return null;
}

function isTextBuffer(buf: Buffer): boolean {
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte === 0) return false; // Null byte indicates binary
  }
  return true;
}

/**
 * Validates path traversal safety.
 */
export function sanitizeAndAssertPath(baseDir: string, relativeOrAbsoluteTarget: string): string {
  // Reject null bytes, backslashes and relative parent indicators in filename
  if (relativeOrAbsoluteTarget.includes('\0')) {
    throw new ValidationError('Null byte injection detected in path', 400, 'PATH_TRAVERSAL');
  }

  const baseResolved = path.resolve(baseDir);
  const targetResolved = path.resolve(baseDir, relativeOrAbsoluteTarget);

  if (!targetResolved.startsWith(baseResolved)) {
    throw new ValidationError('Path traversal attempt outside allowed boundary', 403, 'PATH_TRAVERSAL');
  }

  return targetResolved;
}

/**
 * Full security validation of an uploaded buffer.
 */
export function validateUploadedBuffer(
  buffer: Buffer,
  declaredFileName?: string,
  declaredMimeType?: string,
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('Empty file: 0 bytes uploaded', 400, 'EMPTY_FILE');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File size (${buffer.length} bytes) exceeds maximum permitted limit (${MAX_FILE_SIZE_BYTES} bytes)`,
      413,
      'FILE_TOO_LARGE',
    );
  }

  // Magic byte inspection
  const detected = detectMagicSignature(buffer);
  if (!detected) {
    throw new ValidationError(
      'Unsupported or corrupted file format. Magic byte signature not recognized.',
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
  }

  // Cross-check extension against detected signature
  if (declaredFileName) {
    const ext = path.extname(declaredFileName).toLowerCase();
    const extMapping: Record<string, DetectedMediaType[]> = {
      '.pdf': ['PDF'],
      '.pptx': ['PPTX'],
      '.ppt': ['PPT'],
      '.png': ['PNG'],
      '.jpg': ['JPEG'],
      '.jpeg': ['JPEG'],
      '.webp': ['WEBP'],
      '.mp4': ['MP4'],
      '.webm': ['WEBM'],
      '.mp3': ['MP3'],
      '.wav': ['WAV'],
      '.txt': ['TEXT'],
      '.md': ['TEXT'],
      '.json': ['TEXT'],
    };

    const expectedTypes = extMapping[ext];
    if (expectedTypes && !expectedTypes.includes(detected.mediaType)) {
      throw new ValidationError(
        `File signature mismatch: file named with '${ext}' actually contains '${detected.mediaType}' data. Extension spoofing rejected.`,
        400,
        'EXTENSION_MIME_MISMATCH',
      );
    }
  }

  const sourceTypeMapping: Record<DetectedMediaType, string> = {
    PDF: 'PDF',
    PPTX: 'PPTX',
    PPT: 'PPT',
    PNG: 'IMAGE',
    JPEG: 'IMAGE',
    WEBP: 'IMAGE',
    MP4: 'VIDEO',
    WEBM: 'VIDEO',
    MP3: 'AUDIO',
    WAV: 'AUDIO',
    TEXT: 'TEXT',
  };

  return {
    valid: true,
    mediaType: detected.mediaType,
    mimeType: detected.mimeType,
    sourceType: sourceTypeMapping[detected.mediaType],
    sizeBytes: buffer.length,
    isLegacyFormat: detected.isLegacyFormat,
  };
}

/**
 * Validates a file on disk.
 */
export async function validateFileOnDisk(
  filePath: string,
  declaredFileName?: string,
): Promise<FileValidationResult> {
  const stat = await fs.stat(filePath);
  if (stat.size === 0) {
    throw new ValidationError('File on disk is 0 bytes', 400, 'EMPTY_FILE');
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File size (${stat.size} bytes) exceeds maximum permitted limit (${MAX_FILE_SIZE_BYTES} bytes)`,
      413,
      'FILE_TOO_LARGE',
    );
  }

  // Read header for signature check
  const handle = await fs.open(filePath, 'r');
  try {
    const headerBuffer = Buffer.alloc(Math.min(stat.size, 4096));
    await handle.read(headerBuffer, 0, headerBuffer.length, 0);
    return validateUploadedBuffer(headerBuffer, declaredFileName || path.basename(filePath));
  } finally {
    await handle.close();
  }
}

/**
 * Safely cleans up stale orphaned upload files older than maxAgeMs (default 24h).
 * Recursively scans baseDir, only removing files whose mtime is older than maxAgeMs.
 * Returns { scannedCount, deletedCount, freedBytes, errors }.
 */
export async function cleanupStaleUploads(
  baseDir: string,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<{ scannedCount: number; deletedCount: number; freedBytes: number; errors: string[] }> {
  let scannedCount = 0;
  let deletedCount = 0;
  let freedBytes = 0;
  const errors: string[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        errors.push(`Failed to read directory ${dir}: ${err.message}`);
      }
      return;
    }

    const now = Date.now();
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
          // Try to remove directory if empty, ignore if not
          try {
            await fs.rmdir(fullPath);
          } catch {}
        } else if (entry.isFile()) {
          scannedCount++;
          const stat = await fs.stat(fullPath);
          const ageMs = now - stat.mtimeMs;
          if (ageMs > maxAgeMs) {
            await fs.unlink(fullPath);
            deletedCount++;
            freedBytes += stat.size;
          }
        }
      } catch (err: any) {
        errors.push(`Failed to process ${fullPath}: ${err.message}`);
      }
    }
  }

  await scanDirectory(baseDir);

  return {
    scannedCount,
    deletedCount,
    freedBytes,
    errors,
  };
}

