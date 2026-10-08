import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifySupabaseToken, type AuthenticatedUser } from './supabaseAuth.ts';

export interface AuthenticatedRequest extends IncomingMessage {
  user?: AuthenticatedUser;
  requestId: string;
  startTime: number;
}

export interface SecurityContext {
  userId: string;
  email?: string;
  isServiceRole?: boolean;
}

// In-memory sliding window rate limiter
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_GENERAL_REQUESTS_PER_MIN = 120;
const MAX_AI_REQUESTS_PER_MIN = 30;

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function checkRateLimit(key: string, isAiEndpoint = false): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const limit = isAiEndpoint ? MAX_AI_REQUESTS_PER_MIN : MAX_GENERAL_REQUESTS_PER_MIN;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (record.count >= limit) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, retryAfterSec: 0 };
}

/**
 * Resolves user identity from Supabase JWT token or verified server test key.
 * Strictly forbids untrusted query/body user impersonation in production.
 */
export async function authenticateRequest(
  req: IncomingMessage,
  options: { optional?: boolean } = {}
): Promise<SecurityContext | null> {
  const authHeader = req.headers['authorization'];
  const testKeyHeader = req.headers['x-ming-test-key'];
  const envTestSecret = process.env.MING_TEST_SECRET;

  // 1. Check for verified automated test suite / internal benchmark execution
  if (testKeyHeader && envTestSecret && testKeyHeader === envTestSecret) {
    const testUserId = (req.headers['x-ming-user-id'] as string) || 'default_user';
    return {
      userId: testUserId,
      email: `${testUserId}@test.local`,
      isServiceRole: true,
    };
  }

  // 2. Validate standard Bearer JWT from Supabase Auth
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      const user = await verifySupabaseToken(authHeader);
      return {
        userId: user.id,
        email: user.email,
        isServiceRole: false,
      };
    } catch {
      if (options.optional) return null;
      throw new AuthError('Invalid or expired authentication session', 401);
    }
  }

  // 3. Fallback for development / non-production local benchmark execution if explicitly configured
  const isDevOrTest = process.env.NODE_ENV !== 'production';
  const allowDevBypass = process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

  if (isDevOrTest && allowDevBypass) {
    const devUserId = (req.headers['x-dev-user-id'] as string) || 'default_user';
    return {
      userId: devUserId,
      email: `${devUserId}@ming.local`,
      isServiceRole: false,
    };
  }

  if (options.optional) {
    return null;
  }

  throw new AuthError('Authentication required. Missing Bearer token.', 401);
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Safely resolves the authenticated user id for any request handler.
 * Prevents user impersonation through query or body overrides in production.
 */
export async function resolveContextUser(
  req: { headers?: Record<string, any>; query?: Record<string, any>; body?: any },
  allowAnonymousDev = true
): Promise<string> {
  const authHeader = req.headers?.authorization;
  const testKeyHeader = req.headers?.['x-ming-test-key'];
  const envTestSecret = process.env.MING_TEST_SECRET;

  if (testKeyHeader && envTestSecret && testKeyHeader === envTestSecret) {
    return (req.headers?.['x-ming-user-id'] as string) || 'default_user';
  }

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      const user = await verifySupabaseToken(authHeader);
      return user.id;
    } catch {
      throw new AuthError('Invalid or expired authentication session', 401);
    }
  }

  // Development / Benchmark fallback when explicitly enabled
  const isDevOrTest = process.env.NODE_ENV !== 'production';
  const allowDevBypass = process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

  if (isDevOrTest && (allowDevBypass || allowAnonymousDev)) {
    return (
      (req.headers?.['x-dev-user-id'] as string) ||
      (req.headers?.['x-ming-user-id'] as string) ||
      req.query?.userId ||
      req.body?.userId ||
      req.body?.user_id ||
      'default_user'
    );
  }

  throw new AuthError('Authentication required. Missing Bearer token.', 401);
}

export function sendJsonError(
  res: ServerResponse,
  statusCode: number,
  error: string,
  category = 'SECURITY_ERROR',
  details?: unknown
) {
  if (!res.headersSent) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error,
        category,
        statusCode,
        timestamp: new Date().toISOString(),
        details: details || undefined,
      })
    );
  }
}
