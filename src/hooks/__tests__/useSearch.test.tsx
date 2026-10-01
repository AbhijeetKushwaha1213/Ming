import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearch, useRecentPages } from '../useSearch';
import * as searchAPI from '@/api/searchAPI';
import type { SearchResult, Page } from '@/types/notion';

// Mock the API
vi.mock('@/api/searchAPI');

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches pages successfully with debouncing', async () => {
    const mockResults: SearchResult[] = [
      {
        page: {
          id: '1',
          user_id: 'user1',
          parent_id: null,
          title: 'Test Page',
          icon: null,
          cover_image: null,
          content: [],
          position: 0,
          is_favorite: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
        },
        snippet: 'Test Page',
        rank: 1,
      },
    ];

    vi.mocked(searchAPI.searchPages).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useSearch('test'), {
      wrapper: createWrapper(),
    });

    // Wait for debounce and query to complete
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 1000 });
    expect(result.current.data).toEqual(mockResults);
    expect(searchAPI.searchPages).toHaveBeenCalledWith('test');
  });

  it('does not search with empty query', async () => {
    const { result } = renderHook(() => useSearch(''), {
      wrapper: createWrapper(),
    });

    // Query should not be enabled
    expect(result.current.isFetching).toBe(false);
    expect(searchAPI.searchPages).not.toHaveBeenCalled();
  });
});

describe('useRecentPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches recent pages successfully', async () => {
    const mockPages: Page[] = [
      {
        id: '1',
        user_id: 'user1',
        parent_id: null,
        title: 'Recent Page',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
      },
    ];

    vi.mocked(searchAPI.getRecentPages).mockResolvedValue(mockPages);

    const { result } = renderHook(() => useRecentPages(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPages);
    expect(searchAPI.getRecentPages).toHaveBeenCalledWith(10);
  });
});
