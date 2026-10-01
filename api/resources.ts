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

const RESOURCE_TYPES = new Set(['NOTE', 'LINK', 'PDF']);

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
    const user = await verifySupabaseToken(
      typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
    );

    await ensureResourceSchema();

    if (req.method === 'GET') {
      const resources = await prisma.resource.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      json(res, 200, { resources: resources.map(serializeResource) });
      return;
    }

    if (req.method === 'POST') {
      const input = validateCreateInput(parseBody(req.body));
      const resource = await prisma.resource.create({
        data: {
          userId: user.id,
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
        where: {
          id,
          userId: user.id,
        },
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
