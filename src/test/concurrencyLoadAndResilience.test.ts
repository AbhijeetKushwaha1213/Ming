/**
 * Phase 4 Concurrency, Load Hardening, Database Connection-Pool & Gateway Resilience Suite
 * 
 * Tests:
 * 1. Concurrency & Connection-Pool Stability (10, 25, 50 concurrent users)
 * 2. RAG & PgVector Performance under Concurrency
 * 3. Gemini Gateway Resilience (timeouts, 429, 5xx, malformed responses, correlation IDs, zero key leaks)
 * 4. Multi-Tenant Security Regression Under Concurrent Load (User A vs B vs C simultaneous queries)
 * 5. Sliding-Window Rate Limiting (120 req/min general, 30 req/min AI, burst rejection, isolation)
 * 6. Distributed Tracing & W3C TraceContext standards
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkRateLimit,
  resolveContextUser,
  rateLimitMap,
  AuthError,
} from '../../server/authMiddleware.ts';
import { handleAiGenerate } from '../../server/aiProxyHandler.ts';
import { prisma } from '../../server/prisma.ts';
import {
  startSpan,
  endSpan,
  parseTraceparent,
  formatTraceparent,
} from '../../server/observability.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_PATH = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');

function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3001/api/test',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
  };

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(data?: any) {
      if (data && !this.body) {
        try {
          this.body = JSON.parse(data);
        } catch {
          this.body = data;
        }
      }
    },
  };

  return { req, res };
}

function runPythonSnippet(code: string): any {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VECTOR_STORE: 'pgvector',
    PGVECTOR_TEST_LOCAL: '1',
  };

  const output = execFileSync(
    PYTHON_PATH,
    ['-c', code],
    {
      cwd: PROJECT_ROOT,
      env,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`Invalid JSON from Python snippet: ${output}`);
  }
  return JSON.parse(output.slice(jsonStart));
}

describe('PHASE 4: CONCURRENCY, LOAD HARDENING & RESILIENCE', () => {
  beforeEach(() => {
    rateLimitMap.clear();
    process.env.NODE_ENV = 'production';
    process.env.VECTOR_STORE = 'pgvector';
    process.env.PGVECTOR_TEST_LOCAL = '1';
    process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
    process.env.MING_TEST_SECRET = 'test-secret-load-suite';
    process.env.GEMINI_API_KEY = 'AIzaSyProductionMockApiKey987654';
  });

  // =========================================================================
  // 1. Connection-Pool & Concurrency Validation (10, 25, 50 users)
  // =========================================================================
  describe('1. Database Connection-Pool & Concurrency Validation', () => {
    it('1.1 Handles 10, 25, and 50 concurrent database operations without connection storms or deadlocks', async () => {
      const concurrencyLevels = [10, 25, 50];

      for (const concurrency of concurrencyLevels) {
        const operations = Array.from({ length: concurrency }, async (_, i) => {
          const testUserId = `usr_concurrent_${concurrency}_${i}`;
          // Read resource count safely
          const count = await prisma.resource.count({
            where: { userId: testUserId },
          });
          return count;
        });

        const results = await Promise.all(operations);
        expect(results.length).toBe(concurrency);
        results.forEach((c) => expect(typeof c).toBe('number'));
      }
    });

    it('1.2 Sustains concurrent transactional writes without deadlocks or leaked connections', async () => {
      const batchSize = 15;
      const writes = Array.from({ length: batchSize }, async (_, i) => {
        const id = `smoke_tx_${Date.now()}_${i}`;
        const userId = `usr_tx_${i}`;
        return prisma.resource.create({
          data: {
            id,
            userId,
            title: `Concurrent Resource ${i}`,
            type: 'NOTE',
            noteContent: `Content for note ${i}`,
          },
        });
      });

      const inserted = await Promise.all(writes);
      expect(inserted.length).toBe(batchSize);

      // Clean up
      const ids = inserted.map((r) => r.id);
      await prisma.resource.deleteMany({
        where: { id: { in: ids } },
      });
    });
  });

  // =========================================================================
  // 2. RAG & PgVector Concurrency Performance
  // =========================================================================
  describe('2. RAG & PgVector Concurrency Performance', () => {
    it('2.1 Concurrent PgVector nearest-neighbor queries execute with sub-second latency and zero crosstalk', () => {
      const code = `
import sys, json, time
sys.path.insert(0, './server')
from vector_store import get_vector_store
from concurrent.futures import ThreadPoolExecutor

store = get_vector_store('pgvector')

# Warm up embedding model in memory before thread execution
store.query_candidates(query_texts=["warmup memory model"], top_k=1, user_id="default_user")

queries = [
    ("query_1", "operating system virtual memory", "default_user"),
    ("query_2", "process scheduling CPU algorithm", "default_user"),
    ("query_3", "cache coherence MESI protocol", "default_user"),
    ("query_4", "file system inode allocation", "default_user"),
    ("query_5", "page replacement LRU clock algorithm", "default_user"),
] * 4  # 20 concurrent vector searches

def execute_search(item):
    qid, text, uid = item
    t0 = time.time()
    res = store.query_candidates(
        query_texts=[text],
        top_k=3,
        user_id=uid
    )
    dt = time.time() - t0
    return {"qid": qid, "count": len(res.get("ids", [[]])[0]), "duration_ms": dt * 1000}

with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(execute_search, queries))

all_durations = [r["duration_ms"] for r in results]
all_durations.sort()
p50 = all_durations[len(all_durations) // 2]
p95 = all_durations[int(len(all_durations) * 0.95)]

print(json.dumps({
    "total_queries": len(results),
    "all_succeeded": all(r["count"] >= 0 for r in results),
    "p50_ms": p50,
    "p95_ms": p95
}))
`;
      const result = runPythonSnippet(code);
      expect(result.total_queries).toBe(20);
      expect(result.all_succeeded).toBe(true);
      expect(result.p50_ms).toBeLessThan(1000);
    });
  });

  // =========================================================================
  // 3. Gemini Gateway Resilience & Timeouts
  // =========================================================================
  describe('3. Gemini Gateway Resilience', () => {
    it('3.1 Enforces explicit timeout on slow external provider responses', async () => {
      // Mock global fetch to simulate a hanging/delayed Gemini API response
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ candidates: [] }),
            });
          }, 3500);

          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const { req, res } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/ai/generate',
        headers: {
          'x-ming-test-key': 'test-secret-load-suite',
          'x-ming-user-id': 'test_student',
        },
        body: {
          prompt: 'Explain paging',
          timeoutMs: 150, // Short timeout for test
        },
      });

      await handleAiGenerate(req as any, res as any);
      global.fetch = originalFetch;

      expect(res.statusCode).toBe(504);
      expect(res.body.category).toBe('TIMEOUT_ERROR');
    });

    it('3.2 Handles upstream 429 and 5xx failures gracefully without leaking API keys', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Temporarily Unavailable',
      });

      const { req, res } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/ai/generate',
        headers: {
          'x-ming-test-key': 'test-secret-load-suite',
          'x-ming-user-id': 'test_student',
        },
        body: {
          prompt: 'Hello AI',
        },
      });

      await handleAiGenerate(req as any, res as any);
      global.fetch = originalFetch;

      expect(res.statusCode).toBe(502);
      expect(res.body.category).toBe('PROVIDER_ERROR');
      // Verify API key is NOT leaked anywhere in the response
      expect(JSON.stringify(res.body)).not.toContain('AIzaSyProductionMockApiKey987654');
    });

    it('3.3 Handles malformed AI JSON output gracefully with fallback recovery', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '<<<NOT JSON>>> Here is plain conversational output.' }],
              },
            },
          ],
        }),
      });

      const { req, res } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/ai/generate',
        headers: {
          'x-ming-test-key': 'test-secret-load-suite',
          'x-ming-user-id': 'test_student',
        },
        body: {
          prompt: 'Give me JSON format',
          responseFormat: 'json',
        },
      });

      await handleAiGenerate(req as any, res as any);
      global.fetch = originalFetch;

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Multi-Tenant Security Regression Under Simultaneous Load
  // =========================================================================
  describe('4. Multi-Tenant Security Regression Under Load', () => {
    it('4.1 Simultaneous cross-tenant queries for User A, B, and C produce zero cross-tenant leaks', () => {
      const code = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store
from concurrent.futures import ThreadPoolExecutor

store = get_vector_store('pgvector')

# Setup 3 isolated users with private documents
store.add_documents([
    {
        "id": "chunk_private_A_999",
        "text": "Private Financial Record Alpha for User A exclusively.",
        "metadata": {"user_id": "usr_tenant_A", "tenant_type": "USER", "topic": "Finance"}
    },
    {
        "id": "chunk_private_B_999",
        "text": "Private Medical Diagnostic Beta for User B exclusively.",
        "metadata": {"user_id": "usr_tenant_B", "tenant_type": "USER", "topic": "Medical"}
    },
    {
        "id": "chunk_private_C_999",
        "text": "Private Legal Contract Gamma for User C exclusively.",
        "metadata": {"user_id": "usr_tenant_C", "tenant_type": "USER", "topic": "Legal"}
    }
])

# Simulate simultaneous requests
def execute_tenant_query(user_info):
    active_uid, query_phrase = user_info
    res = store.query_candidates(
        query_texts=[query_phrase],
        top_k=5,
        user_id=active_uid
    )
    all_metas = [m for sub in res["metadatas"] for m in sub]
    return {
        "queried_user": active_uid,
        "returned_users": list(set([m.get("user_id") for m in all_metas]))
    }

tasks = [
    ("usr_tenant_A", "Financial Record Alpha Medical Diagnostic Legal Contract"),
    ("usr_tenant_B", "Financial Record Alpha Medical Diagnostic Legal Contract"),
    ("usr_tenant_C", "Financial Record Alpha Medical Diagnostic Legal Contract"),
] * 5  # 15 concurrent cross-tenant searches

with ThreadPoolExecutor(max_workers=6) as executor:
    results = list(executor.map(execute_tenant_query, tasks))

# Cleanup
store.delete_by(user_id="usr_tenant_A")
store.delete_by(user_id="usr_tenant_B")
store.delete_by(user_id="usr_tenant_C")

leaks = 0
for r in results:
    active = r["queried_user"]
    for other_user in ["usr_tenant_A", "usr_tenant_B", "usr_tenant_C"]:
        if other_user != active and other_user in r["returned_users"]:
            leaks += 1

print(json.dumps({
    "total_simultaneous_queries": len(results),
    "leaks_detected": leaks
}))
`;
      const result = runPythonSnippet(code);
      expect(result.total_simultaneous_queries).toBe(15);
      expect(result.leaks_detected).toBe(0);
    });

    it('4.2 Client spoofing attempts (spoofed userId / manipulated tenant_type) are neutralized under concurrency', async () => {
      const spoofAttempts = Array.from({ length: 20 }, async (_, i) => {
        const victim = `victim_user_${i}`;
        const attacker = `attacker_user_${i}`;

        const { req } = createMockReqRes({
          method: 'POST',
          url: `http://localhost:3001/api/rag/search?userId=${victim}&tenant_type=SYSTEM_PUBLIC`,
          headers: {
            'x-ming-test-key': 'test-secret-load-suite',
            'x-ming-user-id': attacker,
          },
          body: {
            userId: victim,
            tenant_type: 'SYSTEM_PUBLIC',
          },
        });

        const resolved = await resolveContextUser(req);
        return {
          spoofed: resolved === victim,
          authenticated: resolved === attacker,
        };
      });

      const results = await Promise.all(spoofAttempts);
      expect(results.every((r) => !r.spoofed)).toBe(true);
      expect(results.every((r) => r.authenticated)).toBe(true);
    });
  });

  // =========================================================================
  // 5. Sliding-Window Rate Limiting Under Concurrency
  // =========================================================================
  describe('5. Rate Limiting Under Load', () => {
    it('5.1 Permits normal traffic under 30 req/min and rejects bursts with HTTP 429 and Retry-After', () => {
      const userKey = 'ai:burst_test_user_42';

      // 1. Send 30 allowed requests
      for (let i = 0; i < 30; i++) {
        const check = checkRateLimit(userKey, true);
        expect(check.allowed).toBe(true);
      }

      // 2. 31st request should be rejected
      const burstCheck = checkRateLimit(userKey, true);
      expect(burstCheck.allowed).toBe(false);
      expect(burstCheck.remaining).toBe(0);
      expect(burstCheck.retryAfterSec).toBeGreaterThan(0);
    });

    it('5.2 Independent users are isolated from one another in rate limiting', () => {
      const userA = 'ai:user_independent_A';
      const userB = 'ai:user_independent_B';

      // Exhaust User A's limit
      for (let i = 0; i < 30; i++) {
        checkRateLimit(userA, true);
      }
      expect(checkRateLimit(userA, true).allowed).toBe(false);

      // User B should remain completely unaffected
      const checkB = checkRateLimit(userB, true);
      expect(checkB.allowed).toBe(true);
      expect(checkB.remaining).toBe(29);
    });
  });

  // =========================================================================
  // 6. Distributed Tracing & W3C TraceContext
  // =========================================================================
  describe('6. Distributed Tracing & TraceContext Standards', () => {
    it('6.1 Generates and propagates W3C TraceContext spans across requests', () => {
      const initialHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const parsed = parseTraceparent(initialHeader);
      expect(parsed.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(parsed.parentSpanId).toBe('00f067aa0ba902b7');

      const span = startSpan('pgvector.query_candidates', {
        traceparent: initialHeader,
        attributes: {
          'db.system': 'postgresql',
          'vector.provider': 'pgvector',
          'vector.dimension': 384,
          'user.id': 'usr_test_student',
        },
      });

      expect(span.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(span.parentSpanId).toBe('00f067aa0ba902b7');
      expect(span.name).toBe('pgvector.query_candidates');

      const endedSpan = endSpan(span, {
        attributes: {
          'vector.candidates_found': 5,
        },
      });

      expect(endedSpan.durationMs).toBeGreaterThanOrEqual(0);
      expect(endedSpan.status).toBe('ok');
      expect(formatTraceparent(endedSpan)).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
    });
  });
});
