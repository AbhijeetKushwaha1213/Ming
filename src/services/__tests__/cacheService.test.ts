import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cacheService } from '../cacheService';
import { db } from '../db';
import { Page } from '@/types/notion';

describe('CacheService', () => {
  const mockPage: Page = {
    id: 'page-123',
    user_id: 'user-123',
    parent_id: null,
    title: 'Test Page',
    icon: '📝',
    cover_image: null,
    content: [],
    position: 0,
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  beforeEach(async () => {
    // Clear all tables before each test
    await db.pages.clear();
    await db.offlinePages.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.pages.clear();
    await db.offlinePages.clear();
  });

  describe('cachePage', () => {
    it('caches a page with cached_at timestamp', async () => {
      await cacheService.cachePage(mockPage);

      const cached = await cacheService.getCachedPage(mockPage.id);
      expect(cached).toBeDefined();
      expect(cached?.id).toBe(mockPage.id);
      expect(cached?.title).toBe(mockPage.title);
      expect(cached?.cached_at).toBeDefined();
    });

    it('updates existing cached page', async () => {
      await cacheService.cachePage(mockPage);
      
      const updatedPage = { ...mockPage, title: 'Updated Title' };
      await cacheService.cachePage(updatedPage);

      const cached = await cacheService.getCachedPage(mockPage.id);
      expect(cached?.title).toBe('Updated Title');
    });
  });

  describe('getCachedPage', () => {
    it('returns undefined for non-existent page', async () => {
      const cached = await cacheService.getCachedPage('nonexistent');
      expect(cached).toBeUndefined();
    });

    it('retrieves cached page by id', async () => {
      await cacheService.cachePage(mockPage);

      const cached = await cacheService.getCachedPage(mockPage.id);
      expect(cached?.id).toBe(mockPage.id);
    });
  });

  describe('getCachedPages', () => {
    it('returns empty array when no pages cached', async () => {
      const pages = await cacheService.getCachedPages('user-123');
      expect(pages).toEqual([]);
    });

    it('returns all cached pages for a user', async () => {
      const page1 = { ...mockPage, id: 'page-1' };
      const page2 = { ...mockPage, id: 'page-2' };
      const page3 = { ...mockPage, id: 'page-3', user_id: 'user-456' };

      await cacheService.cachePage(page1);
      await cacheService.cachePage(page2);
      await cacheService.cachePage(page3);

      const pages = await cacheService.getCachedPages('user-123');
      expect(pages).toHaveLength(2);
      expect(pages.map(p => p.id)).toContain('page-1');
      expect(pages.map(p => p.id)).toContain('page-2');
    });
  });

  describe('getCachedChildren', () => {
    it('returns root pages when parentId is null', async () => {
      const rootPage = { ...mockPage, id: 'root-1', parent_id: null };
      const childPage = { ...mockPage, id: 'child-1', parent_id: 'root-1' };

      await cacheService.cachePage(rootPage);
      await cacheService.cachePage(childPage);

      const children = await cacheService.getCachedChildren(null, 'user-123');
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe('root-1');
    });

    it('returns child pages for a parent', async () => {
      const parentPage = { ...mockPage, id: 'parent-1' };
      const child1 = { ...mockPage, id: 'child-1', parent_id: 'parent-1' };
      const child2 = { ...mockPage, id: 'child-2', parent_id: 'parent-1' };

      await cacheService.cachePage(parentPage);
      await cacheService.cachePage(child1);
      await cacheService.cachePage(child2);

      const children = await cacheService.getCachedChildren('parent-1', 'user-123');
      expect(children).toHaveLength(2);
    });
  });

  describe('markForOffline', () => {
    it('marks a page for offline access', async () => {
      await cacheService.markForOffline('page-123');

      const isMarked = await cacheService.isMarkedForOffline('page-123');
      expect(isMarked).toBe(true);
    });

    it('updates marked_at timestamp on re-mark', async () => {
      await cacheService.markForOffline('page-123');
      const first = await db.offlinePages.get('page-123');

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await cacheService.markForOffline('page-123');
      const second = await db.offlinePages.get('page-123');

      expect(second?.marked_at).not.toBe(first?.marked_at);
    });
  });

  describe('unmarkForOffline', () => {
    it('removes offline marking', async () => {
      await cacheService.markForOffline('page-123');
      expect(await cacheService.isMarkedForOffline('page-123')).toBe(true);

      await cacheService.unmarkForOffline('page-123');
      expect(await cacheService.isMarkedForOffline('page-123')).toBe(false);
    });
  });

  describe('isMarkedForOffline', () => {
    it('returns false for unmarked page', async () => {
      const isMarked = await cacheService.isMarkedForOffline('page-123');
      expect(isMarked).toBe(false);
    });

    it('returns true for marked page', async () => {
      await cacheService.markForOffline('page-123');
      const isMarked = await cacheService.isMarkedForOffline('page-123');
      expect(isMarked).toBe(true);
    });
  });

  describe('getOfflinePages', () => {
    it('returns all offline pages', async () => {
      await cacheService.markForOffline('page-1');
      await cacheService.markForOffline('page-2');

      const offlinePages = await cacheService.getOfflinePages();
      expect(offlinePages).toHaveLength(2);
      expect(offlinePages.map(p => p.page_id)).toContain('page-1');
      expect(offlinePages.map(p => p.page_id)).toContain('page-2');
    });
  });

  describe('getOfflineCachedPages', () => {
    it('returns cached pages that are marked for offline', async () => {
      const page1 = { ...mockPage, id: 'page-1' };
      const page2 = { ...mockPage, id: 'page-2' };
      const page3 = { ...mockPage, id: 'page-3' };

      await cacheService.cachePage(page1);
      await cacheService.cachePage(page2);
      await cacheService.cachePage(page3);

      await cacheService.markForOffline('page-1');
      await cacheService.markForOffline('page-2');

      const offlinePages = await cacheService.getOfflineCachedPages('user-123');
      expect(offlinePages).toHaveLength(2);
      expect(offlinePages.map(p => p.id)).toContain('page-1');
      expect(offlinePages.map(p => p.id)).toContain('page-2');
    });
  });

  describe('removeCachedPage', () => {
    it('removes a page from cache', async () => {
      await cacheService.cachePage(mockPage);
      expect(await cacheService.getCachedPage(mockPage.id)).toBeDefined();

      await cacheService.removeCachedPage(mockPage.id);
      expect(await cacheService.getCachedPage(mockPage.id)).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('clears all cached pages for a user', async () => {
      const page1 = { ...mockPage, id: 'page-1' };
      const page2 = { ...mockPage, id: 'page-2' };
      const page3 = { ...mockPage, id: 'page-3', user_id: 'user-456' };

      await cacheService.cachePage(page1);
      await cacheService.cachePage(page2);
      await cacheService.cachePage(page3);

      await cacheService.clearCache('user-123');

      const pages = await cacheService.getCachedPages('user-123');
      expect(pages).toHaveLength(0);

      // Other user's pages should remain
      const otherPages = await cacheService.getCachedPages('user-456');
      expect(otherPages).toHaveLength(1);
    });
  });

  describe('getCacheStats', () => {
    it('returns cache statistics', async () => {
      const page1 = { ...mockPage, id: 'page-1' };
      const page2 = { ...mockPage, id: 'page-2' };

      await cacheService.cachePage(page1);
      await cacheService.cachePage(page2);
      await cacheService.markForOffline('page-1');

      const stats = await cacheService.getCacheStats('user-123');

      expect(stats.totalCached).toBe(2);
      expect(stats.offlineMarked).toBe(1);
      expect(stats.cacheSize).toBeGreaterThan(0);
    });
  });
});
