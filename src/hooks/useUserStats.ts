import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserStats {
  id: string;
  user_id: string;
  cgpa?: number;
  monthly_earnings?: number;
  active_clients?: number;
  projects_completed?: number;
  rating?: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserStatsData {
  cgpa?: number;
  monthly_earnings?: number;
  active_clients?: number;
  projects_completed?: number;
  rating?: number;
}

export const useUserStats = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user stats
  const {
    data: userStats,
    isLoading,
    error
  } = useQuery({
    queryKey: ['userStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as UserStats | null;
    },
  });

  // Update user stats
  const updateUserStatsMutation = useMutation({
    mutationFn: async (updates: UpdateUserStatsData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_stats')
        .upsert([{ user_id: user.user.id, ...updates }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      toast({
        title: "Stats Updated",
        description: "Your stats have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stats.",
        variant: "destructive",
      });
    },
  });

  return {
    userStats,
    isLoading,
    error,
    updateUserStats: updateUserStatsMutation.mutate,
    isUpdating: updateUserStatsMutation.isPending,
  };
};