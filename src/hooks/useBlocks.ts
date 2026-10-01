import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  duplicateBlock,
  type CreateBlockInput,
  type UpdateBlockInput,
} from '@/api/blockAPI';
import type { Page, Block } from '@/types/notion';
import { pageKeys } from './usePages';

/**
 * Hook for creating a new block in a page
 */
export function useCreateBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockInput: CreateBlockInput) => createBlock(pageId, blockInput),
    onMutate: async (blockInput) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update to the new value
      if (previousPage) {
        const position = blockInput.position ?? previousPage.content.length;
        const optimisticBlock: Block = {
          id: `temp-${Date.now()}`,
          type: blockInput.type,
          position,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...blockInput,
        } as Block;

        const updatedContent = [...previousPage.content];
        updatedContent.splice(position, 0, optimisticBlock);

        // Reindex positions
        const reindexedContent = updatedContent.map((block, index) => ({
          ...block,
          position: index,
        }));

        const optimisticPage: Page = {
          ...previousPage,
          content: reindexedContent,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);
      }

      return { previousPage };
    },
    onError: (err, blockInput, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
      }
    },
    onSuccess: () => {
      // Refetch the page to get the actual block with server-generated ID
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

/**
 * Hook for updating a block in a page
 */
export function useUpdateBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, data }: { blockId: string; data: UpdateBlockInput }) =>
      updateBlock(pageId, blockId, data),
    onMutate: async ({ blockId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update to the new value
      if (previousPage) {
        const updatedContent = previousPage.content.map((block) =>
          block.id === blockId
            ? { ...block, ...data, updated_at: new Date().toISOString() }
            : block
        );

        const optimisticPage: Page = {
          ...previousPage,
          content: updatedContent,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);
      }

      return { previousPage };
    },
    onError: (err, { blockId, data }, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
      }
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

/**
 * Hook for deleting a block from a page
 */
export function useDeleteBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockId: string) => deleteBlock(pageId, blockId),
    onMutate: async (blockId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update to the new value
      if (previousPage) {
        const updatedContent = previousPage.content.filter(
          (block) => block.id !== blockId
        );

        // Reindex positions
        const reindexedContent = updatedContent.map((block, index) => ({
          ...block,
          position: index,
        }));

        const optimisticPage: Page = {
          ...previousPage,
          content: reindexedContent,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);
      }

      return { previousPage };
    },
    onError: (err, blockId, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
      }
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

/**
 * Hook for reordering blocks in a page
 */
export function useReorderBlocks(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockIds: string[]) => reorderBlocks(pageId, blockIds),
    onMutate: async (blockIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update to the new value
      if (previousPage) {
        // Create a map of blocks by ID for quick lookup
        const blockMap = new Map(previousPage.content.map((block) => [block.id, block]));

        // Reorder blocks according to the provided IDs
        const reorderedContent = blockIds.map((blockId, index) => {
          const block = blockMap.get(blockId);
          if (!block) {
            throw new Error(`Block with ID ${blockId} not found`);
          }
          return {
            ...block,
            position: index,
            updated_at: new Date().toISOString(),
          };
        });

        const optimisticPage: Page = {
          ...previousPage,
          content: reorderedContent,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);
      }

      return { previousPage };
    },
    onError: (err, blockIds, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
      }
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

/**
 * Hook for duplicating a block in a page
 */
export function useDuplicateBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockId: string) => duplicateBlock(pageId, blockId),
    onMutate: async (blockId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update to the new value
      if (previousPage) {
        const blockIndex = previousPage.content.findIndex((block) => block.id === blockId);
        if (blockIndex === -1) {
          throw new Error('Block not found');
        }

        const originalBlock = previousPage.content[blockIndex];
        const now = new Date().toISOString();
        const duplicatedBlock: Block = {
          ...originalBlock,
          id: `temp-${Date.now()}`,
          position: blockIndex + 1,
          created_at: now,
          updated_at: now,
        };

        const updatedContent = [...previousPage.content];
        updatedContent.splice(blockIndex + 1, 0, duplicatedBlock);

        // Reindex positions
        const reindexedContent = updatedContent.map((block, index) => ({
          ...block,
          position: index,
        }));

        const optimisticPage: Page = {
          ...previousPage,
          content: reindexedContent,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);
      }

      return { previousPage };
    },
    onError: (err, blockId, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
      }
    },
    onSuccess: () => {
      // Refetch to get the actual duplicated block with server-generated ID
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}
