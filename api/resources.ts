import { ensureResourceSchema, prisma } from '../server/prisma.ts';
import { verifySupabaseToken } from '../server/supabaseAuth.ts';
import type { CreateResourceInput } from '../src/types/resource.ts';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
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

function getStatusForError(message: string) {
  if (message === 'Invalid or expired session' || message === 'Missing bearer token') {
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
  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    let targetUserId: string | null = null;
    let authUser: { id: string } | null = null;

    try {
      authUser = await verifySupabaseToken(
        typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      );
      targetUserId = authUser.id;
    } catch (authErr) {
      const qUser = getQueryParam(req, 'userId') || getQueryParam(req, 'user_id');
      if (qUser) {
        targetUserId = qUser;
      } else if (req.method === 'GET') {
        targetUserId = 'default_user';
      } else {
        throw authErr;
      }
    }

    await ensureResourceSchema();

    if (req.method === 'GET') {
      let resources: any[] = [];
      if (targetUserId && targetUserId !== 'all') {
        resources = await prisma.resource.findMany({
          where: {
            OR: [
              { userId: targetUserId },
              { userId: 'default_user' },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      // If no resources found for this specific user filter, retrieve all available uploaded resources so learners are never blocked
      if (!resources || resources.length === 0) {
        resources = await prisma.resource.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      }

      // Deduplicate resources by title to avoid duplicate dropdown entries
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
      const effectiveUserId = authUser?.id || targetUserId || 'default_user';
      const resource = await prisma.resource.create({
        data: {
          userId: effectiveUserId,
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

      const activeUserId = authUser?.id || targetUserId;
      const existingResource = await prisma.resource.findFirst({
        where: activeUserId ? { id, userId: activeUserId } : { id },
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
    const status = getStatusForError(message);

    console.error('Resource API error:', error);

    json(res, status, {
      error:
        process.env.NODE_ENV === 'production' && status === 500
          ? 'Internal server error'
          : message,
    });
  }
}
