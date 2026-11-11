import React, { useState, useEffect, useContext } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import type { VideoRecord } from '@/types/video';
import { addYouTubeVideo, uploadVideoFile, isVideoAuthError } from '@/api/videoAPI';
import { parseYouTubeInput } from '@/utils/videoUtils';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Youtube,
  UploadCloud,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  LogIn,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const PENDING_VIDEO_DRAFT_KEY = 'ming_pending_video_draft';

export interface PendingVideoDraft {
  activeTab: 'youtube' | 'upload';
  ytUrl: string;
  ytTitle: string;
  ytTranscript: string;
  uploadTitle: string;
  uploadTranscript: string;
  savedAt: number;
}

export function hasPendingVideoDraft(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(sessionStorage.getItem(PENDING_VIDEO_DRAFT_KEY));
  } catch {
    return false;
  }
}

export interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoAdded: (video: VideoRecord) => void;
  onSignInRequest?: () => void;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({
  isOpen,
  onClose,
  onVideoAdded,
  onSignInRequest,
}) => {
  const navCtx = useContext(UNSAFE_NavigationContext);
  const [activeTab, setActiveTab] = useState<'youtube' | 'upload'>('youtube');

  // YouTube Form State
  const [ytTitle, setYtTitle] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytTranscript, setYtTranscript] = useState('');
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytAuthRequired, setYtAuthRequired] = useState(false);
  const [isSubmittingYt, setIsSubmittingYt] = useState(false);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTranscript, setUploadTranscript] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadAuthRequired, setUploadAuthRequired] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Restore saved draft if returning from sign-in redirect
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(PENDING_VIDEO_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as PendingVideoDraft;
      sessionStorage.removeItem(PENDING_VIDEO_DRAFT_KEY);
      if (draft.activeTab === 'youtube' || draft.activeTab === 'upload') {
        setActiveTab(draft.activeTab);
      }
      if (typeof draft.ytUrl === 'string') setYtUrl(draft.ytUrl);
      if (typeof draft.ytTitle === 'string') setYtTitle(draft.ytTitle);
      if (typeof draft.ytTranscript === 'string') setYtTranscript(draft.ytTranscript);
      if (typeof draft.uploadTitle === 'string') setUploadTitle(draft.uploadTitle);
      if (typeof draft.uploadTranscript === 'string') setUploadTranscript(draft.uploadTranscript);
      setYtError(null);
      setYtAuthRequired(false);
      setUploadError(null);
      setUploadAuthRequired(false);
    } catch {
      // Ignore invalid draft JSON
    }
  }, [isOpen]);

  const resetForm = () => {
    setYtTitle('');
    setYtUrl('');
    setYtTranscript('');
    setYtError(null);
    setYtAuthRequired(false);
    setIsSubmittingYt(false);

    setUploadTitle('');
    setSelectedFile(null);
    setUploadTranscript('');
    setUploadProgress(0);
    setUploadError(null);
    setUploadAuthRequired(false);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const saveDraftAndNavigateToSignIn = async () => {
    if (typeof window !== 'undefined') {
      try {
        const draft: PendingVideoDraft = {
          activeTab,
          ytUrl,
          ytTitle,
          ytTranscript,
          uploadTitle,
          uploadTranscript,
          savedAt: Date.now(),
        };
        sessionStorage.setItem(PENDING_VIDEO_DRAFT_KEY, JSON.stringify(draft));
        localStorage.removeItem('studymate_cached_profile');
        localStorage.removeItem('studymate-offline-session');
      } catch {
        // Ignore storage warnings
      }
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // Proceed to sign-in route even if remote signOut skipped
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ming-auth-signout'));
    }

    if (onSignInRequest) {
      onSignInRequest();
      return;
    }

    const target = '/login?redirect=%2Fdashboard%3Ftab%3Dvideo-learning';
    if (navCtx?.navigator && typeof navCtx.navigator.push === 'function') {
      navCtx.navigator.push(target);
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  };

  const parsedYt = ytUrl.trim() ? parseYouTubeInput(ytUrl, { allowBareId: false }) : null;
  const extractedYtId = parsedYt?.valid ? parsedYt.videoId : null;
  const normalizedCanonicalUrl = parsedYt?.valid ? parsedYt.canonicalUrl : null;

  const handleAddYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtError(null);
    setYtAuthRequired(false);

    const title = ytTitle.trim();
    const rawUrl = ytUrl.trim();
    const checked = parseYouTubeInput(rawUrl, { allowBareId: false });

    if (!checked.valid || !checked.canonicalUrl) {
      setYtError(
        checked.error ||
          'Invalid YouTube URL. Please provide a valid YouTube watch/share link or Markdown link.'
      );
      return;
    }

    setIsSubmittingYt(true);

    try {
      const video = await addYouTubeVideo(
        title,
        checked.canonicalUrl,
        ytTranscript.trim() || undefined
      );
      onVideoAdded(video);
      handleClose();
    } catch (err: any) {
      console.error('Failed to add YouTube video:', err);
      if (isVideoAuthError(err)) {
        setYtAuthRequired(true);
        setYtError(
          'Authentication required: your session has expired or you are signed out. Your video details are preserved—please sign in to continue.'
        );
      } else {
        setYtError(err.message || 'Failed to add YouTube video. Please try again.');
      }
    } finally {
      setIsSubmittingYt(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadAuthRequired(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    const validExtensions = ['.mp4', '.webm', '.mov'];
    const isValid = validExtensions.some((v) => ext.endsWith(v));

    if (!isValid) {
      setUploadError('Invalid format. Please upload MP4, WebM, or MOV video files.');
      setSelectedFile(null);
      return;
    }

    // 100MB limit check
    const maxSizeBytes = 100 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError(`File size exceeds the 100MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadTitle(baseName);
    }
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadAuthRequired(false);

    if (!selectedFile) {
      setUploadError('Please select a video file to upload.');
      return;
    }

    const title = uploadTitle.trim() || selectedFile.name;
    setIsUploading(true);
    setUploadProgress(5);

    try {
      const video = await uploadVideoFile(
        title,
        selectedFile,
        (progress) => setUploadProgress(progress),
        uploadTranscript.trim() || undefined
      );

      onVideoAdded(video);
      handleClose();
    } catch (err: any) {
      if (isVideoAuthError(err)) {
        setUploadAuthRequired(true);
        setUploadError(
          'Authentication required: your session has expired or you are signed out. Your selected file details are preserved—please sign in to continue.'
        );
      } else {
        setUploadError(err.message || 'Failed to upload video.');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/40">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Add Educational Video
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Embed a YouTube lecture or upload educational recordings to study with your AI tutor.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'youtube' | 'upload')}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="youtube" className="text-xs flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                YouTube URL
              </TabsTrigger>
              <TabsTrigger value="upload" className="text-xs flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-primary" />
                Upload Video File
              </TabsTrigger>
            </TabsList>

            {/* Tab A: YouTube */}
            <TabsContent value="youtube" className="space-y-4 m-0">
              <form onSubmit={handleAddYouTube} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="yt-url" className="text-xs font-semibold">
                    YouTube URL *
                  </Label>
                  <Input
                    id="yt-url"
                    value={ytUrl}
                    onChange={(e) => {
                      setYtUrl(e.target.value);
                      if (ytError) {
                        setYtError(null);
                        setYtAuthRequired(false);
                      }
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="text-xs h-9 bg-background/80"
                    disabled={isSubmittingYt}
                    required
                  />
                  {extractedYtId ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          Valid Video ID:{' '}
                          <code className="font-mono bg-muted px-1 rounded">{extractedYtId}</code>
                        </span>
                      </div>
                      {parsedYt?.wasMarkdown && normalizedCanonicalUrl && (
                        <div className="text-[11px] text-muted-foreground pl-5">
                          Normalized URL:{' '}
                          <code className="font-mono bg-muted px-1 rounded">
                            {normalizedCanonicalUrl}
                          </code>
                        </div>
                      )}
                    </div>
                  ) : ytUrl.trim() ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{parsedYt?.error || 'Invalid YouTube link format'}</span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="yt-title" className="text-xs font-semibold">
                    Lecture Title (optional)
                  </Label>
                  <Input
                    id="yt-title"
                    value={ytTitle}
                    onChange={(e) => setYtTitle(e.target.value)}
                    placeholder="Auto-fetched from YouTube if left blank"
                    className="text-xs h-9 bg-background/80"
                    disabled={isSubmittingYt}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="yt-transcript" className="text-xs font-semibold flex items-center justify-between">
                    <span>Optional Transcript / Lecture Notes</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Supports [mm:ss]</span>
                  </Label>
                  <Textarea
                    id="yt-transcript"
                    value={ytTranscript}
                    onChange={(e) => setYtTranscript(e.target.value)}
                    placeholder="[00:00] Welcome to lecture&#10;[02:15] Overview of virtual memory..."
                    className="text-xs min-h-[90px] font-mono bg-background/80 resize-none"
                    disabled={isSubmittingYt}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ming will index these timestamped segments into your personalized RAG knowledge base.
                  </p>
                </div>

                {ytError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{ytError}</span>
                    </div>
                    {ytAuthRequired && (
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={saveDraftAndNavigateToSignIn}
                          className="h-7 text-xs bg-primary text-primary-foreground"
                        >
                          <LogIn className="w-3.5 h-3.5 mr-1.5" />
                          Sign In
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmittingYt}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingYt || !parsedYt?.valid}
                    className="bg-brand-gradient text-white shadow-glow"
                  >
                    {isSubmittingYt ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Adding Video...
                      </>
                    ) : (
                      'Add YouTube Video'
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab B: Upload Video */}
            <TabsContent value="upload" className="space-y-4 m-0">
              <form onSubmit={handleUploadVideo} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Video File (MP4, WebM, MOV) *</Label>
                  <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-4 text-center bg-muted/10 relative">
                    <input
                      type="file"
                      accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <FileVideo className="w-8 h-8 text-primary mb-2 opacity-80" />
                      {selectedFile ? (
                        <div className="text-xs font-medium text-foreground">
                          <span className="font-semibold">{selectedFile.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-foreground">
                            Click or drag educational video here
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Max file size: 100MB (MP4, WebM, MOV)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="upload-title" className="text-xs font-semibold">
                    Lecture Title
                  </Label>
                  <Input
                    id="upload-title"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. CS201 - Data Structures Lecture 4"
                    className="text-xs h-9 bg-background/80"
                    disabled={isUploading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="upload-transcript" className="text-xs font-semibold flex items-center justify-between">
                    <span>Optional Transcript / Subtitles</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Auto-transcribed if omitted</span>
                  </Label>
                  <Textarea
                    id="upload-transcript"
                    value={uploadTranscript}
                    onChange={(e) => setUploadTranscript(e.target.value)}
                    placeholder="[00:00] In this lecture we discuss quicksort...&#10;[05:30] Partition algorithm..."
                    className="text-xs min-h-[80px] font-mono bg-background/80 resize-none"
                    disabled={isUploading}
                  />
                </div>

                {isUploading && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border/40">
                    <div className="flex justify-between text-xs font-medium text-foreground">
                      <span>Uploading video to secure storage...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5" />
                  </div>
                )}

                {uploadError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                    {uploadAuthRequired && (
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={saveDraftAndNavigateToSignIn}
                          className="h-7 text-xs bg-primary text-primary-foreground"
                        >
                          <LogIn className="w-3.5 h-3.5 mr-1.5" />
                          Sign In
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isUploading}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUploading || !selectedFile}
                    className="bg-brand-gradient text-white shadow-glow"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Uploading ({uploadProgress}%)...
                      </>
                    ) : (
                      'Upload & Process'
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
