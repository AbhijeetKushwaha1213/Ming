import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPage, updatePage, type UpdatePageInput } from '@/api/pageAPI';
import type { Page } from '@/types/notion';
import { pageKeys } from './usePages';

/**
 * Hook for fetching a single page by ID
 */
export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: pageKeys.detail(id!),
    queryFn: () => getPage(id!),
    enabled: !!id, // Only run query if id is provided
  });
}

/**
 * Hook for updating a single page with optimistic updates
 */
export function useUpdatePageOptimistic(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdatePageInput) => updatePage(pageId, data),
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous value
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update to the new value
      if (previousPage) {
        const optimisticPage: Page = {
          ...previousPage,
          ...data,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);

        // Also update in any lists that contain this page
        queryClient.setQueriesData<Page[]>(
          { queryKey: pageKeys.lists() },
          (oldPages) => {
            if (!oldPages) return oldPages;
            return oldPages.map((page) =>
              page.id === pageId ? optimisticPage : page
            );
          }
        );
      }

      return { previousPage };
    },
    onError: (err, data, context) => {
      // Rollback on error
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
        
        // Rollback in lists as well
        queryClient.setQueriesData<Page[]>(
          { queryKey: pageKeys.lists() },
          (oldPages) => {
            if (!oldPages) return oldPages;
            return oldPages.map((page) =>
              page.id === pageId ? context.previousPage! : page
            );
          }
        );
      }
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(pageKeys.detail(pageId), data);
      
      // Update in lists
      queryClient.setQueriesData<Page[]>(
        { queryKey: pageKeys.lists() },
        (oldPages) => {
          if (!oldPages) return oldPages;
          return oldPages.map((page) =>
            page.id === pageId ? data : page
          );
        }
      );
    },
  });
}
