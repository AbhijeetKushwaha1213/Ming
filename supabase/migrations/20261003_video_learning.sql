-- Supabase PostgreSQL Migration: Video Learning Entity & RLS Policies
-- Enables user-isolated storage and metadata for YouTube and Uploaded Videos.

CREATE TABLE IF NOT EXISTS public.videos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'upload')),
    youtube_url TEXT,
    youtube_video_id TEXT,
    storage_path TEXT,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    transcript_status TEXT NOT NULL DEFAULT 'pending' CHECK (transcript_status IN ('pending', 'processing', 'ready', 'failed')),
    transcript_json TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & user isolation
CREATE INDEX IF NOT EXISTS videos_user_id_created_at_idx ON public.videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS videos_user_id_source_type_idx ON public.videos(user_id, source_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own videos
CREATE POLICY "Users can view own videos" 
ON public.videos FOR SELECT 
USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own videos
CREATE POLICY "Users can insert own videos" 
ON public.videos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only update their own videos
CREATE POLICY "Users can update own videos" 
ON public.videos FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own videos
CREATE POLICY "Users can delete own videos" 
ON public.videos FOR DELETE 
USING (auth.uid() = user_id);
