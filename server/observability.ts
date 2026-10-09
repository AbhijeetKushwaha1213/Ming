/**
 * Observability, Metrics, and Structured Logging Module
 * - Structured JSON logging for production observability.
 * - Safe user representation (never exposes PII or credentials).
 * - Latency tracking across database, vector store, and AI provider.
 * - Health probes: /api/health, /api/health/ready, /api/health/live.
 */

import crypto from 'node:crypto';
import { prisma, ensureResourceSchema, ensureAnalyticsSchema } from './prisma.ts';
import { validateProductionConfig } from './configValidator.ts';
import { serverReadCache } from './serverCache.ts';

export interface RequestMetrics {
  requestId: string;
  userId?: string;
  route: string;
  method: string;
  statusCode?: number;
  durationMs: number;
  dbDurationMs?: number;
  vectorDurationMs?: number;
  aiDurationMs?: number;
  chunksCount?: number;
  errorCategory?: string;
}

const SERVER_START_TIME = Date.now();

/**
 * Returns a privacy-safe, non-sensitive identifier for logs.
 * e.g. "u_7a1a...8a12" or "anon"
 */
export function safeUserId(userId?: string): string {
  if (!userId) return 'anonymous';
  if (['default_user', 'system_public', 'test_user'].includes(userId)) return userId;
  const hash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 8);
  return `usr_${hash}`;
}

/**
 * Scrubs any credentials or sensitive tokens from data objects.
 */
export function scrubSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubSensitiveData);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (
      lk.includes('password') ||
      lk.includes('token') ||
      lk.includes('secret') ||
      lk.includes('apikey') ||
      lk.includes('authorization') ||
      lk.includes('cookie')
    ) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = scrubSensitiveData(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Emits a single structured log line in production JSON format.
 */
export function logStructured(level: 'info' | 'warn' | 'error', message: string, meta: Partial<RequestMetrics> & Record<string, any>) {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const payload = {
    level,
    environment: env,
    message,
    timestamp: new Date().toISOString(),
    ...scrubSensitiveData(meta),
  };
  console.log(JSON.stringify(payload));
}

/**
 * Liveness Probe: Simple check to verify the process is alive.
 */
export function getLivenessStatus() {
  return {
    status: 'live',
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness Probe: Confirms active dependencies (Database & Vector Store).
 * Fails with 503 if critical dependencies are down.
 */
export async function getReadinessStatus(): Promise<{ ready: boolean; statusCode: number; checks: Record<string, string> }> {
  const checks: Record<string, string> = {
    api: 'ok',
    database: 'unknown',
    vectorStore: 'unknown',
  };

  let ready = true;

  // 1. Check Database
  const startDb = Date.now();
  let lastDbErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureResourceSchema();
      await ensureAnalyticsSchema();
      await prisma.resource.count({ take: 1 });
      checks.database = `ok (${Date.now() - startDb}ms)`;
      lastDbErr = null;
      break;
    } catch (dbErr: any) {
      lastDbErr = dbErr;
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 500));
      }
    }
  }

  if (lastDbErr) {
    ready = false;
    checks.database = `failed: ${lastDbErr.message || 'unreachable'}`;
  }

  // 2. Check Vector Store Provider
  const vectorProvider = (process.env.VECTOR_STORE || 'chroma').toLowerCase().trim();
  const isPostgres = Boolean(
    process.env.DATABASE_URL?.startsWith('postgres') ||
    process.env.DATABASE_URL?.startsWith('postgresql') ||
    process.env.PGVECTOR_URL ||
    process.env.SUPABASE_URL ||
    process.env.PGVECTOR_TEST_LOCAL === '1'
  );

  if (vectorProvider === 'pgvector' && !isPostgres) {
    ready = false;
    checks.vectorStore = `failed: pgvector unconfigured (${vectorProvider})`;
  } else {
    checks.vectorStore = `configured (${vectorProvider})`;
  }

  return {
    ready,
    statusCode: ready ? 200 : 503,
    checks,
  };
}

/**
 * Comprehensive Health Diagnostic: Detailed multi-component health.
 */
export async function getComprehensiveHealth() {
  const readiness = await getReadinessStatus();
  const config = validateProductionConfig();

  return {
    status: readiness.ready ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    environment: config.environment,
    components: {
      api: 'healthy',
      database: readiness.checks.database.startsWith('ok') ? 'healthy' : 'degraded',
      vectorStore: config.publicConfig.vectorStore,
      aiProvider: config.publicConfig.geminiConfigured ? 'configured' : 'unconfigured',
      auth: config.publicConfig.supabaseConfigured ? 'supabase_jwt' : 'dev_mode',
    },
    checks: readiness.checks,
    cache: serverReadCache.getStats(),
    publicConfig: config.publicConfig,
    timestamp: new Date().toISOString(),
  };
}

/**
 * OpenTelemetry-Compatible Distributed Tracing Abstraction
 * Implements W3C TraceContext standards (traceparent: 00-<trace_id>-<span_id>-<flags>).
 * Never captures document bodies or secret headers in span attributes.
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  durationMs?: number;
  attributes: Record<string, any>;
  status: 'ok' | 'error';
  errorMessage?: string;
}

export function parseTraceparent(header?: string): { traceId: string; parentSpanId?: string } {
  if (!header || typeof header !== 'string') {
    return { traceId: crypto.randomBytes(16).toString('hex') };
  }

  const parts = header.trim().split('-');
  if (parts.length >= 4 && parts[0] === '00' && parts[1].length === 32) {
    return {
      traceId: parts[1],
      parentSpanId: parts[2],
    };
  }

  return { traceId: crypto.randomBytes(16).toString('hex') };
}

export function formatTraceparent(span: TraceSpan): string {
  return `00-${span.traceId}-${span.spanId}-01`;
}

export function startSpan(
  name: string,
  options?: {
    traceparent?: string;
    parentSpan?: TraceSpan;
    attributes?: Record<string, any>;
  }
): TraceSpan {
  let traceId: string;
  let parentSpanId: string | undefined;

  if (options?.parentSpan) {
    traceId = options.parentSpan.traceId;
    parentSpanId = options.parentSpan.spanId;
  } else if (options?.traceparent) {
    const parsed = parseTraceparent(options.traceparent);
    traceId = parsed.traceId;
    parentSpanId = parsed.parentSpanId;
  } else {
    traceId = crypto.randomBytes(16).toString('hex');
  }

  const spanId = crypto.randomBytes(8).toString('hex');

  return {
    traceId,
    spanId,
    parentSpanId,
    name,
    startTime: Date.now(),
    attributes: scrubSensitiveData(options?.attributes || {}),
    status: 'ok',
  };
}

export function endSpan(
  span: TraceSpan,
  options?: {
    error?: Error | string;
    attributes?: Record<string, any>;
  }
): TraceSpan {
  span.durationMs = Date.now() - span.startTime;

  if (options?.attributes) {
    span.attributes = {
      ...span.attributes,
      ...scrubSensitiveData(options.attributes),
    };
  }

  if (options?.error) {
    span.status = 'error';
    span.errorMessage = typeof options.error === 'string' ? options.error : options.error.message;
    span.attributes['error'] = true;
    span.attributes['error.message'] = span.errorMessage;
  }

  return span;
}
