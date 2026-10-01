
import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, Maximize2, Minimize2, Save, History, Copy, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useChatHistory, ChatSession } from '@/hooks/useChatHistory';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { Citation } from './Citation';
import { askGroundedTutor, CitationData } from '@/api/ragAPI';
import { format } from 'date-fns';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  citations?: CitationData[];
  grounded?: boolean;
  insufficientEvidence?: boolean;
}

interface AIChatProps {
  context?: string;
  placeholder?: string;
  className?: string;
  expandable?: boolean;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hi! I'm your AI ${context}. How can I help you today? Ask questions about your uploaded textbooks, lecture slides, or class videos!`,
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentTopic, setCurrentTopic] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Set topic if not already set
    if (!currentTopic) {
      setCurrentTopic(input.trim());
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      // Retrieve from Chroma knowledge base and ground through Gemini using authenticated user_id
      const tutorResult = await askGroundedTutor({
        message: currentInput,
        userId: user?.user_id || user?.id || 'default_user',
        topic: currentTopic || context,
        conversationHistory
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: tutorResult.response || "The uploaded course materials do not contain sufficient information to answer this question.",
        sender: 'ai',
        timestamp: new Date(),
        citations: tutorResult.citations || [],
        grounded: tutorResult.grounded,
        insufficientEvidence: tutorResult.insufficient_evidence
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error in Grounded AI Tutor:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble retrieving course materials right now. Please try again later.",
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection Error",
        description: "Unable to query knowledge base. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
        title: currentTopic || `Chat ${format(new Date(), 'MMM dd, HH:mm')}`,
        topic: currentTopic || 'General',
        messages: messages.slice(1).map(msg => ({
          role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.text,
          timestamp: msg.timestamp.toISOString()
        }))
      };

      console.log('AIChat: Saving chat session:', sessionData);
      saveChatSession(sessionData);
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
    setMessages([
      {
        id: '1',
        text: `Hi! I'm your AI ${context}. How can I help you today?`,
        sender: 'ai',
        timestamp: new Date()
      },
      ...session.messages.map((msg, index) => ({
        id: `${index + 2}`,
        text: msg.content,
        sender: msg.role === 'user' ? 'user' as const : 'ai' as const,
        timestamp: new Date(msg.timestamp)
      }))
    ]);
    setCurrentTopic(session.topic);
    setShowHistory(false);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: '1',
        text: `Hi! I'm your AI ${context}. How can I help you today?`,
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
    setCurrentTopic('');
    setShowHistory(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const chatHeight = isExpanded ? 'h-[80vh]' : 'h-64';

  return (
    <Card className={`flex flex-col ${chatHeight} ${className}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold flex items-center">
          <span className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center mr-2 shadow-glow">
            <Bot className="w-4 h-4 text-white" />
          </span>
          AI {context.charAt(0).toUpperCase() + context.slice(1)}
        </h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-muted-foreground"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveSession}
            className="text-muted-foreground"
          >
            <Save className="w-4 h-4" />
          </Button>
          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 p-4">
          <ChatHistoryPanel
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
          />
        </div>
      ) : (
        <>
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 ${
                      message.sender === 'user'
                        ? 'bg-brand-gradient text-white shadow-glow'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.sender === 'ai' && (
                        <Bot className="w-4 h-4 mt-0.5 text-primary" />
                      )}
                      {message.sender === 'user' && (
                        <User className="w-4 h-4 mt-0.5 text-white" />
                      )}
                      <div className="flex-1">
                        {message.sender === 'ai' && message.grounded && (
                          <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Grounded in Course Material</span>
                          </div>
                        )}
                        {message.sender === 'ai' && message.insufficientEvidence && (
                          <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Insufficient Uploaded Material</span>
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

                        <div className="flex items-center justify-between mt-2 space-x-4">
                          <p className={`text-xs ${
                            message.sender === 'user' ? 'text-white/70' : 'text-muted-foreground'
                          }`}>
                            {message.timestamp.toLocaleTimeString()}
                          </p>
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
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-2xl p-3 max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <Bot className="w-4 h-4 text-primary" />
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!input.trim() || isLoading}
                size="sm"
                variant="premium"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
