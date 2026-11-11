import React, { useState, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';
import type { BoundingBox, EvidenceType } from '@/types/resource';

export interface PdfViewerProps {
  resourceId: string;
  pageNumber?: number | null;
  pageLabel?: string | null;
  title?: string;
  excerpt?: string;
  boundingBox?: BoundingBox | null;
  regions?: BoundingBox[] | null;
  hasPreciseCoordinates?: boolean;
  localizationConfidence?: number | null;
  evidenceType?: EvidenceType | string;
  equationCropData?: string | null;
  equationNotation?: string | null;
  surroundingContext?: string | null;
  uncertaintyNote?: string | null;
  onPageChange?: (page: number) => void;
  className?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  resourceId,
  pageNumber = 1,
  pageLabel,
  title = 'Document Viewer',
  excerpt,
  boundingBox,
  regions,
  hasPreciseCoordinates = true,
  localizationConfidence,
  evidenceType = 'TEXT_PASSAGE',
  equationCropData,
  equationNotation,
  surroundingContext,
  uncertaintyNote,
  onPageChange,
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState<number>(pageNumber || 1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

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
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[520px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">Streaming original PDF document...</p>
        <p className="text-xs text-muted-foreground mt-1">
          Authenticating and navigating to Page {pageLabel || pageNumber}...
        </p>
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
  const cleanPageLabel = (pageLabel || String(currentPage)).replace(/^Page\s+/i, '');
  const displayLabel = `Page ${cleanPageLabel}`;
  const isEquation = evidenceType === 'EQUATION';

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
            Page <strong className="text-primary font-mono">{cleanPageLabel}</strong>
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
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={handleRotate} title="Rotate 90°">
            <RotateCw className="w-3.5 h-3.5" />
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
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              Verified Evidence Location ({displayLabel}):
            </span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {/* Scanned Document - Highlight Unavailable Notice */}
      {hasPreciseCoordinates === false && (
        <div
          data-testid="pdf-highlight-unavailable-notice"
          className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/40 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Precise coordinate highlight unavailable for this document scan. Showing {displayLabel}.</span>
          </div>
          <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100/50">
            Full-Page Scan
          </Badge>
        </div>
      )}

      {/* Extraction Uncertainty / Symbol Ambiguity Callout */}
      {uncertaintyNote && (
        <div
          data-testid="pdf-uncertainty-callout"
          className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-xs"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-foreground/90 leading-tight">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Extraction Uncertainty / Symbol Ambiguity Note:
            </span>{' '}
            <span className="italic">{uncertaintyNote}</span>
          </div>
        </div>
      )}

      {/* Original Equation / Diagram Crop Evidence Panel */}
      {(equationCropData || equationNotation) && (
        <div
          data-testid="pdf-evidence-crop-panel"
          className="p-3 bg-secondary/60 border-b border-border flex flex-wrap sm:flex-nowrap items-start gap-3"
        >
          {equationCropData && (
            <div className="shrink-0 max-w-[200px] max-h-[90px] rounded border border-border bg-white dark:bg-zinc-900 p-1.5 overflow-hidden shadow-xs flex items-center justify-center">
              <img
                src={equationCropData}
                alt="Authentic Supporting Document Crop"
                className="object-contain max-h-[76px] w-auto"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>
                {equationCropData
                  ? `Authentic Document Evidence Crop (${isEquation ? 'Mathematical Formula' : 'Visual Figure'})`
                  : `Extracted Mathematical Formulation (${isEquation ? 'Vector Graphics Path' : 'Visual Figure'})`}
              </span>
            </div>
            {equationNotation && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Extracted Notation:</span>
                <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {equationNotation}
                </code>
              </div>
            )}
            {uncertaintyNote && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2 py-1 rounded flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{uncertaintyNote}</span>
              </div>
            )}
            {surroundingContext && (
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                <strong className="text-foreground/80">Context & Definitions:</strong> {surroundingContext}
              </p>
            )}
          </div>
        </div>
      )}

      {/* PDF Viewport & Coordinate Highlight Overlay */}
      <div className="flex-1 w-full bg-slate-900/90 relative min-h-[460px] overflow-hidden">
        {blobUrl ? (
          <div
            className="w-full h-full relative"
            style={{
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              transformOrigin: 'center center',
            }}
          >
            <iframe
              key={`${blobUrl}-p${currentPage}-z${zoomLevel}-r${rotation}`}
              src={pdfViewUrl}
              title={`PDF Page ${currentPage}`}
              className="w-full h-full border-0 min-h-[460px]"
              data-testid="pdf-viewport-frame"
            />

            {/* Exact Bounding Box / Multi-Region Highlight Overlay */}
            {hasPreciseCoordinates && (regions && regions.length > 0 ? (
              regions.map((reg, regIdx) => (
                <div
                  key={`highlight-region-${regIdx}`}
                  data-testid="pdf-coordinate-highlight"
                  data-region-index={regIdx}
                  className="absolute border-2 border-amber-500 bg-amber-400/25 rounded ring-2 ring-amber-400/30 transition-all pointer-events-none shadow-sm z-10"
                  style={{
                    left: `${reg.x}%`,
                    top: `${reg.y}%`,
                    width: `${reg.width}%`,
                    height: `${reg.height}%`,
                  }}
                >
                  {regIdx === 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-br w-max shadow-xs">
                      <Sparkles className="w-2.5 h-2.5" />
                      {isEquation ? 'Supporting Equation' : 'Supporting Evidence Passage'}
                    </span>
                  )}
                </div>
              ))
            ) : boundingBox ? (
              <div
                data-testid="pdf-coordinate-highlight"
                className="absolute border-2 border-amber-500 bg-amber-400/25 rounded ring-4 ring-amber-400/30 transition-all pointer-events-none shadow-lg flex flex-col justify-between z-10"
                style={{
                  left: `${boundingBox.x}%`,
                  top: `${boundingBox.y}%`,
                  width: `${boundingBox.width}%`,
                  height: `${boundingBox.height}%`,
                }}
              >
                <span className="inline-flex items-center gap-1 bg-amber-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-br w-max shadow-xs">
                  <Sparkles className="w-2.5 h-2.5" />
                  {isEquation ? 'Supporting Equation' : 'Supporting Evidence Passage'}
                </span>
              </div>
            ) : null)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No document loaded
          </div>
        )}
      </div>
    </div>
  );
};
