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

export const useFlashcards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all flashcards for the current user
  const {
    data: flashcards = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['flashcards', user?.user_id],
    queryFn: async () => {
      if (!user?.user_id) return [];
      
      if (isLocalMode()) {
        return localStore.getFlashcards();
      }

      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching flashcards:', error);
        throw error;
      }

      return data as Flashcard[];
    },
    enabled: !!user?.user_id,
  });

  // Fetch all study materials for the current user
  const {
    data: studyMaterials = [],
    isLoading: isLoadingMaterials,
    error: materialsError
  } = useQuery({
    queryKey: ['study_materials', user?.user_id],
    queryFn: async () => {
      if (!user?.user_id) return [];

      if (isLocalMode()) {
        return localStore.getStudyMaterials();
      }
      
      const { data, error } = await supabase
        .from('study_materials')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching study materials:', error);
        throw error;
      }

      return data as StudyMaterial[];
    },
    enabled: !!user?.user_id,
  });

  // Filter study materials by type
  const getStudyMaterialsByType = (type: string) => {
    return studyMaterials.filter(material => material.type === type);
  };

  // Create new flashcard
  const createFlashcard = useMutation({
    mutationFn: async (newFlashcard: Omit<Flashcard, 'id' | 'created_at' | 'updated_at' | 'mastery_level' | 'review_count' | 'last_reviewed' | 'next_review'>) => {
      if (!user?.user_id) throw new Error('User not authenticated');

      console.log('Creating flashcard:', newFlashcard);

      if (isLocalMode()) {
        return localStore.saveFlashcard(newFlashcard);
      }

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

      if (error) {
        console.error('Error creating flashcard:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      toast({
        title: "Flashcard Created",
        description: "Your new flashcard has been added successfully.",
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
      if (!user?.user_id) throw new Error('User not authenticated');

      console.log('Creating study material:', newMaterial);

      if (isLocalMode()) {
        return localStore.saveStudyMaterial(newMaterial);
      }

      const { data, error } = await supabase
        .from('study_materials')
        .insert([{
          ...newMaterial,
          user_id: user.user_id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating study material:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      toast({
        title: "Content Saved",
        description: `Your ${data.type} has been saved successfully.`,
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
      if (isLocalMode()) {
        return localStore.updateFlashcard(id, updates);
      }

      const { data, error } = await supabase
        .from('flashcards')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      if (isLocalMode()) {
        return localStore.deleteFlashcard(id);
      }

      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
      if (isLocalMode()) {
        return localStore.deleteStudyMaterial(id);
      }

      const { error } = await supabase
        .from('study_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
