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
      const local = (localStore.getSkills() || []) as Skill[];
      if (isLocalMode()) {
        return local;
      }

      try {
        const cloudFetch = supabase
          .from('user_skills')
          .select('*')
          .order('created_at', { ascending: false });

        const timeoutFetch = new Promise<{ data: any; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Timeout fetching skills') }), 1200)
        );

        const { data, error } = await Promise.race([cloudFetch, timeoutFetch]);

        if (error || !data) {
          return local;
        }

        if (local.length > 0) {
          const cloudIds = new Set((data || []).map((s: any) => s.id));
          const uniqueLocal = local.filter(s => !cloudIds.has(s.id));
          return [...(data || []), ...uniqueLocal] as Skill[];
        }
        return (data || []) as Skill[];
      } catch (err) {
        console.warn('Supabase fetch skills failed, using localStore fallback:', err);
        return local;
      }
    },
  });

  // Create skill
  const createSkillMutation = useMutation({
    mutationFn: async (skillData: CreateSkillData) => {
      // 1. Immediately save to localStore
      const localResult = localStore.saveSkill(skillData);

      // 2. Optimistically update React Query cache immediately
      queryClient.setQueryData<Skill[]>(['skills'], (old = []) => {
        const filtered = (old || []).filter(s => s.id !== localResult.id);
        return [localResult as Skill, ...filtered];
      });

      // 3. Background sync to Supabase without blocking UI
      if (!isLocalMode()) {
        (async () => {
          try {
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData?.user?.id;
            if (userId) {
              await supabase
                .from('user_skills')
                .insert([{ 
                  user_id: userId,
                  skill: skillData.skill,
                  category: skillData.category,
                  progress: skillData.progress || 0
                }]);
            }
          } catch (e) {
            console.warn('Background Supabase createSkill note:', e);
          }
        })();
      }

      return localResult as Skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast({
        title: "Skill Added",
        description: "New skill pathway created successfully.",
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
      const localResult = localStore.updateSkill(id, updates);

      queryClient.setQueryData<Skill[]>(['skills'], (old = []) => {
        return (old || []).map(s => s.id === id ? { ...s, ...updates } : s);
      });

      if (!isLocalMode() && !id.startsWith('local-')) {
        (async () => {
          try {
            await supabase
              .from('user_skills')
              .update(updates)
              .eq('id', id);
          } catch (e) {
            console.warn('Background Supabase updateSkill note:', e);
          }
        })();
      }

      return localResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
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
      localStore.deleteSkill(id);

      queryClient.setQueryData<Skill[]>(['skills'], (old = []) => {
        return (old || []).filter(s => s.id !== id);
      });

      if (!isLocalMode() && !id.startsWith('local-')) {
        (async () => {
          try {
            await supabase
              .from('user_skills')
              .delete()
              .eq('id', id);
          } catch (e) {
            console.warn('Background Supabase deleteSkill note:', e);
          }
        })();
      }
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
    createSkillAsync: createSkillMutation.mutateAsync,
    updateSkill: updateSkillMutation.mutate,
    deleteSkill: deleteSkillMutation.mutate,
    isCreating: createSkillMutation.isPending,
    isUpdating: updateSkillMutation.isPending,
    isDeleting: deleteSkillMutation.isPending,
  };
};