import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Play, Pause, RotateCcw, Volume2, VolumeX, ShieldCheck, Video, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';

export interface VideoViewerProps {
  resourceId: string;
  timestampStart?: number | null;
  timestampEnd?: number | null;
  title?: string;
  excerpt?: string;
  className?: string;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({
  resourceId,
  timestampStart = 0,
  timestampEnd,
  title = 'Lecture Video',
  excerpt,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(timestampStart || 0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function loadVideo() {
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
          message: err.message || 'Failed to stream video resource.',
          statusCode,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVideo();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resourceId]);

  // Handle seeking to verified timestamp when metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      if (timestampStart !== null && timestampStart !== undefined && timestampStart > 0) {
        videoRef.current.currentTime = timestampStart;
        setCurrentTime(timestampStart);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      // If timestampEnd is specified and playback crosses it, pause at segment end
      if (timestampEnd && cur >= timestampEnd && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleJumpToStart = () => {
    if (videoRef.current && timestampStart !== null && timestampStart !== undefined) {
      videoRef.current.currentTime = timestampStart;
      setCurrentTime(timestampStart);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[520px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-foreground">Streaming lecture video...</p>
        <p className="text-xs text-muted-foreground mt-1">Seeking to verified timestamp {formatSeconds(timestampStart || 0)}...</p>
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
            ? 'Video Unavailable'
            : 'Error Loading Video'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          {isAuth
            ? 'Your active session has expired or is invalid. Please sign in to access this resource.'
            : isForbidden
            ? 'This resource belongs to another student workspace and cannot be accessed.'
            : isNotFound
            ? 'The cited video lecture has been removed, deleted, or relocated.'
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
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs gap-1 font-mono">
            <Video className="w-3.5 h-3.5" /> VIDEO
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        {/* Timestamp Highlight Badge */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100" onClick={handleJumpToStart}>
            <Clock className="w-3.5 h-3.5" /> Jump to Cited Segment ({formatSeconds(timestampStart || 0)})
          </Button>
        </div>
      </div>

      {/* Verified Evidence Callout Banner */}
      {excerpt && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-foreground/90 leading-tight">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Verified Evidence Timestamp:</span>{' '}
            <span className="font-mono text-emerald-800 dark:text-emerald-200">[{formatSeconds(timestampStart || 0)}{timestampEnd ? ` - ${formatSeconds(timestampEnd)}` : ''}]</span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {/* Video Canvas Area */}
      <div className="flex-1 bg-black flex flex-col justify-center items-center relative min-h-[400px]">
        {blobUrl && (
          <video
            ref={videoRef}
            src={blobUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            controls={false}
            className="w-full h-full max-h-[420px] object-contain"
            data-testid="video-player-element"
          />
        )}

        {/* Video Player Overlay Bar */}
        <div className="w-full bg-slate-900/90 text-white p-3 space-y-2 border-t border-white/10">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleTogglePlay}>
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </Button>

            <span className="text-xs font-mono text-white/90 min-w-[100px]">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>

            {/* Timeline Slider */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
