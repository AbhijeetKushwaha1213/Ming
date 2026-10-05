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
  subject?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const useStudyMaterials = (type?: MaterialType) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch study materials for the current user
  const effectiveUserId = user?.user_id || user?.id || 'guest_user';

  const {
    data: materials = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['study_materials', effectiveUserId, type],
    queryFn: async () => {
      const localList = localStore.getStudyMaterials(type);

      if (isLocalMode() || !user?.user_id) {
        return localList;
      }

      try {
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
          console.warn('Supabase fetch study materials notice, falling back to local:', error);
          return localList;
        }

        const remoteList = (data || []) as StudyMaterial[];
        const seenTitleType = new Set<string>();
        const mergedList: StudyMaterial[] = [];

        // 1. Remote materials take precedence
        for (const rem of remoteList) {
          const key = `${(rem.title || '').trim().toLowerCase()}::${(rem.type || '').toLowerCase()}`;
          if (!seenTitleType.has(key)) {
            seenTitleType.add(key);
            mergedList.push(rem);
          }
        }

        // 2. Add local materials only if not already in remote
        for (const loc of localList) {
          const key = `${(loc.title || '').trim().toLowerCase()}::${(loc.type || '').toLowerCase()}`;
          if (!seenTitleType.has(key) && !mergedList.some(r => r.id === loc.id)) {
            seenTitleType.add(key);
            mergedList.push(loc);
          } else {
            // Already synced to remote, delete local duplicate
            localStore.deleteStudyMaterial(loc.id);
          }
        }

        return mergedList.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      } catch (err) {
        console.warn('Error fetching remote study materials:', err);
        return localList;
      }
    },
    enabled: true,
  });

  // Create new study material
  const createMaterial = useMutation({
    mutationFn: async (newMaterial: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      console.log('Creating study material:', newMaterial);
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
            localStore.deleteStudyMaterial(savedLocal.id);
            return data;
          }
        } catch (syncErr) {
          console.warn('Supabase sync notice, saved locally:', syncErr);
        }
      }

      return savedLocal;
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
      const updatedLocal = localStore.updateStudyMaterial(id, updates);

      if (!isLocalMode() && user?.user_id) {
        try {
          const { data, error } = await supabase
            .from('study_materials')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

          if (!error && data) return data;
        } catch (syncErr) {
          console.warn('Supabase update notice, updated locally:', syncErr);
        }
      }

      return updatedLocal;
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
      const savedLocalList = localStore.saveMultipleStudyMaterials(materials);

      if (!isLocalMode() && user?.user_id) {
        try {
          const materialsWithUserId = materials.map(material => ({
            ...material,
            user_id: user.user_id,
          }));

          const { data, error } = await supabase
            .from('study_materials')
            .insert(materialsWithUserId)
            .select();

          if (!error && data) {
            savedLocalList.forEach(m => localStore.deleteStudyMaterial(m.id));
            return data;
          }
        } catch (syncErr) {
          console.warn('Supabase bulk sync notice, saved locally:', syncErr);
        }
      }

      return savedLocalList;
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