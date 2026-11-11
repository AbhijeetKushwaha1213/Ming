import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import type { VideoRecord } from '@/types/video';
import { extractYouTubeId } from '@/utils/videoUtils';
import { AlertCircle } from 'lucide-react';

export interface VideoPlayerMetadata {
  videoId?: string | null;
  duration?: number | null;
  title?: string | null;
}

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
  onPlayerMetadata?: (meta: VideoPlayerMetadata) => void;
  onEnded?: () => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ video, onTimeUpdate, onDurationChange, onPlayerMetadata, onEnded, className = '' }, ref) => {
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

    const ytPlayerReadyRef = useRef<boolean>(false);
    const pendingYtSeekRef = useRef<number | null>(null);
    const recentExplicitSeekRef = useRef<{ target: number; ts: number } | null>(null);
    const ytHandshakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopYouTubeHandshake = () => {
      if (ytHandshakeTimerRef.current) {
        clearInterval(ytHandshakeTimerRef.current);
        ytHandshakeTimerRef.current = null;
      }
    };

    const sendYouTubeListeningHandshake = () => {
      try {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage(
          JSON.stringify({ event: 'listening', id: video.id, channel: 'widget' }),
          '*'
        );
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onReady'] }),
          '*'
        );
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
          '*'
        );
      } catch {
        // Cross-origin postMessage handshake skipped
      }
    };

    const dispatchYouTubeSeek = (targetSec: number) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [targetSec, true] }),
        '*'
      );
      win.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
    };

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
        recentExplicitSeekRef.current = { target: targetSec, ts: Date.now() };
        if (video.sourceType === 'upload' && videoRef.current) {
          videoRef.current.currentTime = targetSec;
          setCurrentTime(targetSec);
          if (onTimeUpdate) onTimeUpdate(targetSec);
          videoRef.current.play().catch(() => {});
        } else if (video.sourceType === 'youtube') {
          if (!ytPlayerReadyRef.current) {
            pendingYtSeekRef.current = targetSec;
          }
          dispatchYouTubeSeek(targetSec);
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
      ytPlayerReadyRef.current = false;
      pendingYtSeekRef.current = null;
      recentExplicitSeekRef.current = null;
      stopYouTubeHandshake();
      return () => stopYouTubeHandshake();
    }, [video.id, video.sourceType]);

    // Send YouTube JS API listening handshake when iframe finishes loading (retry briefly until widget responds)
    const handleIframeLoad = () => {
      sendYouTubeListeningHandshake();
      stopYouTubeHandshake();
      let attempts = 0;
      ytHandshakeTimerRef.current = setInterval(() => {
        attempts += 1;
        if (ytPlayerReadyRef.current || attempts >= 20) {
          stopYouTubeHandshake();
          return;
        }
        sendYouTubeListeningHandshake();
      }, 300);
    };

    // YouTube iframe message listener
    useEffect(() => {
      if (video.sourceType !== 'youtube') return;

      const handleMessage = (event: MessageEvent) => {
        if (
          event.origin &&
          typeof window !== 'undefined' &&
          event.origin !== window.location.origin &&
          !/^https:\/\/(www\.)?(youtube|youtube-nocookie)\.com$/i.test(event.origin)
        ) {
          return;
        }
        if (typeof event.data !== 'string') return;
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'onReady' || data.event === 'initialDelivery') {
            ytPlayerReadyRef.current = true;
            stopYouTubeHandshake();
            if (pendingYtSeekRef.current !== null) {
              const target = pendingYtSeekRef.current;
              pendingYtSeekRef.current = null;
              dispatchYouTubeSeek(target);
            }
          }
          if ((data.event === 'infoDelivery' || data.event === 'initialDelivery') && data.info) {
            ytPlayerReadyRef.current = true;
            stopYouTubeHandshake();
            if (typeof data.info.currentTime === 'number') {
              const cur = data.info.currentTime;
              const recentSeek = recentExplicitSeekRef.current;
              const isStaleZeroAfterSeek =
                recentSeek &&
                Date.now() - recentSeek.ts < 1500 &&
                recentSeek.target > 2 &&
                cur < 1;
              if (!isStaleZeroAfterSeek) {
                setCurrentTime(cur);
                if (onTimeUpdate) onTimeUpdate(cur);
              }
            }
            if (typeof data.info.duration === 'number' && data.info.duration > 0) {
              setDuration(data.info.duration);
              if (onDurationChange) onDurationChange(data.info.duration);
            }
            if (data.info.videoData || typeof data.info.duration === 'number') {
              if (onPlayerMetadata) {
                onPlayerMetadata({
                  videoId: data.info.videoData?.video_id || null,
                  title: data.info.videoData?.title || null,
                  duration:
                    typeof data.info.duration === 'number' && data.info.duration > 0
                      ? data.info.duration
                      : null,
                });
              }
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
    }, [video.sourceType, onTimeUpdate, onDurationChange, onPlayerMetadata, onEnded]);

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
        if (onPlayerMetadata && isFinite(dur) && dur > 0) {
          onPlayerMetadata({ duration: dur });
        }
      }
    };

    const handleNativeEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };

    const isYouTube = video.sourceType === 'youtube';
    const urlYtId = video.youtubeUrl ? extractYouTubeId(video.youtubeUrl, false) : null;
    const hasUrlIdConflict = Boolean(
      video.youtubeUrl && video.youtubeVideoId && urlYtId && urlYtId !== video.youtubeVideoId
    );
    const ytVideoId = hasUrlIdConflict ? null : video.youtubeVideoId || urlYtId;
    const originQuery =
      typeof window !== 'undefined' &&
      window.location?.origin &&
      /^https?:\/\//i.test(window.location.origin)
        ? `&origin=${encodeURIComponent(window.location.origin)}`
        : '';

    return (
      <div
        className={`relative w-full aspect-video bg-black/95 rounded-2xl overflow-hidden shadow-2xl border border-border/40 ${className}`}
      >
        {isYouTube ? (
          ytVideoId ? (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${ytVideoId}?enablejsapi=1&rel=0&modestbranding=1${originQuery}`}
              title={video.title}
              onLoad={handleIframeLoad}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
              <AlertCircle className="w-12 h-12 text-destructive mb-3" />
              <p className="font-semibold text-foreground">
                {hasUrlIdConflict ? 'YouTube Source Mismatch' : 'Invalid YouTube Video ID'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasUrlIdConflict
                  ? 'Stored YouTube URL and embedded video ID disagree. Playback is blocked until corrected.'
                  : 'Unable to load embedded video. Check that the YouTube URL is valid.'}
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
