import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';

export interface PdfViewerProps {
  resourceId: string;
  pageNumber?: number | null;
  title?: string;
  excerpt?: string;
  onPageChange?: (page: number) => void;
  className?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  resourceId,
  pageNumber = 1,
  title = 'Document Viewer',
  excerpt,
  onPageChange,
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState<number>(pageNumber || 1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    if (pageNumber && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
    }
  }, [pageNumber]);

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function loadPdf() {
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
          message: err.message || 'Failed to load PDF document.',
          statusCode,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resourceId]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1;
      setCurrentPage(nextP);
      if (onPageChange) onPageChange(nextP);
    }
  };

  const handleNextPage = () => {
    const nextP = currentPage + 1;
    setCurrentPage(nextP);
    if (onPageChange) onPageChange(nextP);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 20, 200));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 20, 60));
  const handleResetZoom = () => setZoomLevel(100);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[520px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">Streaming original PDF document...</p>
        <p className="text-xs text-muted-foreground mt-1">Authenticating and navigating to Page {pageNumber}...</p>
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
            : 'Error Loading Document'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          {isAuth
            ? 'Your active session has expired or is invalid. Please sign in to access this resource.'
            : isForbidden
            ? 'This resource belongs to another student workspace and cannot be accessed.'
            : isNotFound
            ? 'The cited source document has been removed, deleted, or relocated.'
            : error.message}
        </p>
      </div>
    );
  }

  // Construct standard PDF open parameter URL
  const pdfViewUrl = blobUrl ? `${blobUrl}#page=${currentPage}&zoom=${zoomLevel}` : '';

  return (
    <div className={`flex flex-col h-full bg-background rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Top Navigation & Toolbar Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 text-xs gap-1 font-mono">
            PDF
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2 py-1 shadow-xs">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <span className="text-xs font-medium px-1 min-w-[70px] text-center">
            Page <strong className="text-primary font-mono">{currentPage}</strong>
          </span>

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleNextPage}
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Zoom & External Controls */}
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
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Open in new tab">
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
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Verified Evidence Location:</span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {/* PDF Viewport */}
      <div className="flex-1 w-full bg-slate-900/90 relative min-h-[460px]">
        {blobUrl ? (
          <iframe
            key={`${blobUrl}-p${currentPage}-z${zoomLevel}`}
            src={pdfViewUrl}
            title={`PDF Page ${currentPage}`}
            className="w-full h-full border-0 min-h-[460px]"
            data-testid="pdf-viewport-frame"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No document loaded
          </div>
        )}
      </div>
    </div>
  );
};
