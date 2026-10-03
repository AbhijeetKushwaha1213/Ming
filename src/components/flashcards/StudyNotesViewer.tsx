import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Sparkles,
  Copy,
  Check,
  Download,
  FolderPlus,
  Lightbulb,
  FileText,
  List,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  normalizeNotesContent,
  notesToMarkdown,
  cleanAiResponseToReadableNotes,
  extractBalancedJsonObject,
  StructuredNotes,
} from '@/utils/notesFormatter';
import { inlineMarkdownToHTML } from '@/components/notion/editor/serialization';
import { copyVaultItemToResources } from '@/utils/vaultToResources';
import { navigateToTab } from '@/utils/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { pageKeys } from '@/hooks/usePages';

/**
 * Formats and renders concept card content, gracefully handling embedded JSON,
 * markdown bullet points, bold terms, and inline code snippets.
 */
function FormattedNotePointContent({ content }: { content: string }) {
  if (!content) return null;

  // 1. If content is an accidentally stringified JSON object or contains JSON brackets
  let cleanText = content.trim();
  if (cleanText.startsWith('{') || cleanText.includes('"notes"') || cleanText.includes('"key_points"')) {
    const balanced = extractBalancedJsonObject(cleanText);
    if (balanced && typeof balanced === 'object') {
      const notesObj = balanced.notes || balanced;
      if (notesObj.summary && typeof notesObj.summary === 'string') {
        cleanText = notesObj.summary;
      } else if (Array.isArray(notesObj.key_points) && notesObj.key_points.length > 0) {
        cleanText = notesObj.key_points
          .map((kp: any) => `${kp.heading ? `**${kp.heading}**: ` : ''}${kp.content || ''}`)
          .join('\n\n');
      }
    }
  }

  // 2. Remove any repeated markdown # headers inside the card content
  cleanText = cleanText.replace(/^#+\s+[^\n]+\n*/gm, '').trim();

  // 3. Process paragraphs and bullet items
  const lines = cleanText.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentBullets: string[] = [];

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      renderedElements.push(
        <ul key={`bullets-${renderedElements.length}`} className="space-y-1.5 my-2 pl-1">
          {currentBullets.map((bullet, bIdx) => (
            <li key={bIdx} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0 mt-2" />
              <span
                dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(bullet) }}
                className="flex-1 break-words"
              />
            </li>
          ))}
        </ul>
      );
      currentBullets = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushBullets();
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      currentBullets.push(line.replace(/^[-*•]\s+/, ''));
    } else {
      flushBullets();
      renderedElements.push(
        <p
          key={`p-${renderedElements.length}`}
          className="text-xs sm:text-sm text-foreground/90 leading-relaxed mb-2 break-words"
          dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(line) }}
        />
      );
    }
  }
  flushBullets();

  return <div className="pl-8 space-y-1">{renderedElements}</div>;
}

interface StudyNotesViewerProps {
  notes: any;
  title?: string;
  topic?: string;
  difficulty?: string;
  materialId?: string;
  onClose?: () => void;
}

