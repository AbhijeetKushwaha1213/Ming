import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ensureResourceSchema, prisma } from '../server/prisma.ts';
import { verifySupabaseToken } from '../server/supabaseAuth.ts';
import { authenticateRequest, resolveContextUser, AuthError } from '../server/authMiddleware.ts';
import { detectMagicSignature } from '../server/fileValidator.ts';
import type { CreateResourceInput } from '../src/types/resource.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | number) => void;
  end: (body?: any) => void;
  write?: (chunk: any) => boolean | void;
  pipe?: (dest: any) => any;
};

export const config = {
  runtime: 'nodejs',
};

const RESOURCE_TYPES = new Set(['NOTE', 'LINK', 'PDF', 'PPTX', 'VIDEO', 'AUDIO']);

function json(res: ApiResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function checkIsSystemPublic(resource: any): boolean {
  if (resource.tenantType === 'SYSTEM_PUBLIC') return true;
  if (resource.userId === 'system_public') return true;
  if (resource.tagsJson) {
    try {
      const parsed = JSON.parse(resource.tagsJson);
      if (Array.isArray(parsed) && parsed.includes('SYSTEM_PUBLIC')) return true;
      if (typeof parsed === 'object' && parsed?.tenantType === 'SYSTEM_PUBLIC') return true;
    } catch {}
  }
  return false;
}

export function extractResourceIdFromFileRoute(req: ApiRequest): string | null {
  if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost:3001');
      const match = parsedUrl.pathname.match(/^\/api\/resources\/([^/]+)\/file\/?$/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    } catch {}
  }
  if (req.query?.action === 'file' && req.query?.id) {
    return Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  }
  return null;
}

export async function authenticateSourceAccess(req: ApiRequest): Promise<string> {
  const securityContext = await authenticateRequest(req as any, { optional: false });
  if (!securityContext || !securityContext.userId) {
    throw new AuthError('Authentication required. Missing Bearer token.', 401);
  }
  return securityContext.userId;
}

async function pipeStreamToResponse(fileStream: fs.ReadStream, res: ApiResponse): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      finished = true;
      fileStream.destroy();
    };

    if (typeof res.write === 'function' && typeof res.end === 'function') {
      fileStream.on('data', (chunk) => {
        if (!finished) (res as any).write(chunk);
      });
      fileStream.on('end', () => {
        if (!finished) {
          res.end();
          resolve();
        }
      });
      fileStream.on('error', (err) => {
        cleanup();
        reject(err);
      });
    } else if (typeof (fileStream as any).pipe === 'function' && typeof (res as any).on === 'function') {
      fileStream.pipe(res as any);
      fileStream.on('end', () => resolve());
      fileStream.on('error', (err) => reject(err));
    } else {
      const chunks: Buffer[] = [];
      fileStream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      fileStream.on('end', () => {
        res.end(Buffer.concat(chunks));
        resolve();
      });
      fileStream.on('error', (err) => reject(err));
    }
  });
}

