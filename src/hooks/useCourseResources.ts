import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAllPages } from '@/api/pageAPI';
import { listResources } from '@/api/resourceAPI';
import type { ResourceItem } from '@/types/resource';

export interface CourseResourceItem {
  id: string;
  title: string;
  rawTitle: string;
  parentTitle?: string;
  type: string; // PDF, VIDEO, PPTX, NOTE, LINK, PAGE, SUBPAGE, DOCUMENT
  icon?: string;
  folder?: string;
  createdAt?: string;
  isNotionPage: boolean;
  pageData?: any;
  resourceData?: ResourceItem;
}

export function useCourseResources() {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id || 'default_user';
  const [resources, setResources] = useState<CourseResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const combined: CourseResourceItem[] = [];
      const seenKeys = new Set<string>();

      // 1. Fetch Notion workspace notes/pages from SQLite
      try {
        const pages = await getAllPages();
        if (Array.isArray(pages) && pages.length > 0) {
          const pageMap = new Map<string, any>();
          pages.forEach((p) => pageMap.set(p.id, p));

          for (const page of pages) {
            if (page.deleted_at) continue;
            const parent = page.parent_id ? pageMap.get(page.parent_id) : null;
            const parentTitle = parent?.title?.trim();
            const pageTitle = (page.title || 'Untitled').trim();
            const displayTitle = parentTitle ? `${parentTitle} / ${pageTitle}` : pageTitle;

            const dedupeKey = `page::${displayTitle.toLowerCase()}`;
            if (!seenKeys.has(dedupeKey)) {
              seenKeys.add(dedupeKey);
              combined.push({
                id: `notion_page_${page.id}`,
                title: displayTitle,
                rawTitle: pageTitle,
                parentTitle: parentTitle || undefined,
                type: parent ? 'SUBPAGE' : 'PAGE',
                icon: page.icon || (parent ? '↳' : '📄'),
                folder: parentTitle || 'Workspace Notes',
                createdAt: page.created_at || page.updated_at,
                isNotionPage: true,
                pageData: page,
              });
            }
          }
        }
      } catch (pageErr) {
        console.warn('useCourseResources: Could not load workspace pages:', pageErr);
      }

      // 2. Fetch Uploaded Course Files from /api/resources
      try {
        let fileList: any[] = [];
        let fetchedFromListAPI = false;
        try {
          const resList = await listResources();
          if (Array.isArray(resList)) {
            fileList = resList;
            fetchedFromListAPI = true;
          }
        } catch {
          // fallback to direct endpoint query
        }

        if (!fetchedFromListAPI) {
          try {
            const res = await fetch(`/api/resources?userId=${encodeURIComponent(userId)}`);
            if (res.ok) {
              const data = await res.json();
              fileList = Array.isArray(data) ? data : Array.isArray(data?.resources) ? data.resources : [];
            }
          } catch {
            // fallback fetch failed or mocked environment
          }
        }

        for (const item of fileList) {
          const title = (item.title || 'Document').trim();
          const dedupeKey = `file::${title.toLowerCase()}::${(item.type || '').toLowerCase()}`;
          if (!seenKeys.has(dedupeKey)) {
            seenKeys.add(dedupeKey);
            combined.push({
              id: item.id || `file_${title}`,
              title,
              rawTitle: title,
              type: item.type || 'DOCUMENT',
              icon: item.type === 'PDF' ? '📕' : item.type === 'VIDEO' ? '🎥' : item.type === 'PPTX' ? '📊' : item.type === 'NOTE' ? '📝' : '📑',
              folder: item.folder || (item.tags && item.tags.length > 0 ? item.tags[0] : undefined),
              createdAt: item.createdAt || item.updatedAt,
              isNotionPage: false,
              resourceData: item,
            });
          }
        }
      } catch (fileErr) {
        console.warn('useCourseResources: Could not load uploaded resources:', fileErr);
      }

      setResources(combined);
    } catch (err: any) {
      console.error('useCourseResources: Failed to load resources:', err);
      setError(err?.message || 'Failed to load course resources');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadResources();

    const handleRefresh = () => loadResources();
    window.addEventListener('studymate-resource-added', handleRefresh);
    window.addEventListener('studymate-resources-changed', handleRefresh);
    window.addEventListener('studymate-resources-updated', handleRefresh);
    window.addEventListener('studymate-page-created', handleRefresh);
    window.addEventListener('studymate-page-updated', handleRefresh);
    window.addEventListener('studymate-page-deleted', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    return () => {
      window.removeEventListener('studymate-resource-added', handleRefresh);
      window.removeEventListener('studymate-resources-changed', handleRefresh);
      window.removeEventListener('studymate-resources-updated', handleRefresh);
      window.removeEventListener('studymate-page-created', handleRefresh);
      window.removeEventListener('studymate-page-updated', handleRefresh);
      window.removeEventListener('studymate-page-deleted', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [loadResources]);

  return {
    resources,
    isLoading,
    error,
    refresh: loadResources,
  };
}
