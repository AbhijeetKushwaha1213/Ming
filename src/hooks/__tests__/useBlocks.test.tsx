import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateBlock, useUpdateBlock, useDeleteBlock, useReorderBlocks } from '../useBlocks';
import * as blockAPI from '@/api/blockAPI';
import type { Block } from '@/types/notion';

// Mock the API
vi.mock('@/api/blockAPI');

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

describe('useCreateBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a block successfully', async () => {
    const newBlock: Block = {
      id: 'block1',
      type: 'text',
      position: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      content: { text: 'Hello', marks: [] },
    };

    vi.mocked(blockAPI.createBlock).mockResolvedValue(newBlock);

    const { result } = renderHook(() => useCreateBlock('page1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ type: 'text', content: { text: 'Hello', marks: [] } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(newBlock);
    expect(blockAPI.createBlock).toHaveBeenCalledWith('page1', {
      type: 'text',
      content: { text: 'Hello', marks: [] },
    });
  });
});

describe('useUpdateBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a block successfully', async () => {
    const updatedBlock: Block = {
      id: 'block1',
      type: 'text',
      position: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      content: { text: 'Updated', marks: [] },
    };

    vi.mocked(blockAPI.updateBlock).mockResolvedValue(updatedBlock);

    const { result } = renderHook(() => useUpdateBlock('page1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      blockId: 'block1',
      data: { content: { text: 'Updated', marks: [] } },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(updatedBlock);
    expect(blockAPI.updateBlock).toHaveBeenCalledWith('page1', 'block1', {
      content: { text: 'Updated', marks: [] },
    });
  });
});

describe('useDeleteBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a block successfully', async () => {
    vi.mocked(blockAPI.deleteBlock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteBlock('page1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate('block1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(blockAPI.deleteBlock).toHaveBeenCalledWith('page1', 'block1');
  });
});

describe('useReorderBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders blocks successfully', async () => {
    vi.mocked(blockAPI.reorderBlocks).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReorderBlocks('page1'), {
      wrapper: createWrapper(),
    });

    const blockIds = ['block2', 'block1', 'block3'];
    result.current.mutate(blockIds);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(blockAPI.reorderBlocks).toHaveBeenCalledWith('page1', blockIds);
  });
});
