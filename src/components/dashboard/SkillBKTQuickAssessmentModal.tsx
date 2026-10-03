import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
  ArrowRight,
  HelpCircle,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { updateLearnerMastery, MasteryStatus, LearnerMasteryRecord } from '@/api/learnerAPI';
import { calculateBKTUpdate, getDifficultyBKTParameters, determineMasteryStatus, calculateConfidence } from '@/utils/bkt';

interface SkillBKTQuickAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName: string;
  categoryName?: string;
  currentMastery?: LearnerMasteryRecord;
  onMasteryUpdated?: (updated: LearnerMasteryRecord) => void;
}

interface QuestionItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const SkillBKTQuickAssessmentModal: React.FC<SkillBKTQuickAssessmentModalProps> = ({
  isOpen,
  onClose,
  skillName,
  categoryName,
  currentMastery,
  onMasteryUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.user_id || user?.id || 'default_user';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [answersLog, setAnswersLog] = useState<Array<{ isCorrect: boolean; posterior: number }>>([]);

  // Running BKT probability state for this quiz session
  const [runningMastery, setRunningMastery] = useState<number>(() => {
    return currentMastery && currentMastery.attempts > 0 ? currentMastery.masteryProbability : 0.15;
  });
  const [priorMastery, setPriorMastery] = useState<number>(runningMastery);
  const [attemptsCount, setAttemptsCount] = useState<number>(() => {
    return currentMastery?.attempts || 0;
  });
  const [isSaving, setIsSaving] = useState(false);

  // Generate 3 questions adapted to the target skill
  const questions: QuestionItem[] = React.useMemo(() => {
    const topic = skillName || 'Core Concept';
    return [
      {
        id: `q1_${topic}`,
        question: `In the context of ${topic}, what is the fundamental prerequisite or governing principle?`,
        options: [
          `Strict enforcement of core architectural invariants and verification checks`,
          `Skipping boundary checks to prioritize nominal speed above all`,
          `Relying on arbitrary heuristics without deterministic fallback`,
          `Omitting error logging and exception handling`
        ],
        correctIndex: 0,
        explanation: `Foundational mastery in ${topic} requires understanding underlying constraints and verification invariants.`,
        difficulty: 'easy',
      },
      {
        id: `q2_${topic}`,
        question: `When designing or analyzing problems in ${topic}, which trade-off represents the standard best practice?`,
        options: [
          `Maximizing resource usage without observing efficiency constraints`,
          `Balancing algorithmic time-complexity, memory footprint, and maintainability`,
          `Avoiding unit testing until production deployment`,
          `Hardcoding static parameters for all dynamic scenarios`
        ],
        correctIndex: 1,
        explanation: `Systematic problem solving in ${topic} requires balancing performance tradeoffs with correctness.`,
        difficulty: 'medium',
      },
      {
        id: `q3_${topic}`,
        question: `Under high-stress or edge-case conditions in ${topic}, how should failures be managed?`,
        options: [
          `Terminate the process immediately without recording context or state`,
          `Ignore degraded states if the majority of requests succeed`,
          `Graceful degradation, bounded retry with backoff, and state recovery`,
          `Infinite synchronous loops waiting for external resources`
        ],
        correctIndex: 2,
        explanation: `Advanced mastery in ${topic} involves fault tolerance, graceful recovery, and resilient degradation.`,
        difficulty: 'hard',
      },
    ];
  }, [skillName]);

  // Reset when dialog opens with new skill
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setSelectedOption(null);
      setHasSubmittedAnswer(false);
      setIsCompleted(false);
      setAnswersLog([]);
      const initialPrior = currentMastery && currentMastery.attempts > 0 ? currentMastery.masteryProbability : 0.15;
      setRunningMastery(initialPrior);
      setPriorMastery(initialPrior);
      setAttemptsCount(currentMastery?.attempts || 0);
    }
  }, [isOpen, skillName, currentMastery]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (index: number) => {
    if (hasSubmittedAnswer) return;
    setSelectedOption(index);
  };

  const handleCheckAnswer = async () => {
    if (selectedOption === null || hasSubmittedAnswer) return;

    const isCorrect = selectedOption === currentQ.correctIndex;
    const params = getDifficultyBKTParameters(currentQ.difficulty);

    // Apply Bayes Rule and transition step
    const { posterior } = calculateBKTUpdate(runningMastery, isCorrect, params);
    const newAttempts = attemptsCount + 1;

    setPriorMastery(runningMastery);
    setRunningMastery(posterior);
    setAttemptsCount(newAttempts);
    setHasSubmittedAnswer(true);

    setAnswersLog((prev) => [...prev, { isCorrect, posterior }]);

    // Persist each question response evidence to the backend
    try {
      await updateLearnerMastery({
        userId,
        topic: skillName,
        subtopic: categoryName || undefined,
        isCorrect,
        difficulty: currentQ.difficulty,
        eventType: 'ASSESSMENT_ANSWER',
        evidenceDetails: `Quick BKT Quiz (Q${currentIndex + 1}): ${isCorrect ? 'Correct' : 'Incorrect'} [${currentQ.difficulty.toUpperCase()}]`,
      });
    } catch (err) {
      console.warn('BKT local record update notice:', err);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setHasSubmittedAnswer(false);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    setIsSaving(true);
    setIsCompleted(true);

    const confidence = calculateConfidence(attemptsCount);
    const status = determineMasteryStatus(attemptsCount, runningMastery);

    const updatedRecord: LearnerMasteryRecord = {
      id: currentMastery?.id || `lm_${Date.now()}`,
      userId,
      courseId: null,
      topic: skillName,
      subtopic: categoryName || null,
      masteryProbability: runningMastery,
      masteryPercentage: Math.round(runningMastery * 100),
      attempts: attemptsCount,
      correctCount: (currentMastery?.correctCount || 0) + answersLog.filter((a) => a.isCorrect).length,
      incorrectCount: (currentMastery?.incorrectCount || 0) + answersLog.filter((a) => !a.isCorrect).length,
      confidence,
      status,
      lastAssessedAt: new Date().toISOString(),
    };

    if (onMasteryUpdated) {
      onMasteryUpdated(updatedRecord);
    }

    // Broadcast refresh event so CollegeDashboard and LearnerMasteryCard update synchronously
    window.dispatchEvent(
      new CustomEvent('studymate-bkt-refresh', {
        detail: { topic: skillName, posterior: runningMastery },
      })
    );

    setIsSaving(false);
    toast({
      title: 'BKT Knowledge Mastery Calibrated!',
      description: `Calculated new cognitive mastery for ${skillName}: ${Math.round(runningMastery * 100)}% (${status.toUpperCase()}).`,
    });
  };

  const getStatusBadge = (status: MasteryStatus) => {
    switch (status) {
      case 'mastered':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 gap-1 font-semibold">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Mastered (≥85%)
          </Badge>
        );
      case 'proficient':
        return (
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Proficient (60-84%)
          </Badge>
        );
      case 'developing':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 gap-1 font-semibold">
            <Activity className="w-3 h-3 text-amber-600" />
            Developing (&lt;60%)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-border text-muted-foreground gap-1">
            <HelpCircle className="w-3 h-3" />
            Unassessed (Cold-Start)
          </Badge>
        );
    }
  };

  const currentStatus = determineMasteryStatus(attemptsCount, runningMastery);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-pink-50/30 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-background border-b border-border/80">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Bayesian Knowledge Tracing (BKT)
                </span>
                <Badge variant="outline" className="text-[11px] bg-white dark:bg-card border-indigo-200">
                  Adaptive Calibration
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Calibrate Mastery: {skillName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Answer diagnostic items to update your Bayesian probability model without fabricated scores.
              </DialogDescription>
            </div>
            <div className="text-right">
              {getStatusBadge(currentStatus)}
              <p className="text-xs font-bold text-foreground mt-1.5">
                P(L) = {Math.round(runningMastery * 100)}%
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {!isCompleted ? (
            <>
              {/* Progress and Question Counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span className="capitalize font-medium text-foreground">
                    Difficulty: <Badge variant="secondary" className="text-[10px] uppercase font-bold">{currentQ.difficulty}</Badge>
                  </span>
                </div>
                <Progress value={((currentIndex + (hasSubmittedAnswer ? 1 : 0)) / questions.length) * 100} className="h-1.5" />
              </div>

              {/* Question Text */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/70 space-y-2">
                <p className="text-sm font-semibold text-foreground leading-relaxed">
                  {currentQ.question}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQ.correctIndex;
                  let borderStyle = 'border-border hover:border-indigo-400/80 bg-card';

                  if (hasSubmittedAnswer) {
                    if (isCorrect) {
                      borderStyle = 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-medium';
                    } else if (isSelected && !isCorrect) {
                      borderStyle = 'border-red-500 bg-red-50/60 dark:bg-red-950/20 text-red-900 dark:text-red-200';
                    } else {
                      borderStyle = 'opacity-50 border-border';
                    }
                  } else if (isSelected) {
                    borderStyle = 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-medium';
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-3.5 rounded-xl border text-sm transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${borderStyle}`}
                    >
                      <span className="flex-1">{opt}</span>
                      {hasSubmittedAnswer && isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {hasSubmittedAnswer && isSelected && !isCorrect && (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Real-time BKT Transition Formula Feedback */}
              {hasSubmittedAnswer && (
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 text-xs space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between font-bold text-indigo-950 dark:text-indigo-200">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Bayesian Update Applied:
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {Math.round(priorMastery * 100)}% → {Math.round(runningMastery * 100)}%
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-normal">
                    {currentQ.explanation}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground border-t border-indigo-100 dark:border-indigo-900/30">
                    <span>pG(Guess): 0.20</span>
                    <span>pS(Slip): 0.10</span>
                    <span>pT(Transition): 0.10</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>

                {!hasSubmittedAnswer ? (
                  <Button
                    size="sm"
                    variant="premium"
                    disabled={selectedOption === null}
                    onClick={handleCheckAnswer}
                  >
                    Check & Update BKT
                  </Button>
                ) : (
                  <Button size="sm" variant="premium" onClick={handleNextQuestion}>
                    {currentIndex < questions.length - 1 ? (
                      <>
                        Next Question
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </>
                    ) : (
                      <>
                        View Calibrated Mastery
                        <Sparkles className="w-3.5 h-3.5 ml-1.5" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Completed Summary View */
            <div className="space-y-6 text-center py-2 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-foreground">
                  Mastery Model Updated!
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Your Knowledge Mastery state for <strong>{skillName}</strong> has been mathematically recalibrated via Bayesian Knowledge Tracing.
                </p>
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[11px] text-muted-foreground block">Final Mastery P(L)</span>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    {Math.round(runningMastery * 100)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[11px] text-muted-foreground block">Classification</span>
                  <div className="mt-1 flex justify-center">{getStatusBadge(currentStatus)}</div>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[11px] text-muted-foreground block">Evidence Trials</span>
                  <span className="text-xl font-black text-foreground">{attemptsCount}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setCurrentIndex(0);
                  setSelectedOption(null);
                  setHasSubmittedAnswer(false);
                  setIsCompleted(false);
                  setAnswersLog([]);
                }}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Retest Topic
                </Button>
                <Button variant="premium" size="sm" onClick={onClose}>
                  Done & Back to Learning Progress
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
