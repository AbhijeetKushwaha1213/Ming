import { supabase } from '@/integrations/supabase/client';
import type { Page, SearchResult } from '@/types/notion';

/**
 * Search API - Full-text search and recent pages
 */

/**
 * Search pages using PostgreSQL full-text search
 * Returns results with matched content snippets ordered by relevance
 */
export async function searchPages(query: string): Promise<SearchResult[]> {
  // Validate query
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Prepare search query - convert to tsquery format
  const searchQuery = query.trim().split(/\s+/).join(' & ');

  // Execute full-text search with ranking
  const { data: pages, error } = await supabase
    .from('pages')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .textSearch('search_vector', searchQuery, {
      type: 'websearch',
      config: 'english'
    })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to search pages: ${error.message}`);
  }

  if (!pages || pages.length === 0) {
    return [];
  }

  // Generate snippets and calculate relevance scores
  const results: SearchResult[] = pages.map((page, index) => {
    const snippet = generateSnippet(page, query);
    // Simple ranking: position in results (lower is better)
    const rank = index + 1;
    
    return {
      page: page as Page,
      snippet,
      rank
    };
  });

  return results;
}

/**
 * Generate a snippet showing where the query was found in the page
 */
function generateSnippet(page: any, query: string): string {
  const queryLower = query.toLowerCase();
  
  // Check title first
  if (page.title && page.title.toLowerCase().includes(queryLower)) {
    return `Title: ${page.title}`;
  }

  // Search in content blocks
  if (page.content && Array.isArray(page.content)) {
    for (const block of page.content) {
      const blockText = extractTextFromBlock(block);
      if (blockText.toLowerCase().includes(queryLower)) {
        // Find the position of the query in the text
        const index = blockText.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, index - 40);
        const end = Math.min(blockText.length, index + query.length + 40);
        
        let snippet = blockText.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < blockText.length) snippet = snippet + '...';
        
        return snippet;
      }
    }
  }

  // Fallback to title if no content match found
  return page.title || 'Untitled';
}

/**
 * Extract text content from a block for snippet generation
 */
function extractTextFromBlock(block: any): string {
  if (!block) return '';

  // Handle different block types
  switch (block.type) {
    case 'text':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'quote':
    case 'callout':
      return block.content?.text || '';
    
    case 'checkbox':
      return block.content?.text || '';
    
    case 'bulletList':
    case 'numberedList':
      if (Array.isArray(block.items)) {
        return block.items.map((item: any) => 
          typeof item === 'string' ? item : item.text || ''
        ).join(' ');
      }
      return '';
    
    case 'code':
      return block.content || '';
    
    case 'image':
      return block.caption || '';
    
    case 'file':
      return block.filename || '';
    
    default:
      return '';
  }
}

/**
 * Track a page view for recent pages functionality
 */
export async function trackPageView(pageId: string): Promise<void> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Call the database function to upsert page view
  const { error } = await supabase.rpc('track_page_view', {
    p_page_id: pageId,
    p_user_id: user.id
  });

  if (error) {
    // Don't throw error for tracking failures - it's not critical
    console.error('Failed to track page view:', error.message);
  }
}

/**
 * Get recently viewed pages for the current user
 * Returns pages ordered by most recently viewed first
 */
export async function getRecentPages(limit: number = 10): Promise<Page[]> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Get recent page views
  const { data: pageViews, error: viewsError } = await supabase
    .from('page_views')
    .select('page_id, viewed_at')
    .eq('user_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(limit);

  if (viewsError) {
    throw new Error(`Failed to get recent pages: ${viewsError.message}`);
  }

  if (!pageViews || pageViews.length === 0) {
    return [];
  }

  // Get the actual pages
  const pageIds = pageViews.map(view => view.page_id);
  const { data: pages, error: pagesError } = await supabase
    .from('pages')
    .select('*')
    .in('id', pageIds)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to get recent pages: ${pagesError.message}`);
  }

  if (!pages) {
    return [];
  }

  // Sort pages by the order of pageViews (most recent first)
  const pageMap = new Map(pages.map(p => [p.id, p as Page]));
  const sortedPages = pageViews
    .map(view => pageMap.get(view.page_id))
    .filter((page): page is Page => page !== undefined);

  return sortedPages;
}
