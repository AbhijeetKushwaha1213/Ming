# Offline Support Usage Guide

This guide explains how to use the offline support features in the Notion-like Resource Manager.

## Components

### OfflineIndicator

A visual indicator that shows the current sync status and pending operations count.

**Usage:**

```tsx
import { OfflineIndicator } from '@/components/notion';

function App() {
  return (
    <div>
      {/* Your app content */}
      <OfflineIndicator />
    </div>
  );
}
```

The indicator automatically:
- Shows when offline with pending operations count
- Shows syncing status with progress
- Shows errors if sync fails
- Hides when online and fully synced

## Hooks

### useOffline

Access sync status and offline state.

```tsx
import { useOffline } from '@/hooks/useOffline';

function MyComponent() {
  const { isOnline, isSyncing, pendingCount, syncStatus, error } = useOffline();

  return (
    <div>
      {!isOnline && <p>You are offline</p>}
      {isSyncing && <p>Syncing {pendingCount} operations...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### usePageCache

Manage offline caching for individual pages.

```tsx
import { usePageCache } from '@/hooks/useOffline';

function PageActions({ pageId }: { pageId: string }) {
  const { isMarkedOffline, isLoading, toggleOffline } = usePageCache(pageId);

  return (
    <button onClick={toggleOffline} disabled={isLoading}>
      {isMarkedOffline ? 'Remove from offline' : 'Make available offline'}
    </button>
  );
}
```

### useCachedPages

Get all cached pages for a user.

```tsx
import { useCachedPages } from '@/hooks/useOffline';

function OfflinePages({ userId }: { userId: string }) {
  const { cachedPages, isLoading } = useCachedPages(userId);

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {cachedPages.map(page => (
        <li key={page.id}>{page.title}</li>
      ))}
    </ul>
  );
}
```

## Services

### CacheService

Low-level API for managing cached pages.

```tsx
import { cacheService } from '@/services/cacheService';

// Cache a page
await cacheService.cachePage(page);

// Get cached page
const cachedPage = await cacheService.getCachedPage(pageId);

// Mark for offline
await cacheService.markForOffline(pageId);

// Check if marked
const isOffline = await cacheService.isMarkedForOffline(pageId);

// Get cache stats
const stats = await cacheService.getCacheStats(userId);
```

### SyncService

Low-level API for managing sync operations.

```tsx
import { syncService } from '@/services/syncService';

// Queue an operation
await syncService.queueOperation('update', 'page', pageId, { title: 'New Title' });

// Get pending count
const count = await syncService.getPendingCount();

// Subscribe to status changes
const unsubscribe = syncService.subscribe((status) => {
  console.log('Sync status:', status);
});

// Manually trigger sync
await syncService.processSyncQueue();
```

## Integration with Existing APIs

The offline support is designed to work seamlessly with existing page APIs. When offline:

1. Operations are automatically queued
2. Local cache is updated optimistically
3. When online, operations sync automatically
4. Conflicts are resolved with last-write-wins strategy

**Example: Update page with offline support**

```tsx
import { pageAPI } from '@/api/pageAPI';
import { syncService } from '@/services/syncService';
import { cacheService } from '@/services/cacheService';

async function updatePageWithOfflineSupport(pageId: string, updates: any) {
  try {
    // Try to update online
    const updatedPage = await pageAPI.updatePage(pageId, updates);
    
    // Cache the updated page
    await cacheService.cachePage(updatedPage);
    
    return updatedPage;
  } catch (error) {
    // If offline, queue the operation
    if (!navigator.onLine) {
      await syncService.queueOperation('update', 'page', pageId, updates);
      
      // Update local cache optimistically
      const cachedPage = await cacheService.getCachedPage(pageId);
      if (cachedPage) {
        const optimisticPage = { ...cachedPage, ...updates };
        await cacheService.cachePage(optimisticPage);
        return optimisticPage;
      }
    }
    
    throw error;
  }
}
```

## Best Practices

1. **Always cache viewed pages**: Call `cacheService.cachePage()` after fetching a page
2. **Queue operations when offline**: Use `syncService.queueOperation()` for mutations
3. **Show offline indicator**: Add `<OfflineIndicator />` to your main layout
4. **Handle sync errors**: Subscribe to sync status and show user-friendly error messages
5. **Limit cache size**: Periodically clear old cached pages to save storage space

## Storage Limits

IndexedDB has generous storage limits (typically 50% of available disk space), but be mindful:

- Each page with content can be 10-100KB
- Images and files are stored separately in Supabase Storage
- Monitor cache size with `cacheService.getCacheStats()`
- Clear cache when needed with `cacheService.clearCache()`
