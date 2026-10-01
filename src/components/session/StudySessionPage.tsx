import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Clock,
  BookOpen,
  Video,
  ExternalLink,
  MessageCircle,
  FileText,
  Upload,
  Plus,
  Settings,
  Target,
  Eye,
  Download,
  Tag,
  StickyNote,
  Music,
  Volume2,
  VolumeOff,
  Timer,
  TrendingUp,
  Brain,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AIChat } from '../chat/AIChat';

interface StudySessionPageProps {
  subject?: string;
  topic?: string;
  onBack?: () => void;
}

interface Resource {
  id: string;
  name: string;
  type: 'pdf' | 'video' | 'link' | 'notes' | 'ppt' | 'doc';
  category: string;
  tags: string[];
  url?: string;
  file?: File;
}

interface SessionNote {
  id: string;
  content: string;
  timestamp: Date;
  type: 'understanding' | 'difficulty' | 'important';
}

const TIMER_PRESETS = [
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '25 minutes (Pomodoro)', value: 25 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
  { label: 'Custom', value: 0 }
];

const BREAK_PRESETS = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: 'Custom', value: 0 }
];

const AI_SUGGESTIONS = [
  "Summarize this topic",
  "Explain SN2 mechanism",
  "Give me MCQs for Organic Chemistry",
  "What's the difference between SN1 and SN2?",
  "Create practice problems for this topic"
];

