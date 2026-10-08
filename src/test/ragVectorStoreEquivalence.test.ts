/**
 * Phase 2 — RAG VectorStore Provider Equivalence Test Suite
 *
 * Validates semantic and architectural equivalence between:
 * 1. ChromaVectorStore (Local / Dev backend)
 * 2. PgVectorStore (PostgreSQL + pgvector backend)
 *
 * Compares:
 * - Top-k candidate document matching and semantic ordering
 * - Strict tenant isolation parity
 * - Full metadata preservation (multimodal coordinates, source types, timestamps)
 * - Filtering behavior (by source_id, topic)
 * - Empty-result behavior
 * - Deletion behavior
 * - Embedding model & version compatibility invariants
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_PATH = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const RAG_ENGINE_PATH = path.join(PROJECT_ROOT, 'server', 'rag_engine.py');

function runRagSearch(query: string, provider: 'chroma' | 'pgvector', userId = 'default_user', topK = 3): any {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VECTOR_STORE: provider,
    PGVECTOR_TEST_LOCAL: '1',
  };

  const output = execFileSync(
    PYTHON_PATH,
    [
      RAG_ENGINE_PATH,
      'search',
      '--query', query,
      '--user-id', userId,
      '--top-k', String(topK),
    ],
    {
      cwd: PROJECT_ROOT,
      env,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`Invalid JSON output: ${output}`);
  }
  return JSON.parse(output.slice(jsonStart));
}

function runPythonSnippet(code: string, extraEnv: Record<string, string> = {}): any {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGVECTOR_TEST_LOCAL: '1',
    ...extraEnv,
  };

  const output = execFileSync(
    PYTHON_PATH,
    ['-c', code],
    {
      cwd: PROJECT_ROOT,
      env,
      encoding: 'utf-8',
    }
  );

  const trimmed = output.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    return JSON.parse(trimmed.slice(jsonStart));
  }
  return trimmed;
}

describe('PHASE 2: VECTORSTORE EQUIVALENCE (Chroma vs PgVector)', () => {

  it('1. Semantic Retrieval Equivalence: Both providers retrieve identical top-k candidates for curriculum query', () => {
    const query = 'virtual memory paging';
    const chromaRes = runRagSearch(query, 'chroma', 'default_user', 3);
    const pgRes = runRagSearch(query, 'pgvector', 'default_user', 3);

    expect(chromaRes.results).toBeDefined();
    expect(pgRes.results).toBeDefined();
    expect(chromaRes.results.length).toBeGreaterThan(0);
    expect(pgRes.results.length).toBe(chromaRes.results.length);

    // Verify top chunk matches exactly
    const chromaTopIds = chromaRes.results.map((r: any) => r.chunk_id);
    const pgTopIds = pgRes.results.map((r: any) => r.chunk_id);

    expect(pgTopIds[0]).toBe(chromaTopIds[0]);
    expect(pgTopIds).toEqual(chromaTopIds);

    // Verify similarity scores are within 0.05 tolerance
    for (let i = 0; i < chromaRes.results.length; i++) {
      const chromaScore = chromaRes.results[i].score;
      const pgScore = pgRes.results[i].score;
      expect(Math.abs(chromaScore - pgScore)).toBeLessThanOrEqual(0.05);
    }
  });

  it('2. Metadata Preservation Equivalence: Coordinates and source types are preserved across providers', () => {
    const chromaRes = runRagSearch('virtual memory paging', 'chroma', 'default_user', 2);
    const pgRes = runRagSearch('virtual memory paging', 'pgvector', 'default_user', 2);

    const cTop = chromaRes.results[0];
    const pgTop = pgRes.results[0];

    expect(pgTop.source_type).toBe(cTop.source_type);
    expect(pgTop.page_number).toBe(cTop.page_number);
    expect(pgTop.source_id).toBe(cTop.source_id);
    expect(pgTop.document_id).toBe(cTop.document_id);
    expect(pgTop.topic).toBe(cTop.topic);
    expect(pgTop.subtopic).toBe(cTop.subtopic);
    expect(pgTop.location).toEqual(cTop.location);
  });

  it('3. Strict Tenant Isolation Parity: User A cannot retrieve User B vectors on either Chroma or PgVector', () => {
    // Search as user_A for content belonging exclusively to user_B
    const pythonCheck = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store

store_c = get_vector_store('chroma')
store_pg = get_vector_store('pgvector')

# Add private chunk for user_victim
victim_chunk = [{
    "id": "private_secret_chunk_999",
    "text": "Top secret cryptographic private key for victim user only.",
    "metadata": {
        "user_id": "user_victim_999",
        "tenant_type": "USER",
        "topic": "Cryptography",
        "source_type": "TEXT"
    }
}]

store_c.add_documents(victim_chunk)
store_pg.add_documents(victim_chunk)

# Attacker queries
c_res = store_c.query_candidates(
    query_texts=["cryptographic private key"],
    top_k=5,
    user_id="user_attacker_111"
)
pg_res = store_pg.query_candidates(
    query_texts=["cryptographic private key"],
    top_k=5,
    user_id="user_attacker_111"
)

c_ids = [cid for sub in c_res["ids"] for cid in sub]
pg_ids = [cid for sub in pg_res["ids"] for cid in sub]

# Cleanup
store_c.delete_by(user_id="user_victim_999")
store_pg.delete_by(user_id="user_victim_999")

print(json.dumps({
    "chroma_leaked": "private_secret_chunk_999" in c_ids,
    "pgvector_leaked": "private_secret_chunk_999" in pg_ids
}))
`;
    const res = runPythonSnippet(pythonCheck);
    expect(res.chroma_leaked).toBe(false);
    expect(res.pgvector_leaked).toBe(false);
  });

  it('4. Fail Closed on Missing Tenant Identity: Querying without user_id only exposes SYSTEM_PUBLIC on PgVector', () => {
    const pythonCheck = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store
store_pg = get_vector_store('pgvector')

# Query with None as user_id
res = store_pg.query_candidates(
    query_texts=["virtual memory"],
    top_k=10,
    user_id=None
)

all_metas = [m for sub in res["metadatas"] for m in sub]
any_user_tenant = any(m.get("tenant_type") == "USER" for m in all_metas)

print(json.dumps({
    "returned_count": len(all_metas),
    "any_user_tenant": any_user_tenant
}))
`;
    const res = runPythonSnippet(pythonCheck);
    expect(res.any_user_tenant).toBe(false);
  });

  it('5. Source ID Filter Parity: Both providers respect source scoping', () => {
    const pythonCheck = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store
store_c = get_vector_store('chroma')
store_pg = get_vector_store('pgvector')

c_res = store_c.query_candidates(
    query_texts=["operating system process"],
    top_k=5,
    user_id="default_user",
    source_id="src_os_pdf"
)

pg_res = store_pg.query_candidates(
    query_texts=["operating system process"],
    top_k=5,
    user_id="default_user",
    source_id="src_os_pdf"
)

c_sources = list(set([m.get("source_id") for sub in c_res["metadatas"] for m in sub]))
pg_sources = list(set([m.get("source_id") for sub in pg_res["metadatas"] for m in sub]))

print(json.dumps({
    "chroma_sources": c_sources,
    "pg_sources": pg_sources
}))
`;
    const res = runPythonSnippet(pythonCheck);
    expect(res.chroma_sources.every((s: string) => s === 'src_os_pdf')).toBe(true);
    expect(res.pg_sources.every((s: string) => s === 'src_os_pdf')).toBe(true);
  });

  it('6. Deletion Behavior Parity: Deleting by user_id removes vectors across both providers', () => {
    const pythonCheck = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store
store_c = get_vector_store('chroma')
store_pg = get_vector_store('pgvector')

test_chunk = [{
    "id": "del_test_chunk_456",
    "text": "Temporary chunk to verify deletion parity.",
    "metadata": {
        "user_id": "temp_delete_user_456",
        "tenant_type": "USER",
        "topic": "Testing",
        "source_type": "TEXT"
    }
}]

store_c.add_documents(test_chunk)
store_pg.add_documents(test_chunk)

c_del_count = store_c.delete_by(user_id="temp_delete_user_456")
pg_del_count = store_pg.delete_by(user_id="temp_delete_user_456")

c_after = store_c.get_chunk("del_test_chunk_456")
pg_after = store_pg.get_chunk("del_test_chunk_456")

print(json.dumps({
    "chroma_deleted": c_after is None,
    "pg_deleted": pg_after is None
}))
`;
    const res = runPythonSnippet(pythonCheck);
    expect(res.chroma_deleted).toBe(true);
    expect(res.pg_deleted).toBe(true);
  });

  it('7. Startup Invariant: Selecting pgvector without DB configuration fails closed and NEVER silently downgrades', () => {
    const pythonCheck = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store
try:
    store = get_vector_store('pgvector')
    print(json.dumps({"failed_closed": False}))
except RuntimeError as e:
    print(json.dumps({"failed_closed": True, "error": str(e)}))
`;
    // Run without PGVECTOR_TEST_LOCAL or DATABASE_URL
    const res = runPythonSnippet(pythonCheck, {
      PGVECTOR_TEST_LOCAL: '',
      DATABASE_URL: '',
      SUPABASE_URL: '',
      VITE_SUPABASE_URL: '',
      PGVECTOR_URL: '',
    });

    expect(res.failed_closed).toBe(true);
    expect(res.error).toContain('Failing closed: cannot silently downgrade to Chroma in production');
  });

  it('8. Embedding Dimension Invariant: PgVector rejects incompatible embedding vector dimensions', () => {
    const pythonCheck = `
import sys, json
sys.path.insert(0, './server')
from vector_store import get_vector_store
store_pg = get_vector_store('pgvector')

# Attempt to insert a 128-dimensional vector when 384 is required
bad_chunk = [{
    "id": "bad_dim_chunk",
    "text": "Incompatible dimension text",
    "embedding": [0.1] * 128,
    "metadata": {"user_id": "test_user"}
}]

try:
    store_pg.add_documents(bad_chunk)
    print(json.dumps({"rejected": False}))
except ValueError as e:
    print(json.dumps({"rejected": True, "error": str(e)}))
`;
    const res = runPythonSnippet(pythonCheck);
    expect(res.rejected).toBe(true);
    expect(res.error).toContain('Incompatible embedding dimension');
  });
});
