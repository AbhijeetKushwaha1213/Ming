
-- Create projects table for user projects (if not exists)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  technologies TEXT[],
  github_url TEXT,
  demo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_skills table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  skill_name TEXT NOT NULL,
  proficiency_level INTEGER DEFAULT 1 CHECK (proficiency_level BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_name)
);

-- Create notifications table (if not exists)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for projects (only if table was created)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'projects' AND schemaname = 'public') THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
    DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
    DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
    DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
    
    CREATE POLICY "Users can view their own projects" 
      ON public.projects 
      FOR SELECT 
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own projects" 
      ON public.projects 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own projects" 
      ON public.projects 
      FOR UPDATE 
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own projects" 
      ON public.projects 
      FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add RLS policies for user_skills
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_skills' AND schemaname = 'public') THEN
    ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own skills" ON public.user_skills;
    DROP POLICY IF EXISTS "Users can create their own skills" ON public.user_skills;
    DROP POLICY IF EXISTS "Users can update their own skills" ON public.user_skills;
    DROP POLICY IF EXISTS "Users can delete their own skills" ON public.user_skills;
    
    CREATE POLICY "Users can view their own skills" 
      ON public.user_skills 
      FOR SELECT 
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own skills" 
      ON public.user_skills 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own skills" 
      ON public.user_skills 
      FOR UPDATE 
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own skills" 
      ON public.user_skills 
      FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add RLS policies for notifications
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notifications' AND schemaname = 'public') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can create their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    
    CREATE POLICY "Users can view their own notifications" 
      ON public.notifications 
      FOR SELECT 
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own notifications" 
      ON public.notifications 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own notifications" 
      ON public.notifications 
      FOR UPDATE 
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own notifications" 
      ON public.notifications 
      FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON public.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Add trigger to update updated_at timestamp for projects (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
    CREATE TRIGGER update_projects_updated_at
      BEFORE UPDATE ON public.projects
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
