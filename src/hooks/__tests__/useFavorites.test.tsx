import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFavorites, useToggleFavorite } from '../useFavorites';
import * as pageAPI from '@/api/pageAPI';
import type { Page } from '@/types/notion';

// Mock the API
vi.mock('@/api/pageAPI');

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

describe('useFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches favorite pages successfully', async () => {
    const mockFavorites: Page[] = [
      {
        id: '1',
        user_id: 'user1',
        parent_id: null,
        title: 'Favorite Page',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
      },
    ];

    vi.mocked(pageAPI.getFavorites).mockResolvedValue(mockFavorites);

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFavorites);
    expect(pageAPI.getFavorites).toHaveBeenCalled();
  });
});

describe('useToggleFavorite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles favorite status successfully', async () => {
    const toggledPage: Page = {
      id: '1',
      user_id: 'user1',
      parent_id: null,
      title: 'Test Page',
      icon: null,
      cover_image: null,
      content: [],
      position: 0,
      is_favorite: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      deleted_at: null,
    };

    vi.mocked(pageAPI.toggleFavorite).mockResolvedValue(toggledPage);

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(toggledPage);
    expect(pageAPI.toggleFavorite).toHaveBeenCalledWith('1');
  });
});
