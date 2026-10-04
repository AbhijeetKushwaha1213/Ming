import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, Bot, User, Loader2, Maximize2, Minimize2, Save, History, 
  Copy, Check, ShieldCheck, AlertCircle, Paperclip, X, Sparkles, Plus,
  Mic, MicOff, Volume2, VolumeX, Languages
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useChatHistory, ChatSession } from '@/hooks/useChatHistory';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { Citation } from './Citation';
import { askGroundedTutor, ingestSource, CitationData, GroundedChatResponse } from '@/api/ragAPI';
import { geminiClient } from '@/utils/geminiClient';
import { 
  getWorkspaceCatalog, 
  getAgentWorkspacePrompt, 
  parseAgentActions, 
  executeAgentActions 
} from '@/services/agentActionEngine';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { navigateToTab } from '@/utils/navigation';
import { format } from 'date-fns';

function useSafeQueryClient(): QueryClient | undefined {
  try {
    return useQueryClient();
  } catch {
    return undefined;
  }
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  citations?: CitationData[];
  grounded?: boolean;
  insufficientEvidence?: boolean;
  usedGeminiFallback?: boolean;
  attachedFileName?: string;
  attachedFileSize?: string;
  actionsExecuted?: string[];
}

interface AIChatProps {
  context?: string;
  placeholder?: string;
  className?: string;
  expandable?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const AIChat = ({ 
  context = "study assistant", 
  placeholder = "Ask me anything about your studies...",
  className = "",
  expandable = false
}: AIChatProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { saveChatSession } = useChatHistory();
  const queryClient = useSafeQueryClient();

  const quickPrompts = [
    { label: '✏️ Edit / Modify Page', prompt: "Edit the page 'Machine Learning' and append a summary of key formulas and concepts." },
    { label: '🗑️ Delete Resource', prompt: "Delete the page 'Untitled' from my resources." },
    { label: '📁 Organize Resources', prompt: "Organize all my study resources into topic folders based on similarity." },
    { label: '📚 Vault to Resources', prompt: "Copy my recent quizzes and study materials from Vault into Resources." },
  ];

  const activeChatStorageKey = `studymate_active_chat_${user?.user_id || user?.id || 'guest'}`;

  // Restore or generate current session ID
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(activeChatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sessionId) return parsed.sessionId;
      }
    } catch (e) {}
    return `session_${Date.now()}`;
  });

  // Restore current topic (ignore greetings)
  const [currentTopic, setCurrentTopic] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(activeChatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.topic && !['hy', 'hi', 'hello', 'hey', 'test', 'yo'].includes(parsed.topic.toLowerCase().trim())) {
          return parsed.topic;
        }
      }
    } catch (e) {}
    return '';
  });

  // Restore messages or initialize
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(activeChatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          return parsed.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to parse active chat messages:', e);
    }
    return [
      {
        id: '1',
        text: `Hi! I'm your AI ${context}. How can I help you today? You can ask questions about your studies, attach lecture slides/PDFs, or explore any academic concept!`,
        sender: 'ai',
        timestamp: new Date()
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type ChatLanguage = 'english' | 'hinglish' | 'hindi';

  const [language, setLanguage] = useState<ChatLanguage>(() => {
    return (localStorage.getItem('studymate_chat_language') as ChatLanguage) || 'english';
  });
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const handleSetLanguage = (lang: ChatLanguage) => {
    setLanguage(lang);
    try {
      localStorage.setItem('studymate_chat_language', lang);
    } catch (e) {}
    toast({
      title: `Language: ${lang === 'hinglish' ? '🇮🇳 Hinglish' : lang === 'hindi' ? '🇮🇳 Hindi' : '🇬🇧 English'}`,
      description: lang === 'hinglish'
        ? 'Tutor will explain concepts in collegiate Hinglish with verified source citations.'
        : lang === 'hindi'
        ? 'Tutor will explain concepts in Hindi with verified source citations.'
        : 'Tutor will explain concepts in standard English with verified source citations.',
      duration: 2500,
    });
  };

  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser does not support Web Speech Recognition. Please use Chrome, Edge, or Safari.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'hindi' ? 'hi-IN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleToggleSpeech = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast({
        title: "Audio Read-Aloud Unavailable",
        description: "Speech synthesis is not supported on this browser.",
        variant: "destructive"
      });
      return;
    }

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Strip markdown tags and citation IDs for smooth natural speech
    const cleanSpokenText = text
      .replace(/\[CHUNK_[A-Za-z0-9_-]+\]/g, '')
      .replace(/###?\s+/g, '')
      .replace(/[*`_~]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = language === 'hindi' ? 'hi-IN' : 'en-US';

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Auto-save active chat state to localStorage on every update
  useEffect(() => {
    try {
      localStorage.setItem(activeChatStorageKey, JSON.stringify({
        sessionId: currentSessionId,
        topic: currentTopic,
        messages: messages.map(m => ({
          ...m,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
        }))
      }));
    } catch (e) {
      console.warn('Failed to auto-save active chat state:', e);
    }
  }, [messages, currentTopic, currentSessionId, activeChatStorageKey]);

  // Auto-archive active session into history when there is a conversation
  useEffect(() => {
    if (messages.length > 1) {
      const firstUserMsg = messages.find(m => m.sender === 'user')?.text;
      const title = currentTopic || (firstUserMsg ? firstUserMsg.slice(0, 32) : `Chat ${format(new Date(), 'MMM dd, HH:mm')}`);
      saveChatSession({
        id: currentSessionId,
        title,
        topic: currentTopic || 'General',
        messages: messages.slice(1).map(msg => ({
          role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.text,
          timestamp: (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toISOString()
        }))
      });
    }
  }, [messages.length, currentSessionId]);

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

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please choose a file smaller than 50MB.",
          variant: "destructive",
        });
        return;
      }
      setAttachedFile(file);
      if (!currentTopic) {
        setCurrentTopic(file.name.replace(/\.[^/.]+$/, ""));
      }
      toast({
        title: "File Attached",
        description: `Attached ${file.name}. Type your question or press send to analyze it!`,
      });
    }
  };

  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && !attachedFile) || isLoading) return;

    let userMsgText = trimmedInput;
    if (!userMsgText && attachedFile) {
      userMsgText = `Please analyze and summarize the uploaded document: ${attachedFile.name}`;
    }

    const fileToIngest = attachedFile;
    const attachedName = fileToIngest?.name;
    const attachedSize = fileToIngest ? formatFileSize(fileToIngest.size) : undefined;

    // Reset input states immediately for responsive feel
    setInput('');
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Set topic only if real topic and not a greeting/casual message
    const isGreeting = /^(hi|hey|hello|hy|yo|sup|test|help|start|good\s+(morning|afternoon|evening))\b/i.test(userMsgText.trim()) || userMsgText.trim().length <= 3;
    let effectiveTopic = currentTopic;
    if (attachedName) {
      effectiveTopic = attachedName.replace(/\.[^/.]+$/, "");
      setCurrentTopic(effectiveTopic);
    } else if (!effectiveTopic && !isGreeting && userMsgText.length > 5) {
      effectiveTopic = userMsgText.slice(0, 35);
      setCurrentTopic(effectiveTopic);
    }

    const sanitizedTopic = (effectiveTopic && !['hy', 'hi', 'hello', 'hey', 'test', 'yo'].includes(effectiveTopic.toLowerCase().trim())) 
      ? effectiveTopic 
      : undefined;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMsgText,
      sender: 'user',
      timestamp: new Date(),
      attachedFileName: attachedName,
      attachedFileSize: attachedSize
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 1. If file attached, ingest it into the user's RAG knowledge base first
      if (fileToIngest) {
        setIsUploadingFile(true);
        try {
          await ingestSource({
            file: fileToIngest,
            userId: user?.user_id || user?.id || 'default_user',
            topic: sanitizedTopic || 'Course Document',
            title: fileToIngest.name
          });
          toast({
            title: "File Indexed",
            description: `"${fileToIngest.name}" is now part of your study knowledge base!`,
          });
        } catch (ingestErr) {
          console.warn('File ingestion notice (proceeding to generate response):', ingestErr);
        } finally {
          setIsUploadingFile(false);
        }
      }

      const conversationHistory = messages.slice(-8).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      // Gather real-time workspace context & action prompt
      const catalog = await getWorkspaceCatalog();
      const workspacePrompt = getAgentWorkspacePrompt(catalog, `Current topic/context: ${sanitizedTopic || context}`);

      const isActionQuery = /(delete|remove|edit|modify|update|rename|create|folder|organize|move|copy\s+vault|vault\s+to\s+resource|add\s+notes\s+to|append|clean\s+up)/i.test(userMsgText);

      // If user specifically asked for workspace actions (edit, delete, modify, organize, copy), route directly to Gemini with workspace tools
      if (isActionQuery) {
        const directRes = await geminiClient.generateContent({
          message: userMsgText,
          systemPrompt: workspacePrompt,
          topic: sanitizedTopic,
          context: conversationHistory
        });

        if (directRes && directRes.response && !directRes.error) {
          const { cleanText, actions } = parseAgentActions(directRes.response);
          const executed = await executeAgentActions(actions, queryClient);

          if (executed.length > 0) {
            toast({
              title: "Workspace Actions Executed ⚡",
              description: executed.join(', '),
            });
          }

          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: cleanText || "I've processed your workspace request.",
            sender: 'ai',
            timestamp: new Date(),
            citations: [],
            grounded: false,
            usedGeminiFallback: true,
            insufficientEvidence: false,
            actionsExecuted: executed.length > 0 ? executed : undefined,
          };
          setMessages(prev => [...prev, aiMessage]);
          return;
        }
      }

      // 2. Query Grounded AI Tutor
      let tutorResult: GroundedChatResponse | null = null;
      try {
        tutorResult = await askGroundedTutor({
          message: userMsgText,
          userId: user?.user_id || user?.id || 'default_user',
          topic: sanitizedTopic || context,
          conversationHistory,
          language,
        });
      } catch (tutorError) {
        console.warn('askGroundedTutor failed, falling back to direct Gemini API:', tutorError);
      }

      // Check if tutor returned grounded response with verified citations
      const hasGroundedEvidence = tutorResult && 
        !tutorResult.insufficient_evidence && 
        tutorResult.grounded && 
        tutorResult.citations && 
        tutorResult.citations.length > 0;

      if (hasGroundedEvidence && tutorResult) {
        const { cleanText, actions } = parseAgentActions(tutorResult.response);
        const executed = await executeAgentActions(actions, queryClient);

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: cleanText,
          sender: 'ai',
          timestamp: new Date(),
          citations: tutorResult.citations || [],
          grounded: true,
          insufficientEvidence: false,
          actionsExecuted: executed.length > 0 ? executed : undefined,
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Fall back directly to Gemini 2.5 Flash with workspace systemPrompt
        let adjustedPrompt = workspacePrompt;
        if (language === 'hinglish') {
          adjustedPrompt += '\n\nIMPORTANT: Explain concepts in natural, friendly collegiate Hinglish (Hindi written in Roman/English script mixed with English technical terms). Keep technical keywords and code in English.';
        } else if (language === 'hindi') {
          adjustedPrompt += '\n\nIMPORTANT: Explain concepts in clear Hindi using Devanagari script, with technical English terms in parentheses.';
        }

        const directRes = await geminiClient.generateContent({
          message: userMsgText,
          systemPrompt: adjustedPrompt,
          topic: sanitizedTopic,
          context: conversationHistory
        });

        if (directRes && directRes.response && !directRes.error) {
          const { cleanText, actions } = parseAgentActions(directRes.response);
          const executed = await executeAgentActions(actions, queryClient);

          if (executed.length > 0) {
            toast({
              title: "Workspace Actions Executed ⚡",
              description: executed.join(', '),
            });
          }

          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: cleanText,
            sender: 'ai',
            timestamp: new Date(),
            citations: [],
            grounded: false,
            usedGeminiFallback: true,
            insufficientEvidence: false,
            actionsExecuted: executed.length > 0 ? executed : undefined,
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          // If Gemini also failed (e.g. key issue or network), show the tutor result response or a helpful message
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: directRes?.error
              ? `I couldn't contact Gemini AI (${directRes.error}). ${tutorResult?.response || "Please attach a document or check your network connection."}`
              : (tutorResult?.response || "I couldn't find specific course materials for this topic. Please attach a document or ask a general study question!"),
            sender: 'ai',
            timestamp: new Date(),
            insufficientEvidence: true
          };
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble processing your request right now. Please try again in a moment.",
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
      setIsLoading(false);
      setIsUploadingFile(false);
    }
  };

  const handleSaveSession = () => {
    if (messages.length <= 1) {
      toast({
        title: "Nothing to Save",
        description: "Start a conversation to save your chat session.",
        variant: "destructive",
      });
      return;
    }

    try {
      const sessionData = {
        id: currentSessionId,
        title: currentTopic || `Chat ${format(new Date(), 'MMM dd, HH:mm')}`,
        topic: currentTopic || 'General',
        messages: messages.slice(1).map(msg => ({
          role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.text,
          timestamp: (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toISOString()
        }))
      };

      saveChatSession(sessionData);
      toast({
        title: "Chat Saved",
        description: "Your conversation has been saved to chat history.",
      });
    } catch (error) {
      console.error('AIChat: Error saving session:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save chat session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setCurrentTopic(session.topic);
    setMessages([
      {
        id: '1',
        text: `Continuing conversation: "${session.title}" (${session.topic})`,
        sender: 'ai',
        timestamp: new Date(session.created_at)
      },
      ...session.messages.map((msg, index) => ({
        id: `${index + 2}`,
        text: msg.content,
        sender: msg.role === 'user' ? 'user' as const : 'ai' as const,
        timestamp: new Date(msg.timestamp)
      }))
    ]);
    setShowHistory(false);
    toast({
      title: "Chat Restored",
      description: `Loaded "${session.title}" with ${session.messages.length} messages.`,
    });
  };

  const handleNewChat = () => {
    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    setCurrentTopic('');
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const initialMsgs: Message[] = [
      {
        id: '1',
        text: `Hi! I'm your AI ${context}. How can I help you today? You can ask questions about your studies, attach lecture slides/PDFs, or explore any academic concept!`,
        sender: 'ai',
        timestamp: new Date()
      }
    ];

    setMessages(initialMsgs);
    setShowHistory(false);
    toast({
      title: "New Chat Started",
      description: "Previous conversation preserved in history.",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const defaultHeight = expandable 
    ? (isExpanded ? 'h-[85vh]' : 'h-96') 
    : 'h-[calc(100vh-140px)] min-h-[580px]';
  const chatHeight = className.includes('h-') ? '' : defaultHeight;

  return (
    <Card className={`flex flex-col shadow-sm border border-border/70 rounded-2xl bg-card overflow-hidden ${chatHeight} ${className}`}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card/60 backdrop-blur-sm">
        <h3 className="font-semibold flex items-center">
          <span className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center mr-2 shadow-glow">
            <Bot className="w-4 h-4 text-white" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">AI {context.charAt(0).toUpperCase() + context.slice(1)}</span>
            {currentTopic && !['hy', 'hi', 'hello', 'hey', 'test', 'yo'].includes(currentTopic.toLowerCase().trim()) ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="truncate max-w-[180px]">Topic: {currentTopic}</span>
                <button
                  type="button"
                  onClick={() => setCurrentTopic('')}
                  className="hover:text-foreground text-muted-foreground/70 p-0.5 rounded-full hover:bg-muted"
                  title="Clear topic focus"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Ready • Gemini 2.5 + Grounded RAG</span>
            )}
          </div>
        </h3>
        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
          {/* Language Selector: English / Hinglish / Hindi */}
          <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => handleSetLanguage('english')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                language === 'english'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="English explanations"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleSetLanguage('hinglish')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                language === 'hinglish'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Hinglish explanations (Hindi + English)"
            >
              🇮🇳 Hinglish
            </button>
            <button
              type="button"
              onClick={() => handleSetLanguage('hindi')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                language === 'hindi'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Hindi explanations"
            >
              हिन्दी
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="h-8 gap-1 text-xs font-medium"
            title="Start a new chat conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>

          <Button
            variant={showHistory ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Chat History"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveSession}
            className="h-8 text-muted-foreground hover:text-foreground"
            title="Save session"
          >
            <Save className="w-4 h-4" />
          </Button>

          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 text-muted-foreground"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 p-4 overflow-hidden">
          <ChatHistoryPanel
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
          />
        </div>
      ) : (
        <>
          {/* Messages Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-brand-gradient text-white shadow-glow'
                        : 'bg-muted/80 text-foreground border border-border/40'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      {message.sender === 'ai' && (
                        <Bot className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      )}
                      {message.sender === 'user' && (
                        <User className="w-4 h-4 mt-0.5 text-white shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {/* Attached File in User Bubble */}
                        {message.sender === 'user' && message.attachedFileName && (
                          <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                            <Paperclip className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[220px]">{message.attachedFileName}</span>
                            {message.attachedFileSize && (
                              <span className="text-white/80 text-[10px]">({message.attachedFileSize})</span>
                            )}
                          </div>
                        )}

                        {/* AI Response Badges */}
                        {message.sender === 'ai' && message.grounded && (
                          <div className="mb-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Grounded in Course Material</span>
                          </div>
                        )}
                        {message.sender === 'ai' && message.usedGeminiFallback && (
                          <div className="mb-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-primary border border-primary/20">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span>Answered via Gemini AI</span>
                          </div>
                        )}
                        {message.sender === 'ai' && message.insufficientEvidence && (
                          <div className="mb-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>General Academic Guidance</span>
                          </div>
                        )}

                        {/* Executed Agent Actions Badge */}
                        {message.sender === 'ai' && message.actionsExecuted && message.actionsExecuted.length > 0 && (
                          <div className="mb-2.5 p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                            <div className="flex items-center justify-between font-medium text-primary mb-1.5">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                Workspace Actions Executed ({message.actionsExecuted.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => navigateToTab('resources')}
                                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                Open Resources ↗
                              </button>
                            </div>
                            <div className="space-y-1 text-muted-foreground text-[11px]">
                              {message.actionsExecuted.map((summary, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-1.5">
                                  <span className="text-primary font-bold">•</span>
                                  <span>{summary}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>

                        {/* Verified Sources Shelf */}
                        {message.sender === 'ai' && message.citations && message.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-border/40">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-1.5">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Verified Sources Cited ({message.citations.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {message.citations.map((citation, cIdx) => (
                                <Citation key={`${message.id}-cit-${cIdx}`} citation={citation} />
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2.5 pt-1 space-x-4 border-t border-black/5 dark:border-white/5">
                          <p className={`text-[11px] ${
                            message.sender === 'user' ? 'text-white/70' : 'text-muted-foreground'
                          }`}>
                            {message.timestamp instanceof Date 
                              ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          </p>
                          <div className="flex items-center gap-1">
                            {message.sender === 'ai' && (
                              <button
                                type="button"
                                onClick={() => handleToggleSpeech(message.id, message.text)}
                                className={`p-1 rounded transition-colors ${
                                  speakingMessageId === message.id
                                    ? 'text-primary bg-primary/15 animate-pulse'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-black/10'
                                }`}
                                title={speakingMessageId === message.id ? "Stop voice playback" : "Listen (Read aloud)"}
                              >
                                {speakingMessageId === message.id ? (
                                  <VolumeX className="w-3.5 h-3.5 text-primary" />
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleCopy(message.text, message.id)}
                              className={`p-1 rounded hover:bg-black/10 transition-colors ${
                                message.sender === 'user' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              title="Copy message"
                            >
                              {copiedId === message.id ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-2xl p-3.5 max-w-[85%] border border-border/40">
                    <div className="flex items-center space-x-2.5">
                      <Bot className="w-4 h-4 text-primary" />
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm">
                        {isUploadingFile ? `Indexing ${attachedFile?.name || 'document'} into your study notes...` : 'Thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer Input Area */}
          <div className="p-3.5 border-t bg-card/60 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto space-y-2">
              {/* Quick Action Suggestion Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <span className="text-[11px] text-muted-foreground font-medium shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Agent Actions:
                </span>
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInput(qp.prompt);
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11px] bg-muted/80 hover:bg-primary/10 hover:text-primary border border-border/60 transition-colors cursor-pointer"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* Attached file pill banner */}
              {attachedFile && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-primary font-medium truncate">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{attachedFile.name}</span>
                    <span className="text-muted-foreground font-normal">({formatFileSize(attachedFile.size)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors ml-2"
                    title="Remove attached file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Voice recognition active banner */}
              {isListening && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="font-medium">Listening... speak your question in {language === 'hindi' ? 'Hindi' : 'English / Hinglish'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className="text-xs underline font-semibold ml-2 hover:opacity-80 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.pptx,.ppt,.txt,.md,.mp4,.webm,.mp3,.wav,.m4a"
                />

                {/* File Attachment Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-10 w-10 shrink-0 text-muted-foreground hover:text-primary transition-colors ${
                    attachedFile ? 'text-primary bg-primary/15' : ''
                  }`}
                  title="Attach file (PDF, PPTX, text notes, lecture audio/video)"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>

                {/* Query Input Field */}
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={attachedFile ? `Ask something about "${attachedFile.name}" (or press send to summarize)...` : placeholder}
                  disabled={isLoading}
                  className="flex-1 h-10 rounded-xl"
                />

                {/* Speech-to-Text Microphone Button */}
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "ghost"}
                  size="icon"
                  disabled={isLoading}
                  onClick={toggleSpeechRecognition}
                  className={`h-10 w-10 shrink-0 rounded-xl transition-all ${
                    isListening ? 'animate-pulse ring-2 ring-red-500/50 text-white' : 'text-muted-foreground hover:text-primary'
                  }`}
                  title={isListening ? "Listening... click to stop" : "Voice input (Speech to Text)"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>

                {/* Send Button */}
                <Button 
                  onClick={handleSendMessage} 
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                  size="icon"
                  variant="premium"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
