import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isLocalMode } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { localStore } from '@/utils/localStore';

export interface Flashcard {
  id: string;
  title: string;
  question: string;
  answer: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  mastery_level: number;
  review_count: number;
  last_reviewed: string | null;
  next_review: string;
  created_at: string;
  updated_at: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  type: 'flashcards' | 'mindmaps' | 'quizzes' | 'diagrams' | 'notes';
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
}

// Helper to migrate legacy items saved in studymate_vault_resources_* to local materials
const getMergedLocalStudyMaterials = (userId?: string): StudyMaterial[] => {
  const localList = localStore.getStudyMaterials();
  const existingIds = new Set(localList.map(m => m.id));
  let modified = false;

  try {
    const keysToCheck = [
      `studymate_vault_resources_${userId || 'guest'}`,
      'studymate_vault_resources_guest',
      'studymate_vault_resources_local-dev-user-id'
    ];
    for (const key of keysToCheck) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const mappedId = item.id || `migrated-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            if (!existingIds.has(mappedId)) {
              existingIds.add(mappedId);
              const rawType = (item.type || '').toLowerCase();
              const mappedType = rawType === 'flashcard' ? 'flashcards' :
                                rawType === 'quiz' ? 'quizzes' :
                                rawType === 'mindmap' ? 'mindmaps' :
                                rawType === 'diagram' ? 'diagrams' : 'notes';
              const migrated: StudyMaterial = {
                id: mappedId,
                title: item.title || 'Study Material',
                content: {
                  summary: item.description || (typeof item.noteContent === 'string' ? item.noteContent.slice(0, 200) : ''),
                  content: item.noteContent || item.content || '',
                  key_points: [{ heading: 'Overview', content: item.noteContent || '' }],
                  quick_facts: ['Saved from AI Generator']
                },
                type: mappedType,
                topic: item.folder || 'General',
                difficulty: 'medium',
                tags: item.tags || ['notes', 'AI-Generated'],
                source: 'AI Generator',
                created_at: item.createdAt || new Date().toISOString(),
                updated_at: item.updatedAt || new Date().toISOString(),
              };
              localList.unshift(migrated);
              modified = true;
            }
          }
        }
      }
    }
    if (modified) {
      localStorage.setItem('studymate-local-materials', JSON.stringify(localList));
    }
  } catch (err) {
    console.warn('Migration error in getMergedLocalStudyMaterials:', err);
  }

  return localList;
};

export const useFlashcards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const effectiveUserId = user?.user_id || user?.id || 'guest_user';

  // Fetch all flashcards for the current user (hybrid local + remote)
  const {
    data: flashcards = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['flashcards', effectiveUserId],
    queryFn: async () => {
      const localCards = localStore.getFlashcards();

      if (isLocalMode() || !user?.user_id) {
        return localCards;
      }

      try {
        const { data, error } = await supabase
          .from('flashcards')
          .select('*')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Supabase fetch flashcards notice (using local fallback):', error);
          return localCards;
        }

        const remoteCards = (data || []) as Flashcard[];
        const mergedMap = new Map<string, Flashcard>();
        remoteCards.forEach(fc => mergedMap.set(fc.id, fc));
        localCards.forEach(fc => {
          if (!mergedMap.has(fc.id)) {
            mergedMap.set(fc.id, fc);
          }
        });

        return Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      } catch (err) {
        console.warn('Error fetching remote flashcards, using local store:', err);
        return localCards;
      }
    },
    enabled: true,
  });

  // Fetch all study materials for the current user (hybrid local + remote)
  const {
    data: studyMaterials = [],
    isLoading: isLoadingMaterials,
    error: materialsError
  } = useQuery({
    queryKey: ['study_materials', effectiveUserId],
    queryFn: async () => {
      const localMaterials = getMergedLocalStudyMaterials(effectiveUserId);

      if (isLocalMode() || !user?.user_id) {
        return localMaterials;
      }

      try {
        const { data, error } = await supabase
          .from('study_materials')
          .select('*')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Supabase fetch study materials notice (using local fallback):', error);
          return localMaterials;
        }

        const remoteMaterials = (data || []) as StudyMaterial[];
        const mergedMap = new Map<string, StudyMaterial>();
        remoteMaterials.forEach(m => mergedMap.set(m.id, m));
        localMaterials.forEach(m => {
          if (!mergedMap.has(m.id)) {
            mergedMap.set(m.id, m);
          }
        });

        return Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      } catch (err) {
        console.warn('Error fetching remote study materials, using local store:', err);
        return localMaterials;
      }
    },
    enabled: true,
  });

  // Filter study materials by type
  const getStudyMaterialsByType = (type: string) => {
    return studyMaterials.filter(material => material.type === type);
  };

  // Create new flashcard
  const createFlashcard = useMutation({
    mutationFn: async (newFlashcard: Omit<Flashcard, 'id' | 'created_at' | 'updated_at' | 'mastery_level' | 'review_count' | 'last_reviewed' | 'next_review'>) => {
      console.log('Creating flashcard:', newFlashcard);
      // Always save to local store first
      const savedLocal = localStore.saveFlashcard(newFlashcard);

      if (!isLocalMode() && user?.user_id) {
        try {
          const { data, error } = await supabase
            .from('flashcards')
            .insert([{
              ...newFlashcard,
              user_id: user.user_id,
              mastery_level: 0,
              review_count: 0,
              last_reviewed: null,
              next_review: new Date().toISOString(),
            }])
            .select()
            .single();

          if (!error && data) {
            return data;
          }
        } catch (syncErr) {
          console.warn('Supabase flashcard sync notice, saved locally:', syncErr);
        }
      }

      return savedLocal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      toast({
        title: "Flashcard Created",
        description: "Your new flashcard has been saved to your vault.",
      });
    },
    onError: (error) => {
      console.error('Error creating flashcard:', error);
      toast({
        title: "Error",
        description: "Failed to create flashcard. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create new study material
  const createStudyMaterial = useMutation({
    mutationFn: async (newMaterial: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Creating study material:', newMaterial);
      // Always save to local store first
      const savedLocal = localStore.saveStudyMaterial(newMaterial);

      if (!isLocalMode() && user?.user_id) {
        try {
          const { data, error } = await supabase
            .from('study_materials')
            .insert([{
              ...newMaterial,
              user_id: user.user_id,
            }])
            .select()
            .single();

          if (!error && data) {
            return data;
          }
        } catch (syncErr) {
          console.warn('Supabase study material sync notice, saved locally:', syncErr);
        }
      }

      return savedLocal;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      toast({
        title: "Content Saved to Vault! 🔒",
        description: `Your ${data.type || 'study material'} has been saved to your Vault.`,
      });
    },
    onError: (error) => {
      console.error('Error creating study material:', error);
      toast({
        title: "Error",
        description: "Failed to save content. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update flashcard
  const updateFlashcard = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Flashcard> }) => {
      const localUpdated = localStore.updateFlashcard(id, updates);

      if (!isLocalMode() && user?.user_id) {
        try {
          const { data, error } = await supabase
            .from('flashcards')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

          if (!error && data) return data;
        } catch (err) {
          console.warn('Error updating flashcard in Supabase:', err);
        }
      }

      return localUpdated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      toast({
        title: "Flashcard Updated",
        description: "Your flashcard has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating flashcard:', error);
      toast({
        title: "Error",
        description: "Failed to update flashcard. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete flashcard
  const deleteFlashcard = useMutation({
    mutationFn: async (id: string) => {
      localStore.deleteFlashcard(id);

      if (!isLocalMode() && user?.user_id) {
        try {
          await supabase
            .from('flashcards')
            .delete()
            .eq('id', id);
        } catch (err) {
          console.warn('Error deleting flashcard from Supabase:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      toast({
        title: "Flashcard Deleted",
        description: "Your flashcard has been removed successfully.",
      });
    },
    onError: (error) => {
      console.error('Error deleting flashcard:', error);
      toast({
        title: "Error",
        description: "Failed to delete flashcard. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete study material
  const deleteStudyMaterial = useMutation({
    mutationFn: async (id: string) => {
      localStore.deleteStudyMaterial(id);

      if (!isLocalMode() && user?.user_id) {
        try {
          await supabase
            .from('study_materials')
            .delete()
            .eq('id', id);
        } catch (err) {
          console.warn('Error deleting study material from Supabase:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      toast({
        title: "Content Deleted",
        description: "Your content has been removed successfully.",
      });
    },
    onError: (error) => {
      console.error('Error deleting study material:', error);
      toast({
        title: "Error",
        description: "Failed to delete content. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    flashcards,
    studyMaterials,
    getStudyMaterialsByType,
    isLoading: isLoading || isLoadingMaterials,
    error: error || materialsError,
    createFlashcard: createFlashcard.mutate,
    createStudyMaterial: createStudyMaterial.mutate,
    updateFlashcard: updateFlashcard.mutate,
    deleteFlashcard: deleteFlashcard.mutate,
    deleteStudyMaterial: deleteStudyMaterial.mutate,
    isCreating: createFlashcard.isPending || createStudyMaterial.isPending,
    isUpdating: updateFlashcard.isPending,
    isDeleting: deleteFlashcard.isPending || deleteStudyMaterial.isPending,
  };
};
