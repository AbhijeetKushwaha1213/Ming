import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Bot,
  Sparkles,
  Clock,
  BookOpen,
  CheckCircle2,
  ListChecks,
  MessageSquare,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Target,
  AlertTriangle,
  FileText,
  Send,
  Layers,
  HelpCircle,
  Play,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  getDailyStudyPlan,
  generateDailyStudyPlan,
  updateStudyPlanItem,
  askStudyAgent,
  DailyStudyPlan,
  StudyPlanItem,
  PlanItemStatus,
  ActivityType,
} from '@/api/studyAgentAPI';
import { generateAssessment, AssessmentQuestion, DiagnosticReport } from '@/api/assessmentAPI';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { navigateToTab } from '@/utils/navigation';
import { QuizViewer } from '@/components/flashcards/QuizViewer';
import { 
  getWorkspaceCatalog, 
  getAgentWorkspacePrompt, 
  parseAgentActions, 
  executeAgentActions 
} from '@/services/agentActionEngine';
import { geminiClient } from '@/utils/geminiClient';
import { useQueryClient, QueryClient } from '@tanstack/react-query';

function useSafeQueryClient(): QueryClient | undefined {
  try {
    return useQueryClient();
  } catch {
    return undefined;
  }
}

interface AIStudyAgentPanelProps {
  onNavigateToQuiz?: (topic?: string) => void;
  onNavigateToChat?: (initialMessage?: string) => void;
  examDate?: string | null;
}

