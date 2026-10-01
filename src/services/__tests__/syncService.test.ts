import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncService } from '../syncService';
import { db } from '../db';

describe('SyncService', () => {
  beforeEach(async () => {
    // Clear sync queue before each test
    await db.syncQueue.clear();
    // Set service to offline to prevent automatic syncing during tests
    syncService.setOnlineStatus(false);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.syncQueue.clear();
    // Reset to online status
    syncService.setOnlineStatus(true);
  });

  describe('queueOperation', () => {
    it('adds operation to sync queue', async () => {
      await syncService.queueOperation(
        'create',
        'page',
        'page-123',
        { title: 'Test Page' }
      );

      const pending = await syncService.getPendingOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0].operation).toBe('create');
      expect(pending[0].entity_type).toBe('page');
      expect(pending[0].entity_id).toBe('page-123');
    });

    it('sets initial retry count to 0', async () => {
      await syncService.queueOperation(
        'update',
        'page',
        'page-123',
        { title: 'Updated' }
      );

      const pending = await syncService.getPendingOperations();
      expect(pending[0].retries).toBe(0);
    });

    it('includes timestamp', async () => {
      const before = new Date().toISOString();
      
      await syncService.queueOperation(
        'delete',
        'page',
        'page-123',
        {}
      );

      const after = new Date().toISOString();
      const pending = await syncService.getPendingOperations();
      
      expect(pending[0].timestamp).toBeDefined();
      expect(pending[0].timestamp >= before).toBe(true);
      expect(pending[0].timestamp <= after).toBe(true);
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 when queue is empty', async () => {
      const count = await syncService.getPendingCount();
      expect(count).toBe(0);
    });

    it('returns correct count of pending operations', async () => {
      await syncService.queueOperation('create', 'page', 'page-1', {});
      await syncService.queueOperation('update', 'page', 'page-2', {});
      await syncService.queueOperation('delete', 'page', 'page-3', {});

      const count = await syncService.getPendingCount();
      expect(count).toBe(3);
    });
  });

  describe('getPendingOperations', () => {
    it('returns operations ordered by timestamp', async () => {
      // Add operations with slight delays to ensure different timestamps
      await syncService.queueOperation('create', 'page', 'page-1', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await syncService.queueOperation('update', 'page', 'page-2', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await syncService.queueOperation('delete', 'page', 'page-3', {});

      const operations = await syncService.getPendingOperations();
      
      expect(operations).toHaveLength(3);
      expect(operations[0].entity_id).toBe('page-1');
      expect(operations[1].entity_id).toBe('page-2');
      expect(operations[2].entity_id).toBe('page-3');
    });
  });

  describe('clearQueue', () => {
    it('removes all pending operations', async () => {
      await syncService.queueOperation('create', 'page', 'page-1', {});
      await syncService.queueOperation('update', 'page', 'page-2', {});

      expect(await syncService.getPendingCount()).toBe(2);

      await syncService.clearQueue();

      expect(await syncService.getPendingCount()).toBe(0);
    });
  });

  describe('getOnlineStatus', () => {
    it('returns current online status', () => {
      const status = syncService.getOnlineStatus();
      expect(typeof status).toBe('boolean');
    });
  });

  describe('getSyncingStatus', () => {
    it('returns current syncing status', () => {
      const status = syncService.getSyncingStatus();
      expect(typeof status).toBe('boolean');
    });
  });

  describe('subscribe', () => {
    it('calls listener with initial status', async () => {
      const listener = vi.fn();
      
      const unsubscribe = syncService.subscribe(listener);

      // Wait for async initial status
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toHaveProperty('status');
      expect(listener.mock.calls[0][0]).toHaveProperty('pendingCount');

      unsubscribe();
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = syncService.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('stops calling listener after unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = syncService.subscribe(listener);

      // Wait for initial call
      await new Promise(resolve => setTimeout(resolve, 50));
      const initialCallCount = listener.mock.calls.length;

      unsubscribe();

      // Queue an operation which would normally trigger listener
      await syncService.queueOperation('create', 'page', 'page-1', {});

      // Listener should not be called again
      expect(listener.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('multiple operations', () => {
    it('handles multiple operations of different types', async () => {
      await syncService.queueOperation('create', 'page', 'page-1', { title: 'Page 1' });
      await syncService.queueOperation('update', 'block', 'block-1', { content: 'Updated' });
      await syncService.queueOperation('delete', 'file', 'file-1', {});

      const operations = await syncService.getPendingOperations();
      
      expect(operations).toHaveLength(3);
      expect(operations.map(op => op.entity_type)).toContain('page');
      expect(operations.map(op => op.entity_type)).toContain('block');
      expect(operations.map(op => op.entity_type)).toContain('file');
    });
  });
});
