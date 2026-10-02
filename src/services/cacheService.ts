// CacheService for local storage of pages using IndexedDB
import { db, CachedPage, OfflinePage } from './db';
import { Page } from '@/types/notion';

// ============================================================================
// CacheService Class
// ============================================================================

export class CacheService {
  /**
   * Cache a page locally for offline access
   * @param page - The page to cache
   */
  async cachePage(page: Page): Promise<void> {
    const cachedPage: CachedPage = {
      ...page,
      cached_at: new Date().toISOString()
    };
    
    await db.pages.put(cachedPage);
  }

  /**
   * Retrieve a cached page from local storage
   * @param pageId - The ID of the page to retrieve
   * @returns The cached page or undefined if not found
   */
  async getCachedPage(pageId: string): Promise<CachedPage | undefined> {
    return await db.pages.get(pageId);
  }

  /**
   * Get all cached pages for a user
   * @param userId - The user ID
   * @returns Array of cached pages
   */
  async getCachedPages(userId: string): Promise<CachedPage[]> {
    const allPages = await db.pages.toArray();
    return allPages.filter((p) => {
      if (p.deleted_at) return false;
      if (!userId) return true;
      return p.user_id === userId || !p.user_id || p.user_id === 'local-dev-user-id';
    });
  }

  /**
   * Get cached child pages for a parent
   * @param parentId - The parent page ID (null for root pages)
   * @param userId - The user ID
   * @returns Array of cached child pages
   */
  async getCachedChildren(parentId: string | null, userId?: string): Promise<CachedPage[]> {
    const allPages = await db.pages.toArray();
    return allPages.filter((page) => {
      if (page.deleted_at) return false;
      const matchesParent = parentId === null ? !page.parent_id : page.parent_id === parentId;
      if (!matchesParent) return false;
      if (!userId) return true;
      return page.user_id === userId || !page.user_id || page.user_id === 'local-dev-user-id';
    });
  }

  /**
   * Mark a page for offline access (persistent offline storage)
   * @param pageId - The ID of the page to mark
   */
  async markForOffline(pageId: string): Promise<void> {
    const offlinePage: OfflinePage = {
      page_id: pageId,
      marked_at: new Date().toISOString()
    };
    
    await db.offlinePages.put(offlinePage);
  }

  /**
   * Unmark a page from offline access
   * @param pageId - The ID of the page to unmark
   */
  async unmarkForOffline(pageId: string): Promise<void> {
    await db.offlinePages.delete(pageId);
  }

  /**
   * Check if a page is marked for offline access
   * @param pageId - The ID of the page to check
   * @returns True if marked for offline, false otherwise
   */
  async isMarkedForOffline(pageId: string): Promise<boolean> {
    const offlinePage = await db.offlinePages.get(pageId);
    return offlinePage !== undefined;
  }

  /**
   * Get all pages marked for offline access
   * @returns Array of offline page records
   */
  async getOfflinePages(): Promise<OfflinePage[]> {
    return await db.offlinePages.toArray();
  }

  /**
   * Get all cached pages that are marked for offline
   * @param userId - The user ID
   * @returns Array of cached pages marked for offline
   */
  async getOfflineCachedPages(userId: string): Promise<CachedPage[]> {
    const offlinePages = await this.getOfflinePages();
    const offlinePageIds = offlinePages.map(op => op.page_id);
    
    return await db.pages
      .where('id').anyOf(offlinePageIds)
      .and(page => page.user_id === userId)
      .toArray();
  }

  /**
   * Remove a page from cache
   * @param pageId - The ID of the page to remove
   */
  async removeCachedPage(pageId: string): Promise<void> {
    await db.pages.delete(pageId);
  }

  /**
   * Clear all cached pages for a user
   * @param userId - The user ID
   */
  async clearCache(userId: string): Promise<void> {
    await db.pages.where('user_id').equals(userId).delete();
  }

  /**
   * Get cache statistics
   * @param userId - The user ID
   * @returns Cache statistics
   */
  async getCacheStats(userId: string): Promise<{
    totalCached: number;
    offlineMarked: number;
    cacheSize: number;
  }> {
    const cachedPages = await this.getCachedPages(userId);
    const offlinePages = await this.getOfflinePages();
    
    // Estimate cache size (rough approximation)
    const cacheSize = cachedPages.reduce((total, page) => {
      return total + JSON.stringify(page).length;
    }, 0);
    
    return {
      totalCached: cachedPages.length,
      offlineMarked: offlinePages.length,
      cacheSize
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
