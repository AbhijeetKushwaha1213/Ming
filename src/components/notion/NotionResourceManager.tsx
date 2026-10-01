import React, { useState, useEffect } from 'react';
import { PageSidebar } from './PageSidebar';
import { PageView } from './PageView';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { usePages } from '@/hooks/usePages';
import { createPage } from '@/api/pageAPI';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthProvider';
import { ErrorBoundary } from '../ErrorBoundary';
import { logError } from '@/utils/errorLogger';
import type { Page } from '@/types/notion';

/**
 * Main Notion-like Resource Manager component
 * Combines sidebar navigation with page content view
 */
export function NotionResourceManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: pages, isLoading, error: pagesError } = usePages();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  // Log errors for debugging
  useEffect(() => {
    if (pagesError) {
      logError(pagesError, {
        component: 'NotionResourceManager',
        action: 'loadPages',
        userId: user?.user_id,
      });
      
      toast({
        title: 'Error Loading Pages',
        description: 'Failed to load your pages. Please try refreshing.',
        variant: 'destructive',
      });
    }
  }, [pagesError, toast, user?.id]);

  // Select first page by default if none selected
  useEffect(() => {
    if (!selectedPageId && pages && pages.length > 0) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  const handlePageClick = (page: Page) => {
    setSelectedPageId(page.id);
  };

  const handleNavigate = (pageId: string) => {
    setSelectedPageId(pageId);
  };

  const handleCreatePage = async () => {
    if (!user?.user_id) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to create pages',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingPage(true);
    try {
      const newPage = await createPage({
        title: 'Untitled',
        parent_id: null,
      });

      setSelectedPageId(newPage.id);
      
      toast({
        title: 'Page Created',
        description: 'New page created successfully',
      });
    } catch (error) {
      logError(error, {
        component: 'NotionResourceManager',
        action: 'createPage',
        userId: user?.user_id,
      });
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create page',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingPage(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
      {/* Sidebar */}
      <ErrorBoundary>
        <div className="w-64 border-r border-border bg-background flex flex-col">
          <div className="p-4 border-b border-border">
            <Button
              onClick={handleCreatePage}
              disabled={isCreatingPage}
              className="w-full"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Page
            </Button>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <PageSidebar
              onPageClick={handlePageClick}
              selectedPageId={selectedPageId || undefined}
              isLoading={isLoading}
            />
          </div>
        </div>
      </ErrorBoundary>

      {/* Main Content */}
      <ErrorBoundary>
        <div className="flex-1 overflow-hidden">
          {selectedPageId ? (
            <PageView pageId={selectedPageId} onNavigate={handleNavigate} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Page Selected</h3>
                <p className="text-muted-foreground mb-4">
                  Create a new page or select one from the sidebar
                </p>
                <Button onClick={handleCreatePage} disabled={isCreatingPage}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Page
                </Button>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
