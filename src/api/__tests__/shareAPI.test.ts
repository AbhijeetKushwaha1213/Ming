import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createShare, deleteShare, getShares } from '../shareAPI';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Share API', () => {
  const mockUser = { id: 'user-123' };
  const mockPageId = 'page-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    });
  });

  describe('createShare', () => {
    it('creates a share with view permission', async () => {
      const mockShare = {
        id: 'share-123',
        page_id: mockPageId,
        shared_by: mockUser.id,
        shared_with: null,
        permission: 'view',
        share_link: 'abc123',
        created_at: new Date().toISOString(),
      };

      // Mock page exists check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockPageId },
          error: null,
        }),
      } as any);

      // Mock share link uniqueness check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      // Mock share creation
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockShare,
          error: null,
        }),
      } as any);

      const result = await createShare(mockPageId, 'view');

      expect(result).toEqual(mockShare);
      expect(result.permission).toBe('view');
    });

    it('creates a share with edit permission', async () => {
      const mockShare = {
        id: 'share-123',
        page_id: mockPageId,
        shared_by: mockUser.id,
        shared_with: null,
        permission: 'edit',
        share_link: 'abc123',
        created_at: new Date().toISOString(),
      };

      // Mock page exists check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockPageId },
          error: null,
        }),
      } as any);

      // Mock share link uniqueness check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      // Mock share creation
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockShare,
          error: null,
        }),
      } as any);

      const result = await createShare(mockPageId, 'edit');

      expect(result).toEqual(mockShare);
      expect(result.permission).toBe('edit');
    });

    it('throws error when page not found', async () => {
      // Mock page not found
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      } as any);

      await expect(createShare(mockPageId, 'view')).rejects.toThrow(
        'Page not found or access denied'
      );
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' } as any,
      });

      await expect(createShare(mockPageId, 'view')).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('deleteShare', () => {
    it('deletes a share successfully', async () => {
      const shareId = 'share-123';

      // Mock share exists check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { shared_by: mockUser.id },
          error: null,
        }),
      } as any);

      // Mock delete
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as any);

      await expect(deleteShare(shareId)).resolves.toBeUndefined();
    });

    it('throws error when share not found', async () => {
      const shareId = 'share-123';

      // Mock share not found
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      } as any);

      await expect(deleteShare(shareId)).rejects.toThrow('Share not found');
    });

    it('throws error when user is not the share creator', async () => {
      const shareId = 'share-123';

      // Mock share exists but different user
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { shared_by: 'other-user' },
          error: null,
        }),
      } as any);

      await expect(deleteShare(shareId)).rejects.toThrow(
        'Only the user who created the share can delete it'
      );
    });
  });

  describe('getShares', () => {
    it('returns all shares for a page', async () => {
      const mockShares = [
        {
          id: 'share-1',
          page_id: mockPageId,
          shared_by: mockUser.id,
          shared_with: null,
          permission: 'view',
          share_link: 'abc123',
          created_at: new Date().toISOString(),
        },
        {
          id: 'share-2',
          page_id: mockPageId,
          shared_by: mockUser.id,
          shared_with: null,
          permission: 'edit',
          share_link: 'def456',
          created_at: new Date().toISOString(),
        },
      ];

      // Mock page exists check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockPageId },
          error: null,
        }),
      } as any);

      // Mock get shares
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockShares,
          error: null,
        }),
      } as any);

      const result = await getShares(mockPageId);

      expect(result).toEqual(mockShares);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no shares exist', async () => {
      // Mock page exists check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockPageId },
          error: null,
        }),
      } as any);

      // Mock get shares - empty
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      const result = await getShares(mockPageId);

      expect(result).toEqual([]);
    });

    it('throws error when page not found', async () => {
      // Mock page not found
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      } as any);

      await expect(getShares(mockPageId)).rejects.toThrow(
        'Page not found or access denied'
      );
    });
  });
});
