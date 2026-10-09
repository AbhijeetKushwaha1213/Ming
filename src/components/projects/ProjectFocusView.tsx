import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Play, Pause, RotateCcw, Code, ExternalLink, Github, Timer, 
  Brain, Send, Plus, Trash2, CheckCircle2, Circle, AlertCircle, TrendingUp, 
  FileEdit, Copy, Check, ChevronDown, ChevronUp, Maximize2, Minimize2, ListTodo 
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSkills, parseSkillDetails } from "@/hooks/useSkills";
import { useProjects } from "@/hooks/useProjects";
import { geminiClient } from "@/utils/geminiClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { DailyLearningPlanCard } from "./DailyLearningPlanCard";

interface ProjectFocusViewProps {
  projectId?: string;
  projectName?: string;
  projectType?: string;
  deadline?: string;
  onBack: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface Resource {
  id: number;
  title: string;
  url: string;
  type: 'documentation' | 'tutorial' | 'article' | 'video';
}

interface Task {
  id: number;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface LeetCodeProblem {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  url: string;
}

export default function ProjectFocusView({ 
  projectId,
  projectName = "React Portfolio Website", 
  projectType = "Frontend Project", 
  deadline = "2 days",
  onBack 
}: ProjectFocusViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timer, setTimer] = useState(3600); // 1 hour default
  const [initialTimer, setInitialTimer] = useState(3600);
  const [isRunning, setIsRunning] = useState(false);
  const projectDir = projectName.toLowerCase().replace(/\s+/g, '-');

  // Sidebar squeeze and maximize states
  const [isAiSqueezed, setIsAiSqueezed] = useState<boolean>(() => {
    return localStorage.getItem('studymate_focus_ai_squeezed') === 'true';
  });
  const [isAiMaximized, setIsAiMaximized] = useState<boolean>(false);

  const [isTasksSqueezed, setIsTasksSqueezed] = useState<boolean>(() => {
    return localStorage.getItem('studymate_focus_tasks_squeezed') === 'true';
  });
  const [isTasksMaximized, setIsTasksMaximized] = useState<boolean>(false);

  const toggleAiSqueezed = () => {
    setIsAiSqueezed(prev => {
      const next = !prev;
      localStorage.setItem('studymate_focus_ai_squeezed', String(next));
      if (next) setIsAiMaximized(false);
      return next;
    });
  };

  const toggleAiMaximized = () => {
    setIsAiMaximized(prev => {
      const next = !prev;
      if (next) setIsAiSqueezed(false);
      return next;
    });
  };

  const toggleTasksSqueezed = () => {
    setIsTasksSqueezed(prev => {
      const next = !prev;
      localStorage.setItem('studymate_focus_tasks_squeezed', String(next));
      if (next) setIsTasksMaximized(false);
      return next;
    });
  };

  const toggleTasksMaximized = () => {
    setIsTasksMaximized(prev => {
      const next = !prev;
      if (next) setIsTasksSqueezed(false);
      return next;
    });
  };
  const [codeContent, setCodeContent] = useState("Write or paste your code here... This is a local scratchpad and does not save.");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hey there! FocusBot here.\n\nHow can I help you with your project today?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([
    { id: 1, title: "React Docs", url: "https://reactjs.org/docs", type: "documentation" },
    { id: 2, title: "Tailwind CSS Guide", url: "https://tailwindcss.com/docs", type: "documentation" }
  ]);
  const [newResource, setNewResource] = useState({ title: "", url: "", type: "documentation" as Resource['type'] });
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const { skills, updateSkill } = useSkills();
  const { projects, updateProject } = useProjects();

  const isSkill = projectId?.startsWith('skill-');
  const actualId = isSkill ? projectId.replace('skill-', '') : projectId;

  const parseProjectDetails = (description: string) => {
    try {
      if (description && (description.startsWith('{') || description.startsWith('['))) {
        const parsed = JSON.parse(description);
        return {
          descriptionText: parsed.descriptionText || '',
          tasks: parsed.tasks || []
        };
      }
    } catch (e) {}
    return {
      descriptionText: description || '',
      tasks: []
    };
  };

