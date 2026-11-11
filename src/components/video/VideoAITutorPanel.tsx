import React, { useState, useRef, useEffect } from 'react';
import type { VideoRecord, VideoCitation } from '@/types/video';
import { askVideoQuestion, isVideoAuthError } from '@/api/videoAPI';
import { formatTimestamp, CAPTION_CUE_END_TOLERANCE_SECONDS } from '@/utils/videoUtils';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: VideoCitation[];
  grounded?: boolean;
  insufficientEvidence?: boolean;
  partialAnswer?: boolean;
  timestamp: string;
}

export interface VideoAITutorPanelProps {
  video: VideoRecord;
  onSeek: (seconds: number) => void;
  integrityError?: string | null;
  runtimeDurationSeconds?: number | null;
  className?: string;
}

// Formatted markdown and timestamp citation renderer for video tutor messages
const VideoTutorFormattedContent: React.FC<{
  content: string;
  citations?: VideoCitation[];
  isGrounded?: boolean;
  maxDurationSeconds?: number;
  onSeek: (seconds: number) => void;
}> = ({ content, citations = [], isGrounded = true, maxDurationSeconds = 0, onSeek }) => {
  // 1. Clean raw chunk identifiers
  const cleaned = content
    .replace(/\[CHUNK\s+[^\]]+\]/g, '')
    .replace(/\[[a-zA-Z0-9_\-]+_t\d+_c\d+\]/g, '')
    .replace(/\[vid_[a-zA-Z0-9_\-]+\]/g, '')
    .trim();

  const isSeekableTimestamp = (secs: number): boolean => {
    if (!isGrounded) return false;
    if (!isFinite(secs) || secs < 0) return false;
    if (maxDurationSeconds > 0 && secs > maxDurationSeconds + CAPTION_CUE_END_TOLERANCE_SECONDS) {
      return false;
    }
    if (citations.length > 0) {
      return citations.some((c) => {
        const cSec = c.seek_seconds ?? c.timestamp_start;
        return typeof cSec === 'number' && Math.abs(cSec - secs) <= 5;
      });
    }
    return true;
  };

  // Split into paragraphs / blocks
  const blocks = cleaned.split(/\n{2,}/).filter(Boolean);

  const renderInlineFormatted = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const tokenRegex = /(\[(?:EVIDENCE_(\d+))\]|\[?(\d{1,2}):(\d{2})\]?|\(Timestamp\s*(\d+)m(\d+)s\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[2]) {
        // [EVIDENCE_n] token mapped to verified citation timestamp
        const evId = `EVIDENCE_${match[2]}`;
        const matchedCit = citations.find((c) => c.evidence_id === evId) || citations[parseInt(match[2], 10) - 1];
        const targetSec = matchedCit
          ? (matchedCit.seek_seconds ??
            (matchedCit.timestamp_start !== null && matchedCit.timestamp_start !== undefined && matchedCit.timestamp_start >= 0
              ? Number(matchedCit.timestamp_start)
              : null))
          : null;
        if (targetSec !== null) {
          const tsLabel = matchedCit?.formatted_timestamp || formatTimestamp(targetSec);
          parts.push(
            <button
              key={`ev_${match.index}`}
              type="button"
              onClick={() => onSeek(targetSec)}
              title={`Seek video to ${tsLabel}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-1 rounded bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground font-mono text-[11px] font-semibold transition-colors cursor-pointer border border-primary/20 align-baseline"
            >
              <Clock className="w-2.5 h-2.5" />
              {tsLabel}
            </button>
          );
        }
      } else if (match[3] && match[4]) {
        // [mm:ss] format
        const m = parseInt(match[3], 10);
        const s = parseInt(match[4], 10);
        const secs = m * 60 + s;
        if (isSeekableTimestamp(secs)) {
          parts.push(
            <button
              key={`ts_${match.index}`}
              type="button"
              onClick={() => onSeek(secs)}
              title={`Seek video to ${match[3]}:${match[4]}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-1 rounded bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground font-mono text-[11px] font-semibold transition-colors cursor-pointer border border-primary/20 align-baseline"
            >
              <Clock className="w-2.5 h-2.5" />
              {match[3]}:{match[4]}
            </button>
          );
        } else {
          parts.push(match[0]);
        }
      } else if (match[5] && match[6]) {
        // (Timestamp XmYs)
        const m = parseInt(match[5], 10);
        const s = parseInt(match[6], 10);
        const secs = m * 60 + s;
        const timeLabel = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (isSeekableTimestamp(secs)) {
          parts.push(
            <button
              key={`ts_${match.index}`}
              type="button"
              onClick={() => onSeek(secs)}
              title={`Seek video to ${timeLabel}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-1 rounded bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground font-mono text-[11px] font-semibold transition-colors cursor-pointer border border-primary/20 align-baseline"
            >
              <Clock className="w-2.5 h-2.5" />
              {timeLabel}
            </button>
          );
        } else {
          parts.push(match[0]);
        }
      } else if (match[7]) {
        // **bold**
        parts.push(
          <strong key={`b_${match.index}`} className="font-semibold text-foreground">
            {match[7]}
          </strong>
        );
      } else if (match[8]) {
        // `code`
        parts.push(
          <code key={`c_${match.index}`} className="px-1 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-primary">
            {match[8]}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();

        // 1. Heading 3 (e.g. ### 📚 Course Material Evidence)
        if (trimmed.startsWith('### ')) {
          const headingText = trimmed.replace(/^###\s+/, '').replace(/^[\p{Emoji}\s]+/u, '').trim();
          return (
            <div
              key={bIdx}
              className="flex items-center gap-1.5 font-bold text-xs text-primary pb-1.5 border-b border-border/40 mt-1 mb-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>{headingText}</span>
            </div>
          );
        }

        // 2. Heading 2 or Heading 1
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          const headingText = trimmed.replace(/^#+\s+/, '').replace(/^[\p{Emoji}\s]+/u, '').trim();
          return (
            <h4 key={bIdx} className="font-bold text-xs text-foreground mt-2 mb-1">
              {headingText}
            </h4>
          );
        }

        // 3. Bullet list (contains lines starting with * or -)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.includes('\n* ') || trimmed.includes('\n- ')) {
          const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
          return (
            <div key={bIdx} className="space-y-1.5 my-1.5">
              {lines.map((line, lIdx) => {
                const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
                const cleanLine = line.trim().replace(/^[-*]\s+/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2 group/bullet">
                    {isBullet && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/70 mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 text-foreground/90 group-hover/bullet:text-foreground transition-colors leading-relaxed">
                      {renderInlineFormatted(cleanLine)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        // 4. Regular paragraph
        return (
          <p key={bIdx} className="text-foreground/90 leading-relaxed">
            {renderInlineFormatted(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export const VideoAITutorPanel: React.FC<VideoAITutorPanelProps> = ({
  video,
  onSeek,
  integrityError = null,
  runtimeDurationSeconds = null,
  className = '',
}) => {
  const isGroundedMode = video.transcriptStatus === 'ready' && !integrityError;
  const effectiveDuration =
    runtimeDurationSeconds && runtimeDurationSeconds > 0
      ? runtimeDurationSeconds
      : Number(video.durationSeconds || 0);

  const buildWelcomeContent = (ready: boolean, processing: boolean) => {
    if (integrityError) {
      return `Hello! I am your AI Video Tutor for **"${video.title}"**. Source verification detected a metadata or transcript mismatch (${integrityError}), so Grounded citations have been withheld.`;
    }
    if (ready) {
      return `Hello! I am your AI Video Tutor for **"${video.title}"**. Ask me anything about this lecture, and I will explain concepts using only verified video transcript evidence with clickable timestamps!`;
    }
    if (processing) {
      return `Extracting verified captions and metadata for **"${video.title}"**... Once ready, I will answer using only verified lecture transcript evidence.`;
    }
    return `Hello! I am your AI Video Tutor for **"${video.title}"**. Note: A verified transcript is not available for this lecture. I can provide general conceptual assistance, but claims cannot be grounded in video citations.`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: `welcome_${video.id}`,
      role: 'assistant',
      content: buildWelcomeContent(isGroundedMode, video.transcriptStatus === 'processing'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      grounded: isGroundedMode,
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  // Active request controller and tracking ref to prevent switching race conditions
  const activeAbortRef = useRef<AbortController | null>(null);
  const activeVideoIdRef = useRef<string>(video.id);

  // Clear stale chat, pending queries, and citations when active video switches;
  // if only metadata/transcriptStatus updates during polling before any user turn, refresh welcome text without wiping chat
  useEffect(() => {
    const isVideoSwitch = activeVideoIdRef.current !== video.id;
    const isReady = video.transcriptStatus === 'ready' && !integrityError;
    const isProcessing = video.transcriptStatus === 'processing' && !integrityError;
    const welcomeText = buildWelcomeContent(isReady, isProcessing);

    if (isVideoSwitch) {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
      activeVideoIdRef.current = video.id;
      setMessages([
        {
          id: `welcome_${video.id}`,
          role: 'assistant',
          content: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          grounded: isReady,
        },
      ]);
      setInputQuery('');
      setIsLoading(false);
    } else {
      setMessages((prev) => {
        const hasUserTurn = prev.some((m) => m.role === 'user');
        if (hasUserTurn) return prev;
        return [
          {
            id: `welcome_${video.id}`,
            role: 'assistant',
            content: welcomeText,
            timestamp: prev[0]?.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            grounded: isReady,
          },
        ];
      });
    }
  }, [video.id, video.transcriptStatus, video.title, integrityError]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
    };
  }, []);

  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const question = (queryText || inputQuery).trim();
    if (!question || isLoading) return;

    // Abort prior in-flight request if still running
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
      activeAbortRef.current = null;
    }

    const currentAbort = new AbortController();
    activeAbortRef.current = currentAbort;
    const requestVideoId = video.id;

    setInputQuery('');

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build conversation history from previous turns
      const history = messages
        .filter((m) => !m.id.startsWith('welcome_'))
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await askVideoQuestion(requestVideoId, question, history, 'english', currentAbort.signal);

      // Race check: if active video changed while waiting or request was aborted, discard response!
      if (activeVideoIdRef.current !== requestVideoId || currentAbort.signal.aborted) {
        return;
      }

      const rawCitations = Array.isArray(res.citations) ? res.citations : [];
      const verifiedCitations = integrityError
        ? []
        : rawCitations.filter((c) => {
            const cSrc = c.source_id || c.document_id;
            if (cSrc && String(cSrc) !== requestVideoId) return false;
            const targetSec = c.seek_seconds ?? c.timestamp_start;
            if (typeof targetSec !== 'number' || !isFinite(targetSec) || targetSec < 0) return false;
            if (
              effectiveDuration > 0 &&
              targetSec > effectiveDuration + CAPTION_CUE_END_TOLERANCE_SECONDS
            ) {
              return false;
            }
            return true;
          });

      const finalGrounded = Boolean(isGroundedMode && res.grounded && verifiedCitations.length > 0);
      const finalInsufficient = !finalGrounded || Boolean(res.insufficient_evidence);

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: integrityError
          ? `Source integrity check failed for "${video.title}" (${integrityError}). Transcript-grounded citations have been withheld.`
          : res.response || 'No response generated.',
        citations: finalGrounded ? verifiedCitations : [],
        grounded: finalGrounded,
        insufficientEvidence: finalInsufficient,
        partialAnswer: finalGrounded ? res.partial_answer : false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      // If active video changed or request aborted, ignore silently
      if (activeVideoIdRef.current !== requestVideoId || currentAbort.signal.aborted || err?.name === 'AbortError') {
        return;
      }

      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: isVideoAuthError(err)
          ? 'Your session has expired or you are signed out. Please sign in again to ask questions about this lecture.'
          : `Sorry, I encountered an error while consulting the lecture evidence: ${err.message || 'Server error'}. Please try again.`,
        grounded: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      if (activeVideoIdRef.current === requestVideoId) {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'What are the key concepts explained in this video?',
    'What was discussed around the beginning?',
    'Explain the most important definition mentioned in the lecture.',
  ];

  return (
    <div
      className={`flex flex-col bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between gap-3 bg-muted/20">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-glow">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              AI Video Tutor
              {isGroundedMode ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0 border-primary/40 text-primary bg-primary/5 font-medium"
                >
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Grounded
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0 border-amber-500/40 text-amber-500 bg-amber-500/5 font-medium"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Ungrounded Mode
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isGroundedMode ? 'Answers strictly anchored in video evidence' : 'Transcript unavailable - conceptual help without citations'}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setMessages([
              {
                id: `reset_${Date.now()}`,
                role: 'assistant',
                content: isGroundedMode
                  ? `Chat history cleared. What would you like to explore in **"${video.title}"**?`
                  : `Chat history cleared. Asking about **"${video.title}"** in conceptual mode (no transcript citations).`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                grounded: isGroundedMode,
              },
            ])
          }
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
          title="Clear Chat"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Reset
        </Button>
      </div>

      {/* Message List */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[420px] min-h-[300px]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                  isUser
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : msg.insufficientEvidence
                      ? 'bg-amber-500/10 border border-amber-500/20 text-foreground rounded-tl-none'
                      : 'bg-muted/60 border border-border/40 text-foreground rounded-tl-none'
                  }`}
                >
                  {msg.insufficientEvidence && (
                    <div className="flex items-center gap-1.5 font-medium text-amber-500 mb-1.5 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Evidence Unavailable in Video
                    </div>
                  )}

                  {isUser ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <VideoTutorFormattedContent
                      content={msg.content}
                      citations={msg.citations}
                      isGrounded={msg.grounded !== false}
                      maxDurationSeconds={effectiveDuration}
                      onSeek={onSeek}
                    />
                  )}

                  {/* Render Verified Timestamp Citations */}
                  {msg.grounded !== false && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/30 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        Timestamps:
                      </span>
                      {msg.citations.map((c, i) => {
                        const targetSeconds =
                          c.seek_seconds ??
                          (c.timestamp_start !== null && c.timestamp_start !== undefined && c.timestamp_start >= 0
                            ? Number(c.timestamp_start)
                            : null);

                        if (targetSeconds === null) return null;

                        const label = c.formatted_timestamp
                          ? `[${c.formatted_timestamp}]`
                          : `[${formatTimestamp(targetSeconds)}]`;

                        return (
                          <button
                            key={`${c.chunk_id}_${i}`}
                            type="button"
                            onClick={() => onSeek(targetSeconds)}
                            title={`Jump to video at ${formatTimestamp(targetSeconds)}: ${c.snippet || ''}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground font-mono text-[11px] font-semibold transition-all duration-150 shadow-sm border border-primary/20"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 bg-muted/60 border border-border/40 rounded-2xl rounded-tl-none text-xs flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Analyzing lecture video transcript and grounding response...</span>
            </div>
          </div>
        )}

      </div>

      {/* Suggested Quick Questions */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-muted/20 border-t border-border/30 flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            Suggested:
          </span>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSend(q)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-background border border-border hover:border-primary/50 text-foreground transition-colors truncate max-w-[240px]"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-border/40 bg-muted/10 flex items-center gap-2">
        <Input
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this lecture..."
          disabled={isLoading}
          className="text-xs h-9 bg-background/80"
        />
        <Button
          onClick={() => handleSend()}
          disabled={!inputQuery.trim() || isLoading}
          size="sm"
          className="h-9 px-3 bg-brand-gradient text-white shadow-glow flex-shrink-0"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};
