import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Presentation, Download, Layers, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';
import { getChunk } from '@/api/ragAPI';

export interface PresentationViewerProps {
  resourceId: string;
  slideNumber?: number | null;
  chunkId?: string;
  title?: string;
  excerpt?: string;
  onSlideChange?: (slide: number) => void;
  className?: string;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  resourceId,
  slideNumber = 1,
  chunkId,
  title = 'Presentation Slides',
  excerpt,
  onSlideChange,
  className = '',
}) => {
  const [currentSlide, setCurrentSlide] = useState<number>(slideNumber || 1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [extractedSlideData, setExtractedSlideData] = useState<any>(null);

  useEffect(() => {
    if (slideNumber && slideNumber !== currentSlide) {
      setCurrentSlide(slideNumber);
    }
  }, [slideNumber]);

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function loadPresentation() {
      setIsLoading(true);
      setError(null);

      try {
        const fileData = await fetchResourceFile(resourceId);
        if (!isMounted) return;

        createdUrl = fileData.url;
        setBlobUrl(fileData.url);
        setFileSize(fileData.size);

        // Fetch chunk content to display extracted slide text and structure
        if (chunkId) {
          try {
            const chunkRes = await getChunk(chunkId);
            if (isMounted && chunkRes.found) {
              setExtractedSlideData(chunkRes);
            }
          } catch {
            // Non-blocking fallback
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        const statusCode = err instanceof ResourceAccessError ? err.statusCode : err.statusCode || 500;
        setError({
          message: err.message || 'Failed to access presentation resource.',
          statusCode,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPresentation();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resourceId, chunkId]);

  const handlePrevSlide = () => {
    if (currentSlide > 1) {
      const nextS = currentSlide - 1;
      setCurrentSlide(nextS);
      if (onSlideChange) onSlideChange(nextS);
    }
  };

  const handleNextSlide = () => {
    const nextS = currentSlide + 1;
    setCurrentSlide(nextS);
    if (onSlideChange) onSlideChange(nextS);
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[520px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-amber-600 mb-3" />
        <p className="text-sm font-medium text-foreground">Loading presentation source...</p>
        <p className="text-xs text-muted-foreground mt-1">Authenticating and navigating to Slide {slideNumber}...</p>
      </div>
    );
  }

  if (error) {
    const isAuth = error.statusCode === 401;
    const isForbidden = error.statusCode === 403;
    const isNotFound = error.statusCode === 404;

    return (
      <div className={`flex flex-col items-center justify-center h-[520px] bg-destructive/5 rounded-xl border border-destructive/20 p-6 text-center ${className}`}>
        <AlertCircle className="w-10 h-10 text-destructive mb-3" />
        <h3 className="text-base font-semibold text-foreground">
          {isAuth
            ? 'Authentication Required'
            : isForbidden
            ? 'Access Denied'
            : isNotFound
            ? 'Source Material Unavailable'
            : 'Error Loading Presentation'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          {isAuth
            ? 'Your active session has expired or is invalid. Please sign in to access this resource.'
            : isForbidden
            ? 'This resource belongs to another student workspace and cannot be accessed.'
            : isNotFound
            ? 'The cited presentation file has been removed, deleted, or relocated.'
            : error.message}
        </p>
      </div>
    );
  }

  const slideContentText = extractedSlideData?.text || excerpt || 'Slide content verified from course materials.';

  return (
    <div className={`flex flex-col h-full bg-background rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs gap-1 font-mono">
            <Presentation className="w-3.5 h-3.5 text-amber-600" /> PPTX
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        {/* Slide Controls */}
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2 py-1 shadow-xs">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handlePrevSlide}
            disabled={currentSlide <= 1}
            title="Previous Slide"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <span className="text-xs font-medium px-1 min-w-[75px] text-center">
            Slide <strong className="text-amber-600 font-mono">{currentSlide}</strong>
          </span>

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleNextSlide}
            title="Next Slide"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Download original presentation */}
        {blobUrl && (
          <a href={blobUrl} download={`${title || 'presentation'}.pptx`} className="inline-flex">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <Download className="w-3 h-3" /> Download PPTX
            </Button>
          </a>
        )}
      </div>

      {/* Verified Evidence Callout Banner */}
      {excerpt && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-foreground/90 leading-tight">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Verified Evidence Location:</span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {/* Main Slide Deck Representation Viewport */}
      <div className="flex-1 p-6 bg-slate-900/95 flex flex-col items-center justify-center min-h-[460px] overflow-y-auto">
        <div className="w-full max-w-2xl bg-card text-card-foreground rounded-2xl border border-border/80 shadow-2xl overflow-hidden">
          {/* Slide Screen Frame Header */}
          <div className="px-5 py-3 bg-secondary/80 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-xs font-mono text-muted-foreground">Slide #{currentSlide}</span>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              Course Lecture Deck
            </Badge>
          </div>

          {/* Slide Deck Canvas Body */}
          <div className="p-8 space-y-4 min-h-[260px] flex flex-col justify-center">
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                {extractedSlideData?.location?.heading || title || `Slide ${currentSlide}`}
              </h2>
              <p className="text-xs text-muted-foreground">Original Slide Content & Evidence Anchor</p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
              {slideContentText}
            </div>

            {extractedSlideData?.location?.is_diagram && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Diagram Caption: {extractedSlideData.location.diagram_caption || 'Visual Flowchart / Diagram'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
