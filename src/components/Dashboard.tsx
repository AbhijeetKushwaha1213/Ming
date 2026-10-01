
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, Target, Flame, Star, ChevronRight, BookOpen, Plus } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { useSubjects } from '@/hooks/useSubjects';
import { useDailyStats } from '@/hooks/useDailyStats';
import { AddSubjectDialog } from './subjects/AddSubjectDialog';


export const Dashboard = () => {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { dailyStats, weeklyTotals } = useDailyStats();
  
  // Calculate dynamic data
  const todaysStudyTimeHours = dailyStats ? (dailyStats.study_time_minutes / 60).toFixed(1) : '0';
  const studyStreak = user?.study_streak || 0;
  const topicsCompleted = subjects.reduce((acc, s) => acc + s.completed_topics, 0);
  const totalTopics = subjects.reduce((acc, s) => acc + s.total_topics, 0);
  const weeklyGoalProgress = totalTopics > 0 ? Math.round((topicsCompleted / totalTopics) * 100) : 0;

  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Your Personal
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Dashboard</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stay on top of your studies with real-time progress tracking and personalized insights.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome Card */}
            <Card className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Good morning, {user?.name || 'Student'}! 👋</h3>
                  <p className="text-indigo-100">Ready to conquer today's study goals?</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">Day {studyStreak}</div>
                  <div className="text-indigo-200 text-sm">Study Streak</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{todaysStudyTimeHours}h</div>
                  <div className="text-indigo-200 text-sm">Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{topicsCompleted}</div>
                  <div className="text-indigo-200 text-sm">Topics</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{weeklyGoalProgress}%</div>
                  <div className="text-indigo-200 text-sm">Progress</div>
                </div>
              </div>
            </Card>

            {/* Subjects Overview */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">Your Subjects</h3>
                <AddSubjectDialog />
              </div>

              {subjects.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-foreground mb-2">No Subjects Added</h4>
                  <p className="text-muted-foreground mb-4">Start by adding your first subject to track your progress</p>
                  <AddSubjectDialog trigger={
                    <Button variant="premium">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Subject
                    </Button>
                  } />
                </div>
              ) : (
                <div className="space-y-4">
                  {subjects.slice(0, 3).map((subject) => {
                    const progress = subject.total_topics > 0 ? (subject.completed_topics / subject.total_topics) * 100 : 0;
                    const isCompleted = subject.completed_topics === subject.total_topics;
                    
                    return (
                      <div key={subject.id} className={`flex items-center p-4 rounded-lg border ${
                        isCompleted ? 'bg-green-50 border-green-200' :
                        progress > 50 ? 'bg-blue-50 border-blue-200' :
                        'bg-muted border-border'
                      }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${
                          isCompleted ? 'bg-green-500' :
                          progress > 50 ? 'bg-blue-500' :
                          'bg-muted-foreground'
                        }`}>
                          <BookOpen className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{subject.name}</h4>
                          <p className="text-sm text-muted-foreground">{subject.completed_topics} / {subject.total_topics} topics</p>
                        </div>
                        <Badge variant={isCompleted ? 'secondary' : progress > 50 ? 'default' : 'outline'}>
                          {Math.round(progress)}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Card */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Weekly Progress</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Study Time</span>
                    <span className="font-medium">{Math.round(weeklyTotals.totalStudyTime / 60)}h this week</span>
                  </div>
                  <Progress value={Math.min((weeklyTotals.totalStudyTime / 1200) * 100, 100)} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Topics Completed</span>
                    <span className="font-medium">{weeklyTotals.totalTopics} topics</span>
                  </div>
                  <Progress value={Math.min((weeklyTotals.totalTopics / 20) * 100, 100)} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Study Sessions</span>
                    <span className="font-medium">{weeklyTotals.totalSessions} sessions</span>
                  </div>
                  <Progress value={Math.min((weeklyTotals.totalSessions / 14) * 100, 100)} className="h-2" />
                </div>
              </div>
            </Card>

            {/* Streak Card */}
            <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
              <div className="text-center">
                <Flame className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-foreground mb-1">{studyStreak} Days</h3>
                <p className="text-muted-foreground mb-4">Study Streak 🔥</p>
                <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                  {studyStreak > 0 ? 'Keep Going!' : 'Start Your Streak!'}
                </Button>
              </div>
            </Card>


            {/* Achievement Card - Remove hardcoded data */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Recent Achievement</h3>
              <div className="text-center py-4">
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-semibold text-muted-foreground mb-1">No achievements yet</h4>
                <p className="text-sm text-muted-foreground mb-4">Complete study goals to unlock achievements!</p>
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All Badges
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
