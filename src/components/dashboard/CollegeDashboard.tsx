import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Code, 
  Calendar, 
  Trophy, 
  BookOpen, 
  Briefcase, 
  Star, 
  Zap, 
  ArrowRight, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Lock, 
  Trash2,
  History,
  MoreVertical,
  Edit3,
  Pause,
  Play,
  RotateCcw,
  Clock,
  Sparkles
} from 'lucide-react';
import ProjectFocusView from '../projects/ProjectFocusView';
import { AddProjectDialog } from '../projects/AddProjectDialog';
import { AddSkillDialog } from '../skills/AddSkillDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthProvider';
import { useProjects } from '@/hooks/useProjects';
import { useSkills, getSkillCategory, parseSkillDetails } from '@/hooks/useSkills';
import { useUserStats } from '@/hooks/useUserStats';
import { FloatingStudyAgentBar } from './FloatingStudyAgentBar';
import { DashboardCoverWidget } from './DashboardCoverWidget';

export const CollegeDashboard = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'project-focus'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { projects, updateProject, deleteProject } = useProjects();
  const { skills, updateSkill, deleteSkill } = useSkills();
  const { userStats } = useUserStats();

  // Filter Active vs Completed Projects
  const activeProjects = projects.filter(p => p.status !== 'completed' && (p.progress ?? 0) < 100);
  const completedProjects = projects.filter(p => p.status === 'completed' || (p.progress ?? 0) >= 100);

  // History & Actions Dialog State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Edit Project State
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('coding');
  const [editProgress, setEditProgress] = useState(0);

  // Extend Deadline State
  const [extendingProject, setExtendingProject] = useState<any>(null);
  const [customDeadline, setCustomDeadline] = useState('');

  const handleContinueProject = (project: any) => {
    setSelectedProject(project);
    setCurrentView('project-focus');
    toast({
      title: "Project Opened",
      description: `Continuing work on ${project.name}`,
    });
  };

  const handleCompleteProject = (projectId: string) => {
    updateProject({ id: projectId, updates: { progress: 100, status: 'completed' } });
    toast({
      title: "Project Completed! 🎉",
      description: "Great job! Your project has been moved to Project History.",
    });
  };

  const handleOpenEdit = (project: any) => {
    setEditingProject(project);
    setEditName(project.name || '');
    setEditDesc(project.description || '');
    setEditType(project.type || 'coding');
    setEditProgress(project.progress ?? 0);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    updateProject({
      id: editingProject.id,
      updates: {
        name: editName.trim() || editingProject.name,
        description: editDesc.trim(),
        type: editType,
        progress: Math.min(99, Math.max(0, Number(editProgress))),
      }
    });
    setEditingProject(null);
    toast({
      title: "Project Updated ✏️",
      description: "Project details updated successfully.",
    });
  };

  const handleOpenExtendDeadline = (project: any) => {
    setExtendingProject(project);
    setCustomDeadline(project.deadline || '');
  };

  const handleSaveDeadline = (deadlineVal: string) => {
    if (!extendingProject || !deadlineVal.trim()) return;
    updateProject({
      id: extendingProject.id,
      updates: { deadline: deadlineVal.trim() }
    });
    setExtendingProject(null);
    toast({
      title: "Deadline Extended 📅",
      description: `New deadline: ${deadlineVal.trim()}`,
    });
  };

  const handleTogglePause = (project: any) => {
    const isPaused = project.status === 'paused';
    const nextStatus = isPaused ? 'in-progress' : 'paused';
    updateProject({
      id: project.id,
      updates: { status: nextStatus }
    });
    toast({
      title: isPaused ? "Project Resumed ▶" : "Project Paused ⏸",
      description: `${project.name} is now ${nextStatus === 'paused' ? 'paused' : 'in-progress'}.`,
    });
  };

  const handleContinueSkill = (skill: any) => {
    const skillProject = {
      id: `skill-${skill.id}`,
      name: `${skill.skill} Learning`,
      type: getSkillCategory(skill.category).toLowerCase(),
      deadline: 'ongoing',
      description: `Learning and practicing ${skill.skill}`,
      progress: skill.progress
    };
    setSelectedProject(skillProject);
    setCurrentView('project-focus');
    toast({
      title: "Skill Learning",
      description: `Continuing ${skill.skill} learning path`,
    });
  };

  const handleToggleTopic = (skill: any, topicId: string) => {
    const details = parseSkillDetails(skill.category);
    const updatedSyllabus = details.syllabus.map(t => {
      if (t.id === topicId) {
        return { ...t, completed: !t.completed };
      }
      return t;
    });

    const completedCount = updatedSyllabus.filter(t => t.completed).length;
    const totalCount = updatedSyllabus.length;
    const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const firstUncompletedBefore = details.syllabus.find(t => !t.completed);
    const activeDayBefore = firstUncompletedBefore ? firstUncompletedBefore.dayNumber : 1;

    const firstUncompletedAfter = updatedSyllabus.find(t => !t.completed);
    const activeDayAfter = firstUncompletedAfter ? firstUncompletedAfter.dayNumber : 1;

    let newUnlockedDays = details.unlockedDays || 0;
    if (activeDayAfter > activeDayBefore) {
      newUnlockedDays = Math.max(0, newUnlockedDays - (activeDayAfter - activeDayBefore));
    }

    const updatedCategory = {
      ...details,
      syllabus: updatedSyllabus,
      unlockedDays: newUnlockedDays
    };

    updateSkill({
      id: skill.id,
      updates: {
        progress: newProgress,
        category: JSON.stringify(updatedCategory)
      }
    });

    toast({
      title: "Target Updated!",
      description: "Your daily learning target status has been updated.",
    });
  };

  const handleUnlockNextDay = (skill: any) => {
    const details = parseSkillDetails(skill.category);
    const updatedCategory = {
      ...details,
      unlockedDays: (details.unlockedDays || 0) + 1
    };

    updateSkill({
      id: skill.id,
      updates: {
        category: JSON.stringify(updatedCategory)
      }
    });

    toast({
      title: "Next Targets Unlocked! 🚀",
      description: "You've unlocked the next set of topics to study ahead!",
    });
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedProject(null);
  };

  if (currentView === 'project-focus' && selectedProject) {
    return (
      <ProjectFocusView
        projectId={selectedProject.id}
        projectName={selectedProject.name}
        projectType={selectedProject.type}
        deadline={selectedProject.deadline}
        onBack={handleBackToDashboard}
      />
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Customizable Dashboard Cover / Hero Banner (Image, Video, Simulation, Quote, or Default Canvas) */}
      <DashboardCoverWidget
        userName={user?.name || 'Student'}
        userSemester={user?.semester}
        userBranch={user?.branch}
      />


      {/* Daily Study Plan Quick Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-primary/10 via-accent/30 to-background border border-primary/20 rounded-2xl shadow-xs gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              AI Study Agent & Daily Plan
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0">
                Personalized
              </Badge>
            </h4>
            <p className="text-xs text-muted-foreground">
              Daily study tasks and diagnostic priorities available in your side panel
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.dispatchEvent(new CustomEvent('open-daily-plan'))}
          className="h-8 text-xs gap-1.5 border-primary/30 hover:bg-primary/10 text-primary shrink-0 self-start sm:self-center"
        >
          <span>Open Daily Plan on Side</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 1. Learning Progress Block (Moved ABOVE Active Projects as requested) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Learning Progress</h3>
          <AddSkillDialog />
        </div>
        
        {skills.length === 0 ? (
          <div className="text-center py-8">
            <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Skills Added</h4>
            <p className="text-muted-foreground mb-4">Start by adding your first skill to track your learning progress</p>
            <AddSkillDialog trigger={
              <Button variant="premium">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Skill
              </Button>
            } />
          </div>
        ) : (
          (() => {
            const activeSkills = skills.filter(item => item.progress < 100);
            const completedSkills = skills.filter(item => item.progress === 100);

            return (
              <div className="space-y-4">
                {activeSkills.length === 0 && completedSkills.length > 0 ? (
                  <div className="text-center py-4 border border-dashed rounded-xl bg-muted/20">
                    <p className="text-sm text-muted-foreground">All your added skills are fully mastered! 🏆</p>
                  </div>
                ) : (
                  activeSkills.map((item) => {
                    const details = parseSkillDetails(item.category);
                    const isExpanded = expandedSkillId === item.id;
                    
                    const syllabus = details.syllabus || [];
                    const firstUncompleted = syllabus.find(t => !t.completed);
                    const activeDay = firstUncompleted ? firstUncompleted.dayNumber : (syllabus.length > 0 ? Math.max(...syllabus.map(t => t.dayNumber)) : 1);
                    const visibleDayLimit = activeDay + (details.unlockedDays || 0);
                    
                    const todayTargets = syllabus.filter(t => !t.completed && t.dayNumber <= visibleDayLimit);
                    const allTodayTargets = syllabus.filter(t => t.dayNumber <= visibleDayLimit);
                    const completedToday = allTodayTargets.filter(t => t.completed).length;
                    const totalToday = allTodayTargets.length;
                    
                    const isSyllabusEmpty = syllabus.length === 0;
                    const isTodayCompleted = todayTargets.length === 0;

                    return (
                      <div 
                        key={item.id} 
                        className="border border-border/60 rounded-xl overflow-hidden bg-gradient-to-b from-card to-card/50 shadow-sm transition-all duration-300 hover:shadow-md"
                      >
                        <div 
                          onClick={() => setExpandedSkillId(isExpanded ? null : item.id)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors gap-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2.5 mb-2">
                              <span className="font-bold text-foreground text-base tracking-tight">{item.skill}</span>
                              <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-100/50">
                                {details.categoryName}
                              </Badge>
                              {isTodayCompleted && !isSyllabusEmpty ? (
                                <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-0">
                                  Today Done 🎉
                                </Badge>
                              ) : !isSyllabusEmpty ? (
                                <Badge variant="outline" className="text-xs text-muted-foreground border-border/80">
                                  {todayTargets.length} targets left
                                </Badge>
                              ) : null}
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Progress value={item.progress} className="h-2 w-32 bg-secondary" />
                              <span className="text-sm font-semibold text-foreground">{item.progress}%</span>
                              {!isSyllabusEmpty && (
                                <span className="text-xs text-muted-foreground hidden md:inline-block">
                                  • Day {activeDay} of {Math.max(...syllabus.map(t => t.dayNumber))}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 self-end sm:self-center">
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContinueSkill(item);
                              }}
                              size="sm" 
                              variant="outline"
                              className="h-8 border-border hover:bg-muted"
                            >
                              Continue
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                            
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete the skill "${item.skill}"?`)) {
                                  deleteSkill(item.id);
                                }
                              }}
                              size="sm" 
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border/60 bg-muted/10 p-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm border-b border-border/40 pb-4">
                              <div className="flex items-center gap-4 text-muted-foreground">
                                <div>
                                  <span className="font-semibold text-foreground">Pace:</span>{' '}
                                  <span className="capitalize">{details.preference.pace}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-foreground">Daily Time:</span>{' '}
                                  <span>{details.preference.hoursPerDay}h/day</span>
                                </div>
                              </div>
                              {!isSyllabusEmpty && (
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                  Target: {completedToday} of {totalToday} topics learned today
                                </div>
                              )}
                            </div>

                            {isSyllabusEmpty ? (
                              <div className="text-center py-4 bg-muted/20 border border-dashed rounded-lg">
                                <p className="text-sm text-muted-foreground">No syllabus details found for this skill.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                  Today's Daily Target
                                </h4>
                                
                                {isTodayCompleted ? (
                                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl flex flex-col items-center text-center gap-3">
                                    <div>
                                      <h5 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">All targets done for today! 🎉</h5>
                                      <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">You're doing amazing. Want to level up faster?</p>
                                    </div>
                                    <Button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnlockNextDay(item);
                                      }}
                                      size="sm" 
                                      variant="premium"
                                    >
                                      Unlock Next Targets
                                      <Zap className="w-3.5 h-3.5 ml-1.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 gap-2">
                                    {todayTargets.map((topic) => (
                                      <div 
                                        key={topic.id}
                                        className="flex items-center space-x-3 p-3 bg-card border border-border/80 rounded-xl hover:bg-muted/40 transition-colors"
                                      >
                                        <input 
                                          type="checkbox" 
                                          checked={topic.completed}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            handleToggleTopic(item, topic.id);
                                          }}
                                          className="w-4.5 h-4.5 text-indigo-600 border-border rounded focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-foreground truncate">{topic.topic}</p>
                                          <p className="text-xs text-muted-foreground">Day {topic.dayNumber}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {!isSyllabusEmpty && (
                              <div className="space-y-3 pt-3 border-t border-border/40">
                                <h4 className="text-sm font-bold text-foreground">Syllabus Learning Roadmap</h4>
                                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                  {syllabus.map((topic, index) => {
                                    const isCompleted = topic.completed;
                                    const isActive = !isCompleted && topic.dayNumber <= visibleDayLimit;
                                    
                                    return (
                                      <div key={topic.id} className="flex items-start gap-3 text-sm">
                                        <div className="flex flex-col items-center mt-1">
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-xs font-semibold ${
                                            isCompleted 
                                              ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-400' 
                                              : isActive 
                                              ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-900 dark:text-indigo-400'
                                              : 'bg-muted border-border text-muted-foreground'
                                          }`}>
                                            {isCompleted ? (
                                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                            ) : isActive ? (
                                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                            ) : (
                                              <Lock className="w-2.5 h-2.5 text-muted-foreground/60" />
                                            )}
                                          </div>
                                          {index < syllabus.length - 1 && (
                                            <div className="w-0.5 h-6 bg-border/50 mt-1"></div>
                                          )}
                                        </div>
                                        <div className="flex-1 pb-2">
                                          <p className={`text-sm font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                            {topic.topic}
                                          </p>
                                          <p className="text-xs text-muted-foreground">Day {topic.dayNumber}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {completedSkills.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border/60">
                    <h4 className="text-sm font-bold text-muted-foreground mb-3">Completed Skills ({completedSkills.length})</h4>
                    <div className="space-y-3">
                      {completedSkills.map((item) => {
                        const details = parseSkillDetails(item.category);
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-muted/40 border border-border/40 rounded-xl">
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-muted-foreground line-through truncate">{item.skill}</span>
                                <Badge variant="secondary" className="text-[10px] py-0 bg-muted text-muted-foreground border-0">
                                  {details.categoryName}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-100/50">
                                Mastered 🏆
                              </Badge>
                              <Button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete the completed skill "${item.skill}"?`)) {
                                    deleteSkill(item.id);
                                  }
                                }}
                                size="sm" 
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </Card>

      {/* 2. Active Projects Block (with Past Projects History and 3-Dot Row Menu) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-xl font-bold text-foreground">Active Projects</h3>
            {activeProjects.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeProjects.length}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* History Button just before Add Project */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <History className="w-4 h-4 text-primary" />
              <span>Past Projects</span>
              {completedProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-muted">
                  {completedProjects.length}
                </Badge>
              )}
            </Button>

            <AddProjectDialog />
          </div>
        </div>

        {activeProjects.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Active Projects</h4>
            <p className="text-muted-foreground mb-4">
              {completedProjects.length > 0 
                ? "All current projects are marked as complete! Review past work in History or add a new project."
                : "Start by adding your first project to track your progress"}
            </p>
            <div className="flex items-center justify-center gap-3">
              {completedProjects.length > 0 && (
                <Button variant="outline" onClick={() => setIsHistoryOpen(true)}>
                  <History className="w-4 h-4 mr-2" />
                  View Past Projects ({completedProjects.length})
                </Button>
              )}
              <AddProjectDialog trigger={
                <Button variant="premium">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Project
                </Button>
              } />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeProjects.map((project) => (
              <div 
                key={project.id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all ${
                  project.status === 'paused' 
                    ? 'bg-amber-500/5 border-amber-500/20' 
                    : 'bg-muted/40 border-border/80 hover:border-border'
                }`}
              >
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    project.type === 'coding' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' :
                    project.type === 'academic' ? 'bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400' :
                    'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                  }`}>
                    {project.type === 'coding' ? <Code className="w-5 h-5" /> :
                     project.type === 'academic' ? <BookOpen className="w-5 h-5" /> :
                     <Briefcase className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground text-sm truncate">{project.name}</h4>
                      {project.status === 'paused' && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200">
                          Paused ⏸
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <div className="flex items-center space-x-2">
                        <Progress value={project.progress} className="w-20 h-2" />
                        <span className="text-xs text-muted-foreground">{project.progress}%</span>
                      </div>
                      {project.deadline && (
                        <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due in {project.deadline}
                        </Badge>
                      )}
                      {project.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] hidden md:inline">
                          • {project.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Actions Right Side */}
                <div className="flex items-center space-x-2 mt-3 sm:mt-0 sm:ml-4 self-end sm:self-center shrink-0">
                  <Button 
                    onClick={() => handleContinueProject(project)}
                    size="sm" 
                    variant={project.status === 'paused' ? 'outline' : 'premium'}
                    className="h-8 text-xs"
                  >
                    {project.status === 'paused' ? 'Resume' : 'Continue'}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>

                  {project.progress < 100 && (
                    <Button 
                      onClick={() => handleCompleteProject(project.id)}
                      size="sm" 
                      variant="outline"
                      className="h-8 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      Complete
                    </Button>
                  )}

                  {/* 3-Dot Action Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleOpenEdit(project)}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleOpenExtendDeadline(project)}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Extend Deadline
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleTogglePause(project)}>
                        {project.status === 'paused' ? (
                          <>
                            <Play className="w-4 h-4 mr-2 text-emerald-600" />
                            Resume Project
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4 mr-2 text-amber-600" />
                            Pause Project
                          </>
                        )}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                            deleteProject(project.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>


      {/* Floating Ask the AI Study Agent Dock */}
      <FloatingStudyAgentBar />

      {/* MODAL 1: Past Projects / History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              Past Projects & History
            </DialogTitle>
            <DialogDescription>
              Review completed projects, restore past work to active status, or delete records.
            </DialogDescription>
          </DialogHeader>

          {completedProjects.length === 0 ? (
            <div className="text-center py-10">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-1">No Past Projects Yet</h4>
              <p className="text-xs text-muted-foreground">
                When you mark an active project as completed, it will be safely archived here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {completedProjects.map((project) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-3.5 bg-muted/40 border border-border/70 rounded-xl hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      project.type === 'coding' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' :
                      project.type === 'academic' ? 'bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400' :
                      'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                    }`}>
                      {project.type === 'coding' ? <Code className="w-4 h-4" /> :
                       project.type === 'academic' ? <BookOpen className="w-4 h-4" /> :
                       <Briefcase className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground text-sm truncate">{project.name}</h4>
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-0">
                          Completed 🏆
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {project.deadline ? `Target was: ${project.deadline}` : 'Completed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-3 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => {
                        updateProject({ 
                          id: project.id, 
                          updates: { status: 'in-progress', progress: 90 } 
                        });
                        toast({
                          title: "Project Reopened 🚀",
                          description: `${project.name} moved back to Active Projects.`,
                        });
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Reopen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete "${project.name}"?`)) {
                          deleteProject(project.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              Edit Project Details
            </DialogTitle>
            <DialogDescription>
              Update your project title, category, description, and completion progress.
            </DialogDescription>
          </DialogHeader>

          {editingProject && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold">Project Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Compiler Design Project"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc" className="text-xs font-semibold">Description</Label>
                <Input
                  id="edit-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Short summary of project goals..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-type" className="text-xs font-semibold">Project Type</Label>
                <select
                  id="edit-type"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="coding">Coding / Development</option>
                  <option value="academic">Academic / Coursework</option>
                  <option value="other">Other / Freelance</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <Label htmlFor="edit-progress">Progress</Label>
                  <span className="text-muted-foreground">{editProgress}%</span>
                </div>
                <Input
                  id="edit-progress"
                  type="number"
                  min="0"
                  max="99"
                  value={editProgress}
                  onChange={(e) => setEditProgress(Number(e.target.value))}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingProject(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="premium">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Extend Deadline Dialog */}
      <Dialog open={!!extendingProject} onOpenChange={(open) => !open && setExtendingProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Extend Project Deadline
            </DialogTitle>
            <DialogDescription>
              Adjust your target completion date for {extendingProject?.name}.
            </DialogDescription>
          </DialogHeader>

          {extendingProject && (
            <div className="space-y-4 pt-2">
              {/* Quick Preset Buttons */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Extensions</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['2 weeks', '1 month', '3 months'].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveDeadline(preset)}
                      className="text-xs h-8 hover:border-primary hover:text-primary"
                    >
                      + {preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Deadline input */}
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <Label htmlFor="custom-deadline" className="text-xs font-semibold">Custom Deadline / Date</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-deadline"
                    value={customDeadline}
                    onChange={(e) => setCustomDeadline(e.target.value)}
                    placeholder="e.g. 15 Nov or 6 months"
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="premium" 
                    onClick={() => handleSaveDeadline(customDeadline)}
                    disabled={!customDeadline.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
