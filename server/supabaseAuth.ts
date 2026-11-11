import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://cmcbkatdyhunlvlktwlv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtY2JrYXRkeWh1bmx2bGt0d2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzOTc2MjIsImV4cCI6MjA1OTk3MzYyMn0.Q45bsnjT3BLNPeuth7CKXZ8O4Z3YLJJ55ez_bVCUYvk';

const parsedTimeout = Number(process.env.SUPABASE_AUTH_TIMEOUT_MS);
const SUPABASE_AUTH_TIMEOUT_MS =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000;

const timedFetch: typeof fetch = (input, init = {}) => {
  const timeoutSignal = AbortSignal.timeout(SUPABASE_AUTH_TIMEOUT_MS);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
};

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: timedFetch },
});

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fast local syntax check for compact JWS tokens (`header.payload.signature`)
 * so malformed bearer strings fail immediately without a remote auth roundtrip.
 */
function isPlausibleJwtFormat(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  if (!parts.every((part) => part.length > 0 && BASE64URL_RE.test(part))) {
    return false;
  }

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return isPlainJsonObject(header) && isPlainJsonObject(payload);
  } catch {
    return false;
  }
}

export async function verifySupabaseToken(authHeader?: string): Promise<AuthenticatedUser> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('Missing bearer token');
  }

  if (!isPlausibleJwtFormat(token)) {
    throw new Error('Invalid or expired session');
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error('Invalid or expired session');
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'Invalid or expired session') {
      throw err;
    }
    throw new Error('Invalid or expired session');
  }
}
