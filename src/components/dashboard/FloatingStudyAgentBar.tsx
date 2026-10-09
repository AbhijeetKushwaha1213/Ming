import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Sparkles, 
  Send, 
  RefreshCw, 
  ArrowRight, 
  X, 
  Calendar, 
  ChevronUp, 
  ChevronDown,
  MessageSquare
} from 'lucide-react';
import { askStudyAgent } from '@/api/studyAgentAPI';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { navigateToTab } from '@/utils/navigation';
import { 
  getWorkspaceCatalog, 
  getAgentWorkspacePrompt, 
  parseAgentActions, 
  executeAgentActions 
} from '@/services/agentActionEngine';
import { geminiClient } from '@/utils/geminiClient';
import { useQueryClient, QueryClient } from '@tanstack/react-query';

function useSafeQueryClient(): QueryClient | undefined {
  try {
    return useQueryClient();
  } catch {
    return undefined;
  }
}

interface FloatingStudyAgentBarProps {
  onNavigateToQuiz?: (topic?: string) => void;
  examDate?: string | null;
}

export const FloatingStudyAgentBar: React.FC<FloatingStudyAgentBarProps> = ({
  onNavigateToQuiz,
  examDate,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useSafeQueryClient();
  const userId = user?.user_id || user?.id || 'default_user';

  const [chatQuery, setChatQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [agentAnswer, setAgentAnswer] = useState<{
    reply: string;
    recommendedTopic?: string;
    suggestedAction?: string;
    actionType?: 'quiz' | 'resources';
    actionsExecuted?: string[];
  } | null>(null);

  const quickQuestions = [
    "What should I study today?",
    "What am I weak at?",
    "Organize my study resources",
    "What should I do next?",
  ];

  const handleAskAgent = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsChatLoading(true);

    const safetyTimer = setTimeout(() => {
      setIsChatLoading(false);
      setAgentAnswer(prev => prev || {
        reply: "I am ready to help organize your study plan, diagnose mastery gaps, or navigate course materials. Try asking 'What should I study today?'",
        suggestedAction: "View Today's Plan",
      });
    }, 8000);

    try {
      const trimmed = queryText.trim();
      const isActionQuery = /(delete|remove|edit|modify|update|rename|create|folder|organize|move|copy\s+vault|vault\s+to\s+resource|add\s+notes\s+to|append|clean\s+up)/i.test(trimmed);

      if (isActionQuery) {
        const catalog = await Promise.race([
          getWorkspaceCatalog(),
          new Promise<any>((r) => setTimeout(() => r({ pages: [], pagesCatalog: [], vaultCatalog: [] }), 1200))
        ]);
        const workspacePrompt = getAgentWorkspacePrompt(catalog, "Dashboard Study Assistant");
        const directRes = await geminiClient.generateContent({
          message: trimmed,
          systemPrompt: workspacePrompt,
        });

        if (directRes && directRes.response) {
          const { cleanText, actions } = parseAgentActions(directRes.response);
          const executed = await executeAgentActions(actions, queryClient);

          setAgentAnswer({
            reply: cleanText || "I've processed your workspace update.",
            actionsExecuted: executed.length > 0 ? executed : undefined,
            suggestedAction: executed.length > 0 ? "Review Updated Resources in Workspace" : undefined,
            actionType: 'resources',
          });

          if (executed.length > 0) {
            toast({
              title: "Workspace Actions Executed ⚡",
              description: executed.join(', '),
            });
          }
          return;
        }
      }

      // If the student is asking a direct academic concept question (e.g. "what is formula of water", "explain binary search", "how does photosynthesis work")
      const isConceptualQuery = /^(what|how|why|explain|define|tell\s+me|formula|can\s+you|who|where|when)\b/i.test(trimmed) &&
        !/(study|today|weak|exam|plan|priority|diagnos|assessment|mastery)/i.test(trimmed);

      if (isConceptualQuery) {
        const directRes = await geminiClient.generateContent({
          message: trimmed,
          systemPrompt: "You are Ming AI, an expert academic study assistant. Provide clear, direct, and concise explanations with formulas, key facts, and examples where relevant.",
        });

        if (directRes && directRes.response && !directRes.error) {
          const { cleanText } = parseAgentActions(directRes.response);
          setAgentAnswer({
            reply: cleanText || directRes.response,
            suggestedAction: "Ask More in AI Chat",
            actionType: 'quiz',
          });
          return;
        }
      }

      const res = await askStudyAgent({
        userId,
        query: trimmed,
        examDate,
      });

      if (res && res.reply) {
        const { cleanText, actions } = parseAgentActions(res.reply);
        let executed: string[] = [];
        if (actions && actions.length > 0) {
          executed = await executeAgentActions(actions, queryClient);
        }

        setAgentAnswer({
          reply: cleanText || res.reply,
          recommendedTopic: res.recommendedTopic,
          suggestedAction: res.suggestedAction,
          actionType: 'quiz',
          actionsExecuted: executed.length > 0 ? executed : undefined,
        });
      } else {
        setAgentAnswer({
          reply: "I analyzed your learner profile. Let's focus on your diagnostic baseline and high-priority study topics for today!",
          suggestedAction: "Take Diagnostic Assessment",
          actionType: 'quiz',
        });
      }
    } catch (err) {
      console.error('Failed to ask agent:', err);
      try {
        const directRes = await geminiClient.generateContent({
          message: queryText.trim(),
          systemPrompt: "You are an expert study assistant. Provide a clear, concise answer.",
        });
        if (directRes?.response) {
          const { cleanText } = parseAgentActions(directRes.response);
          setAgentAnswer({
            reply: cleanText || directRes.response,
            suggestedAction: "Continue Study",
            actionType: 'quiz',
          });
        } else {
          setAgentAnswer({
            reply: "I am ready to help organize your study plan, diagnose mastery gaps, or navigate course materials. Try asking 'What should I study today?'",
            suggestedAction: "View Today's Plan",
          });
        }
      } catch {
        setAgentAnswer({
          reply: "I am ready to help organize your study plan, diagnose mastery gaps, or navigate course materials. Try asking 'What should I study today?'",
          suggestedAction: "View Today's Plan",
        });
      }
    } finally {
      clearTimeout(safetyTimer);
      setIsChatLoading(false);
    }
  };

  const openDailyPlanSidebar = () => {
    window.dispatchEvent(new CustomEvent('open-daily-plan'));
  };

  if (isCollapsed) {
    return (
      <div className="fixed bottom-5 right-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <Button
          onClick={() => setIsCollapsed(false)}
          className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full px-4 py-2.5 h-auto flex items-center gap-2 border border-primary/20"
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm">Ask AI Study Agent</span>
          <Sparkles className="w-4 h-4 text-emerald-200" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl px-2">
      {/* Answer Bubble Card (Expands upward above the bar) */}
      {(isChatLoading || agentAnswer) && (
        <div className="mb-2 p-4 rounded-2xl bg-card/95 dark:bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold text-foreground">AI Study Agent</span>
              <span className="text-[10px] text-muted-foreground">(Grounded in BKT learner state)</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAgentAnswer(null)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {isChatLoading ? (
            <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>Analyzing your Bayesian mastery and study records...</span>
              <button
                type="button"
                onClick={() => setIsChatLoading(false)}
                className="ml-2 text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : agentAnswer ? (
            <div className="space-y-3">
              <div className="text-xs leading-relaxed text-foreground whitespace-pre-line max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {agentAnswer.reply}
              </div>

              {/* Workspace Actions Executed */}
              {agentAnswer.actionsExecuted && agentAnswer.actionsExecuted.length > 0 && (
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Workspace Actions Executed ({agentAnswer.actionsExecuted.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-primary hover:underline cursor-pointer"
                      onClick={() => navigateToTab('resources')}
                    >
                      Open Resources ↗
                    </Button>
                  </div>
                  {agentAnswer.actionsExecuted.map((summary, idx) => (
                    <div key={idx} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{summary}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommended Next Action Button */}
              {agentAnswer.suggestedAction && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs font-medium text-primary truncate max-w-[60%]">
                    {agentAnswer.suggestedAction}
                  </span>
                  <Button
                    size="sm"
                    variant="premium"
                    className="text-xs h-7 gap-1"
                    onClick={() => {
                      if (agentAnswer.actionType === 'resources') {
                        navigateToTab('resources');
                      } else if (onNavigateToQuiz) {
                        onNavigateToQuiz(agentAnswer.recommendedTopic);
                      } else {
                        navigateToTab('flashcards', 'assessment', { topic: agentAnswer.recommendedTopic });
                      }
                    }}
                  >
                    Start Action
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Floating Dock Bar */}
      <div className="p-2.5 rounded-2xl bg-card/90 dark:bg-card/90 backdrop-blur-xl border border-primary/20 shadow-2xl transition-all duration-200">
        {/* Quick prompt pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-1.5 scrollbar-none custom-scrollbar">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setChatQuery(q);
                handleAskAgent(q);
              }}
              disabled={isChatLoading}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full border border-border/80 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-foreground transition-all flex-shrink-0 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
          <button
            onClick={openDailyPlanSidebar}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all flex items-center gap-1 flex-shrink-0 font-medium"
          >
            <Calendar className="w-3 h-3" />
            Daily Plan on Side ↗
          </button>
        </div>

        {/* Input Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAgent(chatQuery);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <Bot className="w-4 h-4 text-primary absolute left-3 pointer-events-none" />
            <Input
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Ask AI Study Agent anything about your learning, syllabus, or daily plan..."
              className="pl-9 pr-3 h-9 text-xs rounded-xl bg-background/80 border-border/80 focus-visible:ring-primary/30"
              disabled={isChatLoading}
            />
          </div>

          <Button 
            type="submit" 
            disabled={isChatLoading || !chatQuery.trim()} 
            size="sm"
            className="h-9 px-3.5 rounded-xl bg-brand-gradient hover:opacity-95 text-white shadow-xs"
          >
            {isChatLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs">Ask</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            title="Minimize"
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-xl"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};
