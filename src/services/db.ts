// IndexedDB database setup using Dexie.js
import Dexie, { Table } from 'dexie';
import { Page } from '@/types/notion';

// ============================================================================
// Database Schema Types
// ============================================================================

export interface CachedPage extends Page {
  cached_at: string;
}

export interface OfflinePage {
  page_id: string;
  marked_at: string;
}

export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncEntityType = 'page' | 'block' | 'file';

export interface SyncQueueItem {
  id?: number;
  operation: SyncOperationType;
  entity_type: SyncEntityType;
  entity_id: string;
  data: any;
  timestamp: string;
  retries: number;
}

// ============================================================================
// Dexie Database Class
// ============================================================================

export class NotionDatabase extends Dexie {
  // Tables
  pages!: Table<CachedPage, string>;
  offlinePages!: Table<OfflinePage, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('NotionResourceManager');
    
    this.version(1).stores({
      // Cached pages - indexed by id, user_id, and parent_id for efficient queries
      pages: 'id, user_id, parent_id, is_favorite, cached_at',
      
      // Offline pages - pages marked for offline access
      offlinePages: 'page_id, marked_at',
      
      // Sync queue - operations to sync when online
      syncQueue: '++id, timestamp, entity_type, operation'
    });
  }
}

// Create and export database instance
export const db = new NotionDatabase();
