import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Sparkles, CheckCircle2, Circle, Clock, Target, AlertTriangle, 
  BookOpen, ExternalLink, RotateCcw, Brain, ShieldCheck, 
  FolderOpen, Layers, Play, Check, ChevronDown, ChevronUp,
  Flame, ArrowRight, Code, Video, FileText
} from 'lucide-react';
import { DailyLearningPlan, DailyPlanTask } from '@/types/dailyPlan';
import { 
  getDailyPlan, 
  saveDailyPlan, 
  toggleDailyPlanTask, 
  getTodayDateString 
} from '@/utils/dailyPlanStorage';
import { generateDailyPlan } from '@/utils/dailyPlanGenerator';
import { useLearnerMastery } from '@/hooks/useLearnerMastery';
import { useCourseResources } from '@/hooks/useCourseResources';
import { useSavedDAGs } from '@/hooks/useSavedDAGs';
import { useFlashcards } from '@/hooks/useFlashcards';
import { navigateToTab } from '@/utils/navigation';
import { useToast } from '@/hooks/use-toast';

interface DailyLearningPlanCardProps {
  userId: string;
  skillOrProjectId: string;
  skillName: string;
  projectType?: string;
  assignedTasks?: Array<{ id: any; title: string; completed?: boolean }>;
  onAskAiTutor?: (context: {
    skill: string;
    topic: string;
    taskTitle: string;
    resourceTitle?: string;
    masteryPercentage?: number;
    planSummary?: string;
  }) => void;
  onPlanProgressChange?: (progressPercent: number) => void;
}

