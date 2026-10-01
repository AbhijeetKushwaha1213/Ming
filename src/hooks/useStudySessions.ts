
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface StudySession {
  id: string;
  user_id: string;
  session_type: string;
  duration_minutes: number;
  topics_covered: string[];
  flashcards_reviewed: number;
  correct_answers: number;
  session_date: string;
  created_at: string;
}

export const useStudySessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all study sessions for the current user
  const {
    data: studySessions = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['studySessions', user?.user_id],
    queryFn: async () => {
      if (!user?.user_id) return [];
      
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.user_id)
        .order('session_date', { ascending: false });

      if (error) {
        console.error('Error fetching study sessions:', error);
        throw error;
      }

      return data as StudySession[];
    },
    enabled: !!user?.user_id,
  });

  // Create new study session
  const createSessionMutation = useMutation({
    mutationFn: async (newSession: Omit<StudySession, 'id' | 'user_id' | 'created_at'>) => {
      if (!user?.user_id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('study_sessions')
        .insert([{
          ...newSession,
          user_id: user.user_id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studySessions'] });
      toast({
        title: "Session Scheduled",
        description: "Your study session has been added to the calendar.",
      });
    },
    onError: (error) => {
      console.error('Error creating study session:', error);
      toast({
        title: "Error",
        description: "Failed to schedule study session. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update study session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StudySession> }) => {
      const { data, error } = await supabase
        .from('study_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studySessions'] });
      toast({
        title: "Session Updated",
        description: "Your study session has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating study session:', error);
      toast({
        title: "Error",
        description: "Failed to update study session. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete study session
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studySessions'] });
      toast({
        title: "Session Deleted",
        description: "Your study session has been removed from the calendar.",
      });
    },
    onError: (error) => {
      console.error('Error deleting study session:', error);
      toast({
        title: "Error",
        description: "Failed to delete study session. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    studySessions,
    isLoading,
    error,
    createSession: createSessionMutation.mutate,
    updateSession: updateSessionMutation.mutate,
    deleteSession: deleteSessionMutation.mutate,
    isCreating: createSessionMutation.isPending,
    isUpdating: updateSessionMutation.isPending,
    isDeleting: deleteSessionMutation.isPending,
  };
};
