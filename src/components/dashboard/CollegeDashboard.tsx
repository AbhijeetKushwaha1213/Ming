
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Code, Calendar, Users, Trophy, BookOpen, Briefcase, Star, Zap, ArrowRight, Plus, ChevronDown, ChevronUp, Check, Lock, Trash2 } from 'lucide-react';
import ProjectFocusView from '../projects/ProjectFocusView';
import { AddProjectDialog } from '../projects/AddProjectDialog';
import { AddSkillDialog } from '../skills/AddSkillDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthProvider';
import { useProjects } from '@/hooks/useProjects';
import { useSkills, getSkillCategory, parseSkillDetails } from '@/hooks/useSkills';
import { useUserStats } from '@/hooks/useUserStats';


export const CollegeDashboard = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'project-focus'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { projects, updateProject } = useProjects();
  const { skills, updateSkill, deleteSkill } = useSkills();
  const { userStats } = useUserStats();

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
      description: "Great job! Your project has been marked as completed.",
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

    // Check if the current active day advanced
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

  const handleAddProject = () => {
    // Projects are now added via the AddProjectDialog
    toast({
      title: "Add Project",
      description: "Use the Add Project button to create a new project.",
    });
  };

  const handleAddSkill = () => {
    // Skills are now added via the AddSkillDialog
    toast({
      title: "Add Skill",
      description: "Use the Add Skill button to add a new skill.",
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
    <div className="space-y-6">
      {/* Welcome Header */}
        <Card className="relative overflow-hidden p-6 bg-brand-gradient text-white border-0 shadow-glow animate-fade-in-up">
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Hey there, {user?.name || 'Student'}! 🚀</h2>
              <p className="text-white/80">{user?.semester ? `Semester ${user.semester}` : 'College'} • {user?.branch || 'Computer Science'}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{userStats?.cgpa?.toFixed(1) || '0.0'}</div>
              <div className="text-white/70 text-sm">Current CGPA</div>
            </div>
          </div>
        </Card>

      {/* Quick Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center card-interactive">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-foreground">{projects.length}</div>
          <div className="text-sm text-muted-foreground">Active Projects</div>
        </Card>

        <Card className="p-4 text-center card-interactive">
          <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-foreground">{skills.length}</div>
          <div className="text-sm text-muted-foreground">Skills Learning</div>
        </Card>

        <Card className="p-4 text-center card-interactive">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-foreground">₹{userStats?.monthly_earnings || 0}</div>
          <div className="text-sm text-muted-foreground">This Month</div>
        </Card>
      </div>

      {/* Current Projects */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">Active Projects</h3>
          <AddProjectDialog />
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Projects Added</h4>
            <p className="text-muted-foreground mb-4">Start by adding your first project to track your progress</p>
            <AddProjectDialog trigger={
              <Button variant="premium">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Project
              </Button>
            } />
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center p-4 bg-muted rounded-lg">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${
                  project.type === 'coding' ? 'bg-blue-100' :
                  project.type === 'academic' ? 'bg-green-100' : 'bg-purple-100'
                }`}>
                  {project.type === 'coding' ? <Code className="w-5 h-5 text-blue-600" /> :
                   project.type === 'academic' ? <BookOpen className="w-5 h-5 text-green-600" /> :
                   <Briefcase className="w-5 h-5 text-purple-600" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{project.name}</h4>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Progress value={project.progress} className="w-20 h-2" />
                      <span className="text-sm text-muted-foreground">{project.progress}%</span>
                    </div>
                    {project.deadline && (
                      <Badge variant="outline" className="text-xs">
                        Due in {project.deadline}
                      </Badge>
                    )}
                    {project.status === 'completed' && (
                      <Badge className="text-xs bg-green-100 text-green-800">
                        Completed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <Button 
                    onClick={() => handleContinueProject(project)}
                    size="sm" 
                    variant="premium"
                  >
                    Continue Working
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                  {project.progress < 100 && (
                    <Button 
                      onClick={() => handleCompleteProject(project.id)}
                      size="sm" 
                      variant="outline"
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Skills Progress */}
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
                    
                    // Compute target statistics
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
                        {/* Collapsed Header Summary */}
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

                        {/* Expanded Syllabus and Details */}
                        {isExpanded && (
                          <div className="border-t border-border/60 bg-muted/10 p-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* Preferences and Metadata */}
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

                            {/* Daily Learning Targets */}
                            {isSyllabusEmpty ? (
                              <div className="text-center py-4 bg-muted/20 border border-dashed rounded-lg">
                                <p className="text-sm text-muted-foreground">No syllabus details found for this skill. Try deleting and re-creating it with a structured roadmap.</p>
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

                            {/* Complete Syllabus Roadmap */}
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

      {/* Achievements & Freelance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Remove hardcoded achievement */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Recent Achievement</h3>
        <div className="text-center py-4">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-semibold text-muted-foreground mb-1">No achievements yet</h4>
          <p className="text-sm text-muted-foreground">Complete projects to unlock achievements!</p>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Freelance Status</h3>
        {userStats ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Clients</span>
              <span className="font-medium">{userStats?.active_clients || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projects Done</span>
              <span className="font-medium">{userStats?.projects_completed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-medium">{userStats?.rating?.toFixed(1) || '0.0'} ⭐</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No freelance data yet</p>
          </div>
        )}
      </Card>
      </div>

      {/* Remove hardcoded career tip */}
      <Card className="p-6 bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-foreground mb-2">Career Tip</h4>
            <p className="text-muted-foreground">
              {projects.length === 0 
                ? "Start building projects to showcase your skills and advance your career!"
                : skills.length === 0
                ? "Add skills to track your learning progress and identify areas for improvement."
                : "Keep building projects and learning new skills to stay competitive in the job market!"
              }
            </p>
            <Button variant="outline" size="sm" className="mt-3 text-green-700 border-green-300">
              {projects.length === 0 ? "Add Your First Project" : "Explore More Ideas"}
            </Button>
          </div>
        </div>
      </Card>

    </div>
  );
};