export async function handleStreamResourceFile(
  resourceId: string,
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  // 1. Require a valid authenticated JWT (never trust client query/body identity)
  let authenticatedUserId: string;
  try {
    authenticatedUserId = await authenticateSourceAccess(req);
  } catch (authErr: any) {
    const status = authErr instanceof AuthError ? authErr.statusCode : 401;
    json(res, status, { error: authErr.message || 'Unauthorized' });
    return;
  }

  // 2. Load resource from DB and verify existence & deletion
  await ensureResourceSchema();
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource || (resource as any).isDeleted || (resource as any).deletedAt) {
    json(res, 404, { error: 'Resource not found or has been deleted' });
    return;
  }

  // 3. Zero-trust authorization: owner OR SYSTEM_PUBLIC
  const isOwner = resource.userId === authenticatedUserId;
  const isSystemPublic = checkIsSystemPublic(resource);

  if (!isOwner && !isSystemPublic) {
    json(res, 403, { error: 'Forbidden: Access to this resource is denied' });
    return;
  }

  // 4. In-memory NOTE resource handling
  if (resource.type === 'NOTE' && resource.noteContent) {
    const noteBuffer = Buffer.from(resource.noteContent, 'utf8');
    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', String(noteBuffer.length));
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(noteBuffer);
    return;
  }

  if (!resource.storagePath) {
    json(res, 404, { error: 'Source media file not found on storage' });
    return;
  }

  // 5. Storage resolution & path traversal containment
  const rawPath = resource.storagePath;
  if (rawPath.includes('\0')) {
    json(res, 400, { error: 'Invalid path: null byte detected' });
    return;
  }

  const resolvedPath = path.resolve(rawPath);
  const allowedRoots = [
    PROJECT_ROOT,
    path.resolve(process.cwd()),
    path.resolve(os.tmpdir()),
  ];
  const isPermitted = allowedRoots.some((root) => resolvedPath.startsWith(root));
  if (!isPermitted || resolvedPath === '/etc/passwd' || resolvedPath.includes('/etc/')) {
    json(res, 403, { error: 'Access denied: Resource file location is outside permitted storage' });
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    json(res, 404, { error: 'Source media file not found on storage' });
    return;
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    json(res, 404, { error: 'Source media is not a regular file' });
    return;
  }
  const fileSize = stat.size;

  // 6. Content-Type determination via magic bytes & media types
  let detectedMime: string | null = null;
  try {
    const fd = fs.openSync(resolvedPath, 'r');
    const headerBuf = Buffer.alloc(Math.min(fileSize, 4096));
    fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
    fs.closeSync(fd);
    const detected = detectMagicSignature(headerBuf);
    if (detected) {
      detectedMime = detected.mimeType;
    }
  } catch {}

  let contentType = detectedMime;
  if (!contentType) {
    const ext = path.extname(resolvedPath).toLowerCase();
    const type = (resource.type || '').toUpperCase();
    if (type === 'PDF' || ext === '.pdf') contentType = 'application/pdf';
    else if (type === 'PNG' || ext === '.png') contentType = 'image/png';
    else if (type === 'JPEG' || type === 'JPG' || ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (type === 'WEBP' || ext === '.webp') contentType = 'image/webp';
    else if (type === 'MP4' || ext === '.mp4') contentType = 'video/mp4';
    else if (type === 'WEBM' || ext === '.webm') contentType = 'video/webm';
    else if (type === 'WAV' || ext === '.wav') contentType = 'audio/wav';
    else if (type === 'MP3' || ext === '.mp3') contentType = 'audio/mpeg';
    else if (type === 'PPTX' || ext === '.pptx') contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (type === 'PPT' || ext === '.ppt') contentType = 'application/vnd.ms-powerpoint';
    else contentType = 'application/octet-stream';
  }

  // 7. Support HEAD requests
  if (req.method === 'HEAD') {
    res.status(200);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(fileSize));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end();
    return;
  }

  // 8. HTTP Range requests (for video/audio media seeking)
  const rangeHeader = (req.headers['range'] || req.headers['Range']) as string | undefined;
  if (rangeHeader && typeof rangeHeader === 'string') {
    const bytesPrefix = 'bytes=';
    if (!rangeHeader.startsWith(bytesPrefix)) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.end();
      return;
    }

    const rangeSpec = rangeHeader.slice(bytesPrefix.length).trim();
    const parts = rangeSpec.split('-');
    if (parts.length !== 2) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.end();
      return;
    }

    const [startStr, endStr] = parts;
    let start: number;
    let end: number;

    if (startStr !== '' && endStr !== '') {
      start = parseInt(startStr, 10);
      end = parseInt(endStr, 10);
    } else if (startStr !== '' && endStr === '') {
      start = parseInt(startStr, 10);
      end = fileSize - 1;
    } else if (startStr === '' && endStr !== '') {
      const suffixLen = parseInt(endStr, 10);
      start = Math.max(0, fileSize - suffixLen);
      end = fileSize - 1;
    } else {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.end();
      return;
    }

    if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= fileSize) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.end();
      return;
    }

    if (end >= fileSize) {
      end = fileSize - 1;
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(chunkSize));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const fileStream = fs.createReadStream(resolvedPath, { start, end });
    await pipeStreamToResponse(fileStream, res);
    return;
  }

  // 9. Full content response (200 OK)
  res.status(200);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', String(fileSize));
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const fileStream = fs.createReadStream(resolvedPath);
  await pipeStreamToResponse(fileStream, res);
}

