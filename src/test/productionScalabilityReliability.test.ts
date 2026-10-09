import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { recordLearnerEvidence } from '../../server/learnerEvidenceService.ts';
import { ProcessConcurrencyLimiter, ragProcessLimiter } from '../../server/ragHandler.ts';
import { ServerReadCache, serverReadCache } from '../../server/serverCache.ts';
import { checkRateLimit, resetRateLimitStore } from '../../server/authMiddleware.ts';
import { cleanupStaleUploads } from '../../server/fileValidator.ts';
import { getComprehensiveHealth } from '../../server/observability.ts';

describe('CANONICAL PHASE 7 — Production Scalability & Reliability', () => {
  beforeEach(() => {
    resetRateLimitStore();
    serverReadCache.clear();
  });

  // =========================================================================
  // 1. Concurrent Duplicate Evidence Ingestion & Idempotency Race Condition
  // =========================================================================
  describe('1. Evidence Ingestion & Idempotency Under Concurrency', () => {
    it('gracefully handles simultaneous duplicate evidence submissions without constraint crashes', async () => {
      const userId = `test_race_user_${Date.now()}`;
      const idempotencyKey = `idem_race_${Date.now()}_abc`;

      const eventPayload: any = {
        evidence_id: `evd_race_${Date.now()}_1`,
        idempotency_key: idempotencyKey,
        user_id: userId,
        attempt_id: 'att_race_1',
        question_id: 'q_race_1',
        question_type: 'multiple_choice',
        topic: 'Data Structures',
        subtopic: 'Trees',
        concept_id: 'c_binary_search_trees',
        concept_name: 'Binary Search Trees',
        timestamp: new Date().toISOString(),
        classification: 'correct',
        credit: 1.0,
        is_correct: true,
        difficulty: 'medium',
        validity: 'VALID_EVIDENCE',
      };

      // Fire 10 concurrent requests with the identical idempotencyKey
      const promises = Array.from({ length: 10 }).map(() =>
        recordLearnerEvidence(eventPayload)
      );

      const results = await Promise.all(promises);

      // Verify no exceptions were thrown
      expect(results).toHaveLength(10);

      // Exactly one should be applied, the rest recognized as duplicates
      const appliedCount = results.filter((r) => r.applied === true && !r.duplicate).length;
      const duplicateCount = results.filter((r) => r.duplicate === true).length;

      expect(appliedCount).toBe(1);
      expect(duplicateCount).toBe(9);

      // All results must return valid updated_state
      for (const res of results) {
        expect(res.updated_state).toBeDefined();
        expect(res.updated_state?.topic).toBe('Data Structures');
      }
    });
  });

  // =========================================================================
  // 2. Process Concurrency Limiter & Capacity Protection
  // =========================================================================
  describe('2. Process Concurrency Limiter Queueing & Capacity Protection', () => {
    it('limits concurrent process execution and tracks operational statistics', async () => {
      const limiter = new ProcessConcurrencyLimiter(2, 5); // max 2 concurrent, max 5 in queue

      let activeWorkers = 0;
      let maxObservedActive = 0;

      const mockTask = (durationMs: number) => async () => {
        activeWorkers++;
        if (activeWorkers > maxObservedActive) {
          maxObservedActive = activeWorkers;
        }
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        activeWorkers--;
        return 'success';
      };

      // Launch 4 tasks
      const p1 = limiter.run(mockTask(50));
      const p2 = limiter.run(mockTask(50));
      const p3 = limiter.run(mockTask(50));
      const p4 = limiter.run(mockTask(50));

      const stats = limiter.getStats();
      expect(stats.maxConcurrent).toBe(2);
      expect(stats.running).toBe(2);
      expect(stats.queued).toBe(2);

      const outcomes = await Promise.all([p1, p2, p3, p4]);
      expect(outcomes).toEqual(['success', 'success', 'success', 'success']);
      expect(maxObservedActive).toBe(2);

      const finalStats = limiter.getStats();
      expect(finalStats.running).toBe(0);
      expect(finalStats.queued).toBe(0);
      expect(finalStats.totalProcessed).toBe(4);
    });

    it('rejects tasks with 503 capacity error when queue limit is exceeded', async () => {
      const limiter = new ProcessConcurrencyLimiter(1, 2); // max 1 running, max 2 queued

      const longTask = () => new Promise((resolve) => setTimeout(resolve, 200));

      // Task 1 occupies the running slot
      const t1 = limiter.run(longTask);
      // Tasks 2 and 3 fill the queue (queue size 2)
      const t2 = limiter.run(longTask).catch(() => {});
      const t3 = limiter.run(longTask).catch(() => {});

      // Task 4 exceeds queue capacity and must immediately reject
      await expect(limiter.run(longTask)).rejects.toThrow(/Process concurrency capacity exceeded/);

      const stats = limiter.getStats();
      expect(stats.totalRejected).toBe(1);

      limiter.clearQueue();
      await t1;
    });
  });

  // =========================================================================
  // 3. Server Read Cache: Tenant Isolation, Eviction & Invariant
  // =========================================================================
  describe('3. Bounded Server Read Cache', () => {
    it('strictly isolates cache entries between different tenants', () => {
      const cache = new ServerReadCache({ maxEntries: 10, defaultTtlMs: 5000 });

      cache.set('user_alpha', 'resources', 'list', [{ id: 'res_alpha' }]);
      cache.set('user_beta', 'resources', 'list', [{ id: 'res_beta' }]);

      const alphaData = cache.get<any[]>('user_alpha', 'resources', 'list');
      const betaData = cache.get<any[]>('user_beta', 'resources', 'list');

      expect(alphaData).toEqual([{ id: 'res_alpha' }]);
      expect(betaData).toEqual([{ id: 'res_beta' }]);
      expect(alphaData).not.toEqual(betaData);
    });

    it('evicts oldest unaccessed items when maxEntries capacity is reached', () => {
      const cache = new ServerReadCache({ maxEntries: 3, defaultTtlMs: 10000 });

      cache.set('user_1', 'item', 'k1', 'val1');
      cache.set('user_1', 'item', 'k2', 'val2');
      cache.set('user_1', 'item', 'k3', 'val3');

      expect(cache.get('user_1', 'item', 'k1')).toBe('val1'); // access k1 to refresh LRU
      expect(cache.get('user_1', 'item', 'k2')).toBe('val2');

      // Adding 4th item should evict k3 (oldest unaccessed)
      cache.set('user_1', 'item', 'k4', 'val4');

      expect(cache.get('user_1', 'item', 'k4')).toBe('val4');
      expect(cache.get('user_1', 'item', 'k1')).toBe('val1');
      expect(cache.get('user_1', 'item', 'k3')).toBeUndefined(); // evicted!

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(1);
    });

    it('expires cached entries after TTL', async () => {
      const cache = new ServerReadCache({ maxEntries: 10, defaultTtlMs: 50 }); // 50ms TTL

      cache.set('user_1', 'temp', 'key', 'hello');
      expect(cache.get('user_1', 'temp', 'key')).toBe('hello');

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cache.get('user_1', 'temp', 'key')).toBeUndefined();
    });

    it('instant invalidation clears tenant data on mutation', () => {
      const cache = new ServerReadCache({ maxEntries: 10 });

      cache.set('user_1', 'resources', 'list', ['res1', 'res2']);
      cache.set('user_1', 'dags', 'list', ['dag1']);
      cache.set('user_2', 'resources', 'list', ['res_user_2']);

      cache.invalidateUser('user_1');

      expect(cache.get('user_1', 'resources', 'list')).toBeUndefined();
      expect(cache.get('user_1', 'dags', 'list')).toBeUndefined();
      // User 2 remains intact
      expect(cache.get('user_2', 'resources', 'list')).toEqual(['res_user_2']);
    });
  });

  // =========================================================================
  // 4. Categorized Rate Limiting & Overload Protection
  // =========================================================================
  describe('4. Categorized Rate Limiting', () => {
    it('enforces specific request limits for ingest, rag, and ai categories', () => {
      const makeReq = (userId: string) => ({
        headers: { 'x-ming-user-id': userId },
        socket: { remoteAddress: '127.0.0.1' },
      });

      const user = `rate_test_user_${Date.now()}`;
      const req = makeReq(user);

      // Ingestion limit: 20 req/min
      for (let i = 0; i < 20; i++) {
        const check = checkRateLimit(req as any, 'ingest');
        expect(check.allowed).toBe(true);
      }

      // 21st ingestion request must be rejected
      const blockedIngest = checkRateLimit(req as any, 'ingest');
      expect(blockedIngest.allowed).toBe(false);
      expect(blockedIngest.remaining).toBe(0);
      expect(blockedIngest.retryAfterSec).toBeGreaterThan(0);
      expect(blockedIngest.limit).toBe(20);

      // RAG search category should still be allowed under its own separate bucket
      const ragCheck = checkRateLimit(req as any, 'rag');
      expect(ragCheck.allowed).toBe(true);
      expect(ragCheck.limit).toBe(60);
    });
  });

  // =========================================================================
  // 5. Storage Cleanup & Retention
  // =========================================================================
  describe('5. Storage File Retention & Stale Upload Cleanup', () => {
    it('cleans up orphaned files older than maxAgeMs while keeping recent files', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ming-cleanup-test-'));

      try {
        const recentFile = path.join(tempDir, 'recent.txt');
        const staleFile = path.join(tempDir, 'stale.txt');

        await fs.writeFile(recentFile, 'recent content');
        await fs.writeFile(staleFile, 'stale content');

        // Backdate stale file mtime by 2 days
        const twoDaysAgo = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
        await fs.utimes(staleFile, twoDaysAgo, twoDaysAgo);

        const result = await cleanupStaleUploads(tempDir, 24 * 60 * 60 * 1000); // 24h retention

        expect(result.scannedCount).toBe(2);
        expect(result.deletedCount).toBe(1);
        expect(result.freedBytes).toBeGreaterThan(0);
        expect(result.errors).toEqual([]);

        // Recent file still exists
        const recentExists = await fs.stat(recentFile).then(() => true).catch(() => false);
        expect(recentExists).toBe(true);

        // Stale file was deleted
        const staleExists = await fs.stat(staleFile).then(() => true).catch(() => false);
        expect(staleExists).toBe(false);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('safely handles non-existent cleanup directory without throwing', async () => {
      const nonExistent = path.join(os.tmpdir(), `non_existent_${Date.now()}`);
      const result = await cleanupStaleUploads(nonExistent);
      expect(result.scannedCount).toBe(0);
      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. Observability & Telemetry Integration
  // =========================================================================
  describe('6. Production Telemetry & Cache Health Diagnostics', () => {
    it('reports cache metrics in comprehensive health check without exposing secrets', async () => {
      serverReadCache.set('test_user', 'resources', 'list', ['sample']);
      serverReadCache.get('test_user', 'resources', 'list');

      const health = await getComprehensiveHealth();

      expect(health.status).toBeDefined();
      expect(health.cache).toBeDefined();
      expect(health.cache.hits).toBeGreaterThanOrEqual(1);
      expect(health.cache.currentSize).toBeGreaterThanOrEqual(1);
      expect(health.cache.maxEntries).toBe(1000);

      // Verify no sensitive credentials in health dump
      const healthString = JSON.stringify(health);
      expect(healthString).not.toContain('test-secret-key');
      expect(healthString).not.toContain('password');
    });
  });
});
