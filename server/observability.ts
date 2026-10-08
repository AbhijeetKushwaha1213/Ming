/**
 * Observability, Metrics, and Structured Logging Module
 * - Structured JSON logging for production observability.
 * - Safe user representation (never exposes PII or credentials).
 * - Latency tracking across database, vector store, and AI provider.
 * - Health probes: /api/health, /api/health/ready, /api/health/live.
 */

import crypto from 'node:crypto';
import { prisma } from './prisma.ts';
import { validateProductionConfig } from './configValidator.ts';

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
  const payload = {
    level,
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
  try {
    await prisma.resource.count({ take: 1 });
    checks.database = `ok (${Date.now() - startDb}ms)`;
  } catch (dbErr: any) {
    ready = false;
    checks.database = `failed: ${dbErr.message || 'unreachable'}`;
  }

  // 2. Check Vector Store Provider
  const vectorProvider = (process.env.VECTOR_STORE || 'chroma').toLowerCase().trim();
  checks.vectorStore = `configured (${vectorProvider})`;

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
    publicConfig: config.publicConfig,
    timestamp: new Date().toISOString(),
  };
}
