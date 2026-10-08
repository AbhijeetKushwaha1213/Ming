import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, ShieldCheck, Download, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';

export interface ImageViewerProps {
  resourceId: string;
  title?: string;
  excerpt?: string;
  diagramCaption?: string;
  isDiagram?: boolean;
  className?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  resourceId,
  title = 'Visual Source Material',
  excerpt,
  diagramCaption,
  isDiagram,
  className = '',
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function loadImage() {
      setIsLoading(true);
      setError(null);

      try {
        const fileData = await fetchResourceFile(resourceId);
        if (!isMounted) return;

        createdUrl = fileData.url;
        setBlobUrl(fileData.url);
      } catch (err: any) {
        if (!isMounted) return;
        const statusCode = err instanceof ResourceAccessError ? err.statusCode : err.statusCode || 500;
        setError({
          message: err.message || 'Failed to load image resource.',
          statusCode,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resourceId]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 25, 300));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 25, 50));
  const handleResetZoom = () => setZoomLevel(100);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[520px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">Streaming original image...</p>
        <p className="text-xs text-muted-foreground mt-1">Authenticating media access...</p>
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
            ? 'Source Image Unavailable'
            : 'Error Loading Image'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          {isAuth
            ? 'Your active session has expired or is invalid. Please sign in to access this resource.'
            : isForbidden
            ? 'This resource belongs to another student workspace and cannot be accessed.'
            : isNotFound
            ? 'The cited source image has been removed, deleted, or relocated.'
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
          <Badge variant="outline" className="border-primary/25 bg-secondary text-primary text-xs gap-1 font-mono">
            <ImageIcon className="w-3.5 h-3.5" /> IMAGE
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        {/* Zoom & Download */}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] font-mono text-muted-foreground w-10 text-center">{zoomLevel}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={handleResetZoom} title="Reset Zoom">
            <RotateCcw className="w-3 h-3" />
          </Button>
          {blobUrl && (
            <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Open full size">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Verified Evidence Callout Banner */}
      {excerpt && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-foreground/90 leading-tight">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Extracted Vision/OCR Evidence:</span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {diagramCaption && (
        <div className="px-4 py-2 bg-secondary/80 border-b border-border flex items-center gap-2 text-xs text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Diagram Caption: <strong>{diagramCaption}</strong></span>
        </div>
      )}

      {/* Image Canvas Viewport */}
      <div className="flex-1 p-4 bg-slate-950/90 flex items-center justify-center min-h-[460px] overflow-auto">
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={title}
            style={{ width: `${zoomLevel}%`, maxWidth: 'none', transition: 'width 0.15s ease-out' }}
            className="rounded-lg shadow-2xl object-contain select-none"
            data-testid="image-viewer-element"
          />
        ) : (
          <div className="text-xs text-muted-foreground">No image available</div>
        )}
      </div>
    </div>
  );
};
