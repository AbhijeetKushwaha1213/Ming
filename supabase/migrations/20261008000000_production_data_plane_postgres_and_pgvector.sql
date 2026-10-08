-- ============================================================================
-- Supabase Migration: Production Data Plane (PostgreSQL + pgvector)
-- Migration: 20261008000000_production_data_plane_postgres_and_pgvector.sql
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Relational Core Tables with RLS & Tenant Scoping
CREATE TABLE IF NOT EXISTS public.resources (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    note_content TEXT,
    link_url TEXT,
    file_url TEXT,
    storage_path TEXT,
    folder TEXT,
    tags_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resources_user_created ON public.resources(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_user_type ON public.resources(user_id, type);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    assessment_id TEXT,
    fingerprint TEXT NOT NULL,
    normalized_question TEXT,
    type TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    difficulty TEXT NOT NULL,
    source_id TEXT,
    chunk_id TEXT,
    page_number INTEGER,
    slide_number INTEGER,
    timestamp_start DOUBLE PRECISION,
    timestamp_end DOUBLE PRECISION,
    question TEXT NOT NULL,
    options_json TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_user_topic ON public.assessment_questions(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_user_fingerprint ON public.assessment_questions(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment ON public.assessment_questions(assessment_id);

CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    difficulty TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    percentage DOUBLE PRECISION NOT NULL,
    questions_json TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    diagnostic_json TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_completed ON public.assessment_attempts(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_topic ON public.assessment_attempts(user_id, topic);

CREATE TABLE IF NOT EXISTS public.assessment_evaluations (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    classification TEXT NOT NULL,
    credit DOUBLE PRECISION NOT NULL,
    feedback TEXT NOT NULL,
    explanation TEXT,
    source_id TEXT,
    chunk_id TEXT,
    source_coordinate TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_evaluations_attempt ON public.assessment_evaluations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_evaluations_user ON public.assessment_evaluations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.assessment_misconceptions (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    evaluation_id TEXT,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    concept TEXT NOT NULL,
    misconception_type TEXT NOT NULL,
    description TEXT NOT NULL,
    student_answer TEXT NOT NULL,
    expected_answer TEXT NOT NULL,
    source_id TEXT,
    chunk_id TEXT,
    source_coordinate TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_misconceptions_user_topic ON public.assessment_misconceptions(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_assessment_misconceptions_attempt ON public.assessment_misconceptions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_misconceptions_concept ON public.assessment_misconceptions(concept);

CREATE TABLE IF NOT EXISTS public.learner_mastery (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT,
    topic TEXT NOT NULL,
    subtopic TEXT,
    mastery_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    attempts INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'unassessed',
    last_assessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learner_mastery_user_topic ON public.learner_mastery(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_learner_mastery_user_status ON public.learner_mastery(user_id, status);

CREATE TABLE IF NOT EXISTS public.learner_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    event_type TEXT NOT NULL,
    source_id TEXT,
    prior_mastery DOUBLE PRECISION NOT NULL,
    posterior_mastery DOUBLE PRECISION NOT NULL,
    is_correct BOOLEAN,
    difficulty TEXT,
    parameters_json TEXT,
    evidence_details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learner_events_user_time ON public.learner_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_learner_events_user_topic ON public.learner_events(user_id, topic);

CREATE TABLE IF NOT EXISTS public.study_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_date TEXT NOT NULL,
    title TEXT NOT NULL,
    target_minutes INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'active',
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_plans_user_date ON public.study_plans(user_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_study_plans_user_status ON public.study_plans(user_id, status);

CREATE TABLE IF NOT EXISTS public.study_plan_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    priority INTEGER NOT NULL,
    priority_score DOUBLE PRECISION NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    reason TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    source_id TEXT,
    chunk_id TEXT,
    source_title TEXT,
    source_coordinate TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_user_plan ON public.study_plan_items(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_user_status ON public.study_plan_items(user_id, status);

CREATE TABLE IF NOT EXISTS public.learning_dags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    course_id TEXT,
    topic TEXT NOT NULL,
    subtopic TEXT,
    source_material_ids TEXT,
    graph_depth TEXT NOT NULL DEFAULT 'Standard',
    learning_goal TEXT NOT NULL DEFAULT 'Concept Mastery',
    nodes_json TEXT NOT NULL,
    edges_json TEXT,
    mastery_states_json TEXT,
    source_references_json TEXT,
    progress_status TEXT NOT NULL DEFAULT 'active',
    progress_percent DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    current_concept_id TEXT,
    next_concept_id TEXT,
    total_concepts INTEGER NOT NULL DEFAULT 0,
    mastered_concepts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_dags_user_updated ON public.learning_dags(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_dags_user_topic ON public.learning_dags(user_id, topic);

-- 3. Row Level Security on Relational Tables
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_misconceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_dags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "resources_isolation_policy" ON public.resources
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "assessment_attempts_isolation_policy" ON public.assessment_attempts
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "learner_mastery_isolation_policy" ON public.learner_mastery
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "learner_events_isolation_policy" ON public.learner_events
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "study_plans_isolation_policy" ON public.study_plans
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "learning_dags_isolation_policy" ON public.learning_dags
        FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 4. PGVECTOR CHUNKS TABLE & COSINE SIMILARITY SEARCH
-- Embedding Model: all-MiniLM-L6-v2 (384 dimensions)
-- Metric: Cosine Distance
-- Index: HNSW (Hierarchical Navigable Small World)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rag_chunks (
    id TEXT PRIMARY KEY,
    chunk_id TEXT UNIQUE NOT NULL,
    document_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tenant_type TEXT NOT NULL DEFAULT 'USER' CHECK (tenant_type IN ('USER', 'SYSTEM_PUBLIC')),
    topic TEXT,
    subtopic TEXT,
    concept TEXT,
    source_type TEXT NOT NULL DEFAULT 'UNKNOWN',
    page_number INTEGER,
    slide_number INTEGER,
    timestamp_start DOUBLE PRECISION,
    timestamp_end DOUBLE PRECISION,
    content_hash TEXT,
    embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    embedding_version TEXT NOT NULL DEFAULT 'v1',
    embedding_dimension INTEGER NOT NULL DEFAULT 384,
    content TEXT NOT NULL,
    metadata_json JSONB,
    embedding vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast metadata and tenant-scoping indexes
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_tenant ON public.rag_chunks(user_id, tenant_type);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_topic ON public.rag_chunks(topic);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON public.rag_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_model_version ON public.rag_chunks(embedding_model, embedding_version);

-- HNSW Vector Index for sub-millisecond cosine nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw 
ON public.rag_chunks 
USING hnsw (embedding vector_cosine_ops);

-- RLS Policy on Vector Chunks: Authenticated User OR System Public
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "rag_chunks_read_isolation" ON public.rag_chunks
        FOR SELECT USING (
            tenant_type = 'SYSTEM_PUBLIC' OR auth.uid()::text = user_id
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "rag_chunks_write_isolation" ON public.rag_chunks
        FOR INSERT WITH CHECK (
            auth.uid()::text = user_id AND tenant_type = 'USER'
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "rag_chunks_delete_isolation" ON public.rag_chunks
        FOR DELETE USING (
            auth.uid()::text = user_id
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Stored Vector Search Function with Strict Multi-Tenant Enforcement
CREATE OR REPLACE FUNCTION match_rag_chunks(
    query_embedding vector(384),
    match_count INT DEFAULT 10,
    filter_user_id TEXT DEFAULT NULL,
    filter_topic TEXT DEFAULT NULL,
    filter_source_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    chunk_id TEXT,
    document_id TEXT,
    source_id TEXT,
    user_id TEXT,
    tenant_type TEXT,
    topic TEXT,
    subtopic TEXT,
    concept TEXT,
    source_type TEXT,
    page_number INTEGER,
    slide_number INTEGER,
    timestamp_start DOUBLE PRECISION,
    timestamp_end DOUBLE PRECISION,
    content TEXT,
    metadata_json JSONB,
    similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rc.id,
        rc.chunk_id,
        rc.document_id,
        rc.source_id,
        rc.user_id,
        rc.tenant_type,
        rc.topic,
        rc.subtopic,
        rc.concept,
        rc.source_type,
        rc.page_number,
        rc.slide_number,
        rc.timestamp_start,
        rc.timestamp_end,
        rc.content,
        rc.metadata_json,
        -- Cosine similarity: 1 - cosine distance
        (1 - (rc.embedding <=> query_embedding)) AS similarity
    FROM public.rag_chunks rc
    WHERE
        -- Strict Multi-Tenant Isolation:
        -- Authenticated user U can access chunks where user_id == U OR tenant_type == 'SYSTEM_PUBLIC'
        (
            (filter_user_id IS NOT NULL AND (rc.user_id = filter_user_id OR rc.tenant_type = 'SYSTEM_PUBLIC'))
            OR (filter_user_id IS NULL AND rc.tenant_type = 'SYSTEM_PUBLIC')
        )
        AND (filter_topic IS NULL OR rc.topic = filter_topic)
        AND (filter_source_ids IS NULL OR rc.source_id = ANY(filter_source_ids) OR rc.document_id = ANY(filter_source_ids))
        AND rc.embedding_model = 'all-MiniLM-L6-v2'
        AND rc.embedding_version = 'v1'
    ORDER BY rc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
