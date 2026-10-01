import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isLocalMode } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { localStore } from '@/utils/localStore';

export interface SyllabusTopic {
  id: string;
  topic: string;
  completed: boolean;
  dayNumber: number;
}

export interface SkillPreference {
  pace: 'slow' | 'medium' | 'fast';
  hoursPerDay: number;
}

export interface ParsedSkillDetails {
  categoryName: string;
  preference: SkillPreference;
  syllabus: SyllabusTopic[];
  unlockedDays: number;
}

export interface Skill {
  id: string;
  user_id: string;
  skill: string;
  progress: number;
  category: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateSkillData {
  skill: string;
  category: string;
  progress?: number;
}

export interface UpdateSkillData {
  skill?: string;
  progress?: number;
  category?: string;
}

export const getSkillCategory = (categoryField: string): string => {
  try {
    if (categoryField && categoryField.startsWith('{')) {
      const parsed = JSON.parse(categoryField);
      return parsed.categoryName || 'General';
    }
  } catch (e) {}
  return categoryField || 'General';
};

export const parseSkillDetails = (categoryField: string): ParsedSkillDetails => {
  try {
    if (categoryField && categoryField.startsWith('{')) {
      const parsed = JSON.parse(categoryField);
      return {
        categoryName: parsed.categoryName || 'General',
        preference: parsed.preference || { pace: 'medium', hoursPerDay: 2 },
        syllabus: parsed.syllabus || [],
        unlockedDays: parsed.unlockedDays || 0
      };
    }
  } catch (e) {}
  
  return {
    categoryName: categoryField || 'General',
    preference: { pace: 'medium', hoursPerDay: 2 },
    syllabus: [],
    unlockedDays: 0
  };
};

export const useSkills = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch skills
  const {
    data: skills = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      if (isLocalMode()) {
        return localStore.getSkills() as Skill[];
      }

      const { data, error } = await supabase
        .from('user_skills')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Skill[];
    },
  });

  // Create skill
  const createSkillMutation = useMutation({
    mutationFn: async (skillData: CreateSkillData) => {
      if (isLocalMode()) {
        return localStore.saveSkill(skillData);
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_skills')
        .insert([{ 
          user_id: user.user.id,
          skill: skillData.skill,
          category: skillData.category,
          progress: skillData.progress || 0
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({
        title: "Skill Added",
        description: "New skill has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add skill.",
        variant: "destructive",
      });
    },
  });

  // Update skill
  const updateSkillMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateSkillData }) => {
      if (isLocalMode()) {
        return localStore.updateSkill(id, updates);
      }

      const { data, error } = await supabase
        .from('user_skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({
        title: "Skill Updated",
        description: "Skill has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update skill.",
        variant: "destructive",
      });
    },
  });

  // Delete skill
  const deleteSkillMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isLocalMode()) {
        return localStore.deleteSkill(id);
      }

      const { error } = await supabase
        .from('user_skills')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({
        title: "Skill Deleted",
        description: "Skill has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete skill.",
        variant: "destructive",
      });
    },
  });

  return {
    skills,
    isLoading,
    error,
    createSkill: createSkillMutation.mutate,
    updateSkill: updateSkillMutation.mutate,
    deleteSkill: deleteSkillMutation.mutate,
    isCreating: createSkillMutation.isPending,
    isUpdating: updateSkillMutation.isPending,
    isDeleting: deleteSkillMutation.isPending,
  };
};