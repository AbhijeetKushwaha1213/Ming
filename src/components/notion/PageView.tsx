import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { usePage } from '@/hooks/usePage';
import { useUpdatePageOptimistic } from '@/hooks/usePage';
import { getPageAncestors } from '@/api/pageAPI';
import { PageHeader } from './PageHeader';
import { PageBreadcrumb } from './PageBreadcrumb';
import { BlockEditor } from './editor/BlockEditor';
import { ShareModal } from './ShareModal';
import { PageContentSkeleton } from './PageSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logError } from '@/utils/errorLogger';
import type { Page, Block } from '@/types/notion';

interface PageViewProps {
  pageId: string;
  onNavigate: (pageId: string) => void;
}

export function PageView({ pageId, onNavigate }: PageViewProps) {
  const { data: page, isLoading, error } = usePage(pageId);
  const updatePage = useUpdatePageOptimistic(pageId);
  const [ancestors, setAncestors] = useState<Page[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<Block[]>([]);

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

  useEffect(() => {
    if (!page) return;
    setDraftBlocks(page.content || []);
  }, [page?.id]);

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

      {/* Breadcrumb navigation */}
      {ancestors.length > 0 && (
        <PageBreadcrumb
          ancestors={ancestors}
          currentPageTitle={page.title}
          onNavigate={onNavigate}
        />
      )}

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

      {/* Block editor */}
      <div className="px-16 pb-32">
        <BlockEditor
          pageId={page.id}
          blocks={draftBlocks}
          onBlocksChange={handleBlocksChange}
          editable={true}
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
