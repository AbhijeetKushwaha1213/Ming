import React from 'react';
import type { VideoRecord } from '@/types/video';
import { formatDuration } from '@/utils/videoUtils';
import {
  Play,
  Trash2,
  Clock,
  Youtube,
  FileVideo,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface VideoLibraryProps {
  videos: VideoRecord[];
  activeVideoId?: string;
  onSelectVideo: (video: VideoRecord) => void;
  onDeleteVideo: (videoId: string) => void;
  onOpenAddModal: () => void;
  isLoading?: boolean;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  videos,
  activeVideoId,
  onSelectVideo,
  onDeleteVideo,
  onOpenAddModal,
  isLoading = false,
}) => {
  const getStatusBadge = (status: string, transcriptStatus: string) => {
    if (status === 'failed' || transcriptStatus === 'failed') {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
          <AlertCircle className="w-2.5 h-2.5" />
          Failed
        </Badge>
      );
    }
    if (status === 'processing' || transcriptStatus === 'processing') {
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Processing
        </Badge>
      );
    }
    if (transcriptStatus === 'pending') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
          Ready (No Transcript)
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-1">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Ready & Indexed
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            My Educational Videos
            <Badge variant="secondary" className="text-xs font-normal">
              {videos.length}
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your personal video knowledge collection
          </p>
        </div>
        <Button
          size="sm"
          onClick={onOpenAddModal}
          className="bg-brand-gradient text-white shadow-glow text-xs"
        >
          + Add Video
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card/40 rounded-2xl border border-dashed border-border/80 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
            <FileVideo className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">No videos added yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Add a YouTube lecture URL or upload your educational video recordings to start asking grounded questions to your AI tutor.
          </p>
          <Button size="sm" onClick={onOpenAddModal} className="bg-brand-gradient text-white shadow-glow">
            Add Your First Video
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((vid) => {
            const isActive = vid.id === activeVideoId;
            const isYouTube = vid.sourceType === 'youtube';

            return (
              <div
                key={vid.id}
                className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 bg-card/80 backdrop-blur-sm ${
                  isActive
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : 'border-border/60 hover:border-primary/40 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Thumbnail / Header Preview */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/80 mb-3 border border-border/30">
                    {vid.thumbnailUrl ? (
                      <img
                        src={vid.thumbnailUrl}
                        alt={vid.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        {isYouTube ? (
                          <Youtube className="w-8 h-8 text-red-500 opacity-80" />
                        ) : (
                          <FileVideo className="w-8 h-8 text-primary opacity-80" />
                        )}
                      </div>
                    )}

                    {/* Source Badge */}
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 text-white backdrop-blur-md">
                        {isYouTube ? (
                          <>
                            <Youtube className="w-2.5 h-2.5 text-red-500" />
                            YouTube
                          </>
                        ) : (
                          <>
                            <FileVideo className="w-2.5 h-2.5 text-primary" />
                            Uploaded
                          </>
                        )}
                      </span>
                    </div>

                    {/* Duration Badge */}
                    {vid.durationSeconds > 0 && (
                      <div className="absolute bottom-2 right-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-black/80 text-white">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDuration(vid.durationSeconds)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title and Metadata */}
                  <h4 className="font-semibold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {vid.title}
                  </h4>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    {getStatusBadge(vid.status, vid.transcriptStatus)}

                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(vid.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
                  <Button
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => onSelectVideo(vid)}
                    className={`flex-1 h-8 text-xs font-medium ${
                      isActive ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <Play className="w-3 h-3 mr-1 fill-current" />
                    {isActive ? 'Currently Playing' : 'Open Video'}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete "${vid.title}"?`)) {
                        onDeleteVideo(vid.id);
                      }
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete Video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
