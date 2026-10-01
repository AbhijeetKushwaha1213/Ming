-- Fix remaining security issues

-- Enable RLS on user_goals table if it exists and add proper policies
ALTER TABLE IF EXISTS public.user_goals ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for user_goals if they don't exist
DO $$
BEGIN
    -- Check if policies exist before creating them
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_goals' AND policyname = 'Users can view their own goals') THEN
        CREATE POLICY "Users can view their own goals" 
        ON public.user_goals 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_goals' AND policyname = 'Users can create their own goals') THEN
        CREATE POLICY "Users can create their own goals" 
        ON public.user_goals 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_goals' AND policyname = 'Users can update their own goals') THEN
        CREATE POLICY "Users can update their own goals" 
        ON public.user_goals 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_goals' AND policyname = 'Users can delete their own goals') THEN
        CREATE POLICY "Users can delete their own goals" 
        ON public.user_goals 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Fix remaining database functions with missing search_path
-- These functions were detected by the linter as having mutable search_path

-- Fix auth trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, name, email, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    'exam'
  );
  RETURN NEW;
END;
$$;

-- Create secure update functions for all tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Add updated_at triggers to tables that need them
DO $$
BEGIN
    -- Add trigger to user_goals if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_goals_updated_at') THEN
        CREATE TRIGGER update_user_goals_updated_at
        BEFORE UPDATE ON public.user_goals
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;