import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Zap, 
  Target, 
  BookOpen, 
  Brain, 
  Calendar, 
  Flame,
  Star,
  Lock,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'study' | 'streaks' | 'practice' | 'daily';
  target: number;
  current: number;
  unlocked: boolean;
  xp: number;
  color: string;
}

export const NewAchievementsPage = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState({
    totalXP: 0,
    unlockedCount: 0,
    currentLevel: 1,
    studySessions: 0,
    flashcardsGenerated: 0,
    aiChatUsed: 0,
    pdfsUploaded: 0,
    mindMapsCreated: 0,
    currentStreak: 0
  });

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user?.user_id) return;

    try {
      // Fetch user profile data
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.user_id)
        .single();

      // Fetch study materials count
      const { data: materials } = await supabase
        .from('study_materials')
        .select('type')
        .eq('user_id', user.user_id);

      // Fetch study sessions count
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('id')
        .eq('user_id', user.user_id);

      const materialCounts = materials?.reduce((acc, material) => {
        acc[material.type] = (acc[material.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const newStats = {
        totalXP: profile?.experience_points || 0,
        unlockedCount: 0,
        currentLevel: profile?.current_level || 1,
        studySessions: sessions?.length || 0,
        flashcardsGenerated: materialCounts['flashcards'] || 0,
        aiChatUsed: 0, // This would need to be tracked separately
        pdfsUploaded: 0, // This would need to be tracked separately
        mindMapsCreated: materialCounts['mindmaps'] || 0,
        currentStreak: profile?.study_streak || 0
      };

      setStats(newStats);
      generateAchievements(newStats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const generateAchievements = (userStats: typeof stats) => {
    const achievementTemplates: Omit<Achievement, 'current' | 'unlocked'>[] = [
      // Study Category
      {
        id: 'first-session',
        title: 'First Steps',
        description: 'Complete your first study session',
        icon: BookOpen,
        category: 'study',
        target: 1,
        xp: 10,
        color: 'bg-blue-500'
      },
      {
        id: 'session-master',
        title: 'Session Master',
        description: 'Complete 10 study sessions',
        icon: Target,
        category: 'study',
        target: 10,
        xp: 50,
        color: 'bg-blue-600'
      },
      {
        id: 'study-veteran',
        title: 'Study Veteran',
        description: 'Complete 50 study sessions',
        icon: Trophy,
        category: 'study',
        target: 50,
        xp: 200,
        color: 'bg-blue-700'
      },

      // Practice Category
      {
        id: 'flashcard-creator',
        title: 'Flashcard Creator',
        description: 'Generate 5 flashcards',
        icon: Zap,
        category: 'practice',
        target: 5,
        xp: 25,
        color: 'bg-yellow-500'
      },
      {
        id: 'flashcard-master',
        title: 'Flashcard Master',
        description: 'Generate 25 flashcards',
        icon: Star,
        category: 'practice',
        target: 25,
        xp: 100,
        color: 'bg-yellow-600'
      },
      {
        id: 'mind-mapper',
        title: 'Mind Mapper',
        description: 'Create 3 mind maps',
        icon: Brain,
        category: 'practice',
        target: 3,
        xp: 30,
        color: 'bg-purple-500'
      },

      // Streaks Category
      {
        id: 'consistency-start',
        title: 'Getting Consistent',
        description: 'Maintain a 3-day study streak',
        icon: Flame,
        category: 'streaks',
        target: 3,
        xp: 40,
        color: 'bg-orange-500'
      },
      {
        id: 'week-warrior',
        title: 'Week Warrior',
        description: 'Maintain a 7-day study streak',
        icon: Calendar,
        category: 'streaks',
        target: 7,
        xp: 100,
        color: 'bg-orange-600'
      },
      {
        id: 'streak-legend',
        title: 'Streak Legend',
        description: 'Maintain a 30-day study streak',
        icon: Trophy,
        category: 'streaks',
        target: 30,
        xp: 500,
        color: 'bg-red-600'
      },

      // Daily Category
      {
        id: 'early-bird',
        title: 'Early Bird',
        description: 'Study before 9 AM',
        icon: Clock,
        category: 'daily',
        target: 1,
        xp: 15,
        color: 'bg-green-500'
      },
      {
        id: 'progress-tracker',
        title: 'Progress Tracker',
        description: 'Check your progress daily for 5 days',
        icon: TrendingUp,
        category: 'daily',
        target: 5,
        xp: 50,
        color: 'bg-green-600'
      }
    ];

    const processedAchievements = achievementTemplates.map(template => {
      let current = 0;
      
      switch (template.id) {
        case 'first-session':
        case 'session-master':
        case 'study-veteran':
          current = userStats.studySessions;
          break;
        case 'flashcard-creator':
        case 'flashcard-master':
          current = userStats.flashcardsGenerated;
          break;
        case 'mind-mapper':
          current = userStats.mindMapsCreated;
          break;
        case 'consistency-start':
        case 'week-warrior':
        case 'streak-legend':
          current = userStats.currentStreak;
          break;
        default:
          current = 0;
      }

      return {
        ...template,
        current: Math.min(current, template.target),
        unlocked: current >= template.target
      };
    });

    const unlockedCount = processedAchievements.filter(a => a.unlocked).length;
    setStats(prev => ({ ...prev, unlockedCount }));
    setAchievements(processedAchievements);
  };

  const getAchievementsByCategory = (category: Achievement['category']) => {
    return achievements.filter(achievement => achievement.category === category);
  };

  const AchievementCard = ({ achievement }: { achievement: Achievement }) => {
    const Icon = achievement.icon;
    const progress = (achievement.current / achievement.target) * 100;
    
    return (
      <Card className={`p-6 transition-all duration-200 hover:shadow-premium-lg hover:-translate-y-1 border-2 ${
        achievement.unlocked 
          ? 'border-success/30 bg-success/5' 
          : achievement.current > 0
            ? 'border-primary/30 bg-primary/5'
            : 'border-muted bg-muted/30'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-2xl ${achievement.color} ${achievement.unlocked ? 'text-white' : 'text-white opacity-60'}`}>
            {achievement.unlocked ? (
              <CheckCircle className="w-6 h-6" />
            ) : achievement.current > 0 ? (
              <Icon className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <Badge variant={achievement.unlocked ? "default" : "secondary"} className="text-xs">
            +{achievement.xp} XP
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className={`font-semibold text-lg ${achievement.unlocked ? 'text-success' : 'text-foreground'}`}>
              {achievement.title}
            </h3>
            <p className="text-sm text-muted-foreground">{achievement.description}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {achievement.current}/{achievement.target}
              </span>
              <span className="text-muted-foreground">
                {achievement.unlocked ? 'Unlocked!' : `${Math.round(progress)}%`}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </Card>
    );
  };

  const categoryLabels = {
    study: '📚 Study Sessions',
    practice: '⚡ Practice & Creation',
    streaks: '🔥 Consistency Streaks', 
    daily: '🌅 Daily Goals'
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient">
              🏆 Achievements
            </h1>
            <p className="text-muted-foreground text-lg mt-2">
              Track your learning journey and unlock rewards
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{stats.totalXP}</div>
            <div className="text-sm text-muted-foreground">Total XP</div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 card-interactive">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.unlockedCount}</div>
                <div className="text-sm text-muted-foreground">Unlocked</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 card-interactive">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.currentLevel}</div>
                <div className="text-sm text-muted-foreground">Level</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 card-interactive">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-md">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.currentStreak}</div>
                <div className="text-sm text-muted-foreground">Day Streak</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 card-interactive">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{achievements.length - stats.unlockedCount}</div>
                <div className="text-sm text-muted-foreground">To Unlock</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Achievement Categories */}
      <Tabs defaultValue="study" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="text-sm">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(categoryLabels).map(category => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getAchievementsByCategory(category as Achievement['category']).map(achievement => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* No achievements message */}
      {achievements.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">
            Loading your achievements...
          </h3>
          <p className="text-muted-foreground">
            Your progress is being calculated.
          </p>
        </div>
      )}
    </div>
  );
};