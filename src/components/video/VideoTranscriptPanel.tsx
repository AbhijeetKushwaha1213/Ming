import React, { useState, useMemo } from 'react';
import type { TranscriptSegment } from '@/types/video';
import { formatTimestamp } from '@/utils/videoUtils';
import { Search, Clock, FileText, Sparkles, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface VideoTranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  isLoading?: boolean;
  transcriptStatus?: string;
  className?: string;
}

export const VideoTranscriptPanel: React.FC<VideoTranscriptPanelProps> = ({
  segments,
  currentTime,
  onSeek,
  isLoading = false,
  transcriptStatus = 'ready',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter segments by search term
  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    const term = searchTerm.toLowerCase();
    return segments.filter(
      (s) =>
        s.text.toLowerCase().includes(term) ||
        (s.topic && s.topic.toLowerCase().includes(term)) ||
        (s.subtopic && s.subtopic.toLowerCase().includes(term))
    );
  }, [segments, searchTerm]);

  // Find active segment index based on currentTime
  const activeIndex = useMemo(() => {
    return segments.findIndex((s) => currentTime >= s.start && currentTime <= s.end);
  }, [segments, currentTime]);

  return (
    <div
      className={`flex flex-col bg-card/70 backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between gap-3 bg-muted/20">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              Transcript
              {segments.length > 0 && (
                <Badge variant="secondary" className="text-xs px-2 py-0 font-normal">
                  {segments.length} segments
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">Click any timestamp to seek video</p>
          </div>
        </div>

        {/* Search filter */}
        {segments.length > 0 && (
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transcript..."
              className="h-8 pl-8 text-xs bg-background/60"
            />
          </div>
        )}
      </div>

      {/* Segments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px] divide-y divide-border/20">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Loading transcript...</p>
          </div>
        ) : segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium text-foreground">
              {transcriptStatus === 'pending'
                ? 'No transcript generated yet'
                : transcriptStatus === 'processing'
                ? 'Transcribing video audio...'
                : 'No transcript available for this video'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {transcriptStatus === 'pending'
                ? 'Uploaded educational videos are automatically indexed with timestamped transcripts.'
                : 'Once processing completes, timestamped segments will appear here.'}
            </p>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No transcript segments match &quot;{searchTerm}&quot;
          </div>
        ) : (
          filteredSegments.map((segment, idx) => {
            const isActive =
              currentTime >= segment.start &&
              currentTime <= (segment.end || segment.start + 30);

            return (
              <div
                key={`${segment.start}_${idx}`}
                onClick={() => onSeek(segment.start)}
                className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 border-l-4 border-l-primary shadow-sm'
                    : 'hover:bg-muted/40 hover:border-l-2 hover:border-l-primary/40'
                }`}
              >
                {/* Timestamp Pill */}
                <button
                  type="button"
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary'
                  }`}
                  title={`Seek to ${formatTimestamp(segment.start)}`}
                >
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(segment.start)}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {(segment.topic || segment.subtopic) && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {segment.topic && (
                        <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-wider">
                          {segment.topic}
                        </span>
                      )}
                      {segment.subtopic && (
                        <span className="text-[11px] text-muted-foreground">
                          • {segment.subtopic}
                        </span>
                      )}
                    </div>
                  )}
                  <p
                    className={`text-xs leading-relaxed ${
                      isActive
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    {segment.text}
                  </p>
                </div>

                {isActive && (
                  <span className="flex-shrink-0 text-primary animate-pulse" title="Currently playing">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