  useEffect(() => {
    if (!projectId) return;
    if (loadedId === projectId) return;

    if (isSkill) {
      const skill = skills.find(s => s.id === actualId);
      if (skill) {
        const details = parseSkillDetails(skill.category);
        const mappedTasks = (details.syllabus || []).map((t: any) => ({
          id: t.id,
          title: t.topic,
          completed: !!t.completed,
          priority: 'medium' as const,
          dayNumber: t.dayNumber
        }));
        setTasks(mappedTasks);
        setLoadedId(projectId);
      }
    } else {
      const project = projects.find(p => p.id === actualId);
      if (project) {
        const details = parseProjectDetails(project.description || '');
        if (details.tasks.length === 0 && (!project.description || !project.description.startsWith('{'))) {
          const defaultTasks = project.type.toLowerCase() === 'coding' ? [
            { id: '1', title: "Set up project structure", completed: false, priority: 'high' as const },
            { id: '2', title: "Design homepage layout", completed: false, priority: 'high' as const },
            { id: '3', title: "Implement navigation component", completed: false, priority: 'medium' as const },
            { id: '4', title: "Add responsive design", completed: false, priority: 'medium' as const },
            { id: '5', title: "Deploy to staging", completed: false, priority: 'low' as const },
          ] : [
            { id: '1', title: "Research topic literature", completed: false, priority: 'high' as const },
            { id: '2', title: "Create paper outline", completed: false, priority: 'high' as const },
            { id: '3', title: "Write introduction section", completed: false, priority: 'medium' as const },
            { id: '4', title: "Compile references", completed: false, priority: 'low' as const },
          ];
          setTasks(defaultTasks);
          const updatedDesc = JSON.stringify({
            descriptionText: project.description || '',
            tasks: defaultTasks
          });
          updateProject({ id: actualId, updates: { description: updatedDesc } });
        } else {
          setTasks(details.tasks.map(t => ({
            id: t.id,
            title: t.title,
            completed: t.completed,
            priority: t.priority
          })));
        }
        setLoadedId(projectId);
      }
    }
  }, [projectId, skills, projects, isSkill, actualId, loadedId]);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateText, setUpdateText] = useState('');

  const leetcodeProblems: LeetCodeProblem[] = [
    {
      id: 1,
      title: "Two Sum",
      difficulty: "Easy",
      tags: ["Array", "Hash Table"],
      url: "https://leetcode.com/problems/two-sum/"
    },
    {
      id: 20,
      title: "Valid Parentheses",
      difficulty: "Easy", 
      tags: ["Stack", "String"],
      url: "https://leetcode.com/problems/valid-parentheses/"
    }
  ];

  // Timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer(timer => timer - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timer]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setTimer(initialTimer);
    setIsRunning(false);
  };
  const setTimerPreset = (secs: number) => {
    setTimer(secs);
    setInitialTimer(secs);
    setIsRunning(false);
  };

  const timerPercent = initialTimer > 0 
    ? Math.max(0, Math.min(100, Math.round(((initialTimer - timer) / initialTimer) * 100))) 
    : 0;

  const sendMessage = async (overrideMessage?: string) => {
    const textToSend = (overrideMessage !== undefined ? overrideMessage : inputMessage).trim();
    if (!textToSend || isTyping) return;

    const userMsgText = textToSend;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMsgText,
      sender: 'user',
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (overrideMessage === undefined) {
      setInputMessage('');
    }
    setIsTyping(true);

    try {
      let responseText = '';
      try {
        const invokePromise = supabase.functions.invoke('ai-assistant', {
          body: {
            message: userMsgText,
            context: `project focus bot for ${projectName} (${projectType})`,
            conversationHistory: updatedMessages.slice(-10).map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          }
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Edge function timeout')), 600)
        );
        const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as any;

        if (error) throw error;
        responseText = data.response;
      } catch (invokeError) {
        console.warn('Supabase edge function invoke failed, falling back to direct Gemini API call:', invokeError);
        const directRes = await geminiClient.generateContent({
          message: userMsgText,
          context: updatedMessages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        });

        if (directRes.error) {
          throw new Error(`${directRes.error}: ${directRes.details || ''}`);
        }
        responseText = directRes.response;
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText || "I'm sorry, I couldn't process your request right now.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error calling AI assistant:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please try again later.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection Error",
        description: "Unable to reach AI assistant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handlePlanAskAiTutor = (context: {
    skill: string;
    topic: string;
    taskTitle: string;
    resourceTitle?: string;
    masteryPercentage?: number;
    planSummary?: string;
  }) => {
    // Automatically expand the AI Assistant sidebar if squeezed
    setIsAiSqueezed(false);

    const tutorPrompt = `I am currently studying today's learning plan for "${context.skill}".\n\n` +
      `Current Step: ${context.taskTitle}` +
      (context.resourceTitle ? `\nRecommended Resource: ${context.resourceTitle}` : '') +
      `\nCurrent Mastery: ${context.masteryPercentage || 50}%\n` +
      `Could you explain the core concepts of this step, highlight common misconceptions, and give me a clear example?`;

    sendMessage(tutorPrompt);
  };

  const handlePlanProgressChange = useCallback((newProgressPercent: number) => {
    if (isSkill && actualId) {
      const currentSkill = skills.find(s => s.id === actualId);
      if (currentSkill && currentSkill.progress === newProgressPercent) return;
      updateSkill({ id: actualId, updates: { progress: newProgressPercent } });
    }
  }, [isSkill, actualId, skills, updateSkill]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied!",
      description: "Message content copied to clipboard.",
      duration: 2000
    });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const addResource = () => {
    if (newResource.title && newResource.url) {
      setResources(prev => [...prev, { ...newResource, id: Date.now() }]);
      setNewResource({ title: "", url: "", type: "documentation" });
    }
  };

  const removeResource = (id: number) => {
    setResources(prev => prev.filter(resource => resource.id !== id));
  };

  const openLeetCodeProblem = (problem: LeetCodeProblem) => {
    window.open(problem.url, "_blank");
  };

  const openExternalLink = (url: string) => {
    window.open(url, "_blank");
  };

  const openInVSCode = () => {
    // This opens VS Code with a file protocol - may require VS Code to be installed
    window.open("vscode://file/your-project-path", "_blank");
  };

  const toggleTask = (taskId: string | number) => {
    if (isSkill) {
      const skill = skills.find(s => s.id === actualId);
      if (!skill) return;
      
      const details = parseSkillDetails(skill.category);
      const updatedSyllabus = details.syllabus.map(t => {
        if (t.id === taskId) {
          return { ...t, completed: !t.completed };
        }
        return t;
      });

      const completedCount = updatedSyllabus.filter(t => t.completed).length;
      const totalCount = updatedSyllabus.length;
      const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Adjust unlockedDays if completed day changed
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
        id: actualId,
        updates: {
          progress: newProgress,
          category: JSON.stringify(updatedCategory)
        }
      });
      
      // Update local task state immediately for snappy UI
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
    } else {
      const project = projects.find(p => p.id === actualId);
      if (!project) return;

      const details = parseProjectDetails(project.description || '');
      const updatedTasks = details.tasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      
      const completedCount = updatedTasks.filter(t => t.completed).length;
      const newProgress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;

      const updatedDesc = JSON.stringify({
        descriptionText: details.descriptionText,
        tasks: updatedTasks
      });

      updateProject({
        id: actualId,
        updates: {
          description: updatedDesc,
          progress: newProgress
        }
      });

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
    }
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;

    if (isSkill) {
      const skill = skills.find(s => s.id === actualId);
      if (!skill) return;

      const details = parseSkillDetails(skill.category);
      const maxDay = details.syllabus.length > 0 ? Math.max(...details.syllabus.map(t => t.dayNumber)) : 1;
      
      const newTopic = {
        id: Date.now().toString(),
        topic: newTaskTitle.trim(),
        completed: false,
        dayNumber: maxDay
      };

      const updatedSyllabus = [...details.syllabus, newTopic];
      const completedCount = updatedSyllabus.filter(t => t.completed).length;
      const totalCount = updatedSyllabus.length;
      const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      const updatedCategory = {
        ...details,
        syllabus: updatedSyllabus
      };

      updateSkill({
        id: actualId,
        updates: {
          progress: newProgress,
          category: JSON.stringify(updatedCategory)
        }
      });

      setTasks(prev => [...prev, {
        id: newTopic.id,
        title: newTopic.topic,
        completed: false,
        priority: 'medium'
      }]);
      setNewTaskTitle('');
    } else {
      const project = projects.find(p => p.id === actualId);
      if (!project) return;

      const details = parseProjectDetails(project.description || '');
      const newTaskObj = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        completed: false,
        priority: 'medium' as const
      };

      const updatedTasks = [...details.tasks, newTaskObj];
      const completedCount = updatedTasks.filter(t => t.completed).length;
      const newProgress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;

      const updatedDesc = JSON.stringify({
        descriptionText: details.descriptionText,
        tasks: updatedTasks
      });

      updateProject({
        id: actualId,
        updates: {
          description: updatedDesc,
          progress: newProgress
        }
      });

      setTasks(prev => [...prev, newTaskObj]);
      setNewTaskTitle('');
    }
  };

  const deleteTask = (taskId: string | number) => {
    if (isSkill) {
      const skill = skills.find(s => s.id === actualId);
      if (!skill) return;

      const details = parseSkillDetails(skill.category);
      const updatedSyllabus = details.syllabus.filter(t => t.id !== taskId);
      const completedCount = updatedSyllabus.filter(t => t.completed).length;
      const totalCount = updatedSyllabus.length;
      const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      const updatedCategory = {
        ...details,
        syllabus: updatedSyllabus
      };

      updateSkill({
        id: actualId,
        updates: {
          progress: newProgress,
          category: JSON.stringify(updatedCategory)
        }
      });

      setTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      const project = projects.find(p => p.id === actualId);
      if (!project) return;

      const details = parseProjectDetails(project.description || '');
      const updatedTasks = details.tasks.filter(t => t.id !== taskId);
      const completedCount = updatedTasks.filter(t => t.completed).length;
      const newProgress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;

      const updatedDesc = JSON.stringify({
        descriptionText: details.descriptionText,
        tasks: updatedTasks
      });

      updateProject({
        id: actualId,
        updates: {
          description: updatedDesc,
          progress: newProgress
        }
      });

      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-emerald-400';
      default: return 'text-muted-foreground';
    }
  };

  const todaysTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  // Quick Actions handlers
  const handleViewProgress = () => {
    setShowProgressModal(true);
  };

  const handleSubmitUpdate = () => {
    setShowUpdateModal(true);
  };

  const handleMarkComplete = () => {
    if (window.confirm(`Are you sure you want to mark "${projectName}" as complete?`)) {
      toast({
        title: "Project Completed! 🎉",
        description: `Congratulations! ${projectName} has been marked as complete.`,
      });
      // Here you would typically update the project status in your database
      setTimeout(() => {
        onBack();
      }, 2000);
    }
  };

  const handleSaveUpdate = () => {
    if (updateText.trim()) {
      toast({
        title: "Update Submitted",
        description: "Your project update has been saved successfully.",
      });
      setUpdateText('');
      setShowUpdateModal(false);
    }
  };

  const calculateProgress = () => {
    if (tasks.length === 0) return 0;
    return Math.round((completedTasks.length / tasks.length) * 100);
  };

  // Render AI Assistant Card with Squeeze, Maximize, and Position Swap controls
  const renderAiAssistantCard = () => (
    <Card className="bg-card border-border transition-all duration-200 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        {/* Header with Title, Status & Squeeze/Expand/Reorder controls */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none group min-w-0"
            onClick={() => isAiSqueezed && toggleAiSqueezed()}
            title={isAiSqueezed ? "Click to expand AI Assistant" : undefined}
          >
            <div className="p-1.5 rounded-md bg-green-500/10 border border-green-500/30 group-hover:border-green-400/50 transition-colors shrink-0">
              <Brain className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-foreground text-sm whitespace-nowrap">AI Assistant</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30 font-medium shrink-0">
                  FocusBot
                </span>
              </div>
              {isAiSqueezed && (
                <p className="text-[11px] text-muted-foreground truncate">Collapsed · Click to expand</p>
              )}
            </div>
          </div>

          {/* Action buttons: Maximize/Restore, Squeeze/Expand - All Solid Green */}
          <div className="flex items-center gap-1.5 shrink-0">

            {!isAiSqueezed && (
              <Button
                size="sm"
                onClick={toggleAiMaximized}
                className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm border-0 flex items-center justify-center shrink-0"
                title={isAiMaximized ? "Restore default height" : "Maximize height"}
              >
                {isAiMaximized ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
              </Button>
            )}

            <Button
              size="sm"
              onClick={toggleAiSqueezed}
              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm border-0 flex items-center justify-center shrink-0"
              title={isAiSqueezed ? "Expand AI Assistant" : "Squeeze / Collapse AI Assistant"}
            >
              {isAiSqueezed ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronUp className="w-4 h-4 text-white" />}
            </Button>
          </div>
        </div>

        {/* Card Body - visible only when NOT squeezed */}
        {!isAiSqueezed && (
          <div className="animate-in fade-in duration-200">
            <ScrollArea className={`${isAiMaximized ? 'h-[440px]' : 'h-36 sm:h-44'} mb-3 transition-all duration-200 pr-1`}>
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-2.5 rounded text-sm group relative ${
                      message.sender === 'user'
                        ? 'bg-green-600 text-white ml-8 shadow-sm'
                        : 'bg-muted/70 text-foreground mr-8 border border-border'
                    }`}
                  >
                    <div className="whitespace-pre-wrap pr-6 text-xs leading-relaxed">{message.text}</div>
                    <button
                      onClick={() => handleCopy(message.text, message.id)}
                      className="absolute bottom-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
                {isTyping && (
                  <div className="p-2.5 rounded text-sm bg-muted/70 text-muted-foreground mr-8 border border-border">
                    <div className="flex space-x-1 py-1">
                      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask AI anything..."
                className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xs"
                disabled={isTyping}
              />
              <Button 
                onClick={sendMessage}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0 border-0 shadow-sm disabled:bg-green-600 disabled:opacity-50"
                disabled={!inputMessage.trim() || isTyping}
              >
                <Send className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render Today's Tasks Card with Squeeze, Maximize, and Position Swap controls
  const renderTasksCard = () => (
    <Card className="bg-card border-border transition-all duration-200 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        {/* Header with Title, Progress count & Squeeze/Expand/Reorder controls */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none group min-w-0"
            onClick={() => isTasksSqueezed && toggleTasksSqueezed()}
            title={isTasksSqueezed ? "Click to expand Today's Tasks" : undefined}
          >
            <div className="p-1.5 rounded-md bg-green-500/10 border border-green-500/30 group-hover:border-green-400/50 transition-colors shrink-0">
              <ListTodo className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-foreground text-sm whitespace-nowrap">Today's Tasks</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 font-mono font-medium shrink-0">
                  {completedTasks.length}/{tasks.length}
                </span>
              </div>
              {isTasksSqueezed && (
                <p className="text-[11px] text-muted-foreground truncate">Collapsed · Click to expand</p>
              )}
            </div>
          </div>

          {/* Action buttons: Maximize/Restore, Squeeze/Expand - All Solid Green */}
          <div className="flex items-center gap-1.5 shrink-0">

            {!isTasksSqueezed && (
              <Button
                size="sm"
                onClick={toggleTasksMaximized}
                className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm border-0 flex items-center justify-center shrink-0"
                title={isTasksMaximized ? "Restore default height" : "Maximize height"}
              >
                {isTasksMaximized ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
              </Button>
            )}

            <Button
              size="sm"
              onClick={toggleTasksSqueezed}
              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm border-0 flex items-center justify-center shrink-0"
              title={isTasksSqueezed ? "Expand Tasks" : "Squeeze / Collapse Tasks"}
            >
              {isTasksSqueezed ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronUp className="w-4 h-4 text-white" />}
            </Button>
          </div>
        </div>

        {/* Card Body - visible only when NOT squeezed */}
        {!isTasksSqueezed && (
          <div className="animate-in fade-in duration-200">
            {/* Add Task Input */}
            <div className="flex gap-2 mb-3">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a new task..."
                className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xs"
              />
              <Button 
                onClick={addTask}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0 border-0 shadow-sm"
              >
                <Plus className="w-4 h-4 text-white" />
              </Button>
            </div>

            {/* Tasks List */}
            <div className={`space-y-2 ${isTasksMaximized ? 'max-h-[440px]' : 'max-h-52 sm:max-h-60'} overflow-y-auto pr-1 transition-all duration-200`}>
              {/* Pending Tasks */}
              {todaysTasks.length > 0 && (
                <div className="space-y-2">
                  {todaysTasks.map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-start gap-2 p-2 bg-muted/40 rounded border border-border hover:bg-muted/70 transition-colors"
                    >
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="mt-0.5 flex-shrink-0"
                        title={task.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        <Circle className="w-4 h-4 text-muted-foreground hover:text-green-600" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground break-words">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <AlertCircle className={`w-3 h-3 ${getPriorityColor(task.priority)}`} />
                          <span className={`text-xs ${getPriorityColor(task.priority)} capitalize`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => deleteTask(task.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        title="Delete task"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">Completed</p>
                  {completedTasks.map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-start gap-2 p-2 bg-muted/20 rounded border border-border/50"
                    >
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="mt-0.5 flex-shrink-0"
                        title="Mark incomplete"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground line-through break-words">{task.title}</p>
                      </div>
                      <Button
                        onClick={() => deleteTask(task.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        title="Delete task"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-xs">No tasks yet</p>
                  <p className="text-[11px] mt-1">Add your first task above</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="w-full bg-card border-b border-border px-4 lg:px-6 py-3 relative z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Back Arrow - Solid Green */}
          <Button 
            size="icon"
            onClick={onBack}
            className="h-9 w-9 bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg flex-shrink-0 border-0 flex items-center justify-center cursor-pointer transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Button>

          {/* Action Buttons at Top in Place of Platform Links - All Green */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button 
              size="sm" 
              onClick={handleViewProgress}
              className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-white" />
              View Progress
            </Button>
            <Button 
              size="sm" 
              onClick={handleSubmitUpdate}
              className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
            >
              <FileEdit className="w-3.5 h-3.5 mr-1.5 text-white" />
              Submit Update
            </Button>
            <Button 
              size="sm" 
              onClick={handleMarkComplete}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm h-8 px-3.5 text-xs border-0 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-white" />
              Mark as Complete
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Content Area */}
          <div className="lg:col-span-7 xl:col-span-8 2xl:col-span-8 space-y-6 min-w-0">
            {/* Project Header */}
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-3.5 mb-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                      {projectName}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {projectType} · Due in {deadline}
                    </p>
                  </div>
                  
                  {/* Platform Quick Links Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <Button 
                      size="sm" 
                      onClick={openInVSCode}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
                    >
                      <Code className="w-3.5 h-3.5 mr-1.5 text-white" />
                      VS Code
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => openExternalLink("https://github.com")}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
                    >
                      <Github className="w-3.5 h-3.5 mr-1.5 text-white" />
                      GitHub
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => openExternalLink("https://leetcode.com")}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-white" />
                      LeetCode
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => openExternalLink("https://hackerrank.com")}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-white" />
                      HackerRank
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => openExternalLink("https://linkedin.com")}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm h-8 px-3 text-xs border-0 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-white" />
                      LinkedIn
                    </Button>
                  </div>
                </div>

                {/* Expanded Countdown / Focus Timer Block */}
                <div className="mt-4 bg-gradient-to-br from-card via-card to-emerald-500/10 dark:from-card dark:via-card/95 dark:to-emerald-950/20 rounded-xl p-5 sm:p-6 lg:p-7 border border-border shadow-md relative overflow-hidden">
                  {/* Subtle ambient decorative blur */}
                  <div className="absolute -right-16 -top-16 w-56 h-56 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="space-y-4 relative z-10">
                    {/* Header: Timer Title & Status */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 shrink-0">
                          <Timer className={`w-5 h-5 sm:w-6 sm:h-6 ${isRunning ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Focus Session Timer
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isRunning ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                                Active Focus Session
                              </span>
                            ) : timer === 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-primary border border-primary/30">
                                Session Completed 🎉
                              </span>
                            ) : timer < initialTimer ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30">
                                Paused
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                                Ready to Focus
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Digital Clock Typography */}
                    <div className="text-4xl sm:text-5xl lg:text-6xl font-mono font-bold text-foreground tracking-tight select-none">
                      {formatTime(timer)}
                    </div>

                    {/* Quick Duration Presets - All Solid Green */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="text-xs text-muted-foreground font-medium mr-1">Presets:</span>
                      {[
                        { label: '25m', secs: 1500, title: 'Pomodoro (25 mins)' },
                        { label: '45m', secs: 2700, title: 'Deep Work (45 mins)' },
                        { label: '60m', secs: 3600, title: 'Standard (1 hour)' },
                        { label: '90m', secs: 5400, title: 'Extended (1.5 hours)' },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          onClick={() => setTimerPreset(preset.secs)}
                          className={`h-7 px-3 text-xs rounded-md font-semibold border-0 transition-all ${
                            initialTimer === preset.secs
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-500/30 shadow-sm'
                              : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                          }`}
                          title={preset.title}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>

                    {/* Controls & Actions Row */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap pt-1">
                      <Button 
                        onClick={handleStart} 
                        disabled={isRunning}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 sm:px-5 py-2.5 h-11 text-xs sm:text-sm shadow-md gap-2 rounded-xl border-0 disabled:bg-green-600 disabled:opacity-60 disabled:text-white shrink-0 transition-all"
                      >
                        <Play className="w-4 h-4 fill-white text-white" />
                        Start Focus
                      </Button>
                      <Button 
                        onClick={handlePause} 
                        disabled={!isRunning}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 sm:px-5 py-2.5 h-11 text-xs sm:text-sm shadow-md gap-2 rounded-xl border-0 disabled:bg-green-600 disabled:opacity-60 disabled:text-white shrink-0 transition-all"
                      >
                        <Pause className="w-4 h-4 fill-white text-white" />
                        Pause
                      </Button>
                      <Button 
                        onClick={handleReset}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3.5 sm:px-4 py-2.5 h-11 text-xs sm:text-sm shadow-md gap-1.5 rounded-xl border-0 shrink-0 transition-all"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-4 h-4 text-white" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar along the bottom of the countdown block */}
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Session Progress</span>
                      <span className="font-mono">{timerPercent}% elapsed</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${timerPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Today's Learning Plan Card replacing Code Scratchpad / Editor */}
            <DailyLearningPlanCard
              userId={user?.id || user?.user_id || 'default_user'}
              skillOrProjectId={projectId || actualId || 'current-project'}
              skillName={projectName}
              projectType={projectType}
              assignedTasks={tasks}
              onAskAiTutor={handlePlanAskAiTutor}
              onPlanProgressChange={handlePlanProgressChange}
            />
          </div>

          {/* Right Sidebar - Clean natural flow without height clipping */}
          <div className="lg:col-span-5 xl:col-span-4 2xl:col-span-4 space-y-4 min-w-0">
            {/* AI Assistant (Chat) Above */}
            {renderAiAssistantCard()}

            {/* Today's Tasks Below */}
            {renderTasksCard()}
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Project Progress</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Track your progress on {projectName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Overall Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Overall Completion</span>
                <span className="text-2xl font-bold text-foreground">{calculateProgress()}%</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500"
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
            </div>

            {/* Task Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Task Breakdown</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded border border-border">
                  <span className="text-sm text-muted-foreground">Total Tasks</span>
                  <span className="font-semibold text-foreground">{tasks.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded border border-border">
                  <span className="text-sm text-muted-foreground">Completed</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{completedTasks.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded border border-border">
                  <span className="text-sm text-muted-foreground">Remaining</span>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">{todaysTasks.length}</span>
                </div>
              </div>
            </div>

            {/* Time Spent */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Session Info</h4>
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded border border-border">
                <span className="text-sm text-muted-foreground">Current Session</span>
                <span className="font-mono font-semibold text-foreground">{formatTime(3600 - timer)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setShowProgressModal(false)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Update Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Submit Project Update</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Share your progress and any blockers you're facing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                What did you accomplish today?
              </label>
              <Textarea 
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Describe your progress, completed tasks, or any challenges..."
                className="bg-background border-border text-foreground placeholder:text-muted-foreground min-h-32"
              />
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
              <p className="text-sm text-green-700 dark:text-green-300">
                💡 Tip: Regular updates help track your progress and identify patterns in your workflow.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              onClick={() => setShowUpdateModal(false)}
              className="bg-green-700 hover:bg-green-800 text-white font-medium shadow-sm border-0"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUpdate}
              disabled={!updateText.trim()}
              className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm border-0 disabled:bg-green-600 disabled:opacity-50"
            >
              Submit Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
