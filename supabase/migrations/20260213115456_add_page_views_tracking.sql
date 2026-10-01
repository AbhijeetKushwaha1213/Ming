-- Add page views tracking for recent pages functionality

-- Create page_views table to track when users view pages
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page_id, user_id)
);

-- Index for efficient recent pages queries
CREATE INDEX IF NOT EXISTS idx_page_views_user_viewed ON page_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page_id ON page_views(page_id);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own page views
CREATE POLICY "Users can view own page views"
  ON page_views FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own page views
CREATE POLICY "Users can insert own page views"
  ON page_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own page views (for updating viewed_at timestamp)
CREATE POLICY "Users can update own page views"
  ON page_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to upsert page view (update viewed_at if exists, insert if not)
CREATE OR REPLACE FUNCTION track_page_view(p_page_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO page_views (page_id, user_id, viewed_at)
  VALUES (p_page_id, p_user_id, now())
  ON CONFLICT (page_id, user_id)
  DO UPDATE SET viewed_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
