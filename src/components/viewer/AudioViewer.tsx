import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Play, Pause, RotateCcw, Volume2, VolumeX, ShieldCheck, Headphones, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchResourceFile, ResourceAccessError } from '@/api/resourceAPI';

export interface AudioViewerProps {
  resourceId: string;
  timestampStart?: number | null;
  timestampEnd?: number | null;
  title?: string;
  excerpt?: string;
  className?: string;
}

export const AudioViewer: React.FC<AudioViewerProps> = ({
  resourceId,
  timestampStart = 0,
  timestampEnd,
  title = 'Audio Recording',
  excerpt,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(timestampStart || 0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function loadAudio() {
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
          message: err.message || 'Failed to stream audio resource.',
          statusCode,
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAudio();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resourceId]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      if (timestampStart !== null && timestampStart !== undefined && timestampStart > 0) {
        audioRef.current.currentTime = timestampStart;
        setCurrentTime(timestampStart);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      setCurrentTime(cur);

      if (timestampEnd && cur >= timestampEnd && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleJumpToStart = () => {
    if (audioRef.current && timestampStart !== null && timestampStart !== undefined) {
      audioRef.current.currentTime = timestampStart;
      setCurrentTime(timestampStart);
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleCycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[460px] bg-muted/20 rounded-xl border border-border p-6 ${className}`}>
        <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-foreground">Streaming audio lecture...</p>
        <p className="text-xs text-muted-foreground mt-1">Seeking to verified timestamp {formatSeconds(timestampStart || 0)}...</p>
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
            ? 'Audio Unavailable'
            : 'Error Loading Audio'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          {isAuth
            ? 'Your active session has expired or is invalid. Please sign in to access this resource.'
            : isForbidden
            ? 'This resource belongs to another student workspace and cannot be accessed.'
            : isNotFound
            ? 'The cited audio recording has been removed, deleted, or relocated.'
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
            <Headphones className="w-3.5 h-3.5" /> AUDIO
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100" onClick={handleJumpToStart}>
            <Clock className="w-3.5 h-3.5" /> Jump to Segment ({formatSeconds(timestampStart || 0)})
          </Button>
        </div>
      </div>

      {/* Verified Evidence Callout Banner */}
      {excerpt && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-start gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-foreground/90 leading-tight">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Verified Evidence Segment:</span>{' '}
            <span className="font-mono text-emerald-800 dark:text-emerald-200">[{formatSeconds(timestampStart || 0)}{timestampEnd ? ` - ${formatSeconds(timestampEnd)}` : ''}]</span>{' '}
            <span className="italic">"{excerpt}"</span>
          </div>
        </div>
      )}

      {/* Audio Visualizer & Player Area */}
      <div className="flex-1 p-8 bg-slate-900 text-white flex flex-col justify-center items-center min-h-[380px] space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-xl">
          <Headphones className="w-9 h-9 text-emerald-400" />
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-xs font-mono text-emerald-400">
            Anchor Timestamp: {formatSeconds(timestampStart || 0)}
          </p>
        </div>

        {blobUrl && (
          <audio
            ref={audioRef}
            src={blobUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            data-testid="audio-player-element"
          />
        )}

        {/* Audio Controls Bar */}
        <div className="w-full max-w-md bg-slate-800/90 rounded-2xl p-4 space-y-3 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/80 min-w-[45px] text-right">{formatSeconds(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-xs font-mono text-white/80 min-w-[45px]">{formatSeconds(duration)}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs font-mono text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleCycleSpeed}
            >
              {playbackSpeed}x
            </Button>

            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
              onClick={handleTogglePlay}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
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
