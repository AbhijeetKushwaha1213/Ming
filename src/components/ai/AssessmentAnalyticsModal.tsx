import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Calendar,
  BookOpen,
  Lightbulb,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Target,
} from 'lucide-react';
import { getDiagnosticAttempt, DiagnosticReport, AssessmentQuestion } from '@/api/assessmentAPI';
import { navigateToTab } from '@/utils/navigation';

export interface AssessmentAttemptGroup {
  key: string;
  title: string;
  topic: string;
  subtopic?: string | null;
  difficulty: string;
  bestScore: number;
  latestScore: number;
  totalQuestions: number;
  attempts: any[];
  latestAttempt: any;
}

interface AssessmentAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: AssessmentAttemptGroup | null;
  selectedAttempt: any | null;
  userId?: string;
  onRetake: (attempt: any) => void;
}

export const AssessmentAnalyticsModal: React.FC<AssessmentAnalyticsModalProps> = ({
  isOpen,
  onClose,
  group,
  selectedAttempt,
  userId = 'default_user',
  onRetake,
}) => {
  const [currentAttempt, setCurrentAttempt] = useState<any>(selectedAttempt);
  const [fullDiagnostic, setFullDiagnostic] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (selectedAttempt) {
      setCurrentAttempt(selectedAttempt);
    } else if (group?.latestAttempt) {
      setCurrentAttempt(group.latestAttempt);
    }
  }, [selectedAttempt, group]);

  // Load detailed attempt questions & evaluations if not already in memory
  useEffect(() => {
    if (!isOpen || !currentAttempt?.id) return;

    let isMounted = true;
    async function fetchDetails() {
      setIsLoading(true);
      try {
        const details = await getDiagnosticAttempt(currentAttempt.id, userId);
        if (isMounted && details) {
          setFullDiagnostic(details);
        }
      } catch (err) {
        console.warn('Could not load detailed diagnostic for attempt:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentAttempt?.id, userId]);

  if (!isOpen || !group || !currentAttempt) return null;

  const report: DiagnosticReport | null =
    fullDiagnostic?.diagnosticReport || currentAttempt.diagnosticReport || null;

  const questions: AssessmentQuestion[] =
    fullDiagnostic?.questions || currentAttempt.questions || [];

  const answers: any[] = fullDiagnostic?.answers || currentAttempt.answers || [];

  const attemptsList = group.attempts || [currentAttempt];
  const isMultipleAttempts = attemptsList.length > 1;

  // Comparison metrics between oldest and latest
  const sortedByTimeAsc = [...attemptsList].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  const firstAttempt = sortedByTimeAsc[0];
  const latestAttempt = sortedByTimeAsc[sortedByTimeAsc.length - 1];
  const scoreGain = Math.round(latestAttempt.percentage - firstAttempt.percentage);

  const strongConcepts: string[] =
    report?.strongConcepts ||
    (report?.topicPerformance
      ? Object.entries(report.topicPerformance)
          .filter(([_, perf]) => perf.percentage >= 70)
          .map(([t]) => t)
      : []);

  const weakConcepts: string[] =
    report?.weakConcepts ||
    (report?.topicPerformance
      ? Object.entries(report.topicPerformance)
          .filter(([_, perf]) => perf.percentage < 70)
          .map(([t]) => t)
      : []);

  const getScoreBadgeClass = (pct: number) => {
    if (pct >= 80) return 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300';
    if (pct >= 60) return 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300';
    return 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300';
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-0 gap-0 border-border shadow-xl">
        {/* Modal Header */}
        <div className="p-6 border-b border-border bg-card sticky top-0 z-10">
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Assessment Analytics
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {group.title} • {group.topic}
                    {group.subtopic ? ` / ${group.subtopic}` : ''}
                  </DialogDescription>
                </div>
              </div>

              <Badge variant="outline" className={getScoreBadgeClass(currentAttempt.percentage)}>
                Score: {currentAttempt.percentage}%
              </Badge>
            </div>
          </DialogHeader>

          {/* Attempt Selector (If multiple attempts exist) */}
          {isMultipleAttempts && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" />
                Attempt History ({attemptsList.length} attempts):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {attemptsList.map((att, idx) => {
                  const attemptNumber = attemptsList.length - idx;
                  const isSelected = att.id === currentAttempt.id;
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => setCurrentAttempt(att)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Attempt {attemptNumber} ({att.percentage}%)
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5 border bg-muted/20 text-center space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Overall Score
              </span>
              <p className={`text-2xl font-black ${getScoreColor(currentAttempt.percentage)}`}>
                {currentAttempt.percentage}%
              </p>
              <span className="text-[11px] text-muted-foreground">
                {currentAttempt.score}/{currentAttempt.totalQuestions} Questions
              </span>
            </Card>

            <Card className="p-3.5 border bg-muted/20 text-center space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Accuracy
              </span>
              <p className="text-2xl font-black text-foreground">
                {Math.round((currentAttempt.score / currentAttempt.totalQuestions) * 100)}%
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">
                {currentAttempt.score} Correct
              </span>
            </Card>

            <Card className="p-3.5 border bg-muted/20 text-center space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Difficulty
              </span>
              <p className="text-2xl font-black capitalize text-foreground">
                {currentAttempt.difficulty}
              </p>
              <span className="text-[11px] text-muted-foreground">Adaptive Level</span>
            </Card>

            <Card className="p-3.5 border bg-muted/20 text-center space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Date Completed
              </span>
              <p className="text-sm font-bold text-foreground mt-2">
                {new Date(currentAttempt.completedAt).toLocaleDateString()}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {new Date(currentAttempt.completedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </Card>
          </div>

          {/* Multi-Attempt Progression Comparison (if applicable) */}
          {isMultipleAttempts && (
            <Card className="p-4 border-border bg-secondary/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-bold text-foreground">
                    Attempt Progression & Improvement
                  </h4>
                </div>
                {scoreGain > 0 ? (
                  <Badge className="bg-emerald-600 text-white text-xs">
                    ▲ +{scoreGain}% Improvement
                  </Badge>
                ) : scoreGain === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    Consistent Score
                  </Badge>
                ) : (
                  <Badge className="bg-amber-600 text-white text-xs">
                    {scoreGain}% vs Baseline
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {sortedByTimeAsc.map((att, idx) => {
                  const num = idx + 1;
                  const isCurrent = att.id === currentAttempt.id;
                  return (
                    <div
                      key={att.id}
                      className={`flex items-center justify-between text-xs p-2 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'border-indigo-300 bg-white dark:bg-card shadow-xs font-semibold'
                          : 'border-border/60 bg-background/50 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">Attempt {num}</span>
                        {num === 1 && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-dashed">
                            Initial Baseline
                          </Badge>
                        )}
                        {num === sortedByTimeAsc.length && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 text-indigo-600 border-indigo-300">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-foreground">{att.percentage}%</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(att.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Strong Areas vs Weak Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Strong Areas (Mastered)
                </h4>
              </div>
              {strongConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {strongConcepts.map((concept, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="border-emerald-300 bg-white dark:bg-card text-emerald-800 dark:text-emerald-300 text-xs font-semibold"
                    >
                      ✓ {concept}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Keep practicing to reach the 70% mastery threshold in core subtopics.
                </p>
              )}
            </Card>

            <Card className="p-4 border-rose-200/80 bg-rose-50/30 dark:bg-rose-950/20 space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Weak Areas (Needs Review)
                </h4>
              </div>
              {weakConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {weakConcepts.map((concept, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="border-rose-300 bg-white dark:bg-card text-rose-800 dark:text-rose-300 text-xs font-semibold"
                    >
                      ⚠ {concept}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Excellent! No weak concepts identified in this attempt.
                </p>
              )}
            </Card>
          </div>

          {/* Topic & Subtopic Performance */}
          {report?.topicPerformance && Object.keys(report.topicPerformance).length > 0 && (
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Topic & Subtopic Performance Breakdown
              </h4>
              <div className="space-y-3">
                {Object.entries(report.topicPerformance).map(([tName, perf]) => (
                  <div key={tName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-foreground">{tName}</span>
                      <span className="font-semibold text-foreground">
                        {perf.correct}/{perf.total} ({perf.percentage}%)
                      </span>
                    </div>
                    <Progress value={perf.percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommended Next Steps */}
          <Card className="p-4 border-border bg-secondary/50 space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              Recommended Next Steps
            </h4>
            <div className="space-y-2 text-xs">
              {weakConcepts.length > 0 ? (
                <>
                  {weakConcepts.slice(0, 3).map((wc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between"
                    >
                      <span className="text-foreground font-medium">
                        → Review <strong className="text-primary font-semibold">{wc}</strong> concepts & notes
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onClose();
                          navigateToTab('resources');
                        }}
                        className="h-6 text-[11px] text-primary hover:text-primary/80 hover:bg-primary/10 px-2"
                      >
                        Open Notes ↗
                      </Button>
                    </div>
                  ))}
                  <div className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      → Retake this assessment after reviewing weak concepts
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        onClose();
                        onRetake(currentAttempt);
                      }}
                      className="h-6 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retake Now
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-2.5 rounded-lg bg-background border border-emerald-100 dark:border-emerald-900/50 text-foreground font-medium flex items-center justify-between">
                  <span>→ Mastery achieved! Proceed to next course topic or try a higher difficulty level.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onRetake(currentAttempt);
                    }}
                    className="h-6 text-[11px] px-2.5"
                  >
                    Take Again
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Question-by-Question Detailed Review */}
          {questions.length > 0 && (
            <Card className="p-4 space-y-4">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Question-by-Question Detailed Result ({questions.length} Items)
              </h4>

              <div className="space-y-3">
                {questions.map((q, idx) => {
                  const studentAns = answers[idx] ?? (report?.incorrectAnswers?.find((i) => i.questionId === q.question_id)?.userAnswer);
                  const isIncorrect = report?.incorrectAnswers?.some(
                    (i) => i.questionId === q.question_id || i.question === q.question
                  );
                  const isCorrect = !isIncorrect;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                        isCorrect
                          ? 'border-emerald-200/80 bg-emerald-50/20 dark:bg-emerald-950/10'
                          : 'border-rose-200/80 bg-rose-50/20 dark:bg-rose-950/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                          )}
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground text-sm">
                              Q{idx + 1}. {q.question}
                            </span>
                            {q.subtopic && (
                              <p className="text-[11px] text-muted-foreground">
                                Subtopic: {q.subtopic}
                              </p>
                            )}
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={
                            isCorrect
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]'
                              : 'border-rose-300 text-rose-700 bg-rose-50 text-[10px]'
                          }
                        >
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </Badge>
                      </div>

                      <div className="pl-6 space-y-1 text-xs">
                        <p>
                          <span className="text-muted-foreground font-medium">Your Answer: </span>
                          <span className={isCorrect ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                            {String(studentAns || 'Unanswered')}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p>
                            <span className="text-muted-foreground font-medium">Correct Answer: </span>
                            <span className="text-emerald-700 font-semibold">{String(q.correct_answer)}</span>
                          </p>
                        )}
                        {q.explanation && (
                          <div className="p-2 rounded bg-background/80 border border-border/80 text-[11px] text-muted-foreground mt-1">
                            <strong className="text-foreground">Explanation: </strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-2 sticky bottom-0 z-10">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
            Close
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onClose();
              onRetake(currentAttempt);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retake Assessment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