function serializeResource(resource: {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  type: string;
  noteContent: string | null;
  linkUrl: string | null;
  fileUrl: string | null;
  storagePath: string | null;
  folder: string | null;
  tagsJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let tags: string[] = [];

  if (resource.tagsJson) {
    try {
      tags = JSON.parse(resource.tagsJson);
    } catch {
      tags = [];
    }
  }

  return {
    ...resource,
    tags,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

function parseBody(body: unknown): Partial<CreateResourceInput> & { id?: string } {
  if (!body) {
    return {};
  }

  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  if (typeof body === 'object') {
    return body as Partial<CreateResourceInput> & { id?: string };
  }

  return {};
}

function getQueryParam(req: ApiRequest, key: string): string | undefined {
  const queryValue = req.query?.[key];
  if (Array.isArray(queryValue)) {
    return queryValue[0];
  }
  if (queryValue) {
    return queryValue;
  }

  if (req.url) {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get(key) ?? undefined;
  }

  return undefined;
}

function validateCreateInput(input: Partial<CreateResourceInput>) {
  const title = input.title?.trim();
  const type = input.type;

  if (!title) {
    throw new Error('Title is required');
  }

  if (!type || !RESOURCE_TYPES.has(type)) {
    throw new Error('Invalid resource type');
  }

  if (type === 'NOTE' && !input.noteContent?.trim()) {
    throw new Error('Note content is required');
  }

  if (type === 'LINK' && !input.linkUrl?.trim()) {
    throw new Error('Link URL is required');
  }

  if (type === 'PDF' && (!input.fileUrl?.trim() || !input.storagePath?.trim())) {
    throw new Error('PDF uploads require a file URL and storage path');
  }

  return {
    title,
    description: input.description?.trim() || null,
    type,
    noteContent: input.noteContent?.trim() || null,
    linkUrl: input.linkUrl?.trim() || null,
    fileUrl: input.fileUrl?.trim() || null,
    storagePath: input.storagePath?.trim() || null,
    folder: input.folder?.trim() || null,
    tagsJson: JSON.stringify(normalizeTags(input.tags)),
  };
}

function getStatusForError(error: unknown) {
  if (error instanceof AuthError) {
    return error.statusCode;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message === 'Invalid or expired session' ||
    message === 'Missing bearer token' ||
    message.includes('authentication') ||
    message.includes('Unauthorized') ||
    message.includes('Authentication required')
  ) {
    return 401;
  }

  if (
    message === 'Title is required' ||
    message === 'Invalid resource type' ||
    message === 'Note content is required' ||
    message === 'Link URL is required' ||
    message === 'PDF uploads require a file URL and storage path' ||
    message === 'Resource id is required' ||
    message === 'Resource not found'
  ) {
    return 400;
  }

  return 500;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS,HEAD');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Canonical Authenticated Source Access Endpoint: GET /api/resources/:id/file
  const fileResourceId = extractResourceIdFromFileRoute(req);
  if (fileResourceId) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      await handleStreamResourceFile(fileResourceId, req, res);
      return;
    }
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const targetUserId = await resolveContextUser(req as any);

    await ensureResourceSchema();

    if (req.method === 'GET') {
      let resources: any[] = [];
      if (targetUserId) {
        resources = await prisma.resource.findMany({
          where: {
            userId: targetUserId,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      // Deduplicate resources by title for display
      const seenTitles = new Set<string>();
      const deduped: any[] = [];
      for (const r of resources) {
        const key = (r.title || '').trim().toLowerCase();
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          deduped.push(r);
        }
      }

      json(res, 200, { resources: deduped.map(serializeResource) });
      return;
    }

    if (req.method === 'POST') {
      const input = validateCreateInput(parseBody(req.body));
      const resource = await prisma.resource.create({
        data: {
          userId: targetUserId,
          ...input,
        },
      });

      json(res, 201, { resource: serializeResource(resource) });
      return;
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req.body);
      const id = getQueryParam(req, 'id') ?? body.id;

      if (!id) {
        throw new Error('Resource id is required');
      }

      const existingResource = await prisma.resource.findFirst({
        where: { id, userId: targetUserId },
      });

      if (!existingResource) {
        throw new Error('Resource not found');
      }

      await prisma.resource.delete({
        where: {
          id: existingResource.id,
        },
      });

      json(res, 200, { success: true });
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const status = getStatusForError(error);

    console.error('Resource API error:', error);

    json(res, status, {
      error:
        process.env.NODE_ENV === 'production' && status === 500
          ? 'Internal server error'
          : message,
    });
  }
}

