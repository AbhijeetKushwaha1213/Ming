import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchPages, trackPageView, getRecentPages } from '../searchAPI';
import { supabase } from '@/integrations/supabase/client';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Search API', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockPage = {
    id: 'page-123',
    user_id: 'user-123',
    parent_id: null,
    title: 'Test Page',
    icon: '📝',
    cover_image: null,
    content: [
      {
        id: '1',
        type: 'text',
        content: { text: 'This is a test page with some content', marks: [] },
        position: 0,
      },
    ],
    position: 0,
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock auth.getUser
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    });
  });

  describe('searchPages', () => {
    it('returns empty array for empty query', async () => {
      const results = await searchPages('');
      expect(results).toEqual([]);
    });

    it('searches pages and returns results with snippets', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              textSearch: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockPage],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const results = await searchPages('test');

      expect(results).toHaveLength(1);
      expect(results[0].page.id).toBe('page-123');
      expect(results[0].snippet).toBeTruthy();
      expect(results[0].rank).toBe(1);
    });

    it('generates snippet from title when query matches title', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              textSearch: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockPage],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const results = await searchPages('Test Page');

      expect(results[0].snippet).toContain('Test Page');
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(searchPages('test')).rejects.toThrow('User not authenticated');
    });
  });

  describe('trackPageView', () => {
    it('tracks page view successfully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(trackPageView('page-123')).resolves.not.toThrow();
      expect(supabase.rpc).toHaveBeenCalledWith('track_page_view', {
        p_page_id: 'page-123',
        p_user_id: 'user-123',
      });
    });

    it('does not throw error when tracking fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' } as any,
      });

      // Should not throw - tracking failures are logged but not critical
      await expect(trackPageView('page-123')).resolves.not.toThrow();
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(trackPageView('page-123')).rejects.toThrow('User not authenticated');
    });
  });

  describe('getRecentPages', () => {
    it('returns recently viewed pages in order', async () => {
      const mockPageViews = [
        { page_id: 'page-2', viewed_at: '2024-01-02T00:00:00Z' },
        { page_id: 'page-1', viewed_at: '2024-01-01T00:00:00Z' },
      ];

      const mockPages = [
        { ...mockPage, id: 'page-1', title: 'Page 1' },
        { ...mockPage, id: 'page-2', title: 'Page 2' },
      ];

      const mockDbFrom = vi.fn()
        .mockReturnValueOnce({
          // First call for page_views
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockPageViews,
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // Second call for pages
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: mockPages,
                error: null,
              }),
            }),
          }),
        });

      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const results = await getRecentPages(10);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('page-2'); // Most recent first
      expect(results[1].id).toBe('page-1');
    });

    it('returns empty array when no recent pages', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const results = await getRecentPages(10);
      expect(results).toEqual([]);
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(getRecentPages(10)).rejects.toThrow('User not authenticated');
    });
  });
});
