// SyncService for handling offline operations and synchronization
import { db, SyncQueueItem, SyncOperationType, SyncEntityType } from './db';
import { cacheService } from './cacheService';
import { Page } from '@/types/notion';

// ============================================================================
// SyncService Class
// ============================================================================

export class SyncService {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private maxRetries: number = 3;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Queue an operation for later synchronization
   * @param operation - The type of operation (create, update, delete)
   * @param entityType - The type of entity (page, block, file)
   * @param entityId - The ID of the entity
   * @param data - The operation data
   */
  async queueOperation(
    operation: SyncOperationType,
    entityType: SyncEntityType,
    entityId: string,
    data: any
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      operation,
      entity_type: entityType,
      entity_id: entityId,
      data,
      timestamp: new Date().toISOString(),
      retries: 0
    };

    await db.syncQueue.add(queueItem);
    this.notifyListeners({ status: 'queued', pendingCount: await this.getPendingCount() });

    // Try to sync immediately if online
    if (this.isOnline && !this.isSyncing) {
      await this.processSyncQueue();
    }
  }

  /**
   * Process the sync queue and sync all pending operations
   */
  async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners({ status: 'syncing', pendingCount: await this.getPendingCount() });

    try {
      const queueItems = await db.syncQueue.orderBy('timestamp').toArray();

      for (const item of queueItems) {
        try {
          await this.syncItem(item);
          // Remove from queue on success
          if (item.id) {
            await db.syncQueue.delete(item.id);
          }
        } catch (error) {
          console.error('Failed to sync item:', item, error);
          
          // Increment retry count
          if (item.id) {
            const updatedItem = { ...item, retries: item.retries + 1 };
            
            // Remove if max retries exceeded
            if (updatedItem.retries >= this.maxRetries) {
              console.error('Max retries exceeded for item:', item);
              await db.syncQueue.delete(item.id);
            } else {
              await db.syncQueue.put(updatedItem);
            }
          }
        }
      }

      this.notifyListeners({ status: 'synced', pendingCount: 0 });
    } catch (error) {
      console.error('Error processing sync queue:', error);
      this.notifyListeners({ 
        status: 'error', 
        pendingCount: await this.getPendingCount(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single queue item
   * @param item - The queue item to sync
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    // Import API modules dynamically to avoid circular dependencies
    const pageAPI = await import('@/api/pageAPI');
    const blockAPI = await import('@/api/blockAPI');
    const fileAPI = await import('@/api/fileAPI');

    switch (item.entity_type) {
      case 'page':
        await this.syncPageOperation(item, pageAPI);
        break;
      case 'block':
        await this.syncBlockOperation(item, blockAPI);
        break;
      case 'file':
        await this.syncFileOperation(item, fileAPI);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity_type}`);
    }
  }

  /**
   * Sync a page operation
   */
  private async syncPageOperation(item: SyncQueueItem, pageAPI: any): Promise<void> {
    switch (item.operation) {
      case 'create':
        await pageAPI.createPage(item.data);
        break;
      case 'update':
        // Last-write-wins conflict resolution
        await pageAPI.updatePage(item.entity_id, item.data);
        break;
      case 'delete':
        await pageAPI.deletePage(item.entity_id);
        break;
    }
  }

  /**
   * Sync a block operation
   */
  private async syncBlockOperation(item: SyncQueueItem, blockAPI: any): Promise<void> {
    const { pageId, blockId, ...data } = item.data;
    
    switch (item.operation) {
      case 'create':
        await blockAPI.createBlock(pageId, data);
        break;
      case 'update':
        await blockAPI.updateBlock(pageId, blockId, data);
        break;
      case 'delete':
        await blockAPI.deleteBlock(pageId, blockId);
        break;
    }
  }

  /**
   * Sync a file operation
   */
  private async syncFileOperation(item: SyncQueueItem, fileAPI: any): Promise<void> {
    switch (item.operation) {
      case 'create':
        // File uploads need special handling - data should contain File object
        await fileAPI.uploadFile(item.data.file, item.data.pageId);
        break;
      case 'delete':
        await fileAPI.deleteFile(item.entity_id);
        break;
      // Update not typically needed for files
    }
  }

  /**
   * Get the number of pending operations in the queue
   */
  async getPendingCount(): Promise<number> {
    return await db.syncQueue.count();
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(): Promise<SyncQueueItem[]> {
    return await db.syncQueue.orderBy('timestamp').toArray();
  }

  /**
   * Clear the sync queue (use with caution)
   */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
    this.notifyListeners({ status: 'synced', pendingCount: 0 });
  }

  /**
   * Check if currently online
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Check if currently syncing
   */
  getSyncingStatus(): boolean {
    return this.isSyncing;
  }

  /**
   * Set online status (for testing purposes)
   * @internal
   */
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
  }

  /**
   * Subscribe to sync status changes
   * @param listener - Callback function to receive status updates
   * @returns Unsubscribe function
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    
    // Send initial status
    this.getPendingCount().then(count => {
      listener({
        status: this.isOnline ? 'synced' : 'offline',
        pendingCount: count
      });
    });

    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(status: SyncStatus): void {
    this.syncListeners.forEach(listener => listener(status));
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    this.notifyListeners({ status: 'online', pendingCount: await this.getPendingCount() });
    
    // Start syncing pending operations
    await this.processSyncQueue();
  }

  /**
   * Handle offline event
   */
  private async handleOffline(): Promise<void> {
    this.isOnline = false;
    this.notifyListeners({ status: 'offline', pendingCount: await this.getPendingCount() });
  }
}

// ============================================================================
// Types
// ============================================================================

export interface SyncStatus {
  status: 'online' | 'offline' | 'syncing' | 'synced' | 'queued' | 'error';
  pendingCount: number;
  error?: string;
}

// Export singleton instance
export const syncService = new SyncService();
