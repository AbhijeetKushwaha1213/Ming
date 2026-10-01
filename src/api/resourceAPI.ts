import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import type { CreateResourceInput, ResourceItem } from '@/types/resource';

const RESOURCE_STORAGE_BUCKET = 'resource-files';
const MAX_PDF_SIZE = 10 * 1024 * 1024;

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('User not authenticated');
  }

  return data.session.access_token;
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
