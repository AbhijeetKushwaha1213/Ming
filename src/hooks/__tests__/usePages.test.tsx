import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePages, useCreatePage, useUpdatePage, useDeletePage } from '../usePages';
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

describe('usePages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches pages successfully', async () => {
    const mockPages: Page[] = [
      {
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
    ];

    vi.mocked(pageAPI.getPageChildren).mockResolvedValue(mockPages);

    const { result } = renderHook(() => usePages(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPages);
    expect(pageAPI.getPageChildren).toHaveBeenCalledWith(null);
  });

  it('handles fetch error', async () => {
    vi.mocked(pageAPI.getPageChildren).mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => usePages(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe('useCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a page successfully', async () => {
    const newPage: Page = {
      id: '1',
      user_id: 'user1',
      parent_id: null,
      title: 'New Page',
      icon: null,
      cover_image: null,
      content: [],
      position: 0,
      is_favorite: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      deleted_at: null,
    };

    vi.mocked(pageAPI.createPage).mockResolvedValue(newPage);

    const { result } = renderHook(() => useCreatePage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ title: 'New Page' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(newPage);
    expect(pageAPI.createPage).toHaveBeenCalledWith({ title: 'New Page' });
  });
});

describe('useUpdatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a page successfully', async () => {
    const updatedPage: Page = {
      id: '1',
      user_id: 'user1',
      parent_id: null,
      title: 'Updated Page',
      icon: null,
      cover_image: null,
      content: [],
      position: 0,
      is_favorite: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      deleted_at: null,
    };

    vi.mocked(pageAPI.updatePage).mockResolvedValue(updatedPage);

    const { result } = renderHook(() => useUpdatePage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: '1', data: { title: 'Updated Page' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(updatedPage);
    expect(pageAPI.updatePage).toHaveBeenCalledWith('1', { title: 'Updated Page' });
  });
});

describe('useDeletePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a page successfully', async () => {
    vi.mocked(pageAPI.deletePage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeletePage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pageAPI.deletePage).toHaveBeenCalledWith('1');
  });
});
