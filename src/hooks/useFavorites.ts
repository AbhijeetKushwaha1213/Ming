import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFavorites, toggleFavorite } from '@/api/pageAPI';
import type { Page } from '@/types/notion';
import { pageKeys } from './usePages';

/**
 * Query key factory for favorites
 */
export const favoritesKeys = {
  all: ['favorites'] as const,
  list: () => [...favoritesKeys.all, 'list'] as const,
};

/**
 * Hook for fetching favorited pages
 */
export function useFavorites() {
  return useQuery({
    queryKey: favoritesKeys.list(),
    queryFn: getFavorites,
  });
}

/**
 * Hook for toggling favorite status of a page
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => toggleFavorite(pageId),
    onMutate: async (pageId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: favoritesKeys.list() });
      await queryClient.cancelQueries({ queryKey: pageKeys.detail(pageId) });

      // Snapshot the previous values
      const previousFavorites = queryClient.getQueryData<Page[]>(favoritesKeys.list());
      const previousPage = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      // Optimistically update the page
      if (previousPage) {
        const optimisticPage: Page = {
          ...previousPage,
          is_favorite: !previousPage.is_favorite,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<Page>(pageKeys.detail(pageId), optimisticPage);

        // Update in page lists
        queryClient.setQueriesData<Page[]>(
          { queryKey: pageKeys.lists() },
          (oldPages) => {
            if (!oldPages) return oldPages;
            return oldPages.map((page) =>
              page.id === pageId ? optimisticPage : page
            );
          }
        );

        // Update favorites list
        if (previousFavorites) {
          if (optimisticPage.is_favorite) {
            // Add to favorites
            queryClient.setQueryData<Page[]>(
              favoritesKeys.list(),
              [...previousFavorites, optimisticPage]
            );
          } else {
            // Remove from favorites
            queryClient.setQueryData<Page[]>(
              favoritesKeys.list(),
              previousFavorites.filter((page) => page.id !== pageId)
            );
          }
        }
      }

      return { previousFavorites, previousPage };
    },
    onError: (err, pageId, context) => {
      // Rollback on error
      if (context?.previousFavorites) {
        queryClient.setQueryData(favoritesKeys.list(), context.previousFavorites);
      }
      if (context?.previousPage) {
        queryClient.setQueryData(pageKeys.detail(pageId), context.previousPage);
      }
    },
    onSuccess: (data, pageId) => {
      // Update cache with server response
      queryClient.setQueryData(pageKeys.detail(pageId), data);
      
      // Invalidate favorites list to refetch
      queryClient.invalidateQueries({ queryKey: favoritesKeys.list() });
      
      // Update in page lists
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