export const AIStudyAgentPanel: React.FC<AIStudyAgentPanelProps> = ({
  onNavigateToQuiz,
  onNavigateToChat,
  examDate,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useSafeQueryClient();
  const userId = user?.user_id || user?.id || 'default_user';

  const [plan, setPlan] = useState<DailyStudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  // Interactive in-panel Assessment & Task execution state
  const [activeQuizItem, setActiveQuizItem] = useState<StudyPlanItem | null>(null);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<AssessmentQuestion[] | null>(null);
  const [isLaunchingQuiz, setIsLaunchingQuiz] = useState<string | null>(null);

  // Conversational Agent state
  const [chatQuery, setChatQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [agentAnswer, setAgentAnswer] = useState<{
    reply: string;
    recommendedTopic?: string;
    suggestedAction?: string;
    actionType?: 'quiz' | 'resources';
    actionsExecuted?: string[];
  } | null>(null);

  // Load existing plan or generate
  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getDailyStudyPlan(userId);
      if (res.success && res.plan) {
        setPlan(res.plan);
      } else {
        // Auto-generate today's plan
        const genRes = await generateDailyStudyPlan({ userId, examDate, targetMinutes: 60 });
        if (genRes.success && genRes.plan) {
          setPlan(genRes.plan);
        }
      }
    } catch (err) {
      console.error('Failed to load study plan:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, examDate]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleGenerate = async (force: boolean = false) => {
    setIsGenerating(true);
    try {
      const res = await generateDailyStudyPlan({
        userId,
        examDate,
        targetMinutes: 60,
        forceRegenerate: force,
      });
      if (res.success && res.plan) {
        setPlan(res.plan);
      }
    } catch (err) {
      console.error('Error generating study plan:', err);
    } finally {
      setIsGenerating(false);
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
        } catch (err) {
          console.warn('Falling back to baseline diagnostic assessment questions:', err);
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
            },
            {
              question_id: `q_diag_3_${Date.now()}`,
              type: 'MCQ',
              topic: item.topic || 'Problem Analysis',
              subtopic: item.subtopic || 'Problem Solving',
              difficulty: 'medium',
              question: `When analyzing problem constraints and complexity in ${item.topic || 'this subject'}, what is the first step?`,
              options: [
                `Immediately test random code without formulating invariants`,
                `Identify input/output boundaries, state transitions, and edge cases`,
                `Assume memory limits are infinite`,
                `Rely on unverified approximations`
              ],
              correct_answer: '1',
              explanation: `Deterministic problem solving begins by verifying input boundaries and state transitions.`,
              source_id: item.sourceId,
              citation_label: item.sourceTitle ? item.sourceTitle : 'Methodology Notes'
            }
          ];
          setActiveQuizQuestions(fallbackQuestions);
          setActiveQuizItem(item);
        } finally {
          setIsLaunchingQuiz(null);
        }
        break;

      case 'REVISE_FLASHCARDS':
        navigateToTab('flashcards', 'vault');
        toast({
          title: "Opening Study Vault 🔒",
          description: `Navigating to your Flashcard Vault to revise ${item.topic}.`,
        });
        break;

      case 'REVIEW_SOURCE':
        navigateToTab('resources', undefined, { sourceId: item.sourceId, sourceTitle: item.sourceTitle });
        toast({
          title: "Opening Course Material 📚",
          description: `Navigating to ${item.sourceTitle || 'Resources'}${item.sourceCoordinate ? ` (${item.sourceCoordinate})` : ''}.`,
        });
        break;

      case 'ASK_TUTOR':
        const promptText = `Explain ${item.topic}${item.subtopic ? ` (${item.subtopic})` : ''} to me. What are the key concepts and common pitfalls?`;
        setChatQuery(promptText);
        handleAskAgent(promptText);
        const chatSection = document.getElementById('agent-chat-section');
        if (chatSection) {
          chatSection.scrollIntoView({ behavior: 'smooth' });
        }
        break;

      case 'COMPLETE_UNFINISHED_TASK':
      default:
        handleToggleItemStatus(item);
        break;
    }
  };

  const handleQuizComplete = async (report: DiagnosticReport, item: StudyPlanItem) => {
    // 1. Mark task completed
    await handleToggleItemStatus(item);

    // 2. Toast success
    toast({
      title: "Diagnostic Assessment Completed! 🎉",
      description: `Scored ${report.percentage}% (${report.correctCount}/${report.totalQuestions}). Your BKT knowledge state has been updated.`,
    });

    // 3. Dispatch mastery refresh event so LearnerMasteryCard reloads
    window.dispatchEvent(new CustomEvent('studymate-bkt-refresh'));

    // 4. Reload study plan
    loadPlan();
  };

  const handleAskAgent = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsChatLoading(true);
    try {
      const isActionQuery = /(delete|remove|edit|modify|update|rename|create|folder|organize|move|copy\s+vault|vault\s+to\s+resource|add\s+notes\s+to|append|clean\s+up)/i.test(queryText);

      if (isActionQuery) {
        const catalog = await getWorkspaceCatalog();
        const workspacePrompt = getAgentWorkspacePrompt(catalog, "Dashboard Study Assistant");
        const directRes = await geminiClient.generateContent({
          message: queryText.trim(),
          systemPrompt: workspacePrompt,
        });

        if (directRes && directRes.response) {
          const { cleanText, actions } = parseAgentActions(directRes.response);
          const executed = await executeAgentActions(actions, queryClient);

          setAgentAnswer({
            reply: cleanText || "I've processed your workspace update.",
            actionsExecuted: executed.length > 0 ? executed : undefined,
            suggestedAction: executed.length > 0 ? "Review Updated Resources in Workspace" : undefined,
            actionType: 'resources',
          });

          if (executed.length > 0) {
            toast({
              title: "Workspace Actions Executed ⚡",
              description: executed.join(', '),
            });
          }
          return;
        }
      }

      const res = await askStudyAgent({
        userId,
        query: queryText.trim(),
        examDate,
      });

      if (res.success) {
        const { cleanText, actions } = parseAgentActions(res.reply);
        let executed: string[] = [];
        if (actions.length > 0) {
          executed = await executeAgentActions(actions, queryClient);
        }

        setAgentAnswer({
          reply: cleanText,
          recommendedTopic: res.recommendedTopic,
          suggestedAction: res.suggestedAction,
          actionType: 'quiz',
          actionsExecuted: executed.length > 0 ? executed : undefined,
        });
      }
    } catch (err) {
      console.error('Failed to ask agent:', err);
      try {
        const catalog = await getWorkspaceCatalog();
        const workspacePrompt = getAgentWorkspacePrompt(catalog, "Dashboard Study Assistant");
        const directRes = await geminiClient.generateContent({
          message: queryText.trim(),
          systemPrompt: workspacePrompt,
        });
        if (directRes?.response) {
          const { cleanText, actions } = parseAgentActions(directRes.response);
          const executed = await executeAgentActions(actions, queryClient);
          setAgentAnswer({
            reply: cleanText,
            actionsExecuted: executed.length > 0 ? executed : undefined,
            suggestedAction: executed.length > 0 ? "Review Updated Resources in Workspace" : undefined,
            actionType: 'resources',
          });
        }
      } catch (fallbackErr) {
        toast({
          title: "Agent Error",
          description: "Unable to process query. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const getActivityBadge = (type: ActivityType) => {
    switch (type) {
      case 'REVIEW_SOURCE':
        return (
          <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300 flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-sky-600" />
            Review Source
          </Badge>
        );
      case 'PRACTICE_ASSESSMENT':
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
            <Target className="w-3 h-3 text-primary" />
            Adaptive Quiz
          </Badge>
        );
      case 'PRACTICE_WEAK_CONCEPTS':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Weak Concept
          </Badge>
        );
      case 'REVISE_FLASHCARDS':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-600" />
            Flashcards
          </Badge>
        );
      case 'ASK_TUTOR':
        return (
          <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300 flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-indigo-600" />
            Ask Tutor
          </Badge>
        );
      case 'DIAGNOSTIC_ASSESSMENT':
        return (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-rose-600" />
            Diagnostic Baseline
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <ListChecks className="w-3 h-3" />
            Task
          </Badge>
        );
    }
  };

  const quickQuestions = [
    'What should I study today?',
    'What am I weak at?',
    'Organize my study resources into folders',
    'Copy my Vault quizzes and notes to Resources',
    'What should I do next?',
  ];

  const completedCount = plan?.items?.filter((i) => i.status === 'completed').length || 0;
  const totalItemsCount = plan?.items?.length || 0;
  const completionPct = totalItemsCount > 0 ? Math.round((completedCount / totalItemsCount) * 100) : 0;

  return (
    <Card className="p-6 border border-border shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">AI Study Agent & Daily Plan</h3>
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Deterministic Priority
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Personalized daily study path grounded in your Bayesian mastery state and uploaded course materials.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleGenerate(true)}
          disabled={isGenerating}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Regenerating...' : 'Regenerate Plan'}
        </Button>
      </div>

      {/* Progress & Target Stats */}
      {plan && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-xl border border-border/50 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs">Today's Target</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-primary" />
              {plan.totalPlannedMinutes} mins planned
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Tasks Completed</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {completedCount} of {totalItemsCount} ({completionPct}%)
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Daily Progress</span>
              <span>{completionPct}%</span>
            </div>
            <Progress value={completionPct} className="h-2" />
          </div>
        </div>
      )}

      {/* Cold Start Diagnostic Notice */}
      {plan?.isColdStart && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200">
              New Learner Onboarding & Diagnostic Recommended
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              No verified assessment data found yet. Rather than fabricating mastery scores, the AI Study Agent
              recommends an initial diagnostic test to establish your personalized BKT knowledge baseline.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  const diagItem = plan.items.find((i) => i.activityType === 'DIAGNOSTIC_ASSESSMENT') || {
                    id: 'cold_start_diag',
                    priority: 1,
                    priorityScore: 100,
                    topic: 'Course Materials',
                    subtopic: 'Diagnostic Baseline',
                    activityType: 'DIAGNOSTIC_ASSESSMENT' as ActivityType,
                    title: 'Take Course Diagnostic Assessment',
                    description: 'Calibrate your initial knowledge baseline across uploaded course materials.',
                    estimatedMinutes: 15,
                    reason: 'Required for personalized BKT mastery calibration.',
                    expectedOutcome: 'Calibrate initial knowledge state.',
                    sourceId: null,
                    chunkId: null,
                    sourceTitle: 'Uploaded Course Materials',
                    sourceCoordinate: 'Diagnostic Test',
                    status: 'pending' as PlanItemStatus,
                    completedAt: null,
                  };
                  handleStartTask(diagItem);
                }}
                disabled={!!isLaunchingQuiz}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs gap-1.5 shadow-xs"
              >
                {isLaunchingQuiz ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Take Diagnostic Assessment Now
              </Button>
              <button
                type="button"
                onClick={() => navigateToTab('flashcards', 'assessment')}
                className="text-xs text-amber-900 dark:text-amber-200 hover:underline flex items-center gap-1 font-medium"
              >
                Open in Assessment Studio <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Items List */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Generating personalized daily plan...
        </div>
      ) : !plan || plan.items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No study tasks planned for today.</p>
          <Button onClick={() => handleGenerate(true)} className="mt-3" size="sm">
            Generate Study Plan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              Recommended Study Activities ({plan.items.length})
            </h4>
            <span className="text-xs text-muted-foreground">Ordered by priority score</span>
          </div>

          <div className="space-y-3">
            {plan.items.map((item) => {
              const isExpanded = !!expandedReasons[item.id];
              const isCompleted = item.status === 'completed';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCompleted
                      ? 'bg-emerald-500/5 border-emerald-500/20 opacity-80'
                      : 'bg-card border-border hover:border-primary/40 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Completion Checkbox */}
                      <button
                        onClick={() => handleToggleItemStatus(item)}
                        className={`mt-1 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-muted-foreground/40 hover:border-primary'
                        }`}
                        title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                      >
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      {/* Content */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-xs text-primary px-1.5 py-0.5 rounded bg-primary/10">
                            #{item.priority}
                          </span>
                          {getActivityBadge(item.activityType)}
                          <span
                            className={`text-sm font-bold ${
                              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">{item.description}</p>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            {item.estimatedMinutes} mins
                          </span>

                          {item.sourceTitle && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted">
                              <FileText className="w-3 h-3 text-sky-600" />
                              {item.sourceTitle}
                              {item.sourceCoordinate ? ` (${item.sourceCoordinate})` : ''}
                            </span>
                          )}

                          <button
                            onClick={() => toggleReason(item.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-0.5 font-medium ml-auto"
                          >
                            Why this?
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* Action Buttons & Navigation Reference Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/50 mt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.activityType === 'DIAGNOSTIC_ASSESSMENT' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                disabled={isLaunchingQuiz === item.id}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                {isLaunchingQuiz === item.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                                Take Diagnostic Assessment
                              </Button>
                            )}

                            {item.activityType === 'PRACTICE_ASSESSMENT' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                disabled={isLaunchingQuiz === item.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                {isLaunchingQuiz === item.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                                Start Practice Quiz
                              </Button>
                            )}

                            {item.activityType === 'PRACTICE_WEAK_CONCEPTS' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                disabled={isLaunchingQuiz === item.id}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                {isLaunchingQuiz === item.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Target className="w-3.5 h-3.5" />
                                )}
                                Practice Weak Topic
                              </Button>
                            )}

                            {item.activityType === 'REVISE_FLASHCARDS' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                Study Flashcards in Vault
                              </Button>
                            )}

                            {item.activityType === 'REVIEW_SOURCE' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Open Course Material
                              </Button>
                            )}

                            {item.activityType === 'ASK_TUTOR' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                <Bot className="w-3.5 h-3.5" />
                                Ask AI Tutor
                              </Button>
                            )}

                            {item.activityType === 'COMPLETE_UNFINISHED_TASK' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(item)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-1.5 shadow-xs h-8 px-3"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                Resume Task
                              </Button>
                            )}

                            {/* Reference navigation link */}
                            {(item.activityType === 'DIAGNOSTIC_ASSESSMENT' || item.activityType === 'PRACTICE_ASSESSMENT' || item.activityType === 'PRACTICE_WEAK_CONCEPTS') && (
                              <button
                                type="button"
                                onClick={() => navigateToTab('flashcards', 'assessment', { topic: item.topic })}
                                className="text-xs text-primary dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium px-2 py-1"
                              >
                                Assessment Studio <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {item.activityType === 'REVISE_FLASHCARDS' && (
                              <button
                                type="button"
                                onClick={() => navigateToTab('flashcards', 'vault')}
                                className="text-xs text-primary dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium px-2 py-1"
                              >
                                My Vault <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {item.activityType === 'REVIEW_SOURCE' && (
                              <button
                                type="button"
                                onClick={() => navigateToTab('resources', undefined, { sourceId: item.sourceId, sourceTitle: item.sourceTitle })}
                                className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium px-2 py-1"
                              >
                                Resources <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            {item.activityType === 'ASK_TUTOR' && (
                              <button
                                type="button"
                                onClick={() => navigateToTab('ai')}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium px-2 py-1"
                              >
                                AI Chat <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Source citation badge reference */}
                          {item.sourceTitle && (
                            <button
                              type="button"
                              onClick={() => navigateToTab('resources', undefined, { sourceId: item.sourceId, sourceTitle: item.sourceTitle })}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 bg-muted/60 hover:bg-muted px-2 py-1 rounded transition-colors"
                              title={`Open ${item.sourceTitle}${item.sourceCoordinate ? ` (${item.sourceCoordinate})` : ''}`}
                            >
                              <FileText className="w-3 h-3 text-sky-600 shrink-0" />
                              <span className="truncate max-w-[150px]">{item.sourceTitle}</span>
                              {item.sourceCoordinate && (
                                <span className="font-semibold text-primary">({item.sourceCoordinate})</span>
                              )}
                              <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                            </button>
                          )}
                        </div>

                        {/* "Why this?" Explanation Accordion */}
                        {isExpanded && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/60 border border-border/60 space-y-2 text-xs">
                            <div>
                              <span className="font-semibold text-foreground block">Deterministic Rationale:</span>
                              <p className="text-muted-foreground mt-0.5">{item.reason}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground block">Expected Learning Outcome:</span>
                              <p className="text-muted-foreground mt-0.5">{item.expectedOutcome}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversational Agent Entry Point */}
      <div className="pt-4 border-t border-border space-y-4" id="agent-chat-section">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Ask the AI Study Agent</h4>
          <span className="text-xs text-muted-foreground">(Grounded in your real BKT learner state)</span>
        </div>

        {/* Quick prompt pills */}
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setChatQuery(q);
                handleAskAgent(q);
              }}
              disabled={isChatLoading}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:text-accent-foreground text-foreground transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Agent Question Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAgent(chatQuery);
          }}
          className="flex gap-2"
        >
          <Input
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            placeholder="Ask agent: What should I study today? What am I weak at?..."
            className="text-sm"
            disabled={isChatLoading}
          />
          <Button type="submit" disabled={isChatLoading || !chatQuery.trim()} size="sm">
            <Send className="w-4 h-4 mr-1" />
            Ask
          </Button>
        </form>

        {/* Agent Answer Bubble */}
        {isChatLoading ? (
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-center text-xs text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2 text-primary" />
            Analyzing your verified Bayesian mastery and course records...
          </div>
        ) : (
          agentAnswer && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-start gap-2">
                <Bot className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-foreground whitespace-pre-line flex-1">
                  {agentAnswer.reply}
                </div>
              </div>

              {/* Executed Workspace Actions Badge */}
              {agentAnswer.actionsExecuted && agentAnswer.actionsExecuted.length > 0 && (
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Workspace Actions Executed ({agentAnswer.actionsExecuted.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-primary hover:underline cursor-pointer"
                      onClick={() => navigateToTab('resources')}
                    >
                      Open Resources ↗
                    </Button>
                  </div>
                  {agentAnswer.actionsExecuted.map((summary, idx) => (
                    <div key={idx} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{summary}</span>
                    </div>
                  ))}
                </div>
              )}

              {agentAnswer.suggestedAction && (
                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                  <span className="text-xs font-medium text-primary">
                    Next Step: {agentAnswer.suggestedAction}
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    className="text-xs h-7 gap-1"
                    onClick={() => {
                      if (agentAnswer.actionType === 'resources') {
                        navigateToTab('resources');
                      } else if (onNavigateToQuiz) {
                        onNavigateToQuiz(agentAnswer.recommendedTopic);
                      } else {
                        navigateToTab('flashcards', 'assessment', { topic: agentAnswer.recommendedTopic });
                      }
                    }}
                  >
                    Start Recommended Action
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Interactive In-Dashboard Assessment Modal */}
      <Dialog
        open={!!activeQuizQuestions}
        onOpenChange={(open) => {
          if (!open) {
            setActiveQuizQuestions(null);
            setActiveQuizItem(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{activeQuizItem?.title || 'Course Assessment'}</DialogTitle>
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
    </Card>
  );
};
