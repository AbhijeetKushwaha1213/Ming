import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPage,
  updatePage,
  deletePage,
  getPageChildren,
  movePage,
  type CreatePageInput,
  type UpdatePageInput,
} from '@/api/pageAPI';
import type { Page } from '@/types/notion';

/**
 * Query key factory for pages
 */
export const pageKeys = {
  all: ['pages'] as const,
  lists: () => [...pageKeys.all, 'list'] as const,
  list: (parentId: string | null) => [...pageKeys.lists(), { parentId }] as const,
  details: () => [...pageKeys.all, 'detail'] as const,
  detail: (id: string) => [...pageKeys.details(), id] as const,
};

/**
 * Hook for fetching child pages of a parent (or root pages if parentId is null)
 */
export function usePages(parentId: string | null = null) {
  return useQuery({
    queryKey: pageKeys.list(parentId),
    queryFn: () => getPageChildren(parentId),
  });
}

/**
 * Hook for creating a new page
 */
export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePageInput) => createPage(data),
    onMutate: async (newPage) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.list(newPage.parent_id ?? null) });

      // Snapshot the previous value
      const previousPages = queryClient.getQueryData<Page[]>(
        pageKeys.list(newPage.parent_id ?? null)
      );

      // Optimistically update to the new value
      if (previousPages) {
        const optimisticPage: Page = {
          id: `temp-${Date.now()}`,
          user_id: '',
          parent_id: newPage.parent_id ?? null,
          title: newPage.title,
          icon: newPage.icon ?? null,
          cover_image: newPage.cover_image ?? null,
          content: newPage.content ?? [],
          position: newPage.position ?? previousPages.length,
          is_favorite: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };

        queryClient.setQueryData<Page[]>(
          pageKeys.list(newPage.parent_id ?? null),
          [...previousPages, optimisticPage]
        );
      }

      return { previousPages };
    },
    onError: (err, newPage, context) => {
      // Rollback on error
      if (context?.previousPages) {
        queryClient.setQueryData(
          pageKeys.list(newPage.parent_id ?? null),
          context.previousPages
        );
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: pageKeys.list(variables.parent_id ?? null) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
    },
  });
}

/**
 * Hook for updating a page
 */
export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePageInput }) =>
      updatePage(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(id) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(id));

      // Optimistically update to the new value
      if (previousPage) {
        const optimisticPage: Page = {
          ...previousPage,
          ...data,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(id), optimisticPage);

        // Also update in lists
        queryClient.setQueriesData<Page[]>(
          { queryKey: pageKeys.lists() },
          (oldPages) => {
            if (!oldPages) return oldPages;
            return oldPages.map((page) =>
              page.id === id ? optimisticPage : page
            );
          }
        );
      }

      return { previousPage };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(id), context.previousPage);
      }
    },
    onSuccess: (data, { id }) => {
      // Update cache with server response
      queryClient.setQueryData(pageKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
    },
  });
}

/**
 * Hook for deleting a page
 */
export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePage(id),
    onMutate: async (id) => {
      // Get the page to know its parent
      const page = queryClient.getQueryData<Page>(pageKeys.detail(id));
      const parentId = page?.parent_id ?? null;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.list(parentId) });

      // Snapshot the previous value
      const previousPages = queryClient.getQueryData<Page[]>(pageKeys.list(parentId));

      // Optimistically remove from the list
      if (previousPages) {
        queryClient.setQueryData<Page[]>(
          pageKeys.list(parentId),
          previousPages.filter((p) => p.id !== id)
        );
      }

      return { previousPages, parentId };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousPages && context?.parentId !== undefined) {
        queryClient.setQueryData(pageKeys.list(context.parentId), context.previousPages);
      }
    },
    onSuccess: (data, id, context) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: pageKeys.list(context?.parentId ?? null) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.removeQueries({ queryKey: pageKeys.detail(id) });
    },
  });
}

/**
 * Hook for moving a page to a new parent and/or position
 */
export function useMovePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      newParentId,
      position,
    }: {
      id: string;
      newParentId: string | null;
      position: number;
    }) => movePage(id, newParentId, position),
    onSuccess: (data, { id }) => {
      // Invalidate all page lists since the page may have moved between parents
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.setQueryData(pageKeys.detail(id), data);
    },
  });
}
