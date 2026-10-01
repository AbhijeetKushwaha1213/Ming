-- Fix infinite recursion in pages RLS policies
-- The issue is that pages policies reference page_shares in subqueries,
-- creating circular dependencies. We'll use security definer functions
-- to bypass RLS when checking shares.

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view shared pages" ON pages;
DROP POLICY IF EXISTS "Users can update shared pages with edit permission" ON pages;

-- Create a security definer function to check if a page is shared with a user
-- This function runs with elevated privileges and bypasses RLS
CREATE OR REPLACE FUNCTION is_page_shared_with_user(page_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM page_shares
    WHERE page_id = page_id_param
    AND (shared_with = user_id_param OR shared_with IS NULL)
  );
END;
$$;

-- Create a security definer function to check if a user has edit permission
CREATE OR REPLACE FUNCTION has_page_edit_permission(page_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM page_shares
    WHERE page_id = page_id_param
    AND shared_with = user_id_param
    AND permission = 'edit'
  );
END;
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Users can view shared pages"
  ON pages FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR is_page_shared_with_user(id, auth.uid())
    )
  );

CREATE POLICY "Users can update shared pages with edit permission"
  ON pages FOR UPDATE
  USING (
    user_id = auth.uid()
    OR has_page_edit_permission(id, auth.uid())
  );
