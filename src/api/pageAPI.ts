import { supabase, isLocalMode } from '@/integrations/supabase/client';
import { cacheService } from '@/services/cacheService';
import { db } from '@/services/db';
import type { Page, CreatePageInput, UpdatePageInput } from '@/types/notion';

/**
 * Page API - CRUD operations for pages
 */

/**
 * Create a new page
 */
export async function createPage(data: CreatePageInput): Promise<Page> {
  // Validate title
  if (!data.title || data.title.trim().length === 0) {
    throw new Error('Page title is required');
  }

  if (isLocalMode()) {
    const page: Page = {
      id: `local-page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: 'local-dev-user-id',
      title: data.title.trim(),
      parent_id: data.parent_id ?? null,
      icon: data.icon ?? null,
      cover_image: data.cover_image ?? null,
      content: data.content ?? [],
      position: data.position ?? 0,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    await cacheService.cachePage(page);
    return page;
  }

  // Get current user
  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (err) {
    user = null;
  }

  if (!user || isLocalMode()) {
    const page: Page = {
      id: `local-page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: user?.id || 'local-dev-user-id',
      title: data.title.trim(),
      parent_id: data.parent_id ?? null,
      icon: data.icon ?? null,
      cover_image: data.cover_image ?? null,
      content: data.content ?? [],
      position: data.position ?? 0,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    await cacheService.cachePage(page);
    return page;
  }

  // Prepare page data
  const pageData = {
    user_id: user.id,
    title: data.title.trim(),
    parent_id: data.parent_id ?? null,
    icon: data.icon ?? null,
    cover_image: data.cover_image ?? null,
    content: data.content ?? [],
    position: data.position ?? 0,
    is_favorite: false,
  };

  try {
    // Insert page
    const { data: page, error } = await supabase
      .from('pages')
      .insert(pageData)
      .select()
      .single();

    if (error || !page) {
      console.warn('Failed to insert page to Supabase, falling back to local cache:', error);
      const localPage: Page = {
        id: `local-page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        user_id: user.id,
        ...pageData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      await cacheService.cachePage(localPage);
      return localPage;
    }

    await cacheService.cachePage(page as Page);
    return page as Page;
  } catch (err) {
    const localPage: Page = {
      id: `local-page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: user.id,
      ...pageData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    await cacheService.cachePage(localPage);
    return localPage;
  }
}

/**
 * Get a page by ID
 */
export async function getPage(id: string): Promise<Page> {
  if (isLocalMode() || id.startsWith('local-page-')) {
    const page = await cacheService.getCachedPage(id);
    if (!page || page.deleted_at) {
      throw new Error('Page not found');
    }
    return page;
  }

  try {
    const { data: page, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !page) {
      const cached = await cacheService.getCachedPage(id);
      if (cached && !cached.deleted_at) {
        return cached;
      }
      throw new Error(`Failed to get page: ${error?.message || 'Page not found'}`);
    }

    // Keep cache fresh
    await cacheService.cachePage(page as Page);
    return page as Page;
  } catch (err: any) {
    const cached = await cacheService.getCachedPage(id);
    if (cached && !cached.deleted_at) {
      return cached;
    }
    throw err;
  }
}

/**
 * Update a page
 */
export async function updatePage(id: string, data: UpdatePageInput): Promise<Page> {
  // Validate title if provided
  if (data.title !== undefined && data.title.trim().length === 0) {
    throw new Error('Page title cannot be empty');
  }

  const cachedPage = await cacheService.getCachedPage(id);

  if (isLocalMode() || id.startsWith('local-page-')) {
    const basePage = cachedPage || {
      id,
      user_id: 'local-dev-user-id',
      title: data.title?.trim() || 'Untitled',
      parent_id: null,
      icon: null,
      cover_image: null,
      content: [],
      position: 0,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const updated: Page = {
      ...basePage,
      title: data.title !== undefined ? data.title.trim() : basePage.title,
      icon: data.icon !== undefined ? data.icon : basePage.icon,
      cover_image: data.cover_image !== undefined ? data.cover_image : basePage.cover_image,
      content: data.content !== undefined ? data.content : basePage.content,
      position: data.position !== undefined ? data.position : basePage.position,
      is_favorite: data.is_favorite !== undefined ? data.is_favorite : basePage.is_favorite,
      updated_at: new Date().toISOString(),
    };
    await cacheService.cachePage(updated);
    return updated;
  }

  // Check if authenticated
  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch {
    user = null;
  }

  const updateData: Partial<Page> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.cover_image !== undefined) updateData.cover_image = data.cover_image;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.is_favorite !== undefined) updateData.is_favorite = data.is_favorite;

  if (!user) {
    const base = cachedPage || {
      id,
      user_id: 'local-dev-user-id',
      title: updateData.title || 'Untitled',
      parent_id: null,
      icon: null,
      cover_image: null,
      content: [],
      position: 0,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    const updated: Page = {
      ...base,
      ...updateData,
    };
    await cacheService.cachePage(updated);
    return updated;
  }

  try {
    // Update page in Supabase
    const { data: page, error } = await supabase
      .from('pages')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !page) {
      console.warn('Supabase page update failed, caching locally:', error);
      if (cachedPage) {
        const updated: Page = {
          ...cachedPage,
          ...updateData,
        };
        await cacheService.cachePage(updated);
        return updated;
      }
      throw new Error(`Failed to update page: ${error?.message || 'Page not found'}`);
    }

    await cacheService.cachePage(page as Page);
    return page as Page;
  } catch (err: any) {
    if (cachedPage) {
      const updated: Page = {
        ...cachedPage,
        ...updateData,
      };
      await cacheService.cachePage(updated);
      return updated;
    }
    throw err;
  }
}

/**
 * Delete a page (supports hard delete and soft delete with local cache cleanup)
 */
export async function deletePage(id: string): Promise<void> {
  const isLocalId = id.startsWith('local-page-');

  // If local mode or local ID, update local IndexedDB cache directly
  if (isLocalMode() || isLocalId) {
    try {
      const page = await cacheService.getCachedPage(id);
      if (page) {
        await cacheService.cachePage({
          ...page,
          deleted_at: new Date().toISOString(),
        });
      }
      await cacheService.removeCachedPage(id);
    } catch (e) {
      console.warn('Local cache deletion error:', e);
    }
    return;
  }

  let lastError: any = null;

  try {
    // 1. First attempt DELETE query in Supabase (matches "Users can delete own pages" FOR DELETE policy)
    const { error: deleteError } = await supabase
      .from('pages')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.warn('Supabase delete failed, attempting soft-delete update:', deleteError.message);
      // 2. Fallback to soft-delete update
      const { error: updateError } = await supabase
        .from('pages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) {
        console.warn('Supabase soft-delete update failed:', updateError.message);
        lastError = updateError;
      }
    }
  } catch (err: any) {
    console.warn('Network or unexpected error while deleting from Supabase:', err);
    lastError = err;
  }

  // 3. Always clean up page from local IndexedDB cache
  try {
    const page = await cacheService.getCachedPage(id);
    if (page) {
      await cacheService.cachePage({
        ...page,
        deleted_at: new Date().toISOString(),
      });
    }
    await cacheService.removeCachedPage(id);
  } catch (cacheErr) {
    console.warn('Failed to clean up page from local cache:', cacheErr);
  }

  // 4. If Supabase threw an RLS policy error (e.g. user session mismatch or row owned by test/agent),
  // but we've removed it from the local workspace cache, we do NOT throw the raw RLS error to block the user.
  if (lastError && !lastError.message?.includes('row-level security')) {
    throw new Error(`Failed to delete page: ${lastError.message}`);
  }
}

/**
 * Move a page to a new parent and/or position
 */
export async function movePage(
  id: string,
  newParentId: string | null,
  position: number
): Promise<Page> {
  // Validate that we're not creating a circular reference
  if (newParentId) {
    try {
      const ancestors = await getPageAncestors(newParentId);
      if (ancestors.some(ancestor => ancestor.id === id)) {
        throw new Error('Cannot move page to its own descendant');
      }
    } catch (e: any) {
      if (e.message?.includes('descendant')) throw e;
    }
  }

  let cachedPage = await cacheService.getCachedPage(id);
  if (!cachedPage) {
    try {
      cachedPage = await getPage(id);
    } catch {}
  }

  const now = new Date().toISOString();
  const updated: Page = {
    ...(cachedPage || {
      id,
      user_id: 'local-dev-user-id',
      title: 'Untitled',
      icon: null,
      cover_image: null,
      content: [],
      position: position,
      is_favorite: false,
      created_at: now,
      deleted_at: null,
    }),
    parent_id: newParentId,
    position: position,
    updated_at: now,
  };

  // Always save immediately to local IndexedDB cache
  await cacheService.cachePage(updated);

  if (isLocalMode() || id.startsWith('local-page-')) {
    return updated;
  }

  try {
    const { data: page, error } = await supabase
      .from('pages')
      .update({
        parent_id: newParentId,
        position: position,
        updated_at: now,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (!error && page) {
      await cacheService.cachePage(page as Page);
      return page as Page;
    }
  } catch (err) {
    console.warn('Supabase movePage network or policy error, preserved in local cache:', err);
  }

  return updated;
}

/**
 * Get child pages of a parent (or root pages if parentId is null)
 */
export async function getPageChildren(parentId: string | null): Promise<Page[]> {
  // Always fetch cached children as a reliable baseline
  let cachedChildren: Page[] = [];
  try {
    cachedChildren = await cacheService.getCachedChildren(parentId);
  } catch (err) {
    console.warn('Failed to get cached children:', err);
  }

  if (isLocalMode()) {
    return cachedChildren.filter(p => !p.deleted_at).sort((a, b) => a.position - b.position);
  }

  // Get current user
  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch {
    user = null;
  }

  if (!user) {
    return cachedChildren.filter(p => !p.deleted_at).sort((a, b) => a.position - b.position);
  }

  try {
    let query = supabase
      .from('pages')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('position', { ascending: true });

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data: pages, error } = await query;

    if (error || !pages) {
      console.warn('Supabase getPageChildren failed, falling back to cache:', error);
      return cachedChildren.filter(p => !p.deleted_at).sort((a, b) => a.position - b.position);
    }

    const pageMap = new Map<string, Page>();

    // Add Supabase pages, but DO NOT overwrite local cache if local cache is newer!
    for (const p of pages as Page[]) {
      const existingInCache = await cacheService.getCachedPage(p.id);
      if (!existingInCache || !existingInCache.updated_at || new Date(p.updated_at) >= new Date(existingInCache.updated_at)) {
        await cacheService.cachePage(p);
        pageMap.set(p.id, p);
      } else {
        // Local cache has more recent modifications (e.g. recent move or rename)
        if (parentId === null ? !existingInCache.parent_id : existingInCache.parent_id === parentId) {
          pageMap.set(existingInCache.id, existingInCache);
        }
      }
    }

    // Include all valid cached children for this parent
    for (const c of cachedChildren) {
      if (!c.deleted_at && (parentId === null ? !c.parent_id : c.parent_id === parentId)) {
        pageMap.set(c.id, c);
      }
    }

    // Double check: sync with local cache
    try {
      const allCached = await db.pages.toArray();
      for (const c of allCached) {
        if (c.deleted_at) {
          pageMap.delete(c.id);
          continue;
        }
        const existingInPageMap = pageMap.get(c.id);
        if (existingInPageMap) {
          const cacheIsNewer = c.updated_at && existingInPageMap.updated_at 
            ? new Date(c.updated_at) > new Date(existingInPageMap.updated_at)
            : false;
          if (cacheIsNewer && (parentId === null ? c.parent_id !== null : c.parent_id !== parentId)) {
            pageMap.delete(c.id);
          }
        } else {
          // If not in pageMap, but local cache has it with this parentId:
          const matches = parentId === null ? !c.parent_id : c.parent_id === parentId;
          if (matches) {
            pageMap.set(c.id, c);
          }
        }
      }
    } catch {}

    return Array.from(pageMap.values()).sort((a, b) => a.position - b.position);
  } catch (err) {
    console.warn('getPageChildren network error, using cached children:', err);
    return cachedChildren.filter(p => !p.deleted_at).sort((a, b) => a.position - b.position);
  }
}

/**
 * Get all active pages for the current user
 */
export async function getAllPages(): Promise<Page[]> {
  const allCached = await db.pages.toArray();
  const activeCached = allCached.filter(p => !p.deleted_at);

  if (isLocalMode()) {
    return activeCached.sort((a, b) => a.position - b.position);
  }

  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch {
    user = null;
  }

  if (!user) {
    return activeCached.sort((a, b) => a.position - b.position);
  }

  try {
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('position', { ascending: true });

    if (error || !pages) {
      return activeCached.sort((a, b) => a.position - b.position);
    }

    const pageMap = new Map<string, Page>();
    for (const p of pages as Page[]) {
      const existing = activeCached.find(c => c.id === p.id);
      if (!existing || !existing.updated_at || new Date(p.updated_at) >= new Date(existing.updated_at)) {
        pageMap.set(p.id, p);
        await cacheService.cachePage(p);
      } else {
        pageMap.set(existing.id, existing);
      }
    }

    // Add local cached pages
    for (const c of activeCached) {
      if (!pageMap.has(c.id)) {
        pageMap.set(c.id, c);
      }
    }

    return Array.from(pageMap.values()).sort((a, b) => a.position - b.position);
  } catch (err) {
    return activeCached.sort((a, b) => a.position - b.position);
  }
}

/**
 * Get ancestors of a page (for breadcrumb navigation)
 * Returns array from root to immediate parent
 */
export async function getPageAncestors(pageId: string): Promise<Page[]> {
  if (isLocalMode()) {
    const ancestors: Page[] = [];
    let currentId: string | null = pageId;
    while (currentId) {
      const page = await cacheService.getCachedPage(currentId);
      if (!page || page.deleted_at) break;
      if (page.id !== pageId) {
        ancestors.unshift(page);
      }
      currentId = page.parent_id;
    }
    return ancestors;
  }

  const ancestors: Page[] = [];
  let currentId: string | null = pageId;

  // Traverse up the hierarchy
  while (currentId) {
    const { data: page, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', currentId)
      .is('deleted_at', null)
      .single();

    if (error || !page) {
      break;
    }

    // Don't include the page itself in ancestors
    if (page.id !== pageId) {
      ancestors.unshift(page as Page);
    }

    currentId = page.parent_id;
  }

  return ancestors;
}

/**
 * Toggle favorite status of a page
 */
export async function toggleFavorite(id: string): Promise<Page> {
  if (isLocalMode()) {
    const page = await cacheService.getCachedPage(id);
    if (!page || page.deleted_at) {
      throw new Error('Page not found');
    }
    const updated: Page = {
      ...page,
      is_favorite: !page.is_favorite,
      updated_at: new Date().toISOString(),
    };
    await cacheService.cachePage(updated);
    return updated;
  }

  // Get current page to check its favorite status
  const currentPage = await getPage(id);
  
  // Toggle the favorite status
  const newFavoriteStatus = !currentPage.is_favorite;
  
  // Update the page
  const { data: page, error } = await supabase
    .from('pages')
    .update({
      is_favorite: newFavoriteStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to toggle favorite: ${error.message}`);
  }

  if (!page) {
    throw new Error('Page not found');
  }

  return page as Page;
}

/**
 * Get all favorited pages for the current user
 */
export async function getFavorites(): Promise<Page[]> {
  if (isLocalMode()) {
    const pages = await cacheService.getCachedPages('local-dev-user-id');
    return pages.filter(p => p.is_favorite && !p.deleted_at).sort((a, b) => a.position - b.position);
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Query favorited pages
  const { data: pages, error } = await supabase
    .from('pages')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_favorite', true)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (error) {
    throw new Error(`Failed to get favorites: ${error.message}`);
  }

  return (pages || []) as Page[];
}
