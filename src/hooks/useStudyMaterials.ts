import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isLocalMode } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { localStore } from '@/utils/localStore';

export type MaterialType = 'flashcards' | 'mindmaps' | 'quizzes' | 'diagrams' | 'notes';

export interface StudyMaterial {
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  type: MaterialType;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  source?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const useStudyMaterials = (type?: MaterialType) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch study materials for the current user
  const {
    data: materials = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['study_materials', user?.user_id, type],
    queryFn: async () => {
      if (!user?.user_id) return [];
      
      if (isLocalMode()) {
        return localStore.getStudyMaterials(type);
      }

      let query = supabase
        .from('study_materials')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching study materials:', error);
        throw error;
      }

      return data as StudyMaterial[];
    },
    enabled: !!user?.user_id,
  });

  // Create new study material
  const createMaterial = useMutation({
    mutationFn: async (newMaterial: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
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
      toast({
        title: "Material Saved Successfully! 📚",
        description: `Your ${data.type} has been saved to your library.`,
      });
    },
    onError: (error) => {
      console.error('Error creating study material:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save study material. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update study material
  const updateMaterial = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StudyMaterial> }) => {
      if (isLocalMode()) {
        return localStore.updateStudyMaterial(id, updates);
      }

      const { data, error } = await supabase
        .from('study_materials')
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
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      toast({
        title: "Material Updated",
        description: "Your study material has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating study material:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update study material. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete study material
  const deleteMaterial = useMutation({
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
        title: "Material Deleted",
        description: "Your study material has been removed successfully.",
      });
    },
    onError: (error) => {
      console.error('Error deleting study material:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete study material. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Bulk create materials
  const createMultipleMaterials = useMutation({
    mutationFn: async (materials: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at' | 'user_id'>[]) => {
      if (!user?.user_id) throw new Error('User not authenticated');

      if (isLocalMode()) {
        return localStore.saveMultipleStudyMaterials(materials);
      }

      const materialsWithUserId = materials.map(material => ({
        ...material,
        user_id: user.user_id,
      }));

      const { data, error } = await supabase
        .from('study_materials')
        .insert(materialsWithUserId)
        .select();

      if (error) {
        console.error('Error creating study materials:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['study_materials'] });
      toast({
        title: "Materials Saved Successfully! 🎉",
        description: `Successfully saved ${data.length} study materials to your library.`,
      });
    },
    onError: (error) => {
      console.error('Error creating study materials:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save some study materials. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    materials,
    isLoading,
    error,
    createMaterial: createMaterial.mutate,
    updateMaterial: updateMaterial.mutate,
    deleteMaterial: deleteMaterial.mutate,
    createMultipleMaterials: createMultipleMaterials.mutate,
    isCreating: createMaterial.isPending,
    isUpdating: updateMaterial.isPending,
    isDeleting: deleteMaterial.isPending,
    isBulkCreating: createMultipleMaterials.isPending,
  };
};