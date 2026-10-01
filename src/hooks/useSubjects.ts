import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  total_topics: number;
  completed_topics: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectData {
  name: string;
  total_topics: number;
}

export interface UpdateSubjectData {
  name?: string;
  total_topics?: number;
  completed_topics?: number;
}

export const useSubjects = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subjects
  const {
    data: subjects = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Subject[];
    },
  });

  // Create subject
  const createSubjectMutation = useMutation({
    mutationFn: async (subjectData: CreateSubjectData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('subjects')
        .insert([{ ...subjectData, user_id: user.user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({
        title: "Subject Added",
        description: "New subject has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add subject.",
        variant: "destructive",
      });
    },
  });

  // Update subject
  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateSubjectData }) => {
      const { data, error } = await supabase
        .from('subjects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({
        title: "Subject Updated",
        description: "Subject has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subject.",
        variant: "destructive",
      });
    },
  });

  // Delete subject
  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({
        title: "Subject Deleted",
        description: "Subject has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subject.",
        variant: "destructive",
      });
    },
  });

  return {
    subjects,
    isLoading,
    error,
    createSubject: createSubjectMutation.mutate,
    updateSubject: updateSubjectMutation.mutate,
    deleteSubject: deleteSubjectMutation.mutate,
    isCreating: createSubjectMutation.isPending,
    isUpdating: updateSubjectMutation.isPending,
    isDeleting: deleteSubjectMutation.isPending,
  };
};