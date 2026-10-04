
import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Target, 
  Trophy, 
  Calendar,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useFlashcards } from '@/hooks/useFlashcards';
import { useAchievements } from '@/hooks/useAchievements';

interface ProgressSummaryProps {
  studyStreak: number;
  totalStudyHours: number;
  achievementsCount: number;
  experiencePoints: number;
  flashcardsCount: number;
  weeklyGoalProgress: number;
}

export const ProgressSummary = ({
  studyStreak,
  totalStudyHours,
  achievementsCount,
  experiencePoints,
  flashcardsCount,
  weeklyGoalProgress
}: ProgressSummaryProps) => {
  const { flashcards } = useFlashcards();
  const { achievements } = useAchievements();
  
  // Use actual data instead of props when available
  const actualFlashcardsCount = flashcards?.length || flashcardsCount;
  const actualAchievementsCount = achievements?.length || achievementsCount;
  
  const currentLevel = Math.floor(experiencePoints / 1000) + 1;
  const progressToNextLevel = (experiencePoints % 1000) / 1000 * 100;

  const stats = [
    {
      icon: Calendar,
      label: 'Study Streak',
      value: `${studyStreak} days`,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      icon: Clock,
      label: 'Total Hours',
      value: `${totalStudyHours}h`,
      color: 'text-green-600 bg-green-100'
    },
    {
      icon: Trophy,
      label: 'Achievements',
      value: actualAchievementsCount.toString(),
      color: 'text-yellow-600 bg-yellow-100'
    },
    {
      icon: BookOpen,
      label: 'Flashcards',
      value: actualFlashcardsCount.toString(),
      color: 'text-primary bg-primary/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Level Progress */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-sm">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Level {currentLevel}</h3>
              <p className="text-sm text-muted-foreground">{experiencePoints} XP total</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {Math.round(progressToNextLevel)}% to Level {currentLevel + 1}
          </Badge>
        </div>
        <Progress value={progressToNextLevel} className="h-2.5" />
        <p className="text-xs text-muted-foreground mt-2">
          {1000 - (experiencePoints % 1000)} XP needed for next level
        </p>
      </Card>

      {/* Weekly Goal */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Weekly Goal</h3>
              <p className="text-sm text-muted-foreground">Study progress this week</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-foreground">
            {Math.round(weeklyGoalProgress)}%
          </span>
        </div>
        <Progress value={weeklyGoalProgress} className="h-2" />
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground truncate">{stat.label}</p>
                <p className="text-lg font-semibold text-foreground">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
