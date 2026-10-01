
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Achievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  description?: string;
  experience_points: number;
  earned_at: string;
}

export const useAchievements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAchievements = async () => {
    if (!user?.user_id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.user_id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const awardAchievement = async (
    achievementType: string,
    achievementName: string,
    description: string,
    experiencePoints: number
  ) => {
    if (!user?.user_id) return;

    try {
      // Check if achievement already exists
      const { data: existing } = await supabase
        .from('achievements')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('achievement_type', achievementType)
        .single();

      if (existing) return; // Achievement already earned

      const { error } = await supabase
        .from('achievements')
        .insert({
          user_id: user.user_id,
          achievement_type: achievementType,
          achievement_name: achievementName,
          description,
          experience_points: experiencePoints
        });

      if (error) throw error;

      toast({
        title: "Achievement Unlocked! 🏆",
        description: `${achievementName} - +${experiencePoints} XP`,
        duration: 5000,
      });

      await fetchAchievements();
    } catch (error) {
      console.error('Error awarding achievement:', error);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, [user?.user_id]);

  return {
    achievements,
    isLoading,
    fetchAchievements,
    awardAchievement
  };
};
