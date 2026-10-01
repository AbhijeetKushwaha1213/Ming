import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
import { useAuth } from '@/components/auth/AuthProvider';

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
  const userId = user?.user_id || user?.id || 'default_user';

  const [plan, setPlan] = useState<DailyStudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  // Conversational Agent state
  const [chatQuery, setChatQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [agentAnswer, setAgentAnswer] = useState<{
    reply: string;
    recommendedTopic?: string;
    suggestedAction?: string;
  } | null>(null);

  // Load existing plan or generate
  useEffect(() => {
    async function loadPlan() {
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
    }

    loadPlan();
  }, [userId, examDate]);

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

  const handleAskAgent = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsChatLoading(true);
    try {
      const res = await askStudyAgent({
        userId,
        query: queryText.trim(),
        examDate,
      });
      if (res.success) {
        setAgentAnswer({
          reply: res.reply,
          recommendedTopic: res.recommendedTopic,
          suggestedAction: res.suggestedAction,
        });
      }
    } catch (err) {
      console.error('Failed to ask agent:', err);
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
          <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 flex items-center gap-1">
            <Target className="w-3 h-3 text-purple-600" />
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
    'What should I revise before my exam?',
    'Why are you recommending this?',
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
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200">
              New Learner Onboarding & Diagnostic Recommended
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              No verified assessment data found yet. Rather than fabricating mastery scores, the AI Study Agent
              recommends an initial diagnostic test to establish your personalized BKT knowledge baseline.
            </p>
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
      <div className="pt-4 border-t border-border space-y-4">
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

              {agentAnswer.suggestedAction && (
                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                  <span className="text-xs font-medium text-primary">
                    Next Step: {agentAnswer.suggestedAction}
                  </span>
                  {onNavigateToQuiz && (
                    <Button
                      size="sm"
                      variant="default"
                      className="text-xs h-7"
                      onClick={() => onNavigateToQuiz(agentAnswer.recommendedTopic)}
                    >
                      Start Recommended Action
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </Card>
  );
};
