// Hook for managing offline functionality
import { useEffect, useState } from 'react';
import { syncService, SyncStatus } from '@/services/syncService';
import { cacheService } from '@/services/cacheService';
import { Page } from '@/types/notion';

/**
 * Hook to access sync status and offline functionality
 */
export function useOffline() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'synced',
    pendingCount: 0
  });

  useEffect(() => {
    const unsubscribe = syncService.subscribe((status) => {
      setSyncStatus(status);
    });

    return unsubscribe;
  }, []);

  return {
    isOnline: syncStatus.status !== 'offline',
    isSyncing: syncStatus.status === 'syncing',
    pendingCount: syncStatus.pendingCount,
    syncStatus: syncStatus.status,
    error: syncStatus.error
  };
}

/**
 * Hook to manage offline page caching
 */
export function usePageCache(pageId: string | null) {
  const [isMarkedOffline, setIsMarkedOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pageId) return;

    const checkOfflineStatus = async () => {
      const marked = await cacheService.isMarkedForOffline(pageId);
      setIsMarkedOffline(marked);
    };

    checkOfflineStatus();
  }, [pageId]);

  const toggleOffline = async () => {
    if (!pageId) return;

    setIsLoading(true);
    try {
      if (isMarkedOffline) {
        await cacheService.unmarkForOffline(pageId);
        setIsMarkedOffline(false);
      } else {
        await cacheService.markForOffline(pageId);
        setIsMarkedOffline(true);
      }
    } catch (error) {
      console.error('Failed to toggle offline status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isMarkedOffline,
    isLoading,
    toggleOffline
  };
}

/**
 * Hook to get cached pages
 */
export function useCachedPages(userId: string | null) {
  const [cachedPages, setCachedPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCachedPages([]);
      setIsLoading(false);
      return;
    }

    const loadCachedPages = async () => {
      setIsLoading(true);
      try {
        const pages = await cacheService.getCachedPages(userId);
        setCachedPages(pages);
      } catch (error) {
        console.error('Failed to load cached pages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCachedPages();
  }, [userId]);

  return {
    cachedPages,
    isLoading
  };
}
