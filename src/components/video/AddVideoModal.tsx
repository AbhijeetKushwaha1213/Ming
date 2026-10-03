import React, { useState } from 'react';
import type { VideoRecord, TranscriptSegment } from '@/types/video';
import { addYouTubeVideo, uploadVideoFile } from '@/api/videoAPI';
import { isValidYouTubeUrl, extractYouTubeId } from '@/utils/videoUtils';
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
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoAdded: (video: VideoRecord) => void;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({
  isOpen,
  onClose,
  onVideoAdded,
}) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'upload'>('youtube');

  // YouTube Form State
  const [ytTitle, setYtTitle] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytTranscript, setYtTranscript] = useState('');
  const [ytError, setYtError] = useState<string | null>(null);
  const [isSubmittingYt, setIsSubmittingYt] = useState(false);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTranscript, setUploadTranscript] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setYtTitle('');
    setYtUrl('');
    setYtTranscript('');
    setYtError(null);
    setIsSubmittingYt(false);

    setUploadTitle('');
    setSelectedFile(null);
    setUploadTranscript('');
    setUploadProgress(0);
    setUploadError(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const extractedYtId = ytUrl.trim() ? extractYouTubeId(ytUrl.trim()) : null;

  const handleAddYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtError(null);

    const title = ytTitle.trim() || `YouTube Lecture (${extractedYtId || 'Video'})`;
    const url = ytUrl.trim();

    if (!url) {
      setYtError('Please enter a YouTube video URL.');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      setYtError('Invalid YouTube URL. Please provide a standard YouTube video or share link.');
      return;
    }

    setIsSubmittingYt(true);

    try {
      const video = await addYouTubeVideo(title, url, ytTranscript.trim() || undefined);
      onVideoAdded(video);
      handleClose();
    } catch (err: any) {
      setYtError(err.message || 'Failed to add YouTube video.');
    } finally {
      setIsSubmittingYt(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
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
      // Auto-populate title without extension
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadTitle(baseName);
    }
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

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
      setUploadError(err.message || 'Failed to upload video.');
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
                    onChange={(e) => setYtUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="text-xs h-9 bg-background/80"
                    disabled={isSubmittingYt}
                    required
                  />
                  {extractedYtId ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Valid Video ID: <code className="font-mono bg-muted px-1 rounded">{extractedYtId}</code>
                    </div>
                  ) : ytUrl.trim() ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Invalid YouTube link format
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="yt-title" className="text-xs font-semibold">
                    Lecture Title
                  </Label>
                  <Input
                    id="yt-title"
                    value={ytTitle}
                    onChange={(e) => setYtTitle(e.target.value)}
                    placeholder="e.g. Operating Systems: Paging & Virtual Memory"
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
                    StudyMate will index these timestamped segments into your personalized RAG knowledge base.
                  </p>
                </div>

                {ytError && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{ytError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmittingYt}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingYt || !ytUrl.trim() || !isValidYouTubeUrl(ytUrl.trim())}
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
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{uploadError}</span>
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
