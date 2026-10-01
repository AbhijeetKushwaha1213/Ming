-- Create user_projects table for college dashboard
CREATE TABLE IF NOT EXISTS public.user_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'coding',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text NOT NULL DEFAULT 'active',
  deadline text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_achievements table for achievement tracking
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon text DEFAULT 'trophy',
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  category text DEFAULT 'general'
);

-- Create user_stats table for personal statistics
CREATE TABLE IF NOT EXISTS public.user_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cgpa numeric(3,2),
  monthly_earnings integer DEFAULT 0,
  active_clients integer DEFAULT 0,
  projects_completed integer DEFAULT 0,
  rating numeric(2,1) DEFAULT 0.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Modify existing user_skills table to match our needs
ALTER TABLE public.user_skills 
ADD COLUMN IF NOT EXISTS skill text,
ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
ADD COLUMN IF NOT EXISTS category text DEFAULT 'General',
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Update skill column from skill_name if it exists (check if column exists first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_skills' AND column_name = 'skill_name') THEN
    UPDATE public.user_skills SET skill = skill_name WHERE skill IS NULL AND skill_name IS NOT NULL;
  END IF;
END $$;

-- Update progress column from proficiency_level if it exists (check if column exists first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_skills' AND column_name = 'proficiency_level') THEN
    UPDATE public.user_skills SET progress = COALESCE(proficiency_level, 0) WHERE progress IS NULL;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_projects
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.user_projects;
CREATE POLICY "Users can manage their own projects" ON public.user_projects
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for user_achievements
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.user_achievements;
CREATE POLICY "Users can view their own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create achievements" ON public.user_achievements;
CREATE POLICY "System can create achievements" ON public.user_achievements
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for user_stats
DROP POLICY IF EXISTS "Users can manage their own stats" ON public.user_stats;
CREATE POLICY "Users can manage their own stats" ON public.user_stats
  FOR ALL USING (auth.uid() = user_id);

-- Create update triggers
DROP TRIGGER IF EXISTS update_user_projects_updated_at ON public.user_projects;
CREATE TRIGGER update_user_projects_updated_at
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_updated_at ON public.user_stats;
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_skills_updated_at ON public.user_skills;
CREATE TRIGGER update_user_skills_updated_at
  BEFORE UPDATE ON public.user_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();