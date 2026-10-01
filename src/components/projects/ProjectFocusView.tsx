import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Pause, RotateCcw, Code, ExternalLink, Github, Timer, Brain, Send, Plus, Trash2, CheckCircle2, Circle, AlertCircle, TrendingUp, FileEdit, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSkills, parseSkillDetails } from "@/hooks/useSkills";
import { useProjects } from "@/hooks/useProjects";

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
  const { toast } = useToast();
  const [timer, setTimer] = useState(3600); // 1 hour default
  const [isRunning, setIsRunning] = useState(false);
  const projectDir = projectName.toLowerCase().replace(/\s+/g, '-');
  const [currentDirectory, setCurrentDirectory] = useState(`~/projects/${projectDir}`);
  const [terminalOutput, setTerminalOutput] = useState([
    `Welcome to ${projectName}`,
    `Current directory: ${currentDirectory}`,
    ""
  ]);
  const [terminalInput, setTerminalInput] = useState("");
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
    setTimer(3600);
    setIsRunning(false);
  };

  const executeCommand = () => {
    if (terminalInput.trim()) {
      const cmd = terminalInput.trim().toLowerCase();
      const newOutput = [...terminalOutput, `${currentDirectory}$ ${terminalInput}`];
      
      if (cmd === "pwd") {
        newOutput.push(currentDirectory);
      } else if (cmd === "ls" || cmd === "ls -la") {
        newOutput.push("src/", "public/", "package.json", "README.md", "node_modules/", ".git/");
      } else if (cmd.startsWith("cd ")) {
        const targetDir = cmd.substring(3).trim();
        if (targetDir === "..") {
          const parts = currentDirectory.split('/');
          parts.pop();
          setCurrentDirectory(parts.join('/') || '~');
        } else if (targetDir === "~" || targetDir === "") {
          setCurrentDirectory(`~/projects/${projectDir}`);
        } else if (["src", "public", "node_modules"].includes(targetDir)) {
          setCurrentDirectory(`${currentDirectory}/${targetDir}`);
        } else {
          newOutput.push(`cd: ${targetDir}: No such file or directory`);
        }
      } else if (cmd === "clear") {
        setTerminalOutput([]);
        setTerminalInput("");
        return;
      } else if (cmd.startsWith("npm install")) {
        newOutput.push("📦 Installing dependencies...", "⏳ This may take a moment...", "✔️ Dependencies installed successfully");
      } else if (cmd.startsWith("git status")) {
        newOutput.push("On branch main", "Your branch is up to date with 'origin/main'.", "", "nothing to commit, working tree clean");
      } else if (cmd.startsWith("git")) {
        newOutput.push("✔️ Git command executed successfully");
      } else if (cmd === "npm run build") {
        newOutput.push("🔨 Building for production...", "✔️ Build completed successfully", "Output: dist/");
      } else if (cmd === "npm start" || cmd === "npm run dev") {
        newOutput.push("🚀 Starting development server...", "✔️ Server running at http://localhost:3000");
      } else if (cmd === "npm test") {
        newOutput.push("🧪 Running tests...", "✔️ All tests passed");
      } else if (cmd === "help") {
        newOutput.push("Available commands:", "  pwd          - Print working directory", "  ls           - List files", "  cd [dir]     - Change directory", "  clear        - Clear terminal", "  npm install  - Install dependencies", "  npm start    - Start dev server", "  npm test     - Run tests", "  git status   - Check git status", "  help         - Show this help");
      } else {
        newOutput.push(`Command not found: ${terminalInput}`, "Type 'help' for available commands");
      }
      
      setTerminalOutput(newOutput);
      setTerminalInput("");
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMsgText = inputMessage.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMsgText,
      sender: 'user',
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: userMsgText,
          context: `project focus bot for ${projectName} (${projectType})`,
          conversationHistory: updatedMessages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        }
      });

      if (error) {
        console.error('AI Assistant Error:', error);
        throw error;
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || "I'm sorry, I couldn't process your request right now.",
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
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onBack}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="text-xl font-semibold text-white">DevFocus Dashboard</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Project Header */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-2">{projectName}</h1>
                    <p className="text-gray-400">{projectType} · Due in {deadline}</p>
                  </div>
                  
                  {/* External Platform Links */}
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={openInVSCode}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Code className="w-4 h-4 mr-2" />
                      VS Code
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openExternalLink("https://github.com")}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Github className="w-4 h-4 mr-2" />
                      GitHub
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openExternalLink("https://leetcode.com")}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      LeetCode
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openExternalLink("https://hackerrank.com")}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      HackerRank
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openExternalLink("https://linkedin.com")}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      LinkedIn
                    </Button>
                  </div>
                </div>

                {/* Quick Actions - Moved here */}
                <div className="mb-6">
                  <h3 className="font-medium text-white mb-3">Quick Actions</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={handleViewProgress}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View Progress
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={handleSubmitUpdate}
                    >
                      <FileEdit className="w-4 h-4 mr-2" />
                      Submit Update
                    </Button>
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleMarkComplete}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark as Complete
                    </Button>
                  </div>
                </div>

                {/* Timer Section */}
                <div className="flex items-center justify-between bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <Timer className="w-8 h-8 text-purple-400" />
                    <div className="text-3xl font-mono font-bold text-white">
                      {formatTime(timer)}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleStart} 
                      disabled={isRunning}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                    <Button 
                      onClick={handlePause} 
                      disabled={!isRunning}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                    <Button 
                      onClick={handleReset}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs Section */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <Tabs defaultValue="terminal" className="w-full">
                  <TabsList className="bg-gray-900 border-gray-700">
                    <TabsTrigger value="terminal" className="data-[state=active]:bg-gray-700">Terminal</TabsTrigger>
                    <TabsTrigger value="resources" className="data-[state=active]:bg-gray-700">Resources</TabsTrigger>
                    <TabsTrigger value="editor" className="data-[state=active]:bg-gray-700">Code Editor</TabsTrigger>
                    <TabsTrigger value="practice" className="data-[state=active]:bg-gray-700">Practice</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="terminal" className="mt-4">
                    <div className="bg-black text-green-400 font-mono p-4 rounded h-96 overflow-y-auto">
                      {terminalOutput.map((line, index) => (
                        <div key={index} className="mb-1 whitespace-pre-wrap">{line}</div>
                      ))}
                      <div className="flex items-center mt-2">
                        <span className="mr-2 text-blue-400">{currentDirectory}$</span>
                        <Input 
                          value={terminalInput}
                          onChange={(e) => setTerminalInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
                          className="bg-transparent border-none text-green-400 font-mono focus:ring-0 focus-visible:ring-0"
                          placeholder="Type 'help' for commands..."
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="resources" className="mt-4">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-white">Project Resources</h3>
                      
                      {/* Add Resource Form */}
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Add resource URL or document name" 
                          value={newResource.title}
                          onChange={(e) => setNewResource({...newResource, title: e.target.value})}
                          className="bg-gray-900 border-gray-600 text-white placeholder-gray-400"
                        />
                        <Button onClick={addResource} className="bg-blue-600 hover:bg-blue-700">
                          Add
                        </Button>
                      </div>
                      
                      {/* Resources List */}
                      <div className="space-y-2">
                        {resources.map(resource => (
                          <div key={resource.id} className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                {resource.type}
                              </div>
                              <a 
                                href={resource.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-white hover:text-blue-400 flex items-center gap-1"
                              >
                                {resource.title}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <Button 
                              onClick={() => removeResource(resource.id)} 
                              variant="ghost" 
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="editor" className="mt-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-white">Code Scratchpad</h3>
                        <Button 
                          onClick={openInVSCode}
                          variant="outline" 
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open in VS Code
                        </Button>
                      </div>
                      <Textarea 
                        value={codeContent}
                        onChange={(e) => setCodeContent(e.target.value)}
                        placeholder="Write or paste your code here... This is a local scratchpad and does not save."
                        className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 font-mono h-96 resize-none"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="practice" className="mt-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-white">Practice Problems</h3>
                        <Button 
                          onClick={() => openExternalLink("https://leetcode.com")}
                          variant="outline" 
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open LeetCode
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        {leetcodeProblems.map(problem => (
                          <div 
                            key={problem.id} 
                            className="p-4 bg-gray-900 rounded border border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
                            onClick={() => openLeetCodeProblem(problem)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-white mb-1">{problem.title}</h4>
                                <p className="text-sm text-gray-400">
                                  {problem.tags.join(", ")} - {problem.difficulty}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLeetCodeProblem(problem);
                                  }}
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  Practice Now
                                </Button>
                                <div className="w-6 h-6 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">
                                  LC
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Sticky */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            {/* Today's Tasks */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-white">Today's Tasks</h3>
                  <div className="text-sm text-gray-400">
                    {completedTasks.length}/{tasks.length}
                  </div>
                </div>

                {/* Add Task Input */}
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                    placeholder="Add a new task..."
                    className="bg-gray-900 border-gray-600 text-white placeholder-gray-400"
                  />
                  <Button 
                    onClick={addTask}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tasks List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {/* Pending Tasks */}
                  {todaysTasks.length > 0 && (
                    <div className="space-y-2">
                      {todaysTasks.map(task => (
                        <div 
                          key={task.id}
                          className="flex items-start gap-2 p-2 bg-gray-900 rounded border border-gray-700 hover:bg-gray-800 transition-colors"
                        >
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            <Circle className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white break-words">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <AlertCircle className={`w-3 h-3 ${getPriorityColor(task.priority)}`} />
                              <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                            </div>
                          </div>
                          <Button
                            onClick={() => deleteTask(task.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed Tasks */}
                  {completedTasks.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-gray-700">
                      <p className="text-xs text-gray-500 uppercase font-medium">Completed</p>
                      {completedTasks.map(task => (
                        <div 
                          key={task.id}
                          className="flex items-start gap-2 p-2 bg-gray-900/50 rounded border border-gray-700/50"
                        >
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-500 line-through break-words">{task.title}</p>
                          </div>
                          <Button
                            onClick={() => deleteTask(task.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty State */}
                  {tasks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No tasks yet</p>
                      <p className="text-xs mt-1">Add your first task above</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Assistant - Sticky */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h3 className="font-medium text-white">AI Assistant</h3>
                </div>
                
                <ScrollArea className="h-48 mb-4">
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-2 rounded text-sm group relative ${
                          message.sender === 'user'
                            ? 'bg-blue-600 text-white ml-8'
                            : 'bg-gray-700 text-gray-300 mr-8'
                        }`}
                      >
                        <div className="whitespace-pre-wrap pr-6">{message.text}</div>
                        <button
                          onClick={() => handleCopy(message.text, message.id)}
                          className="absolute bottom-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 text-gray-400 hover:text-white transition-all"
                          title="Copy message"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="p-2 rounded text-sm bg-gray-700 text-gray-300 mr-8">
                        <div className="flex space-x-1 py-1">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                    className="bg-gray-900 border-gray-600 text-white placeholder-gray-400"
                    disabled={isTyping}
                  />
                  <Button 
                    onClick={sendMessage}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!inputMessage.trim() || isTyping}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Focus Tips */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-medium text-white mb-3">Focus Tips</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Break large tasks into smaller steps.</li>
                  <li>• Use the timer for focused Pomodoro sessions.</li>
                  <li>• Push code regularly to track progress.</li>
                  <li>• Stay consistent — 1 hour daily matters.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Project Progress</DialogTitle>
            <DialogDescription className="text-gray-400">
              Track your progress on {projectName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Overall Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Overall Completion</span>
                <span className="text-2xl font-bold text-white">{calculateProgress()}%</span>
              </div>
              <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
            </div>

            {/* Task Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Task Breakdown</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <span className="text-sm text-gray-300">Total Tasks</span>
                  <span className="font-semibold text-white">{tasks.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <span className="text-sm text-gray-300">Completed</span>
                  <span className="font-semibold text-green-400">{completedTasks.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <span className="text-sm text-gray-300">Remaining</span>
                  <span className="font-semibold text-yellow-400">{todaysTasks.length}</span>
                </div>
              </div>
            </div>

            {/* Time Spent */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Session Info</h4>
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                <span className="text-sm text-gray-300">Current Session</span>
                <span className="font-mono font-semibold text-white">{formatTime(3600 - timer)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setShowProgressModal(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Update Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Submit Project Update</DialogTitle>
            <DialogDescription className="text-gray-400">
              Share your progress and any blockers you're facing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                What did you accomplish today?
              </label>
              <Textarea
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Describe your progress, completed tasks, or any challenges..."
                className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 min-h-32"
              />
            </div>

            <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
              <p className="text-sm text-blue-300">
                💡 Tip: Regular updates help track your progress and identify patterns in your workflow.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setShowUpdateModal(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUpdate}
              disabled={!updateText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Submit Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
