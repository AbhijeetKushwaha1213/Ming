-- ============================================================================
-- NOTION-LIKE RESOURCE MANAGER - MANUAL MIGRATION SCRIPT
-- ============================================================================
-- This script can be executed directly in the Supabase SQL Editor
-- It includes all necessary tables, indexes, RLS policies, and storage setup
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- Pages table: Core entity for hierarchical page structure
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  cover_image TEXT,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  search_vector tsvector
);

-- Files table: Metadata for uploaded files
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT files_size_check CHECK (file_size > 0 AND file_size <= 10485760)
);

-- Page shares table: Sharing and collaboration
CREATE TABLE IF NOT EXISTS page_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  share_link TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates table: System and user templates
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  content JSONB NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Pages indexes
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_favorites ON pages(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_pages_deleted ON pages(user_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pages_position ON pages(parent_id, position);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_pages_search ON pages USING gin(search_vector);

-- Files indexes
CREATE INDEX IF NOT EXISTS idx_files_page_id ON files(page_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);

-- Page shares indexes
CREATE INDEX IF NOT EXISTS idx_page_shares_page_id ON page_shares(page_id);
CREATE INDEX IF NOT EXISTS idx_page_shares_link ON page_shares(share_link);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_system ON templates(is_system) WHERE is_system = true;

-- ============================================================================
-- FULL-TEXT SEARCH SETUP
-- ============================================================================

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_page_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content::text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
DROP TRIGGER IF EXISTS pages_search_vector_update ON pages;
CREATE TRIGGER pages_search_vector_update
  BEFORE INSERT OR UPDATE OF title, content
  ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_page_search_vector();

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for pages updated_at
DROP TRIGGER IF EXISTS pages_updated_at ON pages;
CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PAGES RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own pages" ON pages;
DROP POLICY IF EXISTS "Users can view shared pages" ON pages;
DROP POLICY IF EXISTS "Users can insert own pages" ON pages;
DROP POLICY IF EXISTS "Users can update own pages" ON pages;
DROP POLICY IF EXISTS "Users can update shared pages with edit permission" ON pages;
DROP POLICY IF EXISTS "Users can delete own pages" ON pages;

-- Users can view their own pages
CREATE POLICY "Users can view own pages"
  ON pages FOR SELECT
  USING (
    user_id = auth.uid() 
    AND deleted_at IS NULL
  );

-- Users can view shared pages
CREATE POLICY "Users can view shared pages"
  ON pages FOR SELECT
  USING (
    id IN (
      SELECT page_id FROM page_shares 
      WHERE shared_with = auth.uid() 
      OR (shared_with IS NULL AND share_link IS NOT NULL)
    )
    AND deleted_at IS NULL
  );

-- Users can insert their own pages
CREATE POLICY "Users can insert own pages"
  ON pages FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own pages
CREATE POLICY "Users can update own pages"
  ON pages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can update shared pages with edit permission
CREATE POLICY "Users can update shared pages with edit permission"
  ON pages FOR UPDATE
  USING (
    id IN (
      SELECT page_id FROM page_shares 
      WHERE shared_with = auth.uid() 
      AND permission = 'edit'
    )
  );

-- Users can delete their own pages (soft delete)
CREATE POLICY "Users can delete own pages"
  ON pages FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- FILES RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view files on own pages" ON files;
DROP POLICY IF EXISTS "Users can view files on shared pages" ON files;
DROP POLICY IF EXISTS "Users can insert files on own pages" ON files;
DROP POLICY IF EXISTS "Users can delete files on own pages" ON files;

-- Users can view files on their own pages
CREATE POLICY "Users can view files on own pages"
  ON files FOR SELECT
  USING (
    user_id = auth.uid()
    OR page_id IN (
      SELECT id FROM pages WHERE user_id = auth.uid()
    )
  );

-- Users can view files on shared pages
CREATE POLICY "Users can view files on shared pages"
  ON files FOR SELECT
  USING (
    page_id IN (
      SELECT page_id FROM page_shares 
      WHERE shared_with = auth.uid()
    )
  );

-- Users can insert files on their own pages
CREATE POLICY "Users can insert files on own pages"
  ON files FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND page_id IN (
      SELECT id FROM pages WHERE user_id = auth.uid()
    )
  );

-- Users can delete files on their own pages
CREATE POLICY "Users can delete files on own pages"
  ON files FOR DELETE
  USING (
    user_id = auth.uid()
    OR page_id IN (
      SELECT id FROM pages WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PAGE_SHARES RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view shares they created" ON page_shares;
DROP POLICY IF EXISTS "Users can view shares for own pages" ON page_shares;
DROP POLICY IF EXISTS "Users can create shares for own pages" ON page_shares;
DROP POLICY IF EXISTS "Users can delete shares they created" ON page_shares;
DROP POLICY IF EXISTS "Users can delete shares for own pages" ON page_shares;

-- Users can view shares they created
CREATE POLICY "Users can view shares they created"
  ON page_shares FOR SELECT
  USING (shared_by = auth.uid());

-- Users can view shares for their pages
CREATE POLICY "Users can view shares for own pages"
  ON page_shares FOR SELECT
  USING (
    page_id IN (
      SELECT id FROM pages WHERE user_id = auth.uid()
    )
  );

-- Users can create shares for their own pages
CREATE POLICY "Users can create shares for own pages"
  ON page_shares FOR INSERT
  WITH CHECK (
    shared_by = auth.uid()
    AND page_id IN (
      SELECT id FROM pages WHERE user_id = auth.uid()
    )
  );

-- Users can delete shares they created
CREATE POLICY "Users can delete shares they created"
  ON page_shares FOR DELETE
  USING (shared_by = auth.uid());

-- Users can delete shares for their pages
CREATE POLICY "Users can delete shares for own pages"
  ON page_shares FOR DELETE
  USING (
    page_id IN (
      SELECT id FROM pages WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TEMPLATES RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view system templates" ON templates;
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
DROP POLICY IF EXISTS "Users can create own templates" ON templates;
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;

-- Everyone can view system templates
CREATE POLICY "Anyone can view system templates"
  ON templates FOR SELECT
  USING (is_system = true);

-- Users can view their own templates
CREATE POLICY "Users can view own templates"
  ON templates FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own templates
CREATE POLICY "Users can create own templates"
  ON templates FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_system = false
  );

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- STORAGE BUCKET SETUP
-- ============================================================================

-- Create storage bucket for page files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'page-files',
  'page-files',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload files to own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Users can upload files to their own folders
CREATE POLICY "Users can upload files to own folders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'page-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own files
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'page-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'page-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- SEED DATA: SYSTEM TEMPLATES
-- ============================================================================

-- Insert system templates
INSERT INTO templates (name, description, icon, content, is_system) VALUES
(
  'Notes',
  'Simple note-taking template',
  '📝',
  '[
    {"id": "1", "type": "heading1", "content": {"text": "Notes", "marks": []}, "position": 0},
    {"id": "2", "type": "text", "content": {"text": "Start writing your notes here...", "marks": []}, "position": 1}
  ]'::jsonb,
  true
),
(
  'Study Plan',
  'Organize your study schedule',
  '📚',
  '[
    {"id": "1", "type": "heading1", "content": {"text": "Study Plan", "marks": []}, "position": 0},
    {"id": "2", "type": "heading2", "content": {"text": "Goals", "marks": []}, "position": 1},
    {"id": "3", "type": "bulletList", "items": ["Goal 1", "Goal 2", "Goal 3"], "position": 2},
    {"id": "4", "type": "heading2", "content": {"text": "Schedule", "marks": []}, "position": 3},
    {"id": "5", "type": "text", "content": {"text": "Add your study schedule here...", "marks": []}, "position": 4}
  ]'::jsonb,
  true
),
(
  'Project Tracker',
  'Track project progress and tasks',
  '🎯',
  '[
    {"id": "1", "type": "heading1", "content": {"text": "Project Tracker", "marks": []}, "position": 0},
    {"id": "2", "type": "heading2", "content": {"text": "Tasks", "marks": []}, "position": 1},
    {"id": "3", "type": "checkbox", "checked": false, "content": {"text": "Task 1", "marks": []}, "position": 2},
    {"id": "4", "type": "checkbox", "checked": false, "content": {"text": "Task 2", "marks": []}, "position": 3},
    {"id": "5", "type": "checkbox", "checked": false, "content": {"text": "Task 3", "marks": []}, "position": 4}
  ]'::jsonb,
  true
),
(
  'Reading List',
  'Keep track of books and articles',
  '📖',
  '[
    {"id": "1", "type": "heading1", "content": {"text": "Reading List", "marks": []}, "position": 0},
    {"id": "2", "type": "heading2", "content": {"text": "Currently Reading", "marks": []}, "position": 1},
    {"id": "3", "type": "bulletList", "items": [], "position": 2},
    {"id": "4", "type": "heading2", "content": {"text": "To Read", "marks": []}, "position": 3},
    {"id": "5", "type": "bulletList", "items": [], "position": 4}
  ]'::jsonb,
  true
),
(
  'Flashcard Set',
  'Create flashcards for studying',
  '🎴',
  '[
    {"id": "1", "type": "heading1", "content": {"text": "Flashcard Set", "marks": []}, "position": 0},
    {"id": "2", "type": "text", "content": {"text": "Topic: ", "marks": []}, "position": 1},
    {"id": "3", "type": "divider", "position": 2},
    {"id": "4", "type": "heading2", "content": {"text": "Card 1", "marks": []}, "position": 3},
    {"id": "5", "type": "text", "content": {"text": "Question: ", "marks": []}, "position": 4},
    {"id": "6", "type": "text", "content": {"text": "Answer: ", "marks": []}, "position": 5}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate unique share link
CREATE OR REPLACE FUNCTION generate_share_link()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment these to verify the migration was successful:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('pages', 'files', 'page_shares', 'templates');

-- SELECT * FROM storage.buckets WHERE id = 'page-files';

-- SELECT name, is_system FROM templates WHERE is_system = true;
