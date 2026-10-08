import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  FileQuestion,
  FileText,
  Presentation,
  Video,
  Headphones,
  Image as ImageIcon,
  BookOpen,
  X,
} from 'lucide-react';
import type { CitationData } from '@/types/resource';
import type { CitationVerificationStatus } from '@/types/resource';
import { PdfViewer } from './PdfViewer';
import { PresentationViewer } from './PresentationViewer';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { AudioViewer } from './AudioViewer';
import { TextViewer } from './TextViewer';

export interface SourceViewerProps {
  isOpen: boolean;
  onClose: () => void;
  citation: CitationData | null;
  className?: string;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({
  isOpen,
  onClose,
  citation,
  className = '',
}) => {
  if (!citation) return null;

  const rawType = (citation.source_type || 'TEXT').toUpperCase();
  const rawStatus = (citation.verification_status || 'VERIFIED').toUpperCase() as CitationVerificationStatus;
  const isTrusted = rawStatus === 'VERIFIED' || rawStatus === 'PARTIALLY_VERIFIED';

  const resourceId =
    citation.resource_id ||
    citation.source_id ||
    citation.document_id ||
    'unknown_resource';

  const title = citation.source_title || citation.citation_label || 'Course Material';
  const pageNum = citation.page_number ?? citation.location?.page_number;
  const slideNum = citation.slide_number ?? citation.location?.slide_number;
  const timeStart = citation.timestamp_start ?? citation.location?.timestamp_start;
  const timeEnd = citation.timestamp_end ?? citation.location?.timestamp_end;
  const excerptText = citation.excerpt || citation.snippet || '';

  const getSourceTypeIcon = () => {
    if (citation.is_diagram) return <ImageIcon className="w-4 h-4 text-primary" />;
    if (rawType.includes('PDF')) return <FileText className="w-4 h-4 text-rose-600" />;
    if (rawType.includes('PPT') || rawType.includes('SLIDE')) return <Presentation className="w-4 h-4 text-amber-600" />;
    if (rawType.includes('VIDEO')) return <Video className="w-4 h-4 text-emerald-600" />;
    if (rawType.includes('AUDIO')) return <Headphones className="w-4 h-4 text-emerald-600" />;
    if (rawType.includes('IMAGE') || rawType.includes('PNG') || rawType.includes('JPG')) return <ImageIcon className="w-4 h-4 text-primary" />;
    return <BookOpen className="w-4 h-4 text-blue-600" />;
  };

  const renderStatusBadge = () => {
    switch (rawStatus) {
      case 'VERIFIED':
        return (
          <Badge variant="outline" className="border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs gap-1 font-sans">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Verified Citation
          </Badge>
        );
      case 'PARTIALLY_VERIFIED':
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs gap-1 font-sans">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Partially Verified
          </Badge>
        );
      case 'CROSS_TENANT_REJECTED':
        return (
          <Badge variant="destructive" className="text-xs gap-1 font-sans">
            <Lock className="w-3.5 h-3.5" />
            Cross-Tenant Rejected
          </Badge>
        );
      case 'SOURCE_UNAVAILABLE':
        return (
          <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 text-xs gap-1 font-sans">
            <FileQuestion className="w-3.5 h-3.5 text-rose-600" />
            Source Unavailable
          </Badge>
        );
      case 'COORDINATE_MISMATCH':
        return (
          <Badge variant="destructive" className="text-xs gap-1 font-sans">
            <AlertTriangle className="w-3.5 h-3.5" />
            Coordinate Mismatch
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs gap-1 font-sans">
            <AlertTriangle className="w-3.5 h-3.5" />
            Unverified
          </Badge>
        );
    }
  };

  // Render Rejected / Unverified / Blocked State
  if (!isTrusted) {
    let errorTitle = 'Untrusted Citation Reference';
    let errorDescription = 'This citation failed server-side deterministic verification and cannot be opened.';

    if (rawStatus === 'CROSS_TENANT_REJECTED') {
      errorTitle = 'Cross-Tenant Access Prohibited';
      errorDescription = 'This cited evidence belongs to another private user workspace. Server-side isolation prevents access.';
    } else if (rawStatus === 'SOURCE_UNAVAILABLE') {
      errorTitle = 'Source Unavailable';
      errorDescription = 'The original course material associated with this citation has been deleted or removed.';
    } else if (rawStatus === 'COORDINATE_MISMATCH') {
      errorTitle = 'Coordinate Mismatch';
      errorDescription = 'The cited page, slide, or timestamp contradicts authentic source provenance and cannot be verified.';
    } else if (rawStatus === 'UNVERIFIED') {
      errorTitle = 'Unverified Citation';
      errorDescription = 'This citation was not supported by retrieved course evidence in this query context.';
    }

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md" data-testid="source-viewer-blocked-dialog">
          <DialogHeader>
            <div className="flex items-center justify-between mr-6">
              <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                {errorTitle}
              </DialogTitle>
              {renderStatusBadge()}
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Zero-Trust Grounding Engine Security Guarantee
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-foreground leading-relaxed">
              {errorDescription}
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] font-mono space-y-1 text-muted-foreground">
              <div>chunk_id: {citation.chunk_id}</div>
              <div>status: {rawStatus}</div>
              {citation.resource_id && <div>resource_id: {citation.resource_id}</div>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Render Respective Sub-Viewer
  const renderViewerBody = () => {
    if (rawType.includes('PDF')) {
      return (
        <PdfViewer
          resourceId={resourceId}
          pageNumber={pageNum || 1}
          title={title}
          excerpt={excerptText}
        />
      );
    }

    if (rawType.includes('PPT') || rawType.includes('SLIDE')) {
      return (
        <PresentationViewer
          resourceId={resourceId}
          slideNumber={slideNum || 1}
          chunkId={citation.chunk_id}
          title={title}
          excerpt={excerptText}
        />
      );
    }

    if (rawType.includes('VIDEO') || rawType.includes('YOUTUBE')) {
      return (
        <VideoViewer
          resourceId={resourceId}
          timestampStart={timeStart}
          timestampEnd={timeEnd}
          title={title}
          excerpt={excerptText}
        />
      );
    }

    if (rawType.includes('AUDIO')) {
      return (
        <AudioViewer
          resourceId={resourceId}
          timestampStart={timeStart}
          timestampEnd={timeEnd}
          title={title}
          excerpt={excerptText}
        />
      );
    }

    if (rawType.includes('IMAGE') || rawType.includes('PNG') || rawType.includes('JPG') || rawType.includes('JPEG') || citation.is_diagram) {
      return (
        <ImageViewer
          resourceId={resourceId}
          title={title}
          excerpt={excerptText}
          diagramCaption={citation.diagram_caption}
          isDiagram={citation.is_diagram}
        />
      );
    }

    // Default to Note/Text Viewer
    return (
      <TextViewer
        resourceId={resourceId}
        title={title}
        excerpt={excerptText}
        initialText={excerptText}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`sm:max-w-4xl max-h-[92vh] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-background shadow-2xl border-border ${className}`}
        data-testid="source-viewer-dialog"
      >
        <DialogHeader className="px-5 py-3 border-b border-border bg-card flex flex-row items-center justify-between shrink-0 space-y-0">
          <div className="flex items-center gap-2.5 overflow-hidden mr-4">
            <div className="p-1.5 rounded-lg bg-secondary text-foreground shrink-0">
              {getSourceTypeIcon()}
            </div>
            <div className="truncate">
              <DialogTitle className="text-sm font-semibold truncate text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground truncate">
                Verified Evidence Source Navigation
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {renderStatusBadge()}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative">
          {renderViewerBody()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
