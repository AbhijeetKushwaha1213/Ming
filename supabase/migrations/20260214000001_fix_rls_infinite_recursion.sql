-- Fix infinite recursion in RLS policies by simplifying them

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view files on own pages" ON files;
DROP POLICY IF EXISTS "Users can view files on shared pages" ON files;
DROP POLICY IF EXISTS "Users can insert files on own pages" ON files;
DROP POLICY IF EXISTS "Users can delete files on own pages" ON files;

DROP POLICY IF EXISTS "Users can view shares for own pages" ON page_shares;
DROP POLICY IF EXISTS "Users can create shares for own pages" ON page_shares;
DROP POLICY IF EXISTS "Users can delete shares for own pages" ON page_shares;

-- Recreate files policies without subqueries that cause recursion
CREATE POLICY "Users can view their own files"
  ON files FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own files"
  ON files FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own files"
  ON files FOR DELETE
  USING (user_id = auth.uid());

-- Recreate page_shares policies without subqueries
CREATE POLICY "Users can view shares they created or received"
  ON page_shares FOR SELECT
  USING (
    shared_by = auth.uid() 
    OR shared_with = auth.uid()
  );

CREATE POLICY "Users can create shares"
  ON page_shares FOR INSERT
  WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Users can delete their own shares"
  ON page_shares FOR DELETE
  USING (shared_by = auth.uid());