export const DailyLearningPlanCard: React.FC<DailyLearningPlanCardProps> = ({
  userId,
  skillOrProjectId,
  skillName,
  projectType = 'skill',
  assignedTasks = [],
  onAskAiTutor,
  onPlanProgressChange
}) => {
  const { toast } = useToast();
  const todayDate = getTodayDateString();

  // Integrated hooks for knowledge models & library resources
  const { masteryList } = useLearnerMastery();
  const { resources: uploadedResources } = useCourseResources();
  const { savedDAGs } = useSavedDAGs();
  const { studyMaterials } = useFlashcards();

  // State
  const [plan, setPlan] = useState<DailyLearningPlan | null>(() => {
    return getDailyPlan(userId, skillOrProjectId, todayDate);
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(() => {
    return plan?.targetStudyMinutes || 60;
  });
  const [selectedCodingPlatform, setSelectedCodingPlatform] = useState<'LeetCode' | 'HackerRank' | 'Codeforces'>(() => {
    return plan?.preferredCodingPlatform || 'LeetCode';
  });

  // Sync state if skillOrProjectId changes
  useEffect(() => {
    const existing = getDailyPlan(userId, skillOrProjectId, todayDate);
    setPlan(existing);
    if (existing) {
      setSelectedMinutes(existing.targetStudyMinutes);
      setSelectedCodingPlatform(existing.preferredCodingPlatform);
    }
  }, [userId, skillOrProjectId, todayDate]);

  // Compute metrics
  const completedCount = useMemo(() => {
    return plan?.tasks?.filter(t => t.completed).length || 0;
  }, [plan]);

  const totalCount = useMemo(() => {
    return plan?.tasks?.length || 0;
  }, [plan]);

  const progressPercent = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((completedCount / totalCount) * 100);
  }, [completedCount, totalCount]);

  // Notify parent of progress change
  useEffect(() => {
    if (onPlanProgressChange && plan) {
      onPlanProgressChange(progressPercent);
    }
  }, [progressPercent, plan, onPlanProgressChange]);

  // Format today's display date (e.g. "Monday, Oct 5, 2026")
  const formattedToday = useMemo(() => {
    try {
      return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return todayDate;
    }
  }, [todayDate]);

  // Generate Plan Handler
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      // Simulate micro-generation latency to feel intelligent and deliberate
      await new Promise(r => setTimeout(r, 600));

      const newPlan = generateDailyPlan({
        userId,
        skillOrProjectId,
        skillName,
        projectType,
        assignedTasks,
        targetStudyMinutes: selectedMinutes,
        preferredCodingPlatform: selectedCodingPlatform,
        learnerMasteryList: masteryList,
        uploadedResources,
        userSavedDAGs: savedDAGs,
        studyVaultMaterials: studyMaterials
      });

      const saved = saveDailyPlan(newPlan);
      setPlan(saved);
      setShowConfig(false);

      toast({
        title: "Today's Learning Plan Generated! 🎯",
        description: `${saved.tasks.length} actionable learning steps prepared for ${skillName} (${saved.estimatedTotalMinutes} min total).`,
      });
    } catch (err: any) {
      console.error('Error generating daily plan:', err);
      toast({
        title: "Generation Notice",
        description: "Could not generate plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle Task Completion
  const handleToggleTask = (taskId: string) => {
    if (!plan) return;
    const updated = toggleDailyPlanTask(userId, skillOrProjectId, plan.planDate, taskId);
    if (updated) {
      setPlan(updated);
      const isNowCompleted = updated.tasks.find(t => t.id === taskId)?.completed;
      if (isNowCompleted && updated.status === 'completed') {
        toast({
          title: "Plan Completed! 🎉",
          description: `All learning tasks for today finished! Great job advancing your ${skillName} mastery.`,
        });
      }
    }
  };

  // Navigation Handler
  const handleOpenResource = (task: DailyPlanTask) => {
    if (!task.resource) return;

    if (task.resource.isInternal && task.resource.internalTarget) {
      const { tab, subtab, resourceId, topic } = task.resource.internalTarget;
      navigateToTab(tab as any, subtab, { resourceId, topic: topic || task.title });
      toast({
        title: "Navigating to Library 📖",
        description: `Opening ${task.resource.title} in your StudyMate workspace.`,
      });
    } else if (task.resource.url && task.resource.url !== '#') {
      window.open(task.resource.url, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: "Resource Ready",
        description: `${task.resource.title} - ${task.resource.whyRecommended}`,
      });
    }
  };

  // Ask AI Tutor with Plan Context
  const handleAskAiTutor = (task: DailyPlanTask) => {
    if (onAskAiTutor) {
      const masteryPct = Math.round((plan?.masteryAtGeneration || 0.55) * 100);
      onAskAiTutor({
        skill: skillName,
        topic: task.title,
        taskTitle: task.title,
        resourceTitle: task.resource?.title,
        masteryPercentage: masteryPct,
        planSummary: plan?.objective
      });
      toast({
        title: "AI Tutor Engaged 🤖",
        description: `Context for "${task.title}" passed to your sidebar AI Tutor.`,
      });
    }
  };

  // Status Badge Helper
  const getStatusBadge = () => {
    if (!plan) {
      return (
        <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
          Not Generated
        </Badge>
      );
    }
    if (plan.status === 'completed') {
      return (
        <Badge className="text-xs bg-green-600 hover:bg-green-600 text-white font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </Badge>
      );
    }
    if (plan.status === 'in_progress') {
      return (
        <Badge className="text-xs bg-emerald-600 hover:bg-emerald-600 text-white font-medium flex items-center gap-1">
          <Flame className="w-3 h-3" /> In Progress
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs border-green-600/40 text-green-700 dark:text-green-300 bg-green-500/10 font-medium">
        Generated
      </Badge>
    );
  };

  // Render Task Type Icon
  const renderTaskTypeIcon = (type: DailyPlanTask['type']) => {
    switch (type) {
      case 'video':
        return <Video className="w-3.5 h-3.5 text-blue-500" />;
      case 'practice':
        return <Code className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
      case 'assessment':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'recall':
        return <RotateCcw className="w-3.5 h-3.5 text-purple-500" />;
      case 'documentation':
      case 'article':
      case 'concept':
      default:
        return <FileText className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-6">
        
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 rounded-lg bg-green-600/10 text-green-600 dark:text-green-400 border border-green-600/20">
                <Target className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Today's Learning Plan</h2>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>📅 {formattedToday}</span>
              {plan && (
                <>
                  <span>•</span>
                  <span>⏱️ Est. {plan.estimatedTotalMinutes} min total</span>
                  <span>•</span>
                  <span>📋 {completedCount} / {totalCount} tasks completed</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {plan ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-xs h-9 border-border hover:bg-muted text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {showConfig ? 'Close Options' : 'Regenerate'}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700 text-white font-medium text-xs sm:text-sm h-9 px-4 shadow-sm border-0 gap-2"
              >
                <Sparkles className="w-4 h-4 text-white" />
                {isGenerating ? 'Generating Plan...' : "Generate Today's Plan"}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar (Visible when plan exists) */}
        {plan && (
          <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-xl border border-border/60">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Daily Progress</span>
              <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                {progressPercent}% Complete
              </span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Plan Configuration / Regeneration Settings Bar */}
        {(showConfig || !plan) && (
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-green-600" />
                Study Duration & Platform Preferences
              </span>
              <span className="text-[11px] text-muted-foreground">Tailored for today</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Study Time Budget */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Available Study Time</label>
                <div className="flex flex-wrap gap-1.5">
                  {[30, 45, 60, 90, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMinutes(m)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        selectedMinutes === m
                          ? 'bg-green-600 text-white border-green-600 font-semibold shadow-xs'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Coding / Practice Platform */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Preferred Practice Platform</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['LeetCode', 'HackerRank', 'Codeforces'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedCodingPlatform(p)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        selectedCodingPlatform === p
                          ? 'bg-green-600 text-white border-green-600 font-semibold shadow-xs'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {showConfig && (
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleGeneratePlan}
                  disabled={isGenerating}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white font-medium text-xs shadow-sm border-0 gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  {isGenerating ? 'Regenerating...' : 'Regenerate Plan with New Settings'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Empty State when Not Generated */}
        {!plan && !isGenerating && (
          <div className="py-12 px-4 text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto border border-green-500/20 shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">No plan generated for today yet</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                StudyMate will analyze your learning history, course library, concept prerequisites, and available study time to formulate an executable step-by-step path for today.
              </p>
            </div>
            <Button
              onClick={handleGeneratePlan}
              className="bg-green-600 hover:bg-green-700 text-white font-medium text-xs sm:text-sm px-6 h-10 shadow-sm border-0 gap-2"
            >
              <Sparkles className="w-4 h-4 text-white" />
              Generate Today's Plan ({selectedMinutes} min)
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
            <p className="text-xs font-medium text-foreground">
              Analyzing concept DAG, uploaded materials, and formulating today's path...
            </p>
          </div>
        )}

        {/* Plan Body Content */}
        {plan && !isGenerating && (
          <div className="space-y-6">

            {/* A. Today's Objective Card */}
            <div className="p-4 rounded-xl bg-green-500/5 border border-green-600/20 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wider">
                <Target className="w-3.5 h-3.5 text-green-600" />
                Today's Objective
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {plan.objective}
              </p>
            </div>

            {/* DAG Prerequisite Warning Banner (if applicable) */}
            {plan.dagContext && plan.dagContext.weakPrerequisites.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    Prerequisite detected from Concept DAG:
                  </span>
                  <p className="text-muted-foreground">
                    Your concept model identified <strong className="text-foreground">{plan.dagContext.weakPrerequisites.join(', ')}</strong> as a developing prerequisite. Step 01 has been configured as a quick prerequisite refresher so you can tackle today's topic confidently.
                  </p>
                </div>
              </div>
            )}

            {/* B. Vertical Learning Flow Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Learning Flow ({plan.tasks.length} Steps)
                </h3>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {completedCount} of {totalCount} completed
                </span>
              </div>

              <div className="relative pl-6 sm:pl-8 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {plan.tasks.map((task, idx) => {
                  const isDone = task.completed;
                  return (
                    <div key={task.id} className="relative group">
                      
                      {/* Step Number Dot on timeline */}
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all ${
                          isDone
                            ? 'bg-green-600 text-white border-green-600 shadow-xs'
                            : 'bg-background border-border text-muted-foreground group-hover:border-green-500'
                        }`}
                        title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                      >
                        {isDone ? <Check className="w-3 h-3 text-white" /> : String(idx + 1).padStart(2, '0')}
                      </button>

                      {/* Task Content Card */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        isDone 
                          ? 'bg-muted/30 border-border/60 opacity-80' 
                          : 'bg-card border-border hover:border-green-500/40 shadow-xs'
                      }`}>
                        
                        {/* Task Top Meta */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="p-1 rounded bg-muted/60">
                              {renderTaskTypeIcon(task.type)}
                            </span>
                            <h4 className={`text-sm font-semibold truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {task.title}
                            </h4>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                              {task.estimatedMinutes} min
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Checkbox
                              checked={isDone}
                              onCheckedChange={() => handleToggleTask(task.id)}
                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                            />
                          </div>
                        </div>

                        {/* Task Description */}
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          {task.description}
                        </p>

                        {/* Prerequisite Tag if relevant */}
                        {task.prerequisiteNotice && (
                          <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium border border-amber-500/20">
                            ⚡ {task.prerequisiteNotice}
                          </div>
                        )}

                        {/* Recommended Resource Block */}
                        {task.resource && (
                          <div className="p-3 rounded-lg bg-muted/40 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {task.resource.platform}
                                </Badge>
                                <span className="text-xs font-semibold text-foreground truncate" title={task.resource.title}>
                                  {task.resource.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                💡 {task.resource.whyRecommended}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => handleOpenResource(task)}
                                className="bg-green-600 hover:bg-green-700 text-white font-medium text-xs h-7 px-2.5 shadow-xs border-0 gap-1"
                              >
                                {task.resource.isInternal ? (
                                  <>
                                    <FolderOpen className="w-3 h-3 text-white" />
                                    Open in StudyMate
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink className="w-3 h-3 text-white" />
                                    Open Resource
                                  </>
                                )}
                              </Button>

                              {onAskAiTutor && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAskAiTutor(task)}
                                  className="text-xs h-7 px-2.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground gap-1"
                                  title="Ask your sidebar AI Tutor about this task"
                                >
                                  <Brain className="w-3 h-3 text-green-600 dark:text-green-400" />
                                  Ask Tutor
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Celebratory Completion Footer */}
            {progressPercent === 100 && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-green-600/30 text-center space-y-1.5 animate-in fade-in duration-300">
                <div className="text-lg">🎉 🏆</div>
                <h4 className="text-sm font-bold text-foreground">You finished today's learning plan!</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Every objective for today has been checked off. Your mastery records have been logged. Come back tomorrow for the next adaptive milestone!
                </p>
              </div>
            )}

          </div>
        )}

      </CardContent>
    </Card>
  );
};
