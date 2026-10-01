
-- Add missing columns to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN branch text,
ADD COLUMN exam_date date;
