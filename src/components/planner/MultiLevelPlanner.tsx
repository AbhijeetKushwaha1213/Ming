
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Target, TrendingUp, CheckCircle, Clock, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: 'yearly' | 'monthly' | 'weekly' | 'daily';
  target_value: number;
  current_value: number;
  due_date: string;
  status: 'active' | 'completed' | 'paused';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal_id?: string;
  completed: boolean;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  estimated_hours?: number;
  created_at: string;
}

export const MultiLevelPlanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');

  useEffect(() => {
    if (user?.user_id) {
      fetchGoalsAndTasks();
    }
  }, [user?.user_id]);

  const fetchGoalsAndTasks = async () => {
    if (!user?.user_id) return;
    
    setIsLoading(true);
    try {
      // For now, we'll use mock data until the types are updated
      // In a real implementation, these would be actual Supabase queries
      console.log('Fetching goals and tasks for user:', user.user_id);
      
      // Mock data for demonstration
      setGoals([]);
      setTasks([]);
      
      toast({
        title: "Planner Loaded",
        description: "Your goals and tasks have been loaded successfully.",
      });
    } catch (error) {
      console.error('Error fetching goals and tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load planner data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getGoalsByType = (type: Goal['type']) => {
    return goals.filter(goal => goal.type === type && goal.status === 'active');
  };

  const getTodayTasks = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(task => 
      !task.completed && 
      (task.due_date === today || !task.due_date)
    );
  };

  const getWeekTasks = () => {
    const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date()), 'yyyy-MM-dd');
    return tasks.filter(task => 
      !task.completed && 
      task.due_date && 
      task.due_date >= weekStart && 
      task.due_date <= weekEnd
    );
  };

  const getCompletionPercentage = (goal: Goal) => {
    return Math.min((goal.current_value / goal.target_value) * 100, 100);
  };

  const getMotivationalMessage = () => {
    const todayTasks = getTodayTasks();
    const completedToday = tasks.filter(task => 
      task.completed && 
      task.due_date === format(new Date(), 'yyyy-MM-dd')
    ).length;

    if (completedToday > 0 && todayTasks.length === 0) {
      return "🎉 Amazing! You've completed all today's tasks!";
    } else if (todayTasks.length <= 3) {
      return `💪 You're doing great! ${todayTasks.length} tasks left to complete today. Let's go!`;
    } else {
      return `🚀 You've got this! ${todayTasks.length} tasks to conquer today. One step at a time!`;
    }
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Multi-Level Planner</h1>
        <p className="text-gray-600">{getMotivationalMessage()}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">📌 Today</TabsTrigger>
          <TabsTrigger value="weekly">🗂️ Weekly</TabsTrigger>
          <TabsTrigger value="monthly">📅 Monthly</TabsTrigger>
          <TabsTrigger value="yearly">🗓️ Yearly</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Clock className="w-5 h-5 mr-2 text-indigo-600" />
                Today's Plan - {format(new Date(), 'EEEE, MMMM d')}
              </h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
            
            <div className="space-y-3">
              {getTodayTasks().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>All tasks completed for today! 🎉</p>
                  <p className="text-sm mt-2">Ready to add some new tasks for tomorrow?</p>
                </div>
              ) : (
                getTodayTasks().map((task) => (
                  <div key={task.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <input type="checkbox" className="mr-3" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-600">{task.description}</p>
                      )}
                    </div>
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Target className="w-5 h-5 mr-2 text-purple-600" />
                This Week's Focus
              </h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </div>
            
            <div className="space-y-4">
              {getGoalsByType('weekly').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                  <h3 className="text-lg font-semibold mb-2">No Weekly Goals Set</h3>
                  <p className="mb-4">Set weekly goals to stay focused and motivated!</p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Weekly Goal
                  </Button>
                </div>
              ) : (
                getGoalsByType('weekly').map((goal) => (
                  <div key={goal.id} className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                      <Badge variant="outline">
                        {goal.current_value}/{goal.target_value}
                      </Badge>
                    </div>
                    <Progress value={getCompletionPercentage(goal)} className="h-2 mb-2" />
                    <p className="text-sm text-gray-600">{goal.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Monthly Goals - {format(new Date(), 'MMMM yyyy')}
              </h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getGoalsByType('monthly').length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-blue-300" />
                  <h3 className="text-lg font-semibold mb-2">No Monthly Goals Set</h3>
                  <p className="mb-4">Set monthly goals to track your progress over time!</p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Monthly Goal
                  </Button>
                </div>
              ) : (
                getGoalsByType('monthly').map((goal) => (
                  <div key={goal.id} className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                      <Badge className={getPriorityColor(goal.priority)}>
                        {goal.priority}
                      </Badge>
                    </div>
                    <Progress value={getCompletionPercentage(goal)} className="h-3 mb-2" />
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{goal.current_value} / {goal.target_value}</span>
                      <span>{Math.round(getCompletionPercentage(goal))}%</span>
                    </div>
                    <p className="text-sm text-gray-600">{goal.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="yearly" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                Yearly Vision - {format(new Date(), 'yyyy')}
              </h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </div>
            
            <div className="space-y-6">
              {getGoalsByType('yearly').length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">No Yearly Goals Set</h3>
                  <p className="mb-4">Set your big picture goals to guide your year!</p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Yearly Goal
                  </Button>
                </div>
              ) : (
                getGoalsByType('yearly').map((goal) => (
                  <div key={goal.id} className="p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-gray-900">{goal.title}</h4>
                      <Badge className={`${getPriorityColor(goal.priority)} text-base px-3 py-1`}>
                        {goal.priority} priority
                      </Badge>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{goal.current_value} / {goal.target_value} ({Math.round(getCompletionPercentage(goal))}%)</span>
                      </div>
                      <Progress value={getCompletionPercentage(goal)} className="h-4" />
                    </div>
                    
                    <p className="text-gray-700 mb-4">{goal.description}</p>
                    
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Due: {format(new Date(goal.due_date), 'MMM d, yyyy')}</span>
                      <span>Created: {format(new Date(goal.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
