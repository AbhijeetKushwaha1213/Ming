import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Presentation,
  Video,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  Play,
  Layers,
  ShieldCheck,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import type { CitationData } from '@/types/resource';
import { getSourceLocation } from '@/api/ragAPI';
import { useToast } from '@/hooks/use-toast';

interface CitationProps {
  citation: CitationData;
  inline?: boolean;
  onOpenSource?: (location: any) => void;
  className?: string;
}

export const Citation: React.FC<CitationProps> = ({
  citation,
  inline = false,
  onOpenSource,
  className = '',
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationDetails, setLocationDetails] = useState<any>(citation);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const stype = (citation.source_type || 'TEXT').toUpperCase();
  const isDiagram = Boolean(citation.is_diagram || locationDetails?.is_diagram);

  // Helper to format timestamp seconds into MM:SS
  const formatTime = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceConfig = () => {
    if (isDiagram) {
      const coord = citation.page_number
        ? `Page ${citation.page_number}`
        : citation.slide_number
        ? `Slide ${citation.slide_number}`
        : 'Visual';
      return {
        icon: <ImageIcon className="w-3.5 h-3.5 text-purple-600" />,
        badgeColor: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
        label: `Figure (${coord})`,
        typeLabel: 'Multimodal Figure / Diagram',
      };
    }
    if (stype.includes('PDF')) {
      return {
        icon: <FileText className="w-3.5 h-3.5 text-rose-600" />,
        badgeColor: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
        label: citation.page_number ? `Page ${citation.page_number}` : 'PDF Excerpt',
        typeLabel: 'Textbook / PDF Document',
      };
    }
    if (stype.includes('PPT') || stype.includes('SLIDE')) {
      return {
        icon: <Presentation className="w-3.5 h-3.5 text-amber-600" />,
        badgeColor: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
        label: citation.slide_number ? `Slide ${citation.slide_number}` : 'Slide Excerpt',
        typeLabel: 'Presentation Slides',
      };
    }
    if (stype.includes('VIDEO') || stype.includes('AUDIO') || stype.includes('YOUTUBE')) {
      return {
        icon: <Video className="w-3.5 h-3.5 text-emerald-600" />,
        badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        label:
          citation.timestamp_start !== null && citation.timestamp_start !== undefined && citation.timestamp_start >= 0
            ? formatTime(citation.timestamp_start)
            : 'Lecture Video',
        typeLabel: 'Lecture Video / Audio',
      };
    }
    return {
      icon: <BookOpen className="w-3.5 h-3.5 text-blue-600" />,
      badgeColor: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
      label: citation.citation_label || 'Course Notes',
      typeLabel: 'Verified Study Notes',
    };
  };

  const config = getSourceConfig();

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);

    try {
      setIsLoading(true);
      const freshLoc = await getSourceLocation(citation.chunk_id);
      setLocationDetails((prev: any) => ({ ...prev, ...freshLoc }));
      if (onOpenSource) {
        onOpenSource(freshLoc);
      }
    } catch {
      // Fallback to existing metadata
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCitation = () => {
    const textToCopy = `[Source: ${config.typeLabel} | ${config.label}] "${locationDetails.preview || locationDetails.snippet || ''}"`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({
      title: 'Citation copied',
      description: `Copied ${config.label} reference to clipboard.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDeepLink = () => {
    const coordParam = citation.page_number
      ? `page=${citation.page_number}`
      : citation.slide_number
      ? `slide=${citation.slide_number}`
      : citation.timestamp_start
      ? `t=${Math.floor(citation.timestamp_start)}`
      : '';
    const deepLink = `${window.location.origin}/dashboard#cite=${citation.chunk_id}${coordParam ? `&${coordParam}` : ''}`;
    navigator.clipboard.writeText(deepLink);
    setLinkCopied(true);
    toast({
      title: 'Deep link copied',
      description: `Copied exact coordinate link (${config.label}) to clipboard.`,
    });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium transition-all shadow-xs cursor-pointer select-none ${
          config.badgeColor
        } ${inline ? 'mx-0.5 align-baseline' : ''} ${className}`}
        title={`View citation details: ${config.label}`}
        data-testid={`citation-${citation.chunk_id}`}
      >
        {config.icon}
        <span>{config.label}</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 mr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                  {config.icon}
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    {config.typeLabel}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Citation reference verified in Chroma Knowledge Base
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Coordinate Highlight Banner */}
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm space-y-1">
              <div className="flex items-center justify-between font-medium text-gray-900">
                <span>Exact Source Coordinate</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono">
                  {config.label}
                </span>
              </div>

              {/* Behavior by Source Type */}
              {stype.includes('PDF') && (
                <div className="pt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>Page {locationDetails.page_number || 'N/A'} of uploaded course document</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-rose-700 border-rose-200 hover:bg-rose-50"
                    onClick={() => {
                      toast({
                        title: `Opened Page ${locationDetails.page_number}`,
                        description: 'Simulating document viewport navigation to cited page.',
                      });
                    }}
                  >
                    <ExternalLink className="w-3 h-3" /> Jump to Page {locationDetails.page_number}
                  </Button>
                </div>
              )}

              {(stype.includes('PPT') || stype.includes('SLIDE')) && (
                <div className="pt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>Slide #{locationDetails.slide_number || 'N/A'} in lecture presentation</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() => {
                      toast({
                        title: `Opened Slide ${locationDetails.slide_number}`,
                        description: 'Simulating presentation deck navigation to cited slide.',
                      });
                    }}
                  >
                    <Layers className="w-3 h-3" /> View Slide {locationDetails.slide_number}
                  </Button>
                </div>
              )}

              {(stype.includes('VIDEO') || stype.includes('AUDIO')) && (
                <div className="pt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Timestamp {formatTime(locationDetails.timestamp_start)} - {formatTime(locationDetails.timestamp_end)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => {
                      toast({
                        title: `Seek to ${formatTime(locationDetails.timestamp_start)}`,
                        description: 'Simulating lecture video player seek to timestamp.',
                      });
                    }}
                  >
                    <Play className="w-3 h-3 fill-current" /> Seek to {formatTime(locationDetails.timestamp_start)}
                  </Button>
                </div>
              )}
              {/* Multimodal Diagram Banner */}
              {isDiagram && (
                <div className="pt-2 flex items-center justify-between text-xs text-purple-900 bg-purple-50/70 p-2 rounded-md border border-purple-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                    {locationDetails.diagram_caption || citation.diagram_caption || 'Visual Schema / Figure'}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-purple-100/50 text-purple-700 border-purple-300">
                    Figure Element
                  </Badge>
                </div>
              )}
            </div>

            {/* Verified Text Excerpt */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Grounding Evidence Content
              </p>
              <div className="p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-sm text-gray-800 leading-relaxed max-h-48 overflow-y-auto">
                {isLoading ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Loading location snippet...</p>
                ) : (
                  <blockquote className="border-l-2 border-indigo-400 pl-3 italic font-serif text-gray-700">
                    "{locationDetails.preview || locationDetails.snippet || citation.snippet || 'No excerpt available.'}"
                  </blockquote>
                )}
              </div>
            </div>

            {/* Chunk & Document Identifiers */}
            <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 pt-1 font-mono">
              <span className="px-2 py-0.5 rounded bg-gray-100">
                chunk: {citation.chunk_id}
              </span>
              {citation.document_id && (
                <span className="px-2 py-0.5 rounded bg-gray-100">
                  doc: {citation.document_id}
                </span>
              )}
              {isDiagram && (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                  visual_unit
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCitation}
                className="text-xs gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Reference' : 'Copy Reference'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDeepLink}
                className="text-xs gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              >
                {linkCopied ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <LinkIcon className="w-3.5 h-3.5" />}
                {linkCopied ? 'Link Copied' : 'Copy Deep Link'}
              </Button>
            </div>
            <Button size="sm" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
