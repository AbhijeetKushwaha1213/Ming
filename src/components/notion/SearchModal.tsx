import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useSearch, useRecentPages } from '@/hooks/useSearch';
import type { SearchResult } from '@/types/notion';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Fetch search results when query is not empty
  const { data: searchResults, isLoading: isSearching } = useSearch(query);

  // Fetch recent pages when query is empty
  const { data: recentPages, isLoading: isLoadingRecent } = useRecentPages(10);

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  // Reset query when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  // Handle page selection
  const handleSelectPage = useCallback((pageId: string) => {
    onOpenChange(false);
    navigate(`/notion/page/${pageId}`);
  }, [navigate, onOpenChange]);

  // Determine what to show
  const showRecent = !query.trim() && recentPages && recentPages.length > 0;
  const showSearchResults = query.trim() && searchResults && searchResults.length > 0;
  const showEmpty = query.trim() && !isSearching && (!searchResults || searchResults.length === 0);
  const showNoRecent = !query.trim() && !isLoadingRecent && (!recentPages || recentPages.length === 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search pages..."
        value={query}
        onValueChange={setQuery}
        aria-label="Search pages"
      />
      <CommandList role="listbox" aria-label="Search results">
        {showEmpty && (
          <div className="py-6 text-center text-sm" role="status" aria-live="polite">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium text-foreground">No pages found</p>
            <p className="text-muted-foreground mt-1">
              Try a different search term or create a new page
            </p>
          </div>
        )}

        {showNoRecent && (
          <div className="py-6 text-center text-sm" role="status" aria-live="polite">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium text-foreground">No recent pages</p>
            <p className="text-muted-foreground mt-1">
              Pages you view will appear here for quick access
            </p>
          </div>
        )}

        {showRecent && (
          <CommandGroup heading="Recent Pages">
            {recentPages.map((page) => (
              <CommandItem
                key={page.id}
                value={page.id}
                onSelect={() => handleSelectPage(page.id)}
                role="option"
                aria-label={`Recent page: ${page.title || 'Untitled'}`}
              >
                <Clock className="mr-2 h-4 w-4 opacity-50" aria-hidden="true" />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {page.icon && <span className="text-base" role="img" aria-label={`Icon: ${page.icon}`}>{page.icon}</span>}
                    <span className="truncate">{page.title || 'Untitled'}</span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showSearchResults && (
          <>
            {showRecent && <CommandSeparator />}
            <CommandGroup heading="Search Results">
              {searchResults.map((result: SearchResult) => (
                <CommandItem
                  key={result.page.id}
                  value={result.page.id}
                  onSelect={() => handleSelectPage(result.page.id)}
                  role="option"
                  aria-label={`Search result: ${result.page.title || 'Untitled'}`}
                >
                  <FileText className="mr-2 h-4 w-4 opacity-50" aria-hidden="true" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {result.page.icon && (
                        <span className="text-base" role="img" aria-label={`Icon: ${result.page.icon}`}>{result.page.icon}</span>
                      )}
                      <span className="truncate font-medium">
                        {result.page.title || 'Untitled'}
                      </span>
                    </div>
                    {result.snippet && (
                      <span className="text-xs text-muted-foreground truncate mt-0.5">
                        {result.snippet}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
