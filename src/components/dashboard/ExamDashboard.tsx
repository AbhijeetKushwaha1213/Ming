
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthProvider';
import { Target, Clock, Flame, BookOpen, TrendingUp, Calendar, Zap, Plus, Lightbulb } from 'lucide-react';
import { StudySessionPage } from '../session/StudySessionPage';
import { StudyPlanPage } from '../planner/StudyPlanPage';
import { ScheduleMockTestModal } from '../exam/ScheduleMockTestModal';
import { ViewResultsModal } from '../exam/ViewResultsModal';
import { DeleteTrackerModal } from '../exam/DeleteTrackerModal';
import { RevisionLogModal } from '../exam/RevisionLogModal';
import { useSubjects } from '@/hooks/useSubjects';
import { useDailyStats } from '@/hooks/useDailyStats';
import { AddSubjectDialog } from '../subjects/AddSubjectDialog';


export const ExamDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'session' | 'plan'>('dashboard');
  const [showScheduleMockTest, setShowScheduleMockTest] = useState(false);
  const [showViewResults, setShowViewResults] = useState(false);
  const [showDeleteTracker, setShowDeleteTracker] = useState(false);
  const [showRevisionLog, setShowRevisionLog] = useState(false);

  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const { dailyStats, weeklyTotals } = useDailyStats();

  // Calculate dynamic data
  const todaysStudyTimeHours = dailyStats ? (dailyStats.study_time_minutes / 60).toFixed(1) : '0';
  const syllabusComplete = subjects.length > 0 
    ? Math.round((subjects.reduce((acc, s) => acc + s.completed_topics, 0) / subjects.reduce((acc, s) => acc + s.total_topics, 0)) * 100) || 0
    : 0;
  const topicsLeft = subjects.reduce((acc, s) => acc + (s.total_topics - s.completed_topics), 0);
  const studyStreak = user?.study_streak || 0;

  const handleStartNextSession = () => {
    console.log('Starting next study session...');
    setCurrentView('session');
    toast({
      title: "Session Started! 🚀",
      description: "Your Chemistry - Organic Reactions session has begun. Focus and give your best!",
    });
  };

  const handleViewStudyPlan = () => {
    console.log('Viewing study plan...');
    setCurrentView('plan');
    toast({
      title: "Study Plan Loaded 📚",
      description: "Your personalized study plan is now open.",
    });
  };


  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  // Generate AI recommendation based on user data
  const getAIRecommendation = () => {
    if (subjects.length === 0) {
      return {
        title: "Get Started! 📚",
        message: "Add your first subject to begin tracking your study progress.",
        action: "Add Subject"
      };
    }
    
    const inProgressSubjects = subjects.filter(s => s.completed_topics < s.total_topics);
    if (inProgressSubjects.length === 0) {
      return {
        title: "Excellent Progress! 🎉",
        message: "You've completed all subjects! Consider adding more topics or reviewing completed ones.",
        action: "Review Completed"
      };
    }
    
    const nextSubject = inProgressSubjects[0];
    const progressPercent = Math.round((nextSubject.completed_topics / nextSubject.total_topics) * 100);
    
    return {
      title: `Focus on ${nextSubject.name} 🎯`,
      message: `You're ${progressPercent}% through ${nextSubject.name}. Keep the momentum going!`,
      action: "Continue Learning"
    };
  };

  const aiRec = getAIRecommendation();

  if (currentView === 'session') {
    return (
      <StudySessionPage 
        subject="Chemistry" 
        topic="Organic Reactions" 
        onBack={handleBackToDashboard}
      />
    );
  }

  if (currentView === 'plan') {
    return <StudyPlanPage onBack={handleBackToDashboard} />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Welcome Header */}
        <Card className="relative overflow-hidden p-6 bg-brand-gradient text-white border-0 shadow-glow animate-fade-in-up">
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Good morning, {user?.name || 'Student'}! 🎯</h2>
              <p className="text-white/80">Day {studyStreak} of your {user?.examType || 'exam'} preparation journey</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{syllabusComplete}%</div>
              <div className="text-white/70 text-sm">Syllabus Complete</div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center card-interactive">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-foreground">{studyStreak}</div>
            <div className="text-sm text-muted-foreground">Day Streak</div>
          </Card>

          <Card className="p-4 text-center card-interactive">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-foreground">{todaysStudyTimeHours}h</div>
            <div className="text-sm text-muted-foreground">Today</div>
          </Card>

          <Card className="p-4 text-center card-interactive">
            <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-foreground">{topicsLeft}</div>
            <div className="text-sm text-muted-foreground">Topics Left</div>
          </Card>
        </div>

        {/* Today's Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-foreground">Your Subjects</h3>
            <AddSubjectDialog />
          </div>

          {subjectsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading subjects...</div>
          ) : subjects.length === 0 ? (
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
            <div className="space-y-3">
              {subjects.map((subject) => {
                const progress = subject.total_topics > 0 ? (subject.completed_topics / subject.total_topics) * 100 : 0;
                const isCompleted = subject.completed_topics === subject.total_topics;
                
                return (
                  <div key={subject.id} className={`flex items-center p-3 rounded-lg border ${
                    isCompleted ? 'bg-success/10 border-success/20' :
                    progress > 50 ? 'bg-primary/10 border-primary/20' :
                    'bg-muted border-border'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      isCompleted ? 'bg-success' :
                      progress > 50 ? 'bg-primary' :
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

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button 
              variant="premium"
              onClick={handleStartNextSession}
              disabled={subjects.length === 0}
            >
              <Zap className="w-4 h-4 mr-2" />
              Start Session
            </Button>
            <Button 
              variant="outline"
              onClick={handleViewStudyPlan}
            >
              <Calendar className="w-4 h-4 mr-2" />
              View Study Plan
            </Button>
          </div>
        </Card>

        {/* Progress Overview */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Subject Progress</h3>
          
          {subjects.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No subjects to track yet
            </div>
          ) : (
            <div className="space-y-4">
              {subjects.map((subject) => {
                const progress = subject.total_topics > 0 ? (subject.completed_topics / subject.total_topics) * 100 : 0;
                return (
                  <div key={subject.id}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{subject.name}</span>
                      <span className="font-medium text-foreground">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Exam-Focused Tools Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Mock Tests</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowScheduleMockTest(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Mock Test
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowViewResults(true)}
              >
                <Target className="w-4 h-4 mr-2" />
                View Results
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Exam Tools</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setShowDeleteTracker(true)}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Delete Tracker
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowRevisionLog(true)}
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Revision Log
              </Button>
            </div>
          </Card>
        </div>

        {/* AI Recommendation */}
        <Card className="p-6 bg-brand-gradient-subtle border-primary/20">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-brand-gradient rounded-full flex items-center justify-center shadow-glow flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-foreground mb-2">{aiRec.title}</h4>
              <p className="text-muted-foreground mb-3">{aiRec.message}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-primary border-primary/30 hover:bg-primary/10"
                onClick={handleViewStudyPlan}
              >
                {aiRec.action}
              </Button>
            </div>
          </div>
        </Card>

      </div>

      {/* Exam Modals */}
      <ScheduleMockTestModal open={showScheduleMockTest} onOpenChange={setShowScheduleMockTest} />
      <ViewResultsModal open={showViewResults} onOpenChange={setShowViewResults} />
      <DeleteTrackerModal open={showDeleteTracker} onOpenChange={setShowDeleteTracker} />
      <RevisionLogModal open={showRevisionLog} onOpenChange={setShowRevisionLog} />
    </>
  );
};
