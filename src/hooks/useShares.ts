import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShares, createShare, deleteShare } from '@/api/shareAPI';
import type { PageShare } from '@/types/notion';

/**
 * Query key factory for shares
 */
export const shareKeys = {
  all: ['shares'] as const,
  lists: () => [...shareKeys.all, 'list'] as const,
  list: (pageId: string) => [...shareKeys.lists(), pageId] as const,
};

/**
 * Hook for fetching shares for a page
 */
export function useShares(pageId: string) {
  return useQuery({
    queryKey: shareKeys.list(pageId),
    queryFn: () => getShares(pageId),
    enabled: !!pageId,
  });
}

/**
 * Hook for creating a share
 */
export function useCreateShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, permission }: { pageId: string; permission: 'view' | 'edit' }) =>
      createShare(pageId, permission),
    onSuccess: (newShare) => {
      // Add the new share to the cache
      queryClient.setQueryData<PageShare[]>(
        shareKeys.list(newShare.page_id),
        (oldShares) => {
          if (!oldShares) return [newShare];
          return [...oldShares, newShare];
        }
      );

      // Invalidate to refetch and ensure consistency
      queryClient.invalidateQueries({ queryKey: shareKeys.list(newShare.page_id) });
    },
  });
}

/**
 * Hook for deleting a share
 */
export function useDeleteShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) => deleteShare(shareId),
    onMutate: async (shareId) => {
      // Find which page this share belongs to by checking all share queries
      const queryCache = queryClient.getQueryCache();
      const shareQueries = queryCache.findAll({ queryKey: shareKeys.lists() });

      let pageId: string | null = null;
      let previousShares: PageShare[] | undefined;

      for (const query of shareQueries) {
        const shares = query.state.data as PageShare[] | undefined;
        if (shares) {
          const share = shares.find((s) => s.id === shareId);
          if (share) {
            pageId = share.page_id;
            previousShares = shares;
            break;
          }
        }
      }

      if (pageId) {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: shareKeys.list(pageId) });

        // Optimistically remove the share
        queryClient.setQueryData<PageShare[]>(
          shareKeys.list(pageId),
          (oldShares) => {
            if (!oldShares) return oldShares;
            return oldShares.filter((share) => share.id !== shareId);
          }
        );
      }

      return { pageId, previousShares };
    },
    onError: (err, shareId, context) => {
      // Rollback on error
      if (context?.pageId && context?.previousShares) {
        queryClient.setQueryData(
          shareKeys.list(context.pageId),
          context.previousShares
        );
      }
    },
    onSuccess: (_, shareId, context) => {
      // Invalidate to refetch and ensure consistency
      if (context?.pageId) {
        queryClient.invalidateQueries({ queryKey: shareKeys.list(context.pageId) });
      }
    },
  });
}