export const StudyNotesViewer: React.FC<StudyNotesViewerProps> = ({
  notes: rawNotes,
  title: initialTitle,
  topic: initialTopic,
  difficulty = 'medium',
  materialId,
  onClose,
}) => {
  const { toast } = useToast();
  let queryClient: any;
  try {
    queryClient = useQueryClient();
  } catch {
    queryClient = undefined;
  }

  const [copied, setCopied] = useState(false);
  const [isSavingToResources, setIsSavingToResources] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<'structured' | 'markdown'>('structured');

  const structured: StructuredNotes = normalizeNotesContent(rawNotes, initialTitle || 'Study Notes');
  const fullMarkdown = notesToMarkdown(structured);

  // Estimate reading time
  const wordCount = fullMarkdown.split(/\s+/).filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 180));

  const handleCopy = () => {
    navigator.clipboard.writeText(fullMarkdown);
    setCopied(true);
    toast({
      title: "Notes Copied! 📋",
      description: "Structured notes copied to clipboard in clean Markdown.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(structured.title || 'study-notes').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Notes Exported 📥",
      description: `Saved as ${a.download}`,
    });
  };

  const handleSaveToResources = async () => {
    setIsSavingToResources(true);
    try {
      const page = await copyVaultItemToResources({
        id: materialId || `notes-${Date.now()}`,
        title: structured.title,
        type: 'notes',
        topic: initialTopic || structured.title,
        content: fullMarkdown,
      });

      if (queryClient) {
        await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      }

      toast({
        title: "Saved to Resources Workspace! 📚",
        description: `Created new editable Notion page: "${page.title}"`,
      });

      // Navigate directly to the new resource page in Notion manager
      navigateToTab('resources', undefined, { pageId: page.id });
    } catch (err) {
      console.error('Failed to copy notes to resources:', err);
      toast({
        title: "Save Failed",
        description: "Could not create workspace page. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingToResources(false);
    }
  };

  const getDifficultyBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'easy':
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Easy</Badge>;
      case 'hard':
        return <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30">Advanced</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Intermediate</Badge>;
    }
  };

  const displaySummary = React.useMemo(() => {
    if (!structured.summary) return '';
    const clean = structured.summary.trim();
    if (clean.toLowerCase().startsWith('ai generated notes') && structured.keyPoints.length > 0) {
      const firstPoint = structured.keyPoints[0];
      return firstPoint.content.length > 250
        ? firstPoint.content.slice(0, 250) + '...'
        : firstPoint.content;
    }
    return clean;
  }, [structured.summary, structured.keyPoints]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-9 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <BookOpen className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-foreground truncate max-w-md">{structured.title}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {getDifficultyBadge(difficulty)}
              <span>•</span>
              <span>{readingTimeMin} min read</span>
              <span>•</span>
              <span>{structured.keyPoints.length} core concepts</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
            <button
              onClick={() => setActiveViewMode('structured')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeViewMode === 'structured'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Structured Cards
            </button>
            <button
              onClick={() => setActiveViewMode('markdown')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeViewMode === 'markdown'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Continuous Notes
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 gap-1.5 text-xs">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export .md</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSaveToResources}
            disabled={isSavingToResources}
            className="h-8 gap-1.5 text-xs shadow-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
          >
            {isSavingToResources ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
            <span>Open in Resources</span>
          </Button>
        </div>
      </div>

      {activeViewMode === 'markdown' ? (
        /* Continuous Markdown Reading Mode */
        <Card className="p-8 border border-border shadow-sm bg-card">
          <article className="prose prose-slate dark:prose-invert max-w-none space-y-4 whitespace-pre-wrap leading-relaxed text-sm">
            {fullMarkdown}
          </article>
        </Card>
      ) : (
        /* Structured Visual Cards Mode */
        <div className="space-y-6">
          {/* 1. Executive Summary Callout */}
          {displaySummary && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <Lightbulb className="w-4 h-4" />
                <span>Executive Summary & Overview</span>
              </div>
              <p
                className="text-sm leading-relaxed text-foreground font-medium"
                dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(displaySummary) }}
              />
            </div>
          )}

          {/* 2. Key Concepts & Deep Dive */}
          {structured.keyPoints.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Key Concepts & Deep Dive ({structured.keyPoints.length})
                </h3>
                <span className="text-xs text-muted-foreground">High-yield study points</span>
              </div>

              <div className="grid gap-3.5">
                {structured.keyPoints.map((point, index) => {
                  const isHigh = point.importance === 'high';
                  return (
                    <Card
                      key={index}
                      className="p-4 border border-border/80 bg-card hover:border-primary/40 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <h4 className="font-semibold text-foreground text-sm">{point.heading}</h4>
                        </div>
                        {isHigh ? (
                          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] shrink-0">
                            High Yield
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                            Core Concept
                          </Badge>
                        )}
                      </div>
                      <FormattedNotePointContent content={point.content} />
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Essential Formulas & Rules */}
          {structured.formulas.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Essential Formulas & Rules ({structured.formulas.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {structured.formulas.map((formula, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5"
                  >
                    <div className="font-semibold text-xs text-amber-700 dark:text-amber-400">
                      {formula.name}
                    </div>
                    <div className="p-2 rounded-lg bg-background/80 border border-amber-500/30 font-mono text-xs font-bold text-foreground overflow-x-auto">
                      {formula.formula}
                    </div>
                    {formula.explanation && (
                      <p className="text-[11px] text-muted-foreground italic">
                        {formula.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. High-Yield Quick Facts & Takeaways */}
          {structured.quickFacts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                High-Yield Quick Facts & Takeaways ({structured.quickFacts.length})
              </h3>
              <div className="p-4 rounded-2xl bg-muted/40 border border-border grid gap-2.5">
                {structured.quickFacts.map((fact, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span
                      className="leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(fact) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Exam Tips & Common Pitfalls */}
          {structured.examTips.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Exam Tips & Common Pitfalls
              </h3>
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                {structured.examTips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-rose-900 dark:text-rose-200">
                    <span className="font-bold">•</span>
                    <span
                      className="leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(tip) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
