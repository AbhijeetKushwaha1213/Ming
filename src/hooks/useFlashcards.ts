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
  subject?: string;
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
  subject?: string;
  created_at: string;
  updated_at: string;
}

// Helper to migrate legacy items saved in studymate_vault_resources_* to local materials
const getMergedLocalStudyMaterials = (userId?: string): StudyMaterial[] => {
  let localList = localStore.getStudyMaterials();
  const existingIds = new Set(localList.map(m => m.id));
  let modified = false;

  // 1. Purge ghost notes that were shadow copies of diagrams, mindmaps, or quizzes
  const isGhostNote = (m: StudyMaterial): boolean => {
    if (m.type !== 'notes') return false;
    const summary = (m.content?.summary || (typeof m.content === 'string' ? m.content : '')).toLowerCase();
    const isShadow = /ai generated (diagram|mindmap|quiz|flashcard)/i.test(summary);
    if (!isShadow) return false;
    const normTitle = (m.title || '').trim().toLowerCase();
    return localList.some(other => other.id !== m.id && (other.title || '').trim().toLowerCase() === normTitle && other.type !== 'notes');
  };

  const initialCount = localList.length;
  localList = localList.filter(m => !isGhostNote(m));
  if (localList.length !== initialCount) {
    modified = true;
  }

  // 2. Deduplicate local list by title::type
  const dedupedLocal: StudyMaterial[] = [];
  const seenLocal = new Set<string>();
  for (const item of localList) {
    const key = `${(item.title || '').trim().toLowerCase()}::${(item.type || '').toLowerCase()}`;
    if (!seenLocal.has(key)) {
      seenLocal.add(key);
      dedupedLocal.push(item);
    } else {
      modified = true;
    }
  }
  localList = dedupedLocal;

  // 3. Check legacy keys (only migrate genuine standalone items, never shadow copies)
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
            const desc = (item.description || '').toLowerCase();
            // Discard any AI generator shadow copies
            if (/ai generated (diagram|mindmap|quiz|flashcard)/i.test(desc)) {
              continue;
            }

            const rawType = (item.type || '').toLowerCase();
            const mappedType = rawType === 'flashcard' ? 'flashcards' :
                              rawType === 'quiz' ? 'quizzes' :
                              rawType === 'mindmap' ? 'mindmaps' :
                              rawType === 'diagram' ? 'diagrams' : 'notes';
            const titleTypeKey = `${(item.title || '').trim().toLowerCase()}::${mappedType}`;

            if (!existingIds.has(mappedId) && !seenLocal.has(titleTypeKey)) {
              existingIds.add(mappedId);
              seenLocal.add(titleTypeKey);
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
  } catch (err) {
    console.warn('Migration error in getMergedLocalStudyMaterials:', err);
  }

  if (modified) {
    localStorage.setItem('studymate-local-materials', JSON.stringify(localList));
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
    initialData: () => localStore.getFlashcards(),
    queryFn: async () => {
      const localCards = localStore.getFlashcards();

      if (isLocalMode() || !user?.user_id) {
        return localCards;
      }

      try {
        const fetchPromise = supabase
          .from('flashcards')
          .select('*')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false });

        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Flashcards remote fetch timeout') }), 2500)
        );

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          console.warn('Supabase fetch flashcards notice (using local fallback):', error);
          return localCards;
        }

        const remoteCards = (data || []) as Flashcard[];
        const seenQuestion = new Set<string>();
        const mergedList: Flashcard[] = [];

        remoteCards.forEach(fc => {
          const key = (fc.question || fc.title || '').trim().toLowerCase();
          if (!seenQuestion.has(key)) {
            seenQuestion.add(key);
            mergedList.push(fc);
          }
        });

        localCards.forEach(fc => {
          const key = (fc.question || fc.title || '').trim().toLowerCase();
          if (!seenQuestion.has(key) && !mergedList.some(r => r.id === fc.id)) {
            seenQuestion.add(key);
            mergedList.push(fc);
          } else {
            localStore.deleteFlashcard(fc.id);
          }
        });

        return mergedList.sort(
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
    initialData: () => getMergedLocalStudyMaterials(effectiveUserId),
    queryFn: async () => {
      const localMaterials = getMergedLocalStudyMaterials(effectiveUserId);

      if (isLocalMode() || !user?.user_id) {
        return localMaterials;
      }

      try {
        const fetchPromise = supabase
          .from('study_materials')
          .select('*')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false });

        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Study materials remote fetch timeout') }), 2500)
        );

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          console.warn('Supabase fetch study materials notice (using local fallback):', error);
          return localMaterials;
        }

        const remoteMaterials = (data || []) as StudyMaterial[];
        const seenTitleType = new Set<string>();
        const mergedList: StudyMaterial[] = [];

        // 1. Remote materials take precedence
        for (const rem of remoteMaterials) {
          const key = `${(rem.title || '').trim().toLowerCase()}::${(rem.type || '').toLowerCase()}`;
          if (!seenTitleType.has(key)) {
            seenTitleType.add(key);
            mergedList.push(rem);
          }
        }

        // 2. Add local materials only if not already present in remote
        for (const loc of localMaterials) {
          const key = `${(loc.title || '').trim().toLowerCase()}::${(loc.type || '').toLowerCase()}`;
          if (!seenTitleType.has(key) && !mergedList.some(r => r.id === loc.id)) {
            seenTitleType.add(key);
            mergedList.push(loc);
          } else {
            // Already synced to remote, delete orphan local copy
            localStore.deleteStudyMaterial(loc.id);
          }
        }

        // 3. Purge any ghost notes if a rich version (diagram, mindmap, quiz) exists with the same title
        const filteredList = mergedList.filter(item => {
          if (item.type !== 'notes') return true;
          const summary = (item.content?.summary || (typeof item.content === 'string' ? item.content : '')).toLowerCase();
          const isGhost = /ai generated (diagram|mindmap|quiz|flashcard)/i.test(summary);
          if (!isGhost) return true;
          const normTitle = (item.title || '').trim().toLowerCase();
          const hasRichVersion = mergedList.some(other => other.id !== item.id && (other.title || '').trim().toLowerCase() === normTitle && other.type !== 'notes');
          return !hasRichVersion;
        });

        return filteredList.sort(
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
            // Remove local placeholder since remote Supabase record was created
            localStore.deleteFlashcard(savedLocal.id);
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
            // Remove local placeholder since remote Supabase record was created
            localStore.deleteStudyMaterial(savedLocal.id);
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

      // Clean up matching items from legacy vault keys
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('studymate_vault_resources_'));
        for (const k of keys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((item: any) => item.id !== id && !item.id?.includes(id));
              if (filtered.length !== parsed.length) {
                localStorage.setItem(k, JSON.stringify(filtered));
              }
            }
          }
        }
      } catch (err) {
        // ignore
      }

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
