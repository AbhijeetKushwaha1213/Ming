import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, Share2, Star, ChevronRight, Folder, Plus } from 'lucide-react';
import { usePage } from '@/hooks/usePage';
import { useUpdatePageOptimistic } from '@/hooks/usePage';
import { getPage, getPageAncestors, createPage } from '@/api/pageAPI';
import { PageHeader } from './PageHeader';
import { PageBreadcrumb } from './PageBreadcrumb';
import { BlockEditor } from './editor/BlockEditor';
import { ShareModal } from './ShareModal';
import { PageContentSkeleton } from './PageSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { logError } from '@/utils/errorLogger';
import { useQueryClient } from '@tanstack/react-query';
import { usePages, pageKeys } from '@/hooks/usePages';
import { useToggleFavorite } from '@/hooks/useFavorites';
import { PageActionMenu } from './PageActionMenu';
import { formatDistanceToNow } from 'date-fns';
import type { Page, Block } from '@/types/notion';

interface PageViewProps {
  pageId: string;
  onNavigate: (pageId: string) => void;
}

export function PageView({ pageId, onNavigate }: PageViewProps) {
  const { data: page, isLoading, error } = usePage(pageId);
  const updatePage = useUpdatePageOptimistic(pageId);
  const toggleFavorite = useToggleFavorite();
  const queryClient = useQueryClient();
  const [ancestors, setAncestors] = useState<Page[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<Block[]>([]);

  // Fetch child pages inside this page/folder
  const { data: subpages = [], isLoading: isLoadingSubpages } = usePages(pageId);

  // Create a new subpage inside this page/folder
  const handleCreateSubpage = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const newPage = await createPage({
        title: 'Untitled',
        parent_id: pageId,
      });

      // Optimistically update target page's subpage query
      queryClient.setQueryData<Page[]>(pageKeys.list(pageId), (old) => {
        if (!old) return [newPage];
        return [...old, newPage];
      });

      await queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studymate-page-created', { detail: { pageId: newPage.id } }));
        window.dispatchEvent(
          new CustomEvent('studymate-page-moved', {
            detail: { pageId: newPage.id, targetParentId: pageId },
          })
        );
        window.dispatchEvent(new CustomEvent('studymate-resources-updated'));
      }

      onNavigate(newPage.id);
    } catch (err: any) {
      logError(err, {
        component: 'PageView',
        action: 'createSubpage',
        metadata: { pageId },
      });
    }
  };

  // Fetch ancestors for breadcrumb
  useEffect(() => {
    if (!pageId) return;

    getPageAncestors(pageId)
      .then(setAncestors)
      .catch((err) => {
        logError(err, {
          component: 'PageView',
          action: 'fetchAncestors',
          metadata: { pageId },
        });
      });
  }, [pageId]);

  // Sync draftBlocks when page data changes (including after external updates)
  useEffect(() => {
    if (!page) return;
    setDraftBlocks(page.content || []);
  }, [page?.id, page?.updated_at, page?.content]);

  // Listen for agent-driven page updates and refetch the page from the server
  useEffect(() => {
    const handlePageUpdated = async (e: any) => {
      const updatedPageId = e?.detail?.pageId;
      if (!updatedPageId || updatedPageId === pageId) {
        // Invalidate and refetch the specific page detail query so PageView gets new content
        await queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
        await queryClient.invalidateQueries({ queryKey: pageKeys.all });
        // Also directly fetch fresh data and update draftBlocks to avoid stale state
        try {
          const freshPage = await getPage(pageId);
          if (freshPage) {
            setDraftBlocks(freshPage.content || []);
          }
        } catch (err) {
          console.warn('Failed to refetch page after agent update:', err);
        }
      }
    };

    window.addEventListener('studymate-page-updated', handlePageUpdated);
    return () => {
      window.removeEventListener('studymate-page-updated', handlePageUpdated);
    };
  }, [pageId, queryClient]);

  // Handle title change with auto-save
  const handleTitleChange = useCallback(
    async (title: string) => {
      if (!title.trim()) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        await updatePage.mutateAsync({ title });
      } catch (err) {
        setSaveError('Failed to save title');
        logError(err, {
          component: 'PageView',
          action: 'updateTitle',
          metadata: { pageId },
        });
      } finally {
        setIsSaving(false);
      }
    },
    [updatePage]
  );

  // Handle icon change
  const handleIconChange = useCallback(
    async (icon: string | null) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        await updatePage.mutateAsync({ icon });
      } catch (err) {
        setSaveError('Failed to save icon');
        logError(err, {
          component: 'PageView',
          action: 'updateIcon',
          metadata: { pageId },
        });
      } finally {
        setIsSaving(false);
      }
    },
    [updatePage]
  );

  // Handle cover image change
  const handleCoverImageChange = useCallback(
    async (coverImage: string | null) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        await updatePage.mutateAsync({ cover_image: coverImage });
      } catch (err) {
        setSaveError('Failed to save cover image');
        logError(err, {
          component: 'PageView',
          action: 'updateCoverImage',
          metadata: { pageId },
        });
      } finally {
        setIsSaving(false);
      }
    },
    [updatePage]
  );

  // Handle blocks change with debounced auto-save
  const [blocksUpdateTimeout, setBlocksUpdateTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleBlocksChange = useCallback(
    (blocks: Block[]) => {
      setDraftBlocks(blocks);

      // Clear existing timeout
      if (blocksUpdateTimeout) {
        clearTimeout(blocksUpdateTimeout);
      }

      // Set new timeout for auto-save
      const timeoutId = setTimeout(async () => {
        setIsSaving(true);
        setSaveError(null);

        try {
          await updatePage.mutateAsync({ content: blocks });
        } catch (err) {
          setSaveError('Failed to save content');
          logError(err, {
            component: 'PageView',
            action: 'updateBlocks',
            metadata: { pageId },
          });
        } finally {
          setIsSaving(false);
        }
      }, 1000); // 1 second debounce

      setBlocksUpdateTimeout(timeoutId);
    },
    [updatePage, blocksUpdateTimeout]
  );

  // Cleanup timeout on unmount or page change
  useEffect(() => {
    return () => {
      if (blocksUpdateTimeout) {
        clearTimeout(blocksUpdateTimeout);
      }
    };
  }, [blocksUpdateTimeout, pageId]);

  // Loading state
  if (isLoading) {
    return <PageContentSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8" role="alert" aria-live="assertive">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Failed to load page: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Page not found
  if (!page) {
    return (
      <div className="flex items-center justify-center h-full p-8" role="alert" aria-live="polite">
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>Page not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-view h-full overflow-y-auto page-enter" role="main" aria-label="Page content">
      {/* Save status indicator */}
      <div className="fixed top-4 right-4 z-50">
        {isSaving && (
          <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200" role="status" aria-live="polite" aria-label="Saving page">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Saving...</span>
          </div>
        )}
        {saveError && (
          <Alert variant="destructive" className="py-2 animate-in fade-in slide-in-from-top-2 duration-200" role="alert" aria-live="assertive">
            <AlertDescription className="text-xs">{saveError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Notion-style Top Bar Navigation */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/40 px-6 sm:px-12 py-2 flex items-center justify-between text-xs text-muted-foreground select-none">
        {/* Left: Breadcrumbs or Current Page Indicator */}
        <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1 mr-4">
          {ancestors.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-hidden">
              {ancestors.map((ancestor) => (
                <React.Fragment key={ancestor.id}>
                  <button
                    onClick={() => onNavigate(ancestor.id)}
                    className="hover:text-foreground transition-colors truncate max-w-[130px] flex items-center gap-1"
                  >
                    {ancestor.icon && <span>{ancestor.icon}</span>}
                    <span>{ancestor.title || 'Untitled'}</span>
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                </React.Fragment>
              ))}
              <span className="font-medium text-foreground truncate max-w-[200px] flex items-center gap-1">
                {page.icon && <span>{page.icon}</span>}
                <span>{page.title || 'Untitled'}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-foreground/90 font-medium">
              <span className="text-sm">{page.icon || '📄'}</span>
              <span className="truncate max-w-[240px]">{page.title || 'Untitled'}</span>
            </div>
          )}
        </div>

        {/* Right: Edited Time, Share, Favorite, and 3-dot Action Menu */}
        <div className="flex items-center gap-1 shrink-0">
          {page.updated_at && (
            <span className="text-[11px] text-muted-foreground/85 hidden sm:inline-block mr-2 font-normal">
              Edited {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-accent rounded-md flex items-center gap-1.5"
            aria-label="Share page"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleFavorite.mutate(page.id)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
            title={page.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
            aria-label={page.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Star className={`w-3.5 h-3.5 ${page.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </Button>

          {/* 3-dot Action Menu (Notion style) */}
          <PageActionMenu page={page} align="end" />
        </div>
      </div>

      {/* Page header */}
      <PageHeader
        pageId={page.id}
        title={page.title}
        icon={page.icon}
        coverImage={page.cover_image}
        onTitleChange={handleTitleChange}
        onIconChange={handleIconChange}
        onCoverImageChange={handleCoverImageChange}
        onShareClick={() => setIsShareModalOpen(true)}
        editable={true}
      />

      {/* Notion-style Subpages Links List */}
      {subpages && subpages.length > 0 && (
        <div className="px-8 sm:px-16 pt-2 pb-2 max-w-4xl">
          <div className="space-y-0.5">
            {subpages.map((child) => (
              <div
                key={child.id}
                onClick={() => onNavigate(child.id)}
                className="group flex items-center justify-between px-2.5 py-1.5 -mx-2.5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors duration-150 text-foreground"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigate(child.id);
                  }
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-base shrink-0 select-none">
                    {child.icon || '📄'}
                  </span>
                  <span className="text-sm font-medium truncate group-hover:underline decoration-foreground/40 underline-offset-2">
                    {child.title || 'Untitled'}
                  </span>
                </div>

                {/* 3-dot Action Menu (visible on hover) */}
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PageActionMenu page={child} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block editor */}
      <div className="px-8 sm:px-16 pb-48 min-h-[calc(100vh-14rem)] flex flex-col cursor-text">
        <BlockEditor
          pageId={page.id}
          blocks={draftBlocks}
          onBlocksChange={handleBlocksChange}
          editable={true}
          onNavigate={onNavigate}
        />
      </div>

      {/* Share modal */}
      <ShareModal
        pageId={page.id}
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
      />
    </div>
  );
}
