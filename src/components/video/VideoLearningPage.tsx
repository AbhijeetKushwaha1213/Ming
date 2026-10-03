import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { VideoRecord, TranscriptSegment } from '@/types/video';
import {
  fetchUserVideos,
  fetchVideoTranscript,
  deleteVideoById,
  processVideoById,
} from '@/api/videoAPI';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';
import { VideoTranscriptPanel } from './VideoTranscriptPanel';
import { VideoAITutorPanel } from './VideoAITutorPanel';
import { VideoLibrary } from './VideoLibrary';
import { AddVideoModal } from './AddVideoModal';
import {
  Video,
  Youtube,
  UploadCloud,
  FileVideo,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const VideoLearningPage: React.FC = () => {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoRecord | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(true);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const playerRef = useRef<VideoPlayerRef | null>(null);

  // Load videos on mount
  const loadVideos = useCallback(async (selectFirst = false) => {
    setIsLoadingVideos(true);
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
      console.error('Failed to load videos:', err);
      toast.error('Failed to load videos. Ensure local API is active.');
    } finally {
      setIsLoadingVideos(false);
    }
  }, [activeVideo]);

  useEffect(() => {
    loadVideos(true);
  }, []);

  // Load transcript when active video changes
  useEffect(() => {
    if (!activeVideo) {
      setTranscriptSegments([]);
      return;
    }

    // If activeVideo already has transcriptJson, parse immediately
    if (activeVideo.transcriptJson) {
      try {
        const segs = JSON.parse(activeVideo.transcriptJson);
        if (Array.isArray(segs) && segs.length > 0) {
          setTranscriptSegments(segs);
          return;
        }
      } catch {
        // fallback to fetch
      }
    }

    const loadTranscript = async () => {
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
  }, [activeVideo?.id, activeVideo?.transcriptJson]);

  // Handle Seek from Citations or Transcript
  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
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

      {/* Main Learning Hub: Video Player + AI Video Tutor */}
      {activeVideo ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Video Player */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground truncate">
                    {activeVideo.title}
                  </h2>
                  <Badge variant="secondary" className="text-[11px] uppercase font-semibold">
                    {activeVideo.sourceType === 'youtube' ? 'YouTube Embed' : 'Uploaded Video'}
                  </Badge>
                </div>
              </div>

              {/* Universal Video Player */}
              <VideoPlayer
                ref={playerRef}
                video={activeVideo}
                onTimeUpdate={(t) => setCurrentTime(t)}
                className="w-full shadow-xl"
              />

              {/* Transcript Section below player */}
              <VideoTranscriptPanel
                segments={transcriptSegments}
                currentTime={currentTime}
                onSeek={handleSeek}
                isLoading={isLoadingTranscript}
                transcriptStatus={activeVideo.transcriptStatus}
              />
            </div>

            {/* Right 5 Columns: Grounded AI Tutor */}
            <div className="lg:col-span-5 sticky top-20">
              <VideoAITutorPanel
                video={activeVideo}
                onSeek={handleSeek}
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
              Add a YouTube lecture or upload your video recordings. StudyMate will extract timestamped concepts and allow you to ask grounded questions.
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
      />
    </div>
  );
};
