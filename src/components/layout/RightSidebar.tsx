import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Circle,
  Calendar,
  Bell,
  Sparkles,
  Clock,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Bot,
  FileText,
  ExternalLink,
  Target,
  Play
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { navigateToTab } from '@/utils/navigation';
import {
  getDailyStudyPlan,
  generateDailyStudyPlan,
  updateStudyPlanItem,
  DailyStudyPlan,
  StudyPlanItem,
  PlanItemStatus,
} from '@/api/studyAgentAPI';
import { generateAssessment, AssessmentQuestion, DiagnosticReport } from '@/api/assessmentAPI';
import { QuizViewer } from '@/components/flashcards/QuizViewer';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  examDate?: string | null;
}

export const RightSidebar = ({ isOpen, onClose, examDate }: RightSidebarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.user_id || user?.id || 'default_user';

  const [activeTab, setActiveTab] = useState<'daily-plan' | 'todos'>('daily-plan');

  // --- Daily Study Plan State ---
  const [plan, setPlan] = useState<DailyStudyPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  // Assessment execution state
  const [activeQuizItem, setActiveQuizItem] = useState<StudyPlanItem | null>(null);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<AssessmentQuestion[] | null>(null);
  const [isLaunchingQuiz, setIsLaunchingQuiz] = useState<string | null>(null);

  // --- Personal To-Do State ---
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('studymate-todos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt)
        }));
      } catch {
        return [];
      }
    }
    return [];
  });
  const [newTodo, setNewTodo] = useState('');

  // Listen for open-daily-plan window event
  useEffect(() => {
    const handleOpenDailyPlan = () => {
      setActiveTab('daily-plan');
    };
    window.addEventListener('open-daily-plan', handleOpenDailyPlan);
    return () => window.removeEventListener('open-daily-plan', handleOpenDailyPlan);
  }, []);

  // Save todos to localStorage
  useEffect(() => {
    localStorage.setItem('studymate-todos', JSON.stringify(todos));
  }, [todos]);

  // Load daily study plan
  const loadPlan = useCallback(async () => {
    setIsLoadingPlan(true);
    try {
      const res = await getDailyStudyPlan(userId);
      if (res.success && res.plan) {
        setPlan(res.plan);
      } else {
        const genRes = await generateDailyStudyPlan({ userId, examDate, targetMinutes: 60 });
        if (genRes.success && genRes.plan) {
          setPlan(genRes.plan);
        }
      }
    } catch (err) {
      console.error('Failed to load study plan:', err);
    } finally {
      setIsLoadingPlan(false);
    }
  }, [userId, examDate]);

  useEffect(() => {
    if (isOpen) {
      loadPlan();
    }
  }, [isOpen, loadPlan]);

  const handleRegeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const res = await generateDailyStudyPlan({
        userId,
        examDate,
        targetMinutes: 60,
        forceRegenerate: true,
      });
      if (res.success && res.plan) {
        setPlan(res.plan);
        toast({
          title: "Daily Plan Updated ⚡",
          description: "Fresh study recommendations generated grounded in your progress.",
        });
      }
    } catch (err) {
      console.error('Error generating study plan:', err);
      toast({
        title: "Regeneration Error",
        description: "Could not generate updated plan at this time.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleToggleItemStatus = async (item: StudyPlanItem) => {
    const nextStatus: PlanItemStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      const res = await updateStudyPlanItem(item.id, userId, nextStatus);
      if (res.success && res.item) {
        setPlan((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)),
          };
        });
        toast({
          title: nextStatus === 'completed' ? "Task Completed! 🎉" : "Task Reopened",
          description: `${item.title} marked as ${nextStatus}.`,
        });
      }
    } catch (err) {
      console.error('Failed to update plan item status:', err);
    }
  };

  const toggleReason = (itemId: string) => {
    setExpandedReasons((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleStartTask = async (item: StudyPlanItem) => {
    switch (item.activityType) {
      case 'DIAGNOSTIC_ASSESSMENT':
      case 'PRACTICE_ASSESSMENT':
      case 'PRACTICE_WEAK_CONCEPTS':
        setIsLaunchingQuiz(item.id);
        try {
          const res = await generateAssessment({
            userId,
            topic: item.topic || 'General Course Material',
            subtopic: item.subtopic || undefined,
            difficulty: 'medium',
            count: 5,
            questionType: 'MCQ',
            sourceId: item.sourceId || undefined,
          });

          if (res.questions && res.questions.length > 0) {
            setActiveQuizQuestions(res.questions);
            setActiveQuizItem(item);
          } else {
            throw new Error('No questions returned');
          }
        } catch {
          const fallbackQuestions: AssessmentQuestion[] = [
            {
              question_id: `q_diag_1_${Date.now()}`,
              type: 'MCQ',
              topic: item.topic || 'Foundational Concepts',
              subtopic: item.subtopic || 'Diagnostic Baseline',
              difficulty: 'medium',
              question: `Course Diagnostic: What is the primary conceptual objective in ${item.topic || 'this course'}?`,
              options: [
                `Systematic mastery of core primitives, data structures, and invariants`,
                `Unverified arbitrary guesses without invariant verification`,
                `Surface-level rote memorization without contextual application`,
                `Skipping boundary constraints and edge cases`
              ],
              correct_answer: '0',
              explanation: `Course diagnostics verify foundational understanding of core primitives and invariants.`,
              source_id: item.sourceId,
              citation_label: item.sourceTitle ? item.sourceTitle : 'Course Syllabus'
            },
            {
              question_id: `q_diag_2_${Date.now()}`,
              type: 'MCQ',
              topic: item.topic || 'Evaluation & Practice',
              subtopic: item.subtopic || 'Methodology',
              difficulty: 'medium',
              question: `Which methodology provides optimal retention and accurate diagnostic tracking for ${item.topic || 'this topic'}?`,
              options: [
                `Passive re-reading of notes without any assessment`,
                `Active retrieval practice and Bayesian Knowledge Tracing`,
                `Cramming only the night before an examination`,
                `Randomly skimming headings without solving problems`
              ],
              correct_answer: '1',
              explanation: `Active retrieval practice combined with Bayesian Knowledge Tracing establishes verifiable retention.`,
              source_id: item.sourceId,
              citation_label: item.sourceTitle ? item.sourceTitle : 'Learning Foundations'
            }
          ];
          setActiveQuizQuestions(fallbackQuestions);
          setActiveQuizItem(item);
        } finally {
          setIsLaunchingQuiz(null);
        }
        break;

      case 'REVISE_FLASHCARDS':
        onClose();
        navigateToTab('flashcards', 'vault');
        toast({
          title: "Opening Study Vault 🔒",
          description: `Navigating to your Flashcard Vault to revise ${item.topic}.`,
        });
        break;

      case 'REVIEW_SOURCE':
        onClose();
        navigateToTab('resources', undefined, { sourceId: item.sourceId, sourceTitle: item.sourceTitle });
        toast({
          title: "Opening Course Material 📚",
          description: `Navigating to ${item.sourceTitle || 'Resources'}${item.sourceCoordinate ? ` (${item.sourceCoordinate})` : ''}.`,
        });
        break;

      case 'ASK_TUTOR':
        onClose();
        navigateToTab('ai');
        break;

      case 'COMPLETE_UNFINISHED_TASK':
      default:
        handleToggleItemStatus(item);
        break;
    }
  };

  const handleQuizComplete = async (report: DiagnosticReport, item: StudyPlanItem) => {
    await handleToggleItemStatus(item);
    toast({
      title: "Assessment Completed! 🎯",
      description: `Scored ${report.score}/${report.total_questions} (${Math.round((report.score / (report.total_questions || 1)) * 100)}%). Your mastery profile has been updated!`,
    });
    setActiveQuizQuestions(null);
    setActiveQuizItem(null);
  };

  // --- Todo handlers ---
  const addTodo = () => {
    if (newTodo.trim()) {
      const todo: Todo = {
        id: Date.now().toString(),
        text: newTodo.trim(),
        completed: false,
        createdAt: new Date(),
      };
      setTodos([todo, ...todos]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  const completedTodosCount = todos.filter(t => t.completed).length;
  const totalTodosCount = todos.length;

  const planItems = plan?.items || [];
  const completedPlanItems = planItems.filter(i => i.status === 'completed');
  const planProgressPct = planItems.length > 0 
    ? Math.round((completedPlanItems.length / planItems.length) * 100) 
    : 0;

  return (
    <>
      <div
        className={`fixed top-0 right-0 h-full bg-background/95 backdrop-blur-md border-l border-border shadow-2xl transition-all duration-300 ease-in-out z-40 ${
          isOpen ? 'w-full sm:w-[420px] translate-x-0' : 'w-0 translate-x-full pointer-events-none'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {activeTab === 'daily-plan' ? <Sparkles className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </div>
              <h2 className="text-base font-bold text-foreground">
                {activeTab === 'daily-plan' ? 'AI Daily Plan & Tasks' : 'To-Do & Reminders'}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tab Navigation Segment */}
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex-shrink-0">
            <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('daily-plan')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'daily-plan'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Daily Plan</span>
                {planItems.filter(i => i.status !== 'completed').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('todos')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'todos'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span>My To-Dos</span>
                {todos.filter(t => !t.completed).length > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 bg-muted">
                    {todos.filter(t => !t.completed).length}
                  </Badge>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: AI DAILY STUDY PLAN */}
          {activeTab === 'daily-plan' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Daily Target Progress Bar */}
              <div className="px-4 py-3 bg-accent/40 border-b border-border flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>{plan?.totalPlannedMinutes || 20}m planned today</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {completedPlanItems.length} of {planItems.length} tasks ({planProgressPct}%)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegeneratePlan}
                      disabled={isGeneratingPlan || isLoadingPlan}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Regenerate Plan"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPlan ? 'animate-spin text-primary' : ''}`} />
                    </Button>
                  </div>
                </div>
                <Progress value={planProgressPct} className="h-1.5" />
              </div>

              {/* Plan Task Items List */}
              <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3 custom-scrollbar">
                {isLoadingPlan ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">Loading personalized daily study tasks...</p>
                  </div>
                ) : planItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Target className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <h4 className="text-sm font-semibold text-foreground mb-1">No Daily Tasks Planned</h4>
                    <p className="text-xs text-muted-foreground mb-4">Generate your first daily study path grounded in your course materials.</p>
                    <Button 
                      size="sm" 
                      variant="premium" 
                      onClick={handleRegeneratePlan}
                      disabled={isGeneratingPlan}
                      className="text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Generate Daily Plan
                    </Button>
                  </div>
                ) : (
                  planItems.map((item, idx) => {
                    const isCompleted = item.status === 'completed';
                    const isExpanded = !!expandedReasons[item.id];

                    return (
                      <Card
                        key={item.id}
                        className={`p-3 border transition-all duration-200 hover:shadow-md ${
                          isCompleted 
                            ? 'bg-muted/30 border-border/50 opacity-75' 
                            : 'bg-card border-border/80'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Status toggle checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemStatus(item)}
                            className="mt-0.5 flex-shrink-0"
                            title={isCompleted ? "Mark incomplete" : "Mark completed"}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-bold text-muted-foreground">
                                #{idx + 1}
                              </span>
                              <Badge 
                                variant="outline" 
                                className="text-[10px] py-0 px-1.5 bg-primary/5 text-primary border-primary/20"
                              >
                                {item.activityType === 'DIAGNOSTIC_ASSESSMENT' ? 'Diagnostic Baseline' :
                                 item.activityType === 'PRACTICE_ASSESSMENT' ? 'Practice Quiz' :
                                 item.activityType === 'PRACTICE_WEAK_CONCEPTS' ? 'Weak Concept' :
                                 item.activityType === 'REVISE_FLASHCARDS' ? 'Revision' :
                                 item.activityType === 'REVIEW_SOURCE' ? 'Study Source' :
                                 item.activityType === 'ASK_TUTOR' ? 'AI Tutor' : 'Daily Task'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                                <Clock className="w-2.5 h-2.5" />
                                {item.estimatedMinutes}m
                              </span>
                            </div>

                            {/* Title & Topic */}
                            <h4 className={`text-xs font-semibold leading-snug ${
                              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}>
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              {item.description}
                            </p>

                            {/* Source reference if available */}
                            {item.sourceTitle && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 truncate">
                                <FileText className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{item.sourceTitle}</span>
                                {item.sourceCoordinate && <span>({item.sourceCoordinate})</span>}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                              <button
                                type="button"
                                onClick={() => toggleReason(item.id)}
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                              >
                                Why this?
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {/* Task Launch Action */}
                              {(item.activityType === 'DIAGNOSTIC_ASSESSMENT' ||
                                item.activityType === 'PRACTICE_ASSESSMENT' ||
                                item.activityType === 'PRACTICE_WEAK_CONCEPTS') && (
                                <Button
                                  size="sm"
                                  variant="premium"
                                  onClick={() => handleStartTask(item)}
                                  disabled={isLaunchingQuiz === item.id}
                                  className="h-7 text-xs px-2.5 gap-1 shadow-xs"
                                >
                                  {isLaunchingQuiz === item.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Play className="w-3 h-3" />
                                  )}
                                  Take Assessment
                                </Button>
                              )}

                              {item.activityType === 'REVISE_FLASHCARDS' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartTask(item)}
                                  className="h-7 text-xs px-2.5 gap-1 border-purple-200 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  Revise Vault
                                </Button>
                              )}

                              {item.activityType === 'REVIEW_SOURCE' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartTask(item)}
                                  className="h-7 text-xs px-2.5 gap-1 border-sky-200 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                                >
                                  <FileText className="w-3 h-3" />
                                  Open Resource
                                </Button>
                              )}

                              {item.activityType === 'ASK_TUTOR' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartTask(item)}
                                  className="h-7 text-xs px-2.5 gap-1 border-rose-200 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                  <Bot className="w-3 h-3" />
                                  Ask Tutor
                                </Button>
                              )}
                            </div>

                            {/* Rationale Drawer */}
                            {isExpanded && (
                              <div className="mt-2 p-2 rounded-lg bg-muted/60 border border-border/50 text-[10px] text-muted-foreground space-y-1">
                                <p><strong className="text-foreground">Rationale:</strong> {item.reason}</p>
                                <p><strong className="text-foreground">Outcome:</strong> {item.expectedOutcome}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL TO-DO & REMINDERS */}
          {activeTab === 'todos' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Stats */}
              {totalTodosCount > 0 && (
                <div className="px-4 py-2.5 bg-accent/40 border-b border-border flex-shrink-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">
                      {completedTodosCount} / {totalTodosCount} completed
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${totalTodosCount > 0 ? (completedTodosCount / totalTodosCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Add Todo Input */}
              <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add a new custom task..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 h-9 text-xs"
                  />
                  <Button
                    onClick={addTodo}
                    size="sm"
                    className="px-3 h-9"
                    disabled={!newTodo.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Todo List */}
              <div className="flex-1 px-4 py-2 overflow-y-auto space-y-2 custom-scrollbar">
                {todos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Calendar className="w-10 h-10 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No tasks yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add your first task above</p>
                  </div>
                ) : (
                  todos.map((todo) => (
                    <Card
                      key={todo.id}
                      className={`p-3 transition-all duration-200 hover:shadow-md border ${
                        todo.completed ? 'bg-muted/30 border-border/50' : 'bg-card border-border/80'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <button
                          onClick={() => toggleTodo(todo.id)}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {todo.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs break-words font-medium ${
                              todo.completed
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            {todo.text}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(todo.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTodo(todo.id)}
                          className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Footer */}
              {todos.length > 0 && (
                <div className="p-3 border-t border-border flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTodos(todos.filter(t => !t.completed))}
                    className="w-full text-xs h-8"
                    disabled={completedTodosCount === 0}
                  >
                    Clear Completed ({completedTodosCount})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Assessment Modal when launched from daily task */}
      <Dialog
        open={!!activeQuizQuestions}
        onOpenChange={(open) => {
          if (!open) {
            setActiveQuizQuestions(null);
            setActiveQuizItem(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none z-50">
          <DialogHeader className="sr-only">
            <DialogTitle>{activeQuizItem?.title || 'Daily Task Assessment'}</DialogTitle>
            <DialogDescription>Interactive assessment session</DialogDescription>
          </DialogHeader>
          {activeQuizQuestions && activeQuizItem && (
            <div className="bg-background rounded-2xl border border-border p-6 shadow-2xl">
              <QuizViewer
                questions={activeQuizQuestions}
                title={activeQuizItem.title}
                difficulty="medium"
                topic={activeQuizItem.topic}
                userId={userId}
                onClose={() => {
                  setActiveQuizQuestions(null);
                  setActiveQuizItem(null);
                }}
                onComplete={(report) => {
                  handleQuizComplete(report, activeQuizItem);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
