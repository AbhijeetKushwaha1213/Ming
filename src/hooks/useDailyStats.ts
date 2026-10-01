import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  study_time_minutes: number;
  topics_completed: number;
  sessions_count: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateDailyStatsData {
  study_time_minutes?: number;
  topics_completed?: number;
  sessions_count?: number;
}

export const useDailyStats = (date?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Fetch today's stats
  const {
    data: dailyStats,
    isLoading,
    error
  } = useQuery({
    queryKey: ['daily-stats', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('date', targetDate)
        .maybeSingle();

      if (error) throw error;
      return data as DailyStats | null;
    },
  });

  // Fetch weekly stats
  const {
    data: weeklyStats = [],
    isLoading: isLoadingWeekly
  } = useQuery({
    queryKey: ['weekly-stats'],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .gte('date', weekAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return data as DailyStats[];
    },
  });

  // Update or create daily stats
  const updateDailyStatsMutation = useMutation({
    mutationFn: async (updates: UpdateDailyStatsData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('daily_stats')
        .upsert({
          user_id: user.user.id,
          date: targetDate,
          ...updates
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-stats'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update daily stats.",
        variant: "destructive",
      });
    },
  });

  // Calculate totals from weekly stats
  const weeklyTotals = weeklyStats.reduce((acc, day) => ({
    totalStudyTime: acc.totalStudyTime + day.study_time_minutes,
    totalTopics: acc.totalTopics + day.topics_completed,
    totalSessions: acc.totalSessions + day.sessions_count,
  }), { totalStudyTime: 0, totalTopics: 0, totalSessions: 0 });

  return {
    dailyStats,
    weeklyStats,
    weeklyTotals,
    isLoading,
    isLoadingWeekly,
    error,
    updateDailyStats: updateDailyStatsMutation.mutate,
    isUpdating: updateDailyStatsMutation.isPending,
  };
};