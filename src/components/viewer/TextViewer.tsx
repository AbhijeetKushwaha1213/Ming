import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, FileText, ShieldCheck, Copy, Check, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';
import { useToast } from '@/hooks/use-toast';

export interface TextViewerProps {
  resourceId: string;
  title?: string;
  excerpt?: string;
  initialText?: string;
  className?: string;
}

export const TextViewer: React.FC<TextViewerProps> = ({
  resourceId,
  title = 'Course Notes',
  excerpt,
  initialText,
  className = '',
}) => {
  const { toast } = useToast();
  const [textContent, setTextContent] = useState<string>(initialText || '');
  const [isLoading, setIsLoading] = useState<boolean>(!initialText);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadText() {
      if (initialText) {
        setTextContent(initialText);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fileData = await fetchResourceFile(resourceId);
        if (!isMounted) return;

        const text = await fileData.blob.text();
        setTextContent(text);
      } catch (err: any) {
        if (!isMounted) return;
        const statusCode = err instanceof ResourceAccessError ? err.statusCode : err.statusCode || 500;
        setError({
          message: err.message || 'Failed to access text resource.',
          statusCode,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadText();

    return () => {
      isMounted = false;
    };
  }, [resourceId, initialText]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    toast({
      title: 'Notes copied',
      description: 'Copied full text to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[460px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium text-foreground">Loading study notes...</p>
        <p className="text-xs text-muted-foreground mt-1">Authenticating source access...</p>
      </div>
    );
  }

  if (error) {
    const isAuth = error.statusCode === 401;
    const isForbidden = error.statusCode === 403;
    const isNotFound = error.statusCode === 404;

    return (
      <div className={`flex flex-col items-center justify-center h-[460px] bg-destructive/5 rounded-xl border border-destructive/20 p-6 text-center ${className}`}>
        <AlertCircle className="w-10 h-10 text-destructive mb-3" />
        <h3 className="text-base font-semibold text-foreground">
          {isAuth
            ? 'Authentication Required'
            : isForbidden
            ? 'Access Denied'
            : isNotFound
            ? 'Source Material Unavailable'
            : 'Error Loading Notes'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          {isAuth
            ? 'Your active session has expired or is invalid. Please sign in to access this resource.'
            : isForbidden
            ? 'This resource belongs to another student workspace and cannot be accessed.'
            : isNotFound
            ? 'The cited study notes have been removed, deleted, or relocated.'
            : error.message}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs gap-1 font-mono">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" /> NOTE
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleCopyText}>
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy Text'}</span>
        </Button>
      </div>

      {/* Verified Evidence Callout Banner */}
      {excerpt && (
        <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-foreground/90 leading-tight">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Verified Evidence Excerpt:</span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {/* Notes Text Body */}
      <div className="flex-1 p-6 bg-card text-card-foreground overflow-y-auto max-h-[500px]">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="p-5 rounded-xl bg-muted/30 border border-border leading-relaxed font-sans text-sm whitespace-pre-wrap text-foreground">
            {textContent || 'No text content available in this note.'}
          </div>
        </div>
      </div>
    </div>
  );
};
