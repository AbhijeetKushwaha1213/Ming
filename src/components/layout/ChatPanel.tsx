import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  X, 
  Send, 
  Bot, 
  User as UserIcon, 
  Copy, 
  Check, 
  Paperclip, 
  Image as ImageIcon, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  Folder, 
  FileText,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { geminiClient } from '@/utils/geminiClient';
import { navigateToTab } from '@/utils/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { 
  getWorkspaceCatalog, 
  getAgentWorkspacePrompt, 
  parseAgentActions, 
  executeAgentActions 
} from '@/services/agentActionEngine';

import { DAGTutorContext } from '@/types/dag';

interface AttachedItem {
  name: string;
  type: 'image' | 'file';
  dataUrl?: string;
  textContent?: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  attachment?: {
    name: string;
    type: 'image' | 'file';
    dataUrl?: string;
  };
  actionsExecuted?: string[];
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeDAGContext, setActiveDAGContext] = useState<DAGTutorContext | null>(null);

  useEffect(() => {
    const handleOpenWithDAG = (e: any) => {
      if (e.detail?.dagContext) {
        setActiveDAGContext(e.detail.dagContext);
      }
    };
    const handleContextUpdate = (e: any) => {
      if (e.detail?.dagContext) {
        setActiveDAGContext(e.detail.dagContext);
      }
    };
    window.addEventListener('open-chat-panel', handleOpenWithDAG);
    window.addEventListener('update-dag-tutor-context', handleContextUpdate);
    return () => {
      window.removeEventListener('open-chat-panel', handleOpenWithDAG);
      window.removeEventListener('update-dag-tutor-context', handleContextUpdate);
    };
  }, []);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('studymate-chat-messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch (e) {
        console.warn('Failed to parse saved chat messages:', e);
      }
    }
    return [
      {
        id: '1',
        text: "Hello! I'm your AI study assistant. I can answer questions, organize your Resources into smart folders, move files, and copy materials from your Vault into Resources. How can I help you today?",
        sender: 'ai',
        timestamp: new Date(),
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedItem, setAttachedItem] = useState<AttachedItem | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('studymate-chat-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    if (isImg) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedItem({
          name: file.name,
          type: 'image',
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedItem({
          name: file.name,
          type: 'file',
          textContent: typeof reader.result === 'string' ? reader.result : '',
        });
      };
      reader.readAsText(file);
    }
    // reset input
    e.target.value = '';
  };

  const sendMessage = async (overrideText?: string) => {
    const rawText = (overrideText ?? inputMessage).trim();
    if ((!rawText && !attachedItem) || isTyping) return;

    let userMsgText = rawText || (attachedItem ? `[Attached: ${attachedItem.name}]` : '');
    const currentAttachment = attachedItem;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMsgText,
      sender: 'user',
      timestamp: new Date(),
      attachment: currentAttachment ? {
        name: currentAttachment.name,
        type: currentAttachment.type,
        dataUrl: currentAttachment.dataUrl,
      } : undefined,
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setAttachedItem(null);
    setIsTyping(true);

    try {
      // Gather real-time workspace context & prompt using unified Agent Action Engine
      const catalog = await getWorkspaceCatalog();
      const agentSystemPrompt = getAgentWorkspacePrompt(catalog);

      // If document text was attached, prepend to prompt
      let finalPrompt = userMsgText;
      if (currentAttachment?.textContent) {
        finalPrompt = `[Attached Document Content: ${currentAttachment.name}]\n${currentAttachment.textContent.slice(0, 3000)}\n\nUser Question/Request:\n${userMsgText}`;
      }

      if (activeDAGContext) {
        const dagBlock = `[CANONICAL DAG LEARNING CONTEXT]
Course / Topic: ${activeDAGContext.topic}
Subtopic: ${activeDAGContext.subtopic || 'General'}
DAG Title: ${activeDAGContext.dagTitle}
Learning Goal: ${activeDAGContext.learningGoal}
Selected Concept: ${activeDAGContext.selectedConcept.name}
Description: ${activeDAGContext.selectedConcept.description}
Difficulty: ${activeDAGContext.selectedConcept.difficulty}
Current Mastery: ${activeDAGContext.selectedConcept.masteryPercentage}% (Status: ${activeDAGContext.selectedConcept.status})
Required Prerequisites: ${activeDAGContext.selectedConcept.prerequisiteNames.join(', ') || 'None'}
Downstream Dependents: ${activeDAGContext.selectedConcept.downstreamConcepts.join(', ') || 'None'}
Source Document: ${activeDAGContext.selectedConcept.sourceDocument || 'Course Resource'} ${activeDAGContext.selectedConcept.sourceCoordinate ? `(${activeDAGContext.selectedConcept.sourceCoordinate})` : ''}
Key Formula / Rule: ${activeDAGContext.selectedConcept.formula || 'None'}
Identified Misconception: ${activeDAGContext.selectedConcept.misconception || 'None'}
Weak Topics across Graph: ${activeDAGContext.weakTopics.join(', ') || 'None'}

Please tailor your response specifically to this concept and its prerequisite hierarchy in ${activeDAGContext.topic}.\n\n`;

        finalPrompt = `${dagBlock}${finalPrompt}`;
      }

      let responseText = '';
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            message: finalPrompt,
            context: 'sidebar assistant',
            systemPrompt: agentSystemPrompt,
            conversationHistory: updatedMessages.slice(-8).map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          }
        });

        if (error) throw error;
        responseText = data.response;
      } catch (invokeError) {
        console.warn('Supabase edge function invoke failed, falling back to direct Gemini API call:', invokeError);
        
        let inlineData: { mimeType: string; data: string } | undefined;
        if (currentAttachment?.type === 'image' && currentAttachment.dataUrl) {
          const matchB64 = currentAttachment.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matchB64) {
            inlineData = {
              mimeType: matchB64[1],
              data: matchB64[2],
            };
          }
        }

        const directRes = await geminiClient.generateContent({
          message: finalPrompt,
          systemPrompt: agentSystemPrompt,
          inlineData,
          context: updatedMessages.slice(-8).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        });

        if (directRes.error) {
          throw new Error(`${directRes.error}: ${directRes.details || ''}`);
        }
        responseText = directRes.response;
      }

      // Process and execute any agent actions in the response (edit, delete, create, move, organize, copy)
      const { cleanText, actions } = parseAgentActions(responseText);
      const executedSummaries = await executeAgentActions(actions, queryClient);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: cleanText || "I've processed your request.",
        sender: 'ai',
        timestamp: new Date(),
        actionsExecuted: executedSummaries.length > 0 ? executedSummaries : undefined,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling AI assistant:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an issue processing your request. Please try again.",
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Assistant Error",
        description: "Unable to process request right now.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-background border-l border-border shadow-xl transition-all duration-300 ease-in-out z-30 ${
        isOpen ? 'w-full sm:w-[440px] translate-x-0' : 'w-0 translate-x-full'
      }`}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border flex-shrink-0 bg-primary/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-semibold text-foreground">Ming Copilot</h2>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded-full">Agent</span>
              </div>
              <p className="text-xs text-muted-foreground">Resources & Vault Orchestrator</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessages([{
                    id: '1',
                    text: "Hello! I'm your AI study assistant. I can answer questions, organize your Resources into smart folders, move files, and copy materials from your Vault into Resources. How can I help you today?",
                    sender: 'ai',
                    timestamp: new Date(),
                  }]);
                }}
                className="h-8 px-2 text-xs"
                title="Clear chat"
              >
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Active DAG Tutor Context Banner */}
        {activeDAGContext && (
          <div className="p-3 bg-secondary/80 border-b border-border text-xs flex-shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-[220px]">
                  {activeDAGContext.selectedConcept.name}
                </span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary shrink-0 font-medium">
                  {activeDAGContext.selectedConcept.difficulty}
                </Badge>
              </div>
              <button
                onClick={() => setActiveDAGContext(null)}
                className="text-muted-foreground hover:text-foreground text-[10px] flex items-center gap-0.5 ml-2 shrink-0"
                title="Exit DAG Tutor Context"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground mb-2">
              <span className="font-medium text-primary">
                {activeDAGContext.topic}
              </span>
              <span>•</span>
              <span>Mastery: {activeDAGContext.selectedConcept.masteryPercentage}%</span>
              {activeDAGContext.selectedConcept.sourceCoordinate && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[150px] text-muted-foreground font-mono text-[10px]">
                    {activeDAGContext.selectedConcept.sourceCoordinate}
                  </span>
                </>
              )}
            </div>

            {/* Contextual Quick Actions */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => sendMessage(`Explain the concept "${activeDAGContext.selectedConcept.name}" clearly with intuitive reasoning, key principles, and why it is critical for ${activeDAGContext.topic}.`)}
                disabled={isTyping}
                className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                💡 Explain concept
              </button>
              <button
                onClick={() => sendMessage(`Why do I need the prerequisite (${activeDAGContext.selectedConcept.prerequisiteNames.join(', ') || 'foundations'}) before learning "${activeDAGContext.selectedConcept.name}"? Explain the conceptual dependency.`)}
                disabled={isTyping}
                className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                🔗 Explain prerequisite
              </button>
              <button
                onClick={() => sendMessage(`Give me a concrete, real-world example of "${activeDAGContext.selectedConcept.name}" in action with step-by-step walkthrough.`)}
                disabled={isTyping}
                className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                📝 Give an example
              </button>
              <button
                onClick={() => sendMessage(`Quiz me on "${activeDAGContext.selectedConcept.name}" with 2 short conceptual multiple-choice or short-answer questions to test my understanding. Wait for my answer!`)}
                disabled={isTyping}
                className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                ⚡ Quiz me
              </button>
              <button
                onClick={() => sendMessage(`Based on the ${activeDAGContext.topic} prerequisite DAG, what should I study next after mastering "${activeDAGContext.selectedConcept.name}"?`)}
                disabled={isTyping}
                className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                🧭 What to study next?
              </button>
              <button
                onClick={() => sendMessage(`Why might a student struggle or be weak in "${activeDAGContext.selectedConcept.name}"? What are the common misconceptions and how can I resolve them?`)}
                disabled={isTyping}
                className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                ⚠️ Why am I weak here?
              </button>
              <button
                onClick={() => {
                  navigateToTab('flashcards', 'generate', {
                    topic: activeDAGContext.selectedConcept.name,
                    parentTopic: activeDAGContext.topic,
                    sourceTitle: activeDAGContext.selectedConcept.sourceDocument,
                  });
                  toast({
                    title: 'Generating Study Material',
                    description: `Configured AI Materials for "${activeDAGContext.selectedConcept.name}".`,
                  });
                }}
                className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap text-[11px] font-medium shadow-xs"
              >
                📚 Generate study material
              </button>
            </div>
          </div>
        )}

        {/* Quick Agent Actions Chips (Default Workspace Copilot) */}
        {!activeDAGContext && (
          <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none flex-shrink-0">
            <button
              onClick={() => sendMessage("Please inspect all my resources and organize them into smart folders based on content similarity and topics.")}
              disabled={isTyping}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap text-xs font-medium"
            >
              <Folder className="w-3 h-3" />
              Organize Resources
            </button>
            <button
              onClick={() => sendMessage("List my resources and help me edit, improve, or expand the notes in my current pages.")}
              disabled={isTyping}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors whitespace-nowrap text-xs font-medium"
            >
              <Sparkles className="w-3 h-3" />
              Edit / Expand Content
            </button>
            <button
              onClick={() => sendMessage("Check my workspace for empty, untitled, or duplicate pages and clean them up.")}
              disabled={isTyping}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors whitespace-nowrap text-xs font-medium"
            >
              <X className="w-3 h-3" />
              Delete / Clean Up
            </button>
            <button
              onClick={() => sendMessage("List my generated vault materials and copy key study summaries to my Resources workspace.")}
              disabled={isTyping}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors whitespace-nowrap text-xs font-medium"
            >
              <FileText className="w-3 h-3" />
              Vault to Resources
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4" ref={scrollRef}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex space-x-2 max-w-[90%] ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                  <AvatarFallback className={message.sender === 'ai' ? 'bg-primary text-primary-foreground' : 'bg-accent'}>
                    {message.sender === 'ai' ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <div
                    className={`rounded-xl px-4 py-2.5 ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/80 text-foreground border border-border/50'
                    }`}
                  >
                    {/* Attachment preview if user uploaded */}
                    {message.attachment && (
                      <div className="mb-2 p-2 rounded-lg bg-background/20 border border-current/20 flex items-center gap-2">
                        {message.attachment.type === 'image' && message.attachment.dataUrl ? (
                          <img
                            src={message.attachment.dataUrl}
                            alt={message.attachment.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-5 h-5 shrink-0" />
                        )}
                        <span className="text-xs truncate font-medium">{message.attachment.name}</span>
                      </div>
                    )}

                    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{message.text}</p>

                    {/* Agent Executed Actions Badge */}
                    {message.actionsExecuted && message.actionsExecuted.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                            Workspace Agent Actions Executed
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                            onClick={() => navigateToTab('resources')}
                          >
                            Open Resources <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                        <ul className="space-y-1 pl-1">
                          {message.actionsExecuted.map((summary, idx) => (
                            <li key={idx} className="flex items-center gap-1.5 text-foreground/80">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>{summary}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 mt-1 px-1 ${
                    message.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <span className="text-[10px] text-muted-foreground">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleCopy(message.text, message.id)}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex space-x-2 max-w-[85%]">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-xl px-4 py-3 flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Agent analyzing workspace & executing actions...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-border flex-shrink-0 bg-background">
          {/* File Attachment preview */}
          {attachedItem && (
            <div className="flex items-center gap-2 p-1.5 px-3 mb-2 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary">
              {attachedItem.type === 'image' ? (
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate max-w-[240px] font-medium">{attachedItem.name}</span>
              <button
                onClick={() => setAttachedItem(null)}
                className="ml-auto text-muted-foreground hover:text-foreground p-0.5"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,.pdf,.txt,.md,.json,.csv,.py,.ts,.js"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 h-9 text-muted-foreground hover:text-foreground"
              title="Attach image or file for AI analysis"
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            <Input
              placeholder="Ask anything, or ask to organize files..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 h-9 text-sm"
              disabled={isTyping}
            />

            <Button
              onClick={() => sendMessage()}
              size="sm"
              className="h-9 px-3"
              disabled={(!inputMessage.trim() && !attachedItem) || isTyping}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            Press Enter to send • Agent can create folders, move files & import from Vault
          </p>
        </div>
      </div>
    </div>
  );
};
