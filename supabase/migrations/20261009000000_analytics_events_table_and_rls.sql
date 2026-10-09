-- ============================================================================
-- Migration: 20261009000000_analytics_events_table_and_rls.sql
-- Description: Creates analytics_events table with RLS isolation for production PostgreSQL / Supabase
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_properties_json TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast tenant-scoping and chronological retrieval indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON public.analytics_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type ON public.analytics_events(user_id, event_type);

-- Row Level Security (RLS) enforcement
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "analytics_events_isolation_policy" ON public.analytics_events
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
