/**
 * Bounded In-Memory LRU & TTL Server Read Cache
 * 
 * Production Requirements (Phase 7 Stage D):
 * 1. Strict Tenant Isolation: Every cache key is strictly prefixed with authenticated userId.
 * 2. Bounded Memory: Enforces maxEntries with deterministic LRU eviction.
 * 3. Bounded TTL: Configurable time-to-live per category to prevent stale data.
 * 4. Deterministic Invalidation: Granular per-user, per-category, or per-key invalidation.
 * 5. Invariant: Correctness-sensitive learner state (BKT mastery, evidence events)
 *    is NEVER cached here to ensure Phase 6 recommendations always reflect real-time evidence.
 * 6. Observable metrics: Tracks hits, misses, evictions, and current size.
 */

export interface CacheEntry<T> {
  value: T;
  userId: string;
  category: string;
  createdAt: number;
  expiresAt: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  maxEntries: number;
}

export class ServerReadCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTtlMs = options.defaultTtlMs || 60 * 1000; // 60 seconds default
  }

  /**
   * Constructs a tenant-isolated cache key.
   */
  public makeKey(userId: string, category: string, subKey?: string): string {
    const safeUser = (userId || 'anonymous').trim().toLowerCase();
    const safeCat = (category || 'general').trim().toLowerCase();
    const safeSub = (subKey || 'default').trim();
    return `${safeUser}:::${safeCat}:::${safeSub}`;
  }

  /**
   * Retrieves an item from the cache if present and unexpired.
   */
  public get<T>(userId: string, category: string, subKey?: string): T | undefined {
    const key = this.makeKey(userId, category, subKey);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU position (delete & re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.value as T;
  }

  /**
   * Stores an item in the cache with bounded capacity and TTL.
   * Supports both:
   * set(userId, category, subKey, value, ttlMs)
   * set(userId, category, value, ttlMs) [where subKey defaults to 'default']
   */
  public set<T>(
    userId: string,
    category: string,
    subKeyOrValue: any,
    valueOrTtl?: any,
    maybeTtl?: number
  ): void {
    let subKey: string;
    let value: T;
    let ttlMs: number;

    if (maybeTtl !== undefined || (typeof valueOrTtl !== 'number' && valueOrTtl !== undefined)) {
      subKey = String(subKeyOrValue);
      value = valueOrTtl as T;
      ttlMs = typeof maybeTtl === 'number' ? maybeTtl : this.defaultTtlMs;
    } else {
      subKey = 'default';
      value = subKeyOrValue as T;
      ttlMs = typeof valueOrTtl === 'number' ? valueOrTtl : this.defaultTtlMs;
    }

    const key = this.makeKey(userId, category, subKey);
    const now = Date.now();

    // If updating existing, remove it first
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }

    this.cache.set(key, {
      value,
      userId,
      category,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Invalidates a specific key for a user.
   */
  public invalidateKey(userId: string, category: string, subKey?: string): boolean {
    const key = this.makeKey(userId, category, subKey);
    return this.cache.delete(key);
  }

  /**
   * Invalidates all cached items for a user in a specific category.
   */
  public invalidateCategory(userId: string, category: string): number {
    const prefix = `${(userId || 'anonymous').trim().toLowerCase()}:::${(category || 'general').trim().toLowerCase()}:::`;
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidates all items for a user across all categories.
   */
  public invalidateUser(userId: string): number {
    const prefix = `${(userId || 'anonymous').trim().toLowerCase()}:::`;
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clears the entire cache (e.g. for testing or memory pressure).
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Retrieves current cache telemetry metrics.
   */
  public getMetrics(): CacheMetrics {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      currentSize: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }

  public getStats(): CacheMetrics {
    return this.getMetrics();
  }
}

// Global server read cache singleton with 1,000 max entries and 60-second default TTL
export const serverReadCache = new ServerReadCache({
  maxEntries: 1000,
  defaultTtlMs: 60 * 1000,
});
