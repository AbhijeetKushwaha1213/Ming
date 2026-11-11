import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import type { VideoRecord, TranscriptSegment } from '@/types/video';
import {
  fetchUserVideos,
  fetchVideoById,
  fetchVideoTranscript,
  deleteVideoById,
  processVideoById,
  isVideoAuthError,
} from '@/api/videoAPI';
import {
  formatDuration,
  verifyVideoEvidenceIntegrity,
  validateTranscriptSegments,
  type RuntimeVideoObservation,
} from '@/utils/videoUtils';
import { supabase } from '@/integrations/supabase/client';
import { VideoPlayer, type VideoPlayerRef, type VideoPlayerMetadata } from './VideoPlayer';
import { VideoTranscriptPanel } from './VideoTranscriptPanel';
import { VideoAITutorPanel } from './VideoAITutorPanel';
import { VideoLibrary } from './VideoLibrary';
import { AddVideoModal, hasPendingVideoDraft } from './AddVideoModal';
import {
  Video,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertTriangle,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const VideoLearningPage: React.FC = () => {
  const navCtx = useContext(UNSAFE_NavigationContext);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoRecord | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(true);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(() => hasPendingVideoDraft());
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'default' | 'expanded-left'>('default');
  const [authError, setAuthError] = useState<string | null>(null);
  const [runtimeObsByVideo, setRuntimeObsByVideo] = useState<Record<string, RuntimeVideoObservation>>({});

  const playerRef = useRef<VideoPlayerRef | null>(null);

  const navigateToSignIn = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('studymate_cached_profile');
        localStorage.removeItem('studymate-offline-session');
      } catch {
        // Ignore storage warnings
      }
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Continue redirect even if signOut skipped
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ming-auth-signout'));
    }
    const target = '/login?redirect=%2Fdashboard%3Ftab%3Dvideo-learning';
    if (navCtx?.navigator && typeof navCtx.navigator.push === 'function') {
      navCtx.navigator.push(target);
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  }, [navCtx]);

  // Load videos on mount
  const loadVideos = useCallback(async (selectFirst = false) => {
    setIsLoadingVideos(true);
    setAuthError(null);
    try {
      const list = await fetchUserVideos();
      setVideos(list);

      if (selectFirst && list.length > 0 && !activeVideo) {
        setActiveVideo(list[0]);
      } else if (activeVideo) {
        // Refresh active video record
        const found = list.find((v) => v.id === activeVideo.id);
        if (found) setActiveVideo(found);
      }
    } catch (err: any) {
      if (isVideoAuthError(err)) {
        setAuthError('Please sign in to view your saved videos and add lectures.');
        setVideos([]);
        setActiveVideo(null);
      } else {
        console.warn('Video fetch notice:', err);
      }
    } finally {
      setIsLoadingVideos(false);
    }
  }, [activeVideo]);

  useEffect(() => {
    loadVideos(true);
  }, []);

  // Poll active video while backend background caption/metadata extraction is running
  useEffect(() => {
    if (!activeVideo) return;
    const isProcessing =
      activeVideo.status === 'processing' ||
      activeVideo.status === 'pending' ||
      activeVideo.transcriptStatus === 'processing';
    if (!isProcessing) return;

    let cancelled = false;
    const pollTimer = setInterval(async () => {
      try {
        const latest = await fetchVideoById(activeVideo.id);
        if (cancelled) return;
        setVideos((prev) => prev.map((v) => (v.id === latest.id ? latest : v)));
        setActiveVideo((curr) => (curr && curr.id === latest.id ? latest : curr));
      } catch {
        // Transient polling error; retry on next tick
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
    };
  }, [activeVideo?.id, activeVideo?.status, activeVideo?.transcriptStatus]);

  // Load transcript when active video changes or finishes extracting
  useEffect(() => {
    if (!activeVideo) {
      setTranscriptSegments([]);
      setIsLoadingTranscript(false);
      return;
    }

    // If activeVideo already has transcriptJson, parse immediately
    if (activeVideo.transcriptJson) {
      try {
        const segs = JSON.parse(activeVideo.transcriptJson);
        if (Array.isArray(segs) && segs.length > 0) {
          setTranscriptSegments(segs);
          setIsLoadingTranscript(false);
          return;
        }
      } catch {
        // fallback to fetch
      }
    }

    if (activeVideo.transcriptStatus === 'processing' || activeVideo.transcriptStatus === 'unavailable' || activeVideo.transcriptStatus === 'failed') {
      setTranscriptSegments([]);
      setIsLoadingTranscript(false);
      return;
    }

    const loadTranscript = async () => {
      setTranscriptSegments([]);
      setIsLoadingTranscript(true);
      try {
        const segs = await fetchVideoTranscript(activeVideo.id);
        setTranscriptSegments(segs);
      } catch (err) {
        console.warn('Could not fetch transcript segments:', err);
        setTranscriptSegments([]);
      } finally {
        setIsLoadingTranscript(false);
      }
    };

    loadTranscript();
  }, [activeVideo?.id, activeVideo?.transcriptJson, activeVideo?.transcriptStatus]);

  // Handle Seek from Citations or Transcript
  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
    }
  };

  const handlePlayerDurationChange = useCallback(
    (dur: number) => {
      if (!activeVideo || !isFinite(dur) || dur <= 0) return;
      const vidId = activeVideo.id;
      setRuntimeObsByVideo((prev) => ({
        ...prev,
        [vidId]: {
          ...prev[vidId],
          durationSeconds: dur,
        },
      }));
    },
    [activeVideo?.id]
  );

  const handlePlayerMetadata = useCallback(
    (meta: VideoPlayerMetadata) => {
      if (!activeVideo) return;
      const vidId = activeVideo.id;
      setRuntimeObsByVideo((prev) => ({
        ...prev,
        [vidId]: {
          ...prev[vidId],
          embedVideoId: meta.videoId ?? prev[vidId]?.embedVideoId,
          videoTitle: meta.title ?? prev[vidId]?.videoTitle,
          durationSeconds:
            meta.duration && meta.duration > 0
              ? meta.duration
              : prev[vidId]?.durationSeconds,
        },
      }));
    },
    [activeVideo?.id]
  );

  const activeRuntimeObs = activeVideo ? runtimeObsByVideo[activeVideo.id] : undefined;

  const activeIntegrity = useMemo(
    () =>
      verifyVideoEvidenceIntegrity(
        activeVideo,
        transcriptSegments.length > 0 ? transcriptSegments : undefined,
        activeRuntimeObs
      ),
    [activeVideo, transcriptSegments, activeRuntimeObs]
  );

  const safeTranscriptSegments = useMemo(() => {
    if (!activeVideo || !activeIntegrity.valid) return [];
    if (transcriptSegments.length === 0) return [];
    const val = validateTranscriptSegments(
      transcriptSegments,
      activeIntegrity.effectiveDurationSeconds
    );
    return val.valid && val.segments ? val.segments : [];
  }, [
    activeVideo,
    activeIntegrity.valid,
    activeIntegrity.effectiveDurationSeconds,
    transcriptSegments,
  ]);

  // Generate / Extract transcript on-demand
  const handleGenerateTranscript = async () => {
    if (!activeVideo || isGeneratingTranscript) return;
    setIsGeneratingTranscript(true);
    try {
      toast.info(`Generating transcript and indexing "${activeVideo.title}"...`);
      const updated = await processVideoById(activeVideo.id);
      setActiveVideo(updated);
      setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      if (updated.transcriptJson) {
        try {
          const segs = JSON.parse(updated.transcriptJson);
          setTranscriptSegments(segs);
        } catch {}
      }
      toast.success(`"${updated.title}" successfully indexed into Ming RAG!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate transcript');
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  // Handle video creation
  const handleVideoAdded = (newVideo: VideoRecord) => {
    setVideos((prev) => [newVideo, ...prev]);
    setActiveVideo(newVideo);
    toast.success(`"${newVideo.title}" added successfully!`);
  };

  // Handle video deletion
  const handleDeleteVideo = async (videoId: string) => {
    try {
      await deleteVideoById(videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      if (activeVideo?.id === videoId) {
        const remaining = videos.filter((v) => v.id !== videoId);
        setActiveVideo(remaining.length > 0 ? remaining[0] : null);
      }
      toast.success('Video deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete video.');
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 space-y-8 animate-fade-in">
      {/* Top Banner / Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/50 shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-glow">
              <Video className="w-5 h-5" />
            </div>
            <h1 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Video Learning
            </h1>
            <Badge variant="outline" className="text-xs font-medium border-primary/30 text-primary">
              Multimodal RAG
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
            Watch educational lectures, inspect auto-synchronized timestamped transcripts, and study with your grounded AI tutor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadVideos(false)}
            className="h-9 px-3 text-xs"
            title="Refresh videos"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-4 bg-brand-gradient text-white shadow-glow text-xs font-semibold"
          >
            + Add Video
          </Button>
        </div>
      </div>

      {/* Authentication Warning Banner */}
      {authError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs md:text-sm font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
          <Button size="sm" onClick={navigateToSignIn} className="h-8 text-xs">
            <LogIn className="w-3.5 h-3.5 mr-1.5" />
            Sign In
          </Button>
        </div>
      )}

      {/* Main Learning Hub: Video Player + AI Video Tutor */}
      {activeVideo ? (
        <div className="space-y-6">
          {!activeIntegrity.valid && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-start gap-2.5 text-xs"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Source Integrity Notice — Ungrounded Mode Active
                </p>
                <p className="opacity-90 mt-0.5">
                  {activeIntegrity.error ||
                    'Transcript or metadata conflicts with the active embedded video. Grounded citations and mismatched timestamps have been withheld.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 items-start transition-all duration-300">
            {/* Left Study Workspace (Video Player + Transcript) */}
            <div className="flex-1 min-w-0 w-full space-y-4 transition-all duration-300">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-base font-bold text-foreground truncate">
                        {activeVideo.title}
                      </h2>
                      <Badge variant="secondary" className="text-[11px] uppercase font-semibold flex-shrink-0">
                        {activeVideo.sourceType === 'youtube' ? 'YouTube Embed' : 'Uploaded Video'}
                      </Badge>
                    </div>
                    {(activeVideo.channelName || activeVideo.durationSeconds > 0 || activeVideo.captionLanguage || activeVideo.extractionStatus) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {activeVideo.channelName && (
                          <span className="font-medium text-foreground/80">
                            {activeVideo.channelName}
                          </span>
                        )}
                        {activeVideo.durationSeconds > 0 && (
                          <span>
                            • {formatDuration(activeVideo.durationSeconds)}
                            {activeVideo.durationSource ? ` (${activeVideo.durationSource})` : ''}
                          </span>
                        )}
                        {activeVideo.captionLanguage && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            Captions: {activeVideo.captionLanguageName || activeVideo.captionLanguage}
                            {activeVideo.captionKind ? ` (${activeVideo.captionKind})` : ''}
                          </Badge>
                        )}
                        {activeVideo.captionProvider && activeVideo.captionProvider !== 'none' && (
                          <span className="font-mono text-[10px] opacity-80">
                            via {activeVideo.captionProvider}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mode Toggle Control */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'expanded-left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setViewMode((m) => (m === 'expanded-left' ? 'default' : 'expanded-left'))
                      }
                      aria-pressed={viewMode === 'expanded-left'}
                      aria-label={viewMode === 'expanded-left' ? 'Restore default view' : 'Expand left pane'}
                      title={
                        viewMode === 'expanded-left'
                          ? 'Restore standard view'
                          : 'Expand left workspace for larger video view'
                      }
                      className={`h-8 px-2.5 text-xs font-medium transition-all ${
                        viewMode === 'expanded-left'
                          ? 'bg-primary text-primary-foreground shadow-glow'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      {viewMode === 'expanded-left' ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5 mr-1.5" />
                          Standard View
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                          Expand Left Pane
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Dynamic Study Workspace:
                  In default mode, video and transcript sit side-by-side inside the left study pane.
                  In expanded-left mode, the video expands to full width and the transcript stacks below.
                  The VideoPlayer remains in the same DOM branch so playback time and play/pause state are preserved without remounting. */}
              <div
                className={`transition-all duration-300 ${
                  viewMode === 'expanded-left'
                    ? 'space-y-4'
                    : 'grid grid-cols-1 xl:grid-cols-12 gap-4 items-start'
                }`}
              >
                <div
                  className={`transition-all duration-300 ${
                    viewMode === 'expanded-left' ? 'w-full' : 'xl:col-span-7'
                  }`}
                >
                  <VideoPlayer
                    ref={playerRef}
                    video={activeVideo}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onDurationChange={handlePlayerDurationChange}
                    onPlayerMetadata={handlePlayerMetadata}
                    className="w-full shadow-xl"
                  />
                </div>

                <div
                  className={`transition-all duration-300 ${
                    viewMode === 'expanded-left' ? 'w-full' : 'xl:col-span-5'
                  }`}
                >
                  <VideoTranscriptPanel
                    segments={safeTranscriptSegments}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    isLoading={isLoadingTranscript}
                    isGenerating={isGeneratingTranscript}
                    onGenerateTranscript={handleGenerateTranscript}
                    transcriptStatus={
                      activeIntegrity.valid ? activeVideo.transcriptStatus : 'unavailable'
                    }
                    captionLanguage={activeVideo.captionLanguage}
                    captionLanguageName={activeVideo.captionLanguageName}
                    captionKind={activeVideo.captionKind}
                    isAutoGenerated={activeVideo.isAutoGenerated}
                    captionProvider={activeVideo.captionProvider}
                    errorMessage={activeVideo.errorMessage}
                    integrityError={
                      !activeIntegrity.valid
                        ? activeIntegrity.error || 'Video evidence integrity check failed'
                        : null
                    }
                  />
                </div>
              </div>
            </div>

            {/* Right: Grounded AI Tutor - Retains exact width, position, and full usability */}
            <div className="w-full lg:w-[420px] lg:flex-shrink-0 sticky top-20 transition-all duration-300">
              <VideoAITutorPanel
                key={activeVideo.id}
                video={activeVideo}
                onSeek={handleSeek}
                integrityError={
                  !activeIntegrity.valid
                    ? activeIntegrity.error || 'Video evidence integrity check failed'
                    : null
                }
                runtimeDurationSeconds={activeRuntimeObs?.durationSeconds ?? null}
                className="h-[680px] shadow-lg"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Empty Welcome State */
        <div className="p-12 text-center rounded-3xl bg-card/40 border border-dashed border-border/80 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
            <Video className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Welcome to Video Learning</h2>
            <p className="text-xs md:text-sm text-muted-foreground max-w-md">
              Add a YouTube lecture or upload your video recordings. Ming will extract timestamped concepts and allow you to ask grounded questions.
            </p>
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-brand-gradient text-white shadow-glow px-5"
          >
            + Add Your First Video
          </Button>
        </div>
      )}

      {/* Video Library: "My Videos" Section */}
      <div className="pt-6 border-t border-border/40">
        <VideoLibrary
          videos={videos}
          activeVideoId={activeVideo?.id}
          onSelectVideo={(v) => {
            setActiveVideo(v);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDeleteVideo={handleDeleteVideo}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          isLoading={isLoadingVideos}
        />
      </div>

      {/* Modal for adding YouTube / Uploading Video */}
      <AddVideoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onVideoAdded={handleVideoAdded}
        onSignInRequest={navigateToSignIn}
      />
    </div>
  );
};
