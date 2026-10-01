import { useQuery } from '@tanstack/react-query';
import { searchPages, getRecentPages } from '@/api/searchAPI';
import { useState, useEffect } from 'react';

/**
 * Query key factory for search
 */
export const searchKeys = {
  all: ['search'] as const,
  searches: () => [...searchKeys.all, 'query'] as const,
  search: (query: string) => [...searchKeys.searches(), query] as const,
  recent: () => [...searchKeys.all, 'recent'] as const,
};

/**
 * Hook for searching pages with debouncing
 * @param query - The search query string
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 */
export function useSearch(query: string, debounceMs: number = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [query, debounceMs]);

  return useQuery({
    queryKey: searchKeys.search(debouncedQuery),
    queryFn: () => searchPages(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0, // Only search if query is not empty
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching recent pages
 * @param limit - Maximum number of recent pages to fetch (default: 10)
 */
export function useRecentPages(limit: number = 10) {
  return useQuery({
    queryKey: [...searchKeys.recent(), limit],
    queryFn: () => getRecentPages(limit),
    staleTime: 60 * 1000, // 1 minute
  });
}
