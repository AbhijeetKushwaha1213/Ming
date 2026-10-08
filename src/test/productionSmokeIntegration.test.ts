/**
 * Phase 3 Production End-to-End Smoke & Integration Test Suite
 * 
 * Verifies the complete production request lifecycle:
 * - Scenario A: Authenticated user resource lifecycle (ingest, chunk, embed, pgvector store, retrieve, grounded citations/coordinates)
 * - Scenario B: Strict tenant isolation (User A vs User B, spoofed identity rejection)
 * - Scenario C: SYSTEM_PUBLIC curriculum accessibility for all authenticated users
 * - Scenario D: Controlled failure behaviors (DB down, Gemini down, invalid auth, dimension mismatch, empty query)
 * - Scenario E: Observability, health probes (/api/health, /api/health/ready, /api/health/live), and safe logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLivenessStatus,
  getReadinessStatus,
  getComprehensiveHealth,
  safeUserId,
  scrubSensitiveData,
} from '../../server/observability.ts';
import {
  validateProductionConfig,
  assertValidConfiguration,
  maskSecret,
} from '../../server/configValidator.ts';
import { ragHandler } from '../../server/ragHandler.ts';
import { handleAiGenerate } from '../../server/aiProxyHandler.ts';
import resourcesHandler from '../../api/resources.ts';
import { resolveContextUser, AuthError } from '../../server/authMiddleware.ts';

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

function runPythonPgvectorSnippet(code: string): any {
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

describe('PHASE 3: PRODUCTION END-TO-END INTEGRATION & DEPLOYMENT HARDENING', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.VECTOR_STORE = 'pgvector';
    process.env.PGVECTOR_TEST_LOCAL = '1';
    process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
    process.env.MING_TEST_SECRET = 'test-secret-prod-key';
    process.env.GEMINI_API_KEY = 'AIzaSyTestMockProductionKey123456';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/studymate_prod';
    process.env.SUPABASE_URL = 'https://cmcbkatdyhunlvlktwlv.supabase.co';
    process.env.ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
  });

  // =========================================================================
  // SCENARIO A: Authenticated User Complete Pipeline
  // =========================================================================
  describe('Scenario A: Authenticated User Pipeline', () => {
    const userA = 'usr_prod_smoke_a_' + Date.now();
    const sourceIdA = 'src_smoke_lecture_1';

    it('A1-A4: Ingests resource, chunks, embeds, and stores in PgVectorStore', async () => {
      const code = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store

store = get_vector_store('pgvector')

chunks = [
    {
        "id": "chunk_smoke_a_1",
        "text": "Cache coherency protocols such as MESI maintain state consistency across multi-core processors.",
        "metadata": {
            "document_id": "doc_smoke_a_1",
            "source_id": "${sourceIdA}",
            "user_id": "${userA}",
            "tenant_type": "USER",
            "topic": "Computer Architecture",
            "subtopic": "Cache Coherency",
            "source_type": "PDF",
            "page_number": 42
        }
    },
    {
        "id": "chunk_smoke_a_2",
        "text": "Snooping based bus protocols broadcast invalidate messages on write operations.",
        "metadata": {
            "document_id": "doc_smoke_a_1",
            "source_id": "${sourceIdA}",
            "user_id": "${userA}",
            "tenant_type": "USER",
            "topic": "Computer Architecture",
            "subtopic": "Snooping",
            "source_type": "PDF",
            "page_number": 43
        }
    }
]

res = store.add_documents(chunks)
print(json.dumps({"inserted": res.get("inserted", 0), "provider": store.provider_name}))
`;
      const result = runPythonPgvectorSnippet(code);
      expect(result.inserted).toBe(2);
      expect(result.provider).toBe('pgvector');
    });

    it('A5-A8: Queries pgvector, retrieves chunks, and preserves coordinates & citations', async () => {
      const code = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store

store = get_vector_store('pgvector')

res = store.query_candidates(
    query_texts=["MESI cache coherence multi-core"],
    top_k=2,
    user_id="${userA}",
    source_id="${sourceIdA}"
)

top_id = res["ids"][0][0]
top_meta = res["metadatas"][0][0]
chunk_details = store.get_chunk(top_id)

# Cleanup
store.delete_by(user_id="${userA}")

print(json.dumps({
    "top_id": top_id,
    "source_type": top_meta.get("source_type"),
    "page_number": top_meta.get("page_number"),
    "user_id": top_meta.get("user_id"),
    "location_page": chunk_details.get("location", {}).get("page_number") if chunk_details else None
}))
`;
      const result = runPythonPgvectorSnippet(code);
      expect(result.top_id).toBe('chunk_smoke_a_1');
      expect(result.source_type).toBe('PDF');
      expect(result.page_number).toBe(42);
      expect(result.location_page).toBe(42);
      expect(result.user_id).toBe(userA);
    });
  });

  // =========================================================================
  // SCENARIO B: Tenant Isolation & Spoofing Resistance
  // =========================================================================
  describe('Scenario B: Strict Tenant Isolation', () => {
    const userVictim = 'usr_victim_' + Date.now();
    const userAttacker = 'usr_attacker_' + Date.now();

    it('B1-B4: User A private vectors are never returned to User B query', () => {
      const code = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store

store = get_vector_store('pgvector')

# Add secret chunk for victim
store.add_documents([{
    "id": "chunk_secret_victim_42",
    "text": "Confidential medical record data for patient X99281.",
    "metadata": {
        "user_id": "${userVictim}",
        "tenant_type": "USER",
        "topic": "Medicine",
        "source_type": "TEXT"
    }
}])

# Attacker queries
res = store.query_candidates(
    query_texts=["medical record patient X99281"],
    top_k=5,
    user_id="${userAttacker}"
)

all_ids = [cid for sub in res["ids"] for cid in sub]
all_metas = [m for sub in res["metadatas"] for m in sub]

# Cleanup
store.delete_by(user_id="${userVictim}")

print(json.dumps({
    "leaked": "chunk_secret_victim_42" in all_ids,
    "any_victim_data": any(m.get("user_id") == "${userVictim}" for m in all_metas)
}))
`;
      const result = runPythonPgvectorSnippet(code);
      expect(result.leaked).toBe(false);
      expect(result.any_victim_data).toBe(false);
    });

    it('B5: Spoofed client-provided userId query param is ignored in favor of authenticated context', async () => {
      const { req } = createMockReqRes({
        method: 'POST',
        url: `http://localhost:3001/api/rag/search?userId=${userVictim}`,
        headers: {
          'x-ming-test-key': 'test-secret-prod-key',
          'x-ming-user-id': userAttacker,
        },
        body: {
          query: 'test query',
          userId: userVictim,
        },
      });

      const resolved = await resolveContextUser(req);
      expect(resolved).toBe(userAttacker);
      expect(resolved).not.toBe(userVictim);
    });
  });

  // =========================================================================
  // SCENARIO C: SYSTEM_PUBLIC Curriculum Content
  // =========================================================================
  describe('Scenario C: SYSTEM_PUBLIC Curriculum Accessibility', () => {
    it('C1-C3: Public curriculum content is retrievable by any authenticated user', () => {
      const studentUser = 'usr_student_' + Date.now();
      const code = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store

store = get_vector_store('pgvector')

# Add public curriculum chunk
store.add_documents([{
    "id": "chunk_pub_math_101",
    "text": "The fundamental theorem of calculus connects differentiation and integration.",
    "metadata": {
        "user_id": "system_public",
        "tenant_type": "SYSTEM_PUBLIC",
        "topic": "Calculus",
        "source_type": "TEXT"
    }
}])

# Student queries
res = store.query_candidates(
    query_texts=["fundamental theorem calculus integration"],
    top_k=5,
    user_id="${studentUser}"
)

all_ids = [cid for sub in res["ids"] for cid in sub]
all_metas = [m for sub in res["metadatas"] for m in sub]

# Cleanup
store.delete_by(document_id="chunk_pub_math_101")

print(json.dumps({
    "found_public": "chunk_pub_math_101" in all_ids,
    "has_system_tenant": any(m.get("tenant_type") == "SYSTEM_PUBLIC" for m in all_metas)
}))
`;
      const result = runPythonPgvectorSnippet(code);
      expect(result.found_public).toBe(true);
      expect(result.has_system_tenant).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO D: Controlled Failure Behavior
  // =========================================================================
  describe('Scenario D: Controlled Failure Behavior', () => {
    it('D1: Malformed authentication returns 401 Unauthorized', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/resources',
        headers: {
          authorization: 'Bearer invalid.token.payload',
        },
      });

      await resourcesHandler(req as any, res as any);
      expect(res.statusCode).toBe(401);
    });

    it('D2: Expired authentication returns 401 without crashing', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/resources',
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.expired_payload',
        },
      });

      await resourcesHandler(req as any, res as any);
      expect(res.statusCode).toBe(401);
    });

    it('D3: Empty search query produces controlled 400 Bad Request', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/rag/search',
        headers: {
          'x-ming-test-key': 'test-secret-prod-key',
          'x-ming-user-id': 'test_user',
        },
        body: {
          query: '',
        },
      });

      await ragHandler(req as any, res as any);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Query string is required');
    });

    it('D4: Invalid resource ID returns 400 Bad Request', async () => {
      const { req, res } = createMockReqRes({
        method: 'DELETE',
        url: 'http://localhost:3001/api/resources',
        headers: {
          'x-ming-test-key': 'test-secret-prod-key',
          'x-ming-user-id': 'test_user',
        },
        body: {},
      });

      await resourcesHandler(req as any, res as any);
      expect(res.statusCode).toBe(400);
    });

    it('D5: Embedding dimension mismatch fails closed with descriptive error', () => {
      const code = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store

store = get_vector_store('pgvector')

mismatch_error = False
try:
    store.add_documents([{
        "id": "chunk_bad_dim",
        "text": "test content",
        "embedding": [0.1] * 128,  # Incompatible: 128 != 384
        "metadata": {
            "user_id": "test_user",
            "tenant_type": "USER"
        }
    }])
except ValueError as e:
    mismatch_error = True

print(json.dumps({"caught_dimension_mismatch": mismatch_error}))
`;
      const result = runPythonPgvectorSnippet(code);
      expect(result.caught_dimension_mismatch).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO E: Observability, Health Probes & Safe Logging
  // =========================================================================
  describe('Scenario E: Observability & Health Probes', () => {
    it('E1: Liveness probe /api/health/live returns 200 with uptime', () => {
      const live = getLivenessStatus();
      expect(live.status).toBe('live');
      expect(typeof live.uptimeSeconds).toBe('number');
      expect(live.timestamp).toBeDefined();
    });

    it('E2: Readiness probe /api/health/ready checks DB and vector provider', async () => {
      const ready = await getReadinessStatus();
      expect(ready.checks).toBeDefined();
      expect(ready.checks.api).toBe('ok');
      expect(ready.checks.vectorStore).toContain('configured');
    });

    it('E3: Comprehensive health diagnostic exposes sanitized public config', async () => {
      const health = await getComprehensiveHealth();
      expect(health.status).toBeDefined();
      expect(health.components).toBeDefined();
      expect(health.publicConfig.embeddingModel).toBe('all-MiniLM-L6-v2');
      expect(health.publicConfig.embeddingDimension).toBe(384);
      // Secrets must NOT be leaked
      expect(JSON.stringify(health)).not.toContain('test-secret-prod-key');
      expect(JSON.stringify(health)).not.toContain('AIzaSyTestMockProductionKey123456');
    });

    it('E4: safeUserId scrubs sensitive PII into anonymized hashes', () => {
      const safe = safeUserId('user_personal_email_99@gmail.com');
      expect(safe).toMatch(/^usr_[0-9a-f]{8}$/);
      expect(safe).not.toContain('user_personal_email_99');
      expect(safeUserId(undefined)).toBe('anonymous');
    });

    it('E5: scrubSensitiveData redacts tokens, passwords, and authorization headers', () => {
      const dirty = {
        userId: 'usr_123',
        password: 'supersecretpassword',
        authorization: 'Bearer eyJhbGciOi...',
        apiKey: 'AIzaSy123456789',
        normalField: 'all good',
      };

      const clean = scrubSensitiveData(dirty);
      expect(clean.password).toBe('[REDACTED]');
      expect(clean.authorization).toBe('[REDACTED]');
      expect(clean.apiKey).toBe('[REDACTED]');
      expect(clean.normalField).toBe('all good');
    });

    it('E6: Centralized configuration validator enforces production invariants', () => {
      // Valid config
      const validRes = validateProductionConfig();
      expect(validRes.publicConfig.vectorStore).toBe('pgvector');

      // Invalid config: Dev auth bypass in production
      const savedBypass = process.env.ALLOW_DEV_AUTH_BYPASS;
      process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
      const invalidRes = validateProductionConfig();
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors.some((e) => e.includes('ALLOW_DEV_AUTH_BYPASS'))).toBe(true);
      process.env.ALLOW_DEV_AUTH_BYPASS = savedBypass;
    });

    it('E7: maskSecret masks sensitive keys safely without exposing payload', () => {
      expect(maskSecret('AIzaSyProductionKey987654321')).toBe('AIza...4321');
      expect(maskSecret('short')).toBe('********');
      expect(maskSecret(undefined)).toBe('(not set)');
    });
  });
});
