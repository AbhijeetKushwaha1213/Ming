import { supabase } from '@/integrations/supabase/client';
import type { PageShare } from '@/types/notion';

/**
 * Share API - Functions for managing page shares
 */

/**
 * Generate a unique share link
 */
function generateShareLink(): string {
  // Generate a random string for the share link
  const randomString = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
  return randomString;
}

/**
 * Create a share for a page
 * Generates a unique share link and stores the share record
 */
export async function createShare(
  pageId: string,
  permission: 'view' | 'edit'
): Promise<PageShare> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Verify the page exists and user has access
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('id', pageId)
    .is('deleted_at', null)
    .single();

  if (pageError || !page) {
    throw new Error('Page not found or access denied');
  }

  // Generate unique share link
  let shareLink = generateShareLink();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure uniqueness
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('page_shares')
      .select('id')
      .eq('share_link', shareLink)
      .single();

    if (!existing) {
      break;
    }

    shareLink = generateShareLink();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique share link');
  }

  // Create share record
  const shareData = {
    page_id: pageId,
    shared_by: user.id,
    shared_with: null,
    permission,
    share_link: shareLink,
  };

  const { data: share, error } = await supabase
    .from('page_shares')
    .insert(shareData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create share: ${error.message}`);
  }

  return share as PageShare;
}

/**
 * Delete a share (revoke access)
 */
export async function deleteShare(shareId: string): Promise<void> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Verify the share exists and user is the one who shared it
  const { data: share, error: shareError } = await supabase
    .from('page_shares')
    .select('shared_by')
    .eq('id', shareId)
    .single();

  if (shareError || !share) {
    throw new Error('Share not found');
  }

  if (share.shared_by !== user.id) {
    throw new Error('Only the user who created the share can delete it');
  }

  // Delete the share
  const { error } = await supabase
    .from('page_shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    throw new Error(`Failed to delete share: ${error.message}`);
  }
}

/**
 * Get all shares for a page
 */
export async function getShares(pageId: string): Promise<PageShare[]> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Verify the page exists and user has access
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('id', pageId)
    .is('deleted_at', null)
    .single();

  if (pageError || !page) {
    throw new Error('Page not found or access denied');
  }

  // Get all shares for the page
  const { data: shares, error } = await supabase
    .from('page_shares')
    .select('*')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get shares: ${error.message}`);
  }

  return (shares || []) as PageShare[];
}