export const StudySessionPage = ({ 
  subject = "Chemistry", 
  topic = "Organic Reactions",
  onBack 
}: StudySessionPageProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Timer states
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [customTime, setCustomTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [isBreak, setIsBreak] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  
  // Session states
  const [showChat, setShowChat] = useState(true);
  const [resources, setResources] = useState<Resource[]>([
    { id: '1', name: 'Organic Chemistry Notes.pdf', type: 'pdf', category: 'Notes', tags: ['chemistry', 'organic'], url: '#' },
    { id: '2', name: 'SN1 vs SN2 Mechanisms', type: 'video', category: 'Video', tags: ['mechanism', 'reactions'], url: '#' },
    { id: '3', name: 'Khan Academy - Organic Reactions', type: 'link', category: 'Web Link', tags: ['tutorial', 'online'], url: '#' },
    { id: '4', name: 'Practice Problems Set 3.pdf', type: 'pdf', category: 'Problem Set', tags: ['practice', 'problems'], url: '#' },
  ]);
  
  // Notes states
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [noteType, setNoteType] = useState<'understanding' | 'difficulty' | 'important'>('understanding');
  
  // Session metrics
  const [sessionStartTime] = useState(new Date());
  const [totalFocusTime, setTotalFocusTime] = useState(90); // minutes
  const [sessionsCompleted, setSessionsCompleted] = useState(2);
  const [resourcesOpened, setResourcesOpened] = useState(3);
  const [topicsCovered, setTopicsCovered] = useState(1);
  
  // Ambient sound
  const [ambientSound, setAmbientSound] = useState<'none' | 'rain' | 'lofi' | 'nature'>('none');
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  // AI objectives
  const [sessionObjective] = useState(`Complete ${topic} study and solve practice problems`);
  const [showObjective, setShowObjective] = useState(true);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      if (isBreak) {
        setIsBreak(false);
        if (autoMode) {
          setTimeLeft(totalTime);
          setIsRunning(true);
        }
        toast({
          title: "Break Complete! 🎯",
          description: "Time to get back to studying!",
        });
      } else {
        setSessionsCompleted(prev => prev + 1);
        setTopicsCovered(prev => prev + 1);
        if (autoMode) {
          setIsBreak(true);
          setTimeLeft(breakTime * 60);
          setIsRunning(true);
        }
        toast({
          title: "Session Complete! 🎉",
          description: autoMode ? "Starting break time..." : "Great job! Take a break.",
        });
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, autoMode, totalTime, breakTime, toast]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTimerPreset = (minutes: number) => {
    if (minutes === 0) return; // Custom option
    setTotalTime(minutes * 60);
    setTimeLeft(minutes * 60);
    setCustomTime(minutes);
  };

  const handleCustomTime = () => {
    const seconds = customTime * 60;
    setTotalTime(seconds);
    setTimeLeft(seconds);
  };

  const handleStart = () => {
    setIsRunning(true);
    toast({
      title: `${isBreak ? 'Break' : 'Focus'} Started! 🚀`,
      description: isBreak ? "Enjoy your break!" : "Focus time! You've got this!",
    });
  };

  const handlePause = () => {
    setIsRunning(false);
    toast({
      title: "Timer Paused ⏸️",
      description: "Take your time, resume when ready.",
    });
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(isBreak ? breakTime * 60 : totalTime);
    toast({
      title: "Timer Reset 🔄",
      description: `Timer reset to ${isBreak ? breakTime : Math.floor(totalTime / 60)} minutes.`,
    });
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(totalTime);
    generateSessionSummary();
  };

  const handleResourceUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const newResource: Resource = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: getFileType(file.name),
          category: 'Uploaded',
          tags: ['uploaded', subject.toLowerCase()],
          file
        };
        setResources(prev => [...prev, newResource]);
      });
      toast({
        title: "Files Uploaded! 📁",
        description: `Added ${files.length} file(s) to resources.`,
      });
    }
  };

  const getFileType = (filename: string): Resource['type'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'mp4': case 'avi': case 'mov': return 'video';
      case 'ppt': case 'pptx': return 'ppt';
      case 'doc': case 'docx': return 'doc';
      case 'txt': case 'md': return 'notes';
      default: return 'pdf';
    }
  };

  const addNote = () => {
    if (!currentNote.trim()) return;
    
    const newNote: SessionNote = {
      id: Date.now().toString(),
      content: currentNote.trim(),
      timestamp: new Date(),
      type: noteType
    };
    
    setNotes(prev => [...prev, newNote]);
    setCurrentNote('');
    toast({
      title: "Note Saved! 📝",
      description: "Your session note has been saved.",
    });
  };

  const handleResourceOpen = (resource: Resource) => {
    setResourcesOpened(prev => prev + 1);
    toast({
      title: "Opening Resource 👀",
      description: `Opening ${resource.name}`,
    });
  };

  const generateSessionSummary = () => {
    const duration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 60000);
    toast({
      title: "Session Summary 📊",
      description: `Duration: ${duration}m | Resources: ${resourcesOpened} | Notes: ${notes.length}`,
    });
  };

  const progress = isBreak 
    ? ((breakTime * 60 - timeLeft) / (breakTime * 60)) * 100
    : ((totalTime - timeLeft) / totalTime) * 100;

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'pdf': return FileText;
      case 'video': return Video;
      case 'link': return ExternalLink;
      case 'notes': return StickyNote;
      case 'ppt': return FileText;
      case 'doc': return FileText;
      default: return FileText;
    }
  };

  const getNoteColor = (type: SessionNote['type']) => {
    switch (type) {
      case 'understanding': return 'bg-success/10 border-success/30';
      case 'difficulty': return 'bg-destructive/10 border-destructive/30';
      case 'important': return 'bg-warning/10 border-warning/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-accent/10 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Modern Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" onClick={onBack} className="mb-3 text-muted-foreground hover:text-foreground">
              ← Back to Dashboard
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-1 text-gradient">Welcome to {subject}</h1>
              <p className="text-xl font-medium text-muted-foreground">{topic} Study Session</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={`${isBreak ? 'bg-orange-500/20 text-orange-700 border-orange-200' : 'bg-primary/20 text-primary border-primary/20'} text-lg px-6 py-2 rounded-full font-medium`}>
              {isBreak ? '🧘 Break Time' : '🎯 Active Session'}
            </Badge>
            {soundEnabled && (
              <Button variant="outline" size="sm" onClick={() => setSoundEnabled(false)} className="rounded-full">
                <Volume2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* AI Objective Banner */}
        {showObjective && (
          <Card className="mb-8 p-6 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border-primary/20 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/20 rounded-full">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Session Objective</h3>
                  <p className="text-muted-foreground font-medium">{sessionObjective}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowObjective(false)} className="rounded-full">×</Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Session Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Modern Timer Card */}
            <Card className="p-10 text-center bg-gradient-to-br from-card to-muted/30 border-0 shadow-2xl rounded-3xl">
              <div className="mb-8">
                <div className="flex justify-center items-center space-x-6 mb-6">
                  <div className={`p-4 rounded-full ${isBreak ? 'bg-orange-500/20' : 'bg-primary/20'}`}>
                    <Clock className={`w-20 h-20 ${isBreak ? 'text-orange-600' : 'text-primary'}`} />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowTimerSettings(!showTimerSettings)}
                    className="rounded-full border-2"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className={`text-7xl font-bold mb-4 ${isBreak ? 'text-orange-600' : 'text-foreground'} tracking-tight`}>
                  {formatTime(timeLeft)}
                </div>
                
                <Progress value={progress} className="h-4 mb-6 rounded-full" />
                
                <p className="text-lg text-muted-foreground mb-6 font-medium">
                  {isBreak 
                    ? '🧘 Break time! Relax and recharge.' 
                    : isRunning 
                      ? '🔥 Focus time! Stay concentrated.' 
                      : '✨ Ready to start your session?'
                  }
                </p>

                {/* Timer Settings */}
                {showTimerSettings && (
                  <div className="mb-8 p-6 bg-muted/30 rounded-2xl border border-muted">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-semibold mb-3 text-foreground">⏱️ Focus Time</label>
                        <Select onValueChange={(value) => handleTimerPreset(parseInt(value))}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select focus time" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMER_PRESETS.map(preset => (
                              <SelectItem key={preset.value} value={preset.value.toString()}>
                                {preset.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {customTime && (
                          <div className="flex mt-3 space-x-2">
                            <Input
                              type="number"
                              value={customTime}
                              onChange={(e) => setCustomTime(parseInt(e.target.value) || 25)}
                              min="1"
                              max="180"
                              className="w-24 rounded-xl"
                            />
                            <Button size="sm" onClick={handleCustomTime} className="rounded-xl">Set</Button>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-3 text-foreground">☕ Break Time</label>
                        <Select onValueChange={(value) => setBreakTime(parseInt(value))}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select break time" />
                          </SelectTrigger>
                          <SelectContent>
                            {BREAK_PRESETS.map(preset => (
                              <SelectItem key={preset.value} value={preset.value.toString()}>
                                {preset.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={autoMode}
                          onChange={(e) => setAutoMode(e.target.checked)}
                          className="rounded-md"
                        />
                        <span className="text-sm font-medium">🔄 Auto Pomodoro Cycle</span>
                      </label>
                      
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium">🎵 Ambient Sound:</span>
                        <Select value={ambientSound} onValueChange={(value: any) => setAmbientSound(value)}>
                          <SelectTrigger className="w-36 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="rain">Rain</SelectItem>
                            <SelectItem value="lofi">Lo-fi</SelectItem>
                            <SelectItem value="nature">Nature</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center space-x-6">
                {!isRunning ? (
                  <Button onClick={handleStart} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-3 rounded-2xl text-lg font-semibold shadow-lg">
                    <Play className="w-5 h-5 mr-2" />
                    Start Focus
                  </Button>
                ) : (
                  <Button onClick={handlePause} variant="outline" className="px-8 py-3 rounded-2xl text-lg font-semibold border-2">
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </Button>
                )}
                
                <Button onClick={handleReset} variant="outline" className="px-8 py-3 rounded-2xl text-lg font-semibold border-2">
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Reset
                </Button>
                
                <Button onClick={handleStop} variant="outline" className="px-8 py-3 rounded-2xl text-lg font-semibold border-2 text-destructive border-destructive hover:bg-destructive hover:text-white">
                  <Square className="w-5 h-5 mr-2" />
                  End Session
                </Button>
              </div>
            </Card>

            {/* Modern Resources Section */}
            <Card className="p-8 bg-gradient-to-br from-card to-muted/20 border-0 shadow-xl rounded-3xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gradient">
                  📚 Session Resources
                </h3>
                <div className="flex space-x-3">
                  <Button variant="outline" size="sm" onClick={handleResourceUpload} className="rounded-full border-2 shadow-sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Files
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full border-2 shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,.avi,.mov"
              />
              
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-6 bg-muted/50 rounded-2xl p-1">
                  <TabsTrigger value="all" className="rounded-xl font-medium">All ({resources.length})</TabsTrigger>
                  <TabsTrigger value="pdf" className="rounded-xl font-medium">📄 PDFs</TabsTrigger>
                  <TabsTrigger value="video" className="rounded-xl font-medium">🎥 Videos</TabsTrigger>
                  <TabsTrigger value="notes" className="rounded-xl font-medium">📝 Notes</TabsTrigger>
                  <TabsTrigger value="links" className="rounded-xl font-medium">🔗 Links</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resources.map((resource) => {
                      const IconComponent = getResourceIcon(resource.type);
                      return (
                        <div 
                          key={resource.id}
                          className="flex items-center p-4 border border-muted rounded-2xl hover:shadow-lg hover:border-primary/30 cursor-pointer group transition-all duration-200 bg-background/50"
                          onClick={() => handleResourceOpen(resource)}
                        >
                          <div className="p-2 bg-primary/10 rounded-xl mr-4">
                            <IconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-foreground">{resource.name}</span>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant="secondary" className="text-xs font-medium rounded-full">{resource.category}</Badge>
                              {resource.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs rounded-full">
                                  <Tag className="w-3 h-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="rounded-full">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-full">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            {/* Modern Notes Section */}
            <Card className="p-8 bg-gradient-to-br from-card to-muted/20 border-0 shadow-xl rounded-3xl">
              <h3 className="text-2xl font-bold mb-6 text-gradient">
                📝 Session Notes
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex space-x-3 mb-4">
                    <Select value={noteType} onValueChange={(value: any) => setNoteType(value)}>
                      <SelectTrigger className="w-48 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="understanding">💡 Understanding</SelectItem>
                        <SelectItem value="difficulty">❗ Difficulty</SelectItem>
                        <SelectItem value="important">⭐ Important</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex space-x-3">
                    <Textarea
                      value={currentNote}
                      onChange={(e) => setCurrentNote(e.target.value)}
                      placeholder="What did you learn? What was difficult? Important points..."
                      className="flex-1 rounded-xl border-2 resize-none"
                      rows={3}
                    />
                    <Button onClick={addNote} disabled={!currentNote.trim()} className="rounded-xl px-6">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {notes.length > 0 && (
                  <ScrollArea className="h-40">
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className={`p-4 rounded-2xl border shadow-sm ${getNoteColor(note.type)}`}>
                          <div className="flex justify-between items-start">
                            <p className="text-sm flex-1 font-medium">{note.content}</p>
                            <span className="text-xs text-muted-foreground ml-3 font-medium">
                              {note.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </Card>
          </div>

          {/* Modern Side Panel */}
          <div className="space-y-8">
            {/* Floating AI Assistant */}
            <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-0 shadow-xl rounded-3xl h-96">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-bold flex items-center text-gradient">
                  <div className="p-2 bg-primary/20 rounded-full mr-3">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  AI Study Assistant
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className="rounded-full"
                >
                  {showChat ? 'Minimize' : 'Expand'}
                </Button>
              </div>
              
              {showChat ? (
                <div className="h-72">
                  <AIChat 
                    context={`study assistant for ${subject} - ${topic}`}
                    placeholder={`Ask about ${topic}...`}
                    className="h-full rounded-2xl"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4 font-medium">💡 Quick suggestions:</p>
                  {AI_SUGGESTIONS.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start text-xs rounded-2xl border-muted hover:border-primary/30 hover:bg-primary/5"
                      onClick={() => setShowChat(true)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            {/* Live Metrics with Bold Numbers */}
            <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-0 shadow-xl rounded-3xl">
              <h4 className="text-xl font-bold mb-6 flex items-center text-gradient">
                <div className="p-2 bg-green-500/20 rounded-full mr-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                Live Metrics
              </h4>
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Sessions Today</span>
                  <span className="text-2xl font-bold text-foreground">{sessionsCompleted}<span className="text-lg text-muted-foreground">/4</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Focus Time</span>
                  <span className="text-2xl font-bold text-foreground">{Math.floor(totalFocusTime / 60)}h<span className="text-lg text-muted-foreground"> {totalFocusTime % 60}m</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Resources Opened</span>
                  <span className="text-2xl font-bold text-primary">{resourcesOpened}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Topics Covered</span>
                  <span className="text-2xl font-bold text-accent">{topicsCovered}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Notes Taken</span>
                  <span className="text-2xl font-bold text-secondary-foreground">{notes.length}</span>
                </div>
              </div>
            </Card>

            {/* Session Progress with Enhanced Bars */}
            <Card className="p-6 bg-gradient-to-br from-card to-muted/20 border-0 shadow-xl rounded-3xl">
              <h4 className="text-xl font-bold mb-6 flex items-center text-gradient">
                <div className="p-2 bg-blue-500/20 rounded-full mr-3">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                Today's Goals
              </h4>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-muted-foreground">🎯 Study Sessions</span>
                    <span className="font-bold text-foreground">{sessionsCompleted}/4</span>
                  </div>
                  <Progress value={(sessionsCompleted / 4) * 100} className="h-3 rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-muted-foreground">⏰ Focus Time</span>
                    <span className="font-bold text-foreground">{Math.floor(totalFocusTime / 60)}/3h</span>
                  </div>
                  <Progress value={(totalFocusTime / 180) * 100} className="h-3 rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium text-muted-foreground">📚 Topics</span>
                    <span className="font-bold text-foreground">{topicsCovered}/3</span>
                  </div>
                  <Progress value={(topicsCovered / 3) * 100} className="h-3 rounded-full" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};