-- Add missing columns to user_profiles table for onboarding data
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS subjects JSONB,
ADD COLUMN IF NOT EXISTS study_preference JSONB,
ADD COLUMN IF NOT EXISTS motivation JSONB, 
ADD COLUMN IF NOT EXISTS daily_hours TEXT,
ADD COLUMN IF NOT EXISTS review_modes JSONB,
ADD COLUMN IF NOT EXISTS target_year TEXT,
ADD COLUMN IF NOT EXISTS age_range TEXT,
ADD COLUMN IF NOT EXISTS course TEXT,
ADD COLUMN IF NOT EXISTS study_reminder TEXT;