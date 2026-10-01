-- Create study_materials table for different types of generated content
CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flashcards', 'mindmaps', 'quizzes', 'diagrams', 'notes')),
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can create their own study materials" 
ON public.study_materials 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own study materials" 
ON public.study_materials 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own study materials" 
ON public.study_materials 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study materials" 
ON public.study_materials 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_study_materials_updated_at
BEFORE UPDATE ON public.study_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_study_materials_user_type ON public.study_materials(user_id, type);
CREATE INDEX idx_study_materials_created_at ON public.study_materials(created_at DESC);