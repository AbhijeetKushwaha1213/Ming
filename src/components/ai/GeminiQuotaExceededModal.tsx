import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  Key,
  ExternalLink,
  Sparkles,
  Clock,
  CheckCircle2,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const GEMINI_QUOTA_EVENT = 'gemini-quota-exceeded';

export interface GeminiQuotaEventDetail {
  status?: number;
  message?: string;
  details?: string;
}

export function triggerGeminiQuotaModal(detail?: GeminiQuotaEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GEMINI_QUOTA_EVENT, {
        detail: detail || {
          status: 429,
          message: 'Gemini API limit reached for today',
        },
      })
    );
  }
}

export const GeminiQuotaExceededModal: React.FC = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState('');
  const [hasSavedCustomKey, setHasSavedCustomKey] = useState(false);

  useEffect(() => {
    // Check if user already has a custom key configured
    const stored = localStorage.getItem('ming_gemini_api_key');
    if (stored) {
      setCustomKey(stored);
      setHasSavedCustomKey(true);
    }

    const handleQuotaEvent = (e: Event) => {
      const customEvent = e as CustomEvent<GeminiQuotaEventDetail>;
      if (customEvent.detail?.details) {
        setErrorDetails(customEvent.detail.details);
      }
      setIsOpen(true);
    };

    window.addEventListener(GEMINI_QUOTA_EVENT, handleQuotaEvent);
    return () => {
      window.removeEventListener(GEMINI_QUOTA_EVENT, handleQuotaEvent);
    };
  }, []);

  const handleSaveKey = () => {
    const trimmed = customKey.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) {
      localStorage.removeItem('ming_gemini_api_key');
      setHasSavedCustomKey(false);
      toast({
        title: 'Custom Key Removed',
        description: 'Ming will use default system API keys.',
      });
      return;
    }

    if (!trimmed.startsWith('AIza')) {
      toast({
        title: 'Check Key Format',
        description: 'Google Gemini API keys usually start with "AIza...". Please verify your key.',
        variant: 'destructive',
      });
    }

    localStorage.setItem('ming_gemini_api_key', trimmed);
    setHasSavedCustomKey(true);
    toast({
      title: 'API Key Saved Successfully!',
      description: 'Ming will now use your custom Gemini API key for future AI requests.',
    });
    setIsOpen(false);
  };

  const handleClearKey = () => {
    localStorage.removeItem('ming_gemini_api_key');
    setCustomKey('');
    setHasSavedCustomKey(false);
    toast({
      title: 'API Key Cleared',
      description: 'Reverted to default configuration.',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md md:max-w-lg bg-card border-border shadow-2xl p-6">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-500 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Gemini API Limit Reached
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  HTTP 429 · Quota Exceeded
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Google's free-tier daily usage limit or per-minute rate limit has been reached.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 text-sm">
          {/* Quick Explanation */}
          <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 space-y-2 text-xs leading-relaxed">
            <p className="text-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              What happened?
            </p>
            <p className="text-muted-foreground">
              Google Gemini enforces daily quota limits (free tier requests per day) and per-minute throughput limits. Your study data, saved roadmaps, and local notes remain 100% safe!
            </p>
          </div>

          {/* Practical Solution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-background border border-border flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Automatic Reset</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Quotas automatically refresh daily at midnight Pacific Time.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Wait 1-2 Minutes</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  If this is a short burst limit, waiting a moment will restore access.
                </p>
              </div>
            </div>
          </div>

          {/* Custom Key Section */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="gemini-key" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-primary" />
                Use Your Own Free Gemini API Key
              </Label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                Get Free Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <Input
                id="gemini-key"
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="AIzaSy..."
                className="h-9 text-xs bg-background font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground">
                Your key is stored securely in your browser's local storage and used directly.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSaveKey}
                className="h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
              >
                {hasSavedCustomKey ? 'Update API Key' : 'Save & Use Key'}
              </Button>
              {hasSavedCustomKey && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearKey}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Key
                </Button>
              )}
            </div>
          </div>

          {/* Local features assurance */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-1">
            <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              All offline flashcards, notes, YouTube video player, and practice quizzes continue to work uninterrupted.
            </span>
          </div>
        </div>

        <DialogFooter className="sm:justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="w-full sm:w-auto"
          >
            Got it, Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
