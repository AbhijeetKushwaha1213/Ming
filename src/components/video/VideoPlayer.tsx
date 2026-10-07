import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import type { VideoRecord } from '@/types/video';
import { Play, Pause, RotateCcw, Volume2, Maximize, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export interface VideoPlayerProps {
  video: VideoRecord;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnded?: () => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ video, onTimeUpdate, onDurationChange, onEnded, className = '' }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(video.durationSeconds || 0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);

    // Keep currentTime ref for sync reads
    const currentTimeRef = useRef<number>(0);
    currentTimeRef.current = currentTime;

    const durationRef = useRef<number>(duration);
    durationRef.current = duration;

    // Imperative control handle
    useImperativeHandle(ref, () => ({
      play: () => {
        if (video.sourceType === 'upload' && videoRef.current) {
          videoRef.current.play().catch(() => {});
        } else if (video.sourceType === 'youtube' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
          setIsPlaying(true);
        }
      },
      pause: () => {
        if (video.sourceType === 'upload' && videoRef.current) {
          videoRef.current.pause();
        } else if (video.sourceType === 'youtube' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
          setIsPlaying(false);
        }
      },
      seekTo: (seconds: number) => {
        const targetSec = Math.max(0, seconds);
        if (video.sourceType === 'upload' && videoRef.current) {
          videoRef.current.currentTime = targetSec;
          setCurrentTime(targetSec);
          if (onTimeUpdate) onTimeUpdate(targetSec);
          videoRef.current.play().catch(() => {});
        } else if (video.sourceType === 'youtube' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [targetSec, true] }),
            '*'
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
          setCurrentTime(targetSec);
          if (onTimeUpdate) onTimeUpdate(targetSec);
          setIsPlaying(true);
        }
      },
      getCurrentTime: () => currentTimeRef.current,
      getDuration: () => durationRef.current,
    }));

    // Reset when video changes
    useEffect(() => {
      setCurrentTime(0);
      setDuration(video.durationSeconds || 0);
      setIsPlaying(false);
      setHasError(false);
    }, [video.id, video.sourceType]);

    // YouTube iframe message listener
    useEffect(() => {
      if (video.sourceType !== 'youtube') return;

      const handleMessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return;
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'infoDelivery' && data.info) {
            if (typeof data.info.currentTime === 'number') {
              const cur = data.info.currentTime;
              setCurrentTime(cur);
              if (onTimeUpdate) onTimeUpdate(cur);
            }
            if (typeof data.info.duration === 'number' && data.info.duration > 0) {
              setDuration(data.info.duration);
              if (onDurationChange) onDurationChange(data.info.duration);
            }
            if (data.info.playerState === 1) setIsPlaying(true);
            if (data.info.playerState === 2) setIsPlaying(false);
            if (data.info.playerState === 0) {
              setIsPlaying(false);
              if (onEnded) onEnded();
            }
          }
        } catch {
          // Non-JSON message from iframe
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [video.sourceType, onTimeUpdate, onDurationChange, onEnded]);

    // Handle HTML5 video events
    const handleNativeTimeUpdate = () => {
      if (videoRef.current) {
        const cur = videoRef.current.currentTime;
        setCurrentTime(cur);
        if (onTimeUpdate) onTimeUpdate(cur);
      }
    };

    const handleNativeLoadedMetadata = () => {
      if (videoRef.current) {
        const dur = videoRef.current.duration;
        setDuration(dur);
        if (onDurationChange) onDurationChange(dur);
      }
    };

    const handleNativeEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };

    const isYouTube = video.sourceType === 'youtube';
    const ytVideoId = video.youtubeVideoId || (video.youtubeUrl ? extractYouTubeId(video.youtubeUrl) : null);

    return (
      <div
        className={`relative w-full aspect-video bg-black/95 rounded-2xl overflow-hidden shadow-2xl border border-border/40 ${className}`}
      >
        {isYouTube ? (
          ytVideoId ? (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${ytVideoId}?enablejsapi=1&rel=0&modestbranding=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
              <AlertCircle className="w-12 h-12 text-destructive mb-3" />
              <p className="font-semibold text-foreground">Invalid YouTube Video ID</p>
              <p className="text-sm text-muted-foreground mt-1">
                Unable to load embedded video. Check that the YouTube URL is valid.
              </p>
            </div>
          )
        ) : (
          <video
            ref={videoRef}
            src={`/api/videos/${encodeURIComponent(video.id)}/stream`}
            controls
            playsInline
            className="w-full h-full object-contain"
            onTimeUpdate={handleNativeTimeUpdate}
            onLoadedMetadata={handleNativeLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleNativeEnded}
            onError={() => setHasError(true)}
          />
        )}

        {hasError && !isYouTube && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-3" />
            <p className="font-semibold text-foreground">Unable to play video</p>
            <p className="text-sm text-muted-foreground mt-1">
              The uploaded video stream could not be loaded or is currently processing.
            </p>
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}
