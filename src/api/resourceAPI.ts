import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import type { CreateResourceInput, ResourceItem } from '@/types/resource';

const RESOURCE_STORAGE_BUCKET = 'resource-files';
const MAX_PDF_SIZE = 10 * 1024 * 1024;

async function getAccessToken() {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, error: new Error('Session timeout') }), 800)
    );
    const { data, error } = (await Promise.race([sessionPromise, timeoutPromise])) as any;

    if (error || !data?.session?.access_token) {
      throw new Error('User not authenticated');
    }

    return data.session.access_token;
  } catch (err: any) {
    throw new Error(err.message || 'User not authenticated');
  }
}

async function authorizedFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Resource API request failed: ${error.message}`
        : 'Resource API request failed',
    );
  }

  const rawText = await response.text();
  let payload: Record<string, unknown> = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const message =
      (typeof payload.error === 'string' && payload.error) ||
      rawText ||
      `${response.status} ${response.statusText}` ||
      'Request failed';

    throw new Error(`Resource API error (${response.status}): ${message}`);
  }

  return payload as T;
}

function ensureResourceArray(value: unknown): ResourceItem[] {
  return Array.isArray(value) ? (value as ResourceItem[]) : [];
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildAuthenticatedFileUrl(storagePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/authenticated/${RESOURCE_STORAGE_BUCKET}/${storagePath}`;
}

export async function listResources() {
  const payload = await authorizedFetch<{ resources: ResourceItem[] }>('/api/resources', {
    method: 'GET',
  });

  return ensureResourceArray(payload?.resources);
}

export async function createResource(input: CreateResourceInput) {
  const payload = await authorizedFetch<{ resource: ResourceItem }>('/api/resources', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return payload.resource;
}

export async function deleteResource(id: string) {
  await authorizedFetch<{ success: boolean }>(`/api/resources?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function uploadPdfResource(file: File, userId: string) {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF uploads are supported');
  }

  if (file.size > MAX_PDF_SIZE) {
    throw new Error('PDF size must be 10MB or less');
  }

  const storagePath = `${userId}/resources/${Date.now()}_${sanitizeFilename(file.name)}`;

  const { error } = await supabase.storage
    .from(RESOURCE_STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  return {
    storagePath,
    fileUrl: buildAuthenticatedFileUrl(storagePath),
  };
}

export async function deletePdfResource(storagePath?: string | null) {
  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage
    .from(RESOURCE_STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete PDF: ${error.message}`);
  }
}

export async function createPdfSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(RESOURCE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Failed to generate PDF link');
  }

  return data.signedUrl;
}

/**
 * Canonical Phase 3 authenticated source access URL generator.
 * Returns the canonical endpoint for streaming original citation resources.
 */
export function getResourceFileUrl(resourceId: string): string {
  return `/api/resources/${encodeURIComponent(resourceId)}/file`;
}

export class ResourceAccessError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ResourceAccessError';
    this.statusCode = statusCode;
  }
}

export class ResourceAuthError extends ResourceAccessError {
  constructor(message = 'Authentication required to access resource') {
    super(message, 401);
    this.name = 'ResourceAuthError';
  }
}

export class ResourceForbiddenError extends ResourceAccessError {
  constructor(message = 'Access denied: Resource belongs to another private tenant') {
    super(message, 403);
    this.name = 'ResourceForbiddenError';
  }
}

export class ResourceNotFoundError extends ResourceAccessError {
  constructor(message = 'Source unavailable: Resource not found or has been deleted') {
    super(message, 404);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Safely fetches resource file bytes with authentication headers.
 * Resolves into a local Blob URL for media players and document viewers.
 */
export async function fetchResourceFile(
  resourceId: string
): Promise<{ blob: Blob; contentType: string; url: string; size: number }> {
  if (!resourceId) {
    throw new ResourceNotFoundError('Resource ID is required');
  }

  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch {
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('ming_auth_token') || localStorage.getItem('x-ming-test-key') || null;
    }
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (typeof window !== 'undefined') {
    const testKey = localStorage.getItem('x-ming-test-key');
    if (testKey) headers['x-ming-test-key'] = testKey;
    const testUser = localStorage.getItem('x-ming-user-id');
    if (testUser) headers['x-ming-user-id'] = testUser;
  }

  const res = await fetch(getResourceFileUrl(resourceId), {
    method: 'GET',
    headers,
  });

  if (res.status === 401) {
    throw new ResourceAuthError('Authentication required to access this course material.');
  }
  if (res.status === 403) {
    throw new ResourceForbiddenError('Access denied: You do not have permission to view this resource.');
  }
  if (res.status === 404) {
    throw new ResourceNotFoundError('Source unavailable: The requested course material was deleted or moved.');
  }
  if (!res.ok) {
    throw new ResourceAccessError(`Failed to stream resource (${res.status}): ${res.statusText}`, res.status);
  }

  const blob = await res.blob();
  const contentType = res.headers.get('content-type') || blob.type || 'application/octet-stream';
  const url = URL.createObjectURL(blob);

  return {
    blob,
    contentType,
    url,
    size: blob.size,
  };
}
