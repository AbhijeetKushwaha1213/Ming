import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  extractYouTubeId,
  isValidYouTubeUrl,
  parseYouTubeInput,
  normalizeYouTubeUrl,
  isKnownMismatchedVideoRecord,
  verifyVideoEvidenceIntegrity,
  formatTimestamp,
  parseTimestamp,
  formatDuration,
  extractTimestampCitations,
  validateTranscriptSegments,
  isSyntheticOrInvalidTranscript,
  MEDIA_START_TOLERANCE_SECONDS,
  CAPTION_CUE_END_TOLERANCE_SECONDS,
} from '@/utils/videoUtils';
import {
  fetchUserVideos,
  fetchVideoById,
  addYouTubeVideo,
  uploadVideoFile,
  deleteVideoById,
  processVideoById,
  fetchVideoTranscript,
  askVideoQuestion,
  getStoredVideos,
  VideoAuthError,
  isVideoAuthError,
} from '@/api/videoAPI';
import { supabase } from '@/integrations/supabase/client';
import { AddVideoModal, PENDING_VIDEO_DRAFT_KEY } from '@/components/video/AddVideoModal';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { VideoAITutorPanel } from '@/components/video/VideoAITutorPanel';
import { VideoTranscriptPanel } from '@/components/video/VideoTranscriptPanel';
import { VideoLearningPage } from '@/components/video/VideoLearningPage';
import type { VideoRecord, TranscriptSegment } from '@/types/video';

describe('Ming Video Learning Feature Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------
  // Test 1: YouTube URL Validation
  // ----------------------------------------------------
  describe('1. YouTube URL Validation', () => {
    it('validates various valid YouTube URL formats', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be')).toBe(true);
    });

    it('rejects invalid or non-YouTube URLs', () => {
      expect(isValidYouTubeUrl('')).toBe(false);
      expect(isValidYouTubeUrl('https://vimeo.com/12345678')).toBe(false);
      expect(isValidYouTubeUrl('https://google.com')).toBe(false);
      expect(isValidYouTubeUrl('not_a_url')).toBe(false);
      expect(isValidYouTubeUrl('https://youtube.com/watch?v=short')).toBe(false); // < 11 chars
    });
  });

  // ----------------------------------------------------
  // Test 2: YouTube Video ID Extraction
  // ----------------------------------------------------
  describe('2. YouTube Video ID Extraction', () => {
    it('extracts exactly the 11-character video ID from diverse URL schemes', () => {
      const expectedId = 'dQw4w9WgXcQ';
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expectedId);
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe(expectedId);
      expect(extractYouTubeId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(expectedId);
      expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(expectedId);
      expect(extractYouTubeId('dQw4w9WgXcQ')).toBe(expectedId);
    });
  });

  // ----------------------------------------------------
  // Test 3: Uploaded Video Validation
  // ----------------------------------------------------
  describe('3. Uploaded Video Validation', () => {
    it('accepts supported educational video formats (MP4, WebM, MOV)', () => {
      const allowed = ['lecture.mp4', 'recording.webm', 'demo.mov', 'class.m4v'];
      const extRegex = /\.(mp4|webm|mov|m4v)$/i;
      allowed.forEach((f) => {
        expect(extRegex.test(f)).toBe(true);
      });
    });

    it('rejects unsupported extensions and executables', () => {
      const disallowed = ['script.sh', 'app.exe', 'notes.txt', 'image.png'];
      const extRegex = /\.(mp4|webm|mov|m4v)$/i;
      disallowed.forEach((f) => {
        expect(extRegex.test(f)).toBe(false);
      });
    });

    it('enforces size limit validation (under 100MB threshold)', () => {
      const maxAllowedBytes = 100 * 1024 * 1024;
      const validSize = 50 * 1024 * 1024;
      const oversized = 105 * 1024 * 1024;

      expect(validSize <= maxAllowedBytes).toBe(true);
      expect(oversized <= maxAllowedBytes).toBe(false);
    });
  });

  // ----------------------------------------------------
  // Test 4: Video Metadata Creation
  // ----------------------------------------------------
  describe('4. Video Metadata Creation', () => {
    it('creates a YouTube video record with proper initial metadata', async () => {
      const mockVideo: VideoRecord = {
        id: 'vid_yt_123',
        userId: 'student_1',
        title: 'Operating Systems: Paging',
        sourceType: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        status: 'ready',
        durationSeconds: 720,
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        transcriptStatus: 'ready',
        transcriptJson: JSON.stringify([
          { start: 0, end: 45, text: 'Welcome to Operating Systems' },
        ]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, video: mockVideo }),
      } as any);

      const created = await addYouTubeVideo(
        'Operating Systems: Paging',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );

      expect(created.id).toBe('vid_yt_123');
      expect(created.sourceType).toBe('youtube');
      expect(created.youtubeVideoId).toBe('dQw4w9WgXcQ');
      expect(created.status).toBe('ready');
    });
  });

  // ----------------------------------------------------
  // Test 5: User Isolation
  // ----------------------------------------------------
  describe('5. User Isolation & Security', () => {
    it('rejects access when user requests a video owned by another user', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Video not found or access denied' }),
      } as any);

      await expect(fetchVideoById('vid_other_user_private')).rejects.toThrow(
        /not found or access denied/i
      );
    });

    it('rejects deletion of another user video', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Video not found or access denied' }),
      } as any);

      await expect(deleteVideoById('vid_other_user')).rejects.toThrow(
        /not found or access denied/i
      );
    });
  });

  // ----------------------------------------------------
  // Test 6: Transcript Timestamp Parsing
  // ----------------------------------------------------
  describe('6. Transcript Timestamp Parsing', () => {
    it('correctly parses [mm:ss] and [hh:mm:ss] format into seconds', () => {
      expect(parseTimestamp('[00:00]')).toBe(0);
      expect(parseTimestamp('[02:15]')).toBe(135);
      expect(parseTimestamp('12:00')).toBe(720);
      expect(parseTimestamp('[01:10:30]')).toBe(4230);
    });

    it('formats seconds into readable timestamp strings', () => {
      expect(formatTimestamp(0)).toBe('0:00');
      expect(formatTimestamp(135)).toBe('2:15');
      expect(formatTimestamp(720)).toBe('12:00');
      expect(formatTimestamp(4230)).toBe('1:10:30');
    });

    it('formats duration with fallback for zero or negative values', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(-10)).toBe('0:00');
      expect(formatDuration(360)).toBe('6:00');
    });
  });

  // ----------------------------------------------------
  // Test 7: Transcript Chunk Metadata
  // ----------------------------------------------------
  describe('7. Transcript Chunk Metadata', () => {
    it('verifies transcript chunk structure includes all mandatory fields', () => {
      const mockChunk = {
        chunk_id: 'vid_os_t720_c1',
        video_id: 'vid_os_1',
        user_id: 'student_1',
        source_type: 'VIDEO',
        start_time: 720.4,
        end_time: 746.8,
        text: 'Paging divides memory into fixed-size pages and physical memory into frames.',
      };

      expect(mockChunk.video_id).toBeDefined();
      expect(mockChunk.user_id).toBe('student_1');
      expect(mockChunk.source_type).toBe('VIDEO');
      expect(mockChunk.start_time).toBe(720.4);
      expect(mockChunk.end_time).toBe(746.8);
      expect(mockChunk.chunk_id).toContain('vid_os');
    });
  });

  // ----------------------------------------------------
  // Test 8: Video RAG Retrieval
  // ----------------------------------------------------
  describe('8. Video RAG Retrieval with Timestamps', () => {
    it('distinguishes source_type: video and retains timestamp boundaries', async () => {
      const mockTranscriptSegments: TranscriptSegment[] = [
        {
          start: 720.0,
          end: 746.0,
          text: 'Paging divides memory into fixed-size pages called frames.',
          topic: 'Virtual Memory',
          subtopic: 'Paging',
        },
        {
          start: 800.0,
          end: 830.0,
          text: 'Page table maps virtual pages to physical frame numbers.',
          topic: 'Virtual Memory',
          subtopic: 'Page Tables',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, segments: mockTranscriptSegments }),
      } as any);

      const segments = await fetchVideoTranscript('vid_os_1');
      expect(segments).toHaveLength(2);
      expect(segments[0].start).toBe(720.0);
      expect(segments[0].end).toBe(746.0);
      expect(segments[0].text).toContain('Paging');
    });
  });

  // ----------------------------------------------------
  // Test 9: AI Grounded Answer Generation
  // ----------------------------------------------------
  describe('9. AI Grounded Answer Generation', () => {
    it('answers question using video transcript evidence and returns timestamp citation', async () => {
      const mockAnswer = {
        success: true,
        videoId: 'vid_os_1',
        question: 'What is paging?',
        response: 'Paging divides memory into fixed-size pages [vid_os_t720_c1].',
        citations: [
          {
            chunk_id: 'vid_os_t720_c1',
            source_id: 'vid_os_1',
            source_type: 'VIDEO',
            timestamp_start: 720.0,
            timestamp_end: 746.0,
            seek_seconds: 720.0,
            formatted_timestamp: '12:00',
            citation_label: '[12:00]',
            snippet: 'Paging divides memory into fixed-size pages...',
          },
        ],
        grounded: true,
        insufficient_evidence: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockAnswer),
      } as any);

      const result = await askVideoQuestion('vid_os_1', 'What is paging?');
      expect(result.grounded).toBe(true);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].seek_seconds).toBe(720.0);
      expect(result.citations[0].citation_label).toBe('[12:00]');
    });
  });

  // ----------------------------------------------------
  // Test 10: Insufficient Evidence Refusal
  // ----------------------------------------------------
  describe('10. Insufficient Evidence Refusal', () => {
    it('declines to hallucinate when asked about topics not present in video transcript', async () => {
      const mockRefusal = {
        success: true,
        videoId: 'vid_os_1',
        question: 'What did the lecturer say about quantum computing?',
        response:
          'The uploaded course materials do not contain sufficient information to answer this question. Please upload relevant course materials for this topic.',
        citations: [],
        grounded: false,
        insufficient_evidence: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockRefusal),
      } as any);

      const result = await askVideoQuestion(
        'vid_os_1',
        'What did the lecturer say about quantum computing?'
      );

      expect(result.grounded).toBe(false);
      expect(result.insufficient_evidence).toBe(true);
      expect(result.citations).toHaveLength(0);
      expect(result.response).toContain('do not contain sufficient information');
    });
  });

  // ----------------------------------------------------
  // Test 11: Timestamp Citation Generation
  // ----------------------------------------------------
  describe('11. Timestamp Citation Generation', () => {
    it('extracts [mm:ss] citations and converts them to seek seconds', () => {
      const text =
        'Virtual memory uses paging [12:00] and the page table handles translations [14:30].';
      const citations = extractTimestampCitations(text);

      expect(citations).toHaveLength(2);
      expect(citations[0].label).toBe('12:00');
      expect(citations[0].seconds).toBe(720);
      expect(citations[1].label).toBe('14:30');
      expect(citations[1].seconds).toBe(870);
    });
  });

  // ----------------------------------------------------
  // Test 12: Clicking Timestamp Seeks Player
  // ----------------------------------------------------
  describe('12. Clicking Timestamp Seeks Player UI Component', () => {
    const mockVideo: VideoRecord = {
      id: 'vid_test_1',
      userId: 'student_1',
      title: 'Operating Systems',
      sourceType: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'ready',
      durationSeconds: 900,
      transcriptStatus: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('triggers seek callback with correct seconds when transcript segment is clicked', () => {
      const mockSeek = vi.fn();
      const segments: TranscriptSegment[] = [
        { start: 120, end: 150, text: 'Introduction to threads' },
        { start: 720, end: 750, text: 'Paging and virtual memory' },
      ];

      render(
        <VideoTranscriptPanel
          segments={segments}
          currentTime={0}
          onSeek={mockSeek}
        />
      );

      const segmentBtn = screen.getByText('12:00');
      fireEvent.click(segmentBtn);

      expect(mockSeek).toHaveBeenCalledWith(720);
    });

    it('highlights the active segment based on current playing time', () => {
      const mockSeek = vi.fn();
      const segments: TranscriptSegment[] = [
        { start: 0, end: 60, text: 'Welcome segment' },
        { start: 60, end: 120, text: 'Active middle segment' },
      ];

      const { container } = render(
        <VideoTranscriptPanel
          segments={segments}
          currentTime={75} // within segment 2
          onSeek={mockSeek}
        />
      );

      // Verify active styling / pulse sparkles
      expect(container.querySelector('.animate-pulse')).toBeTruthy();
      expect(screen.getByText('Active middle segment')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------
  // Test 13: Processing State Transitions
  // ----------------------------------------------------
  describe('13. Processing State Transitions', () => {
    it('handles pending -> processing -> ready transitions properly', async () => {
      const pendingVideo: VideoRecord = {
        id: 'vid_job_1',
        userId: 'student_1',
        title: 'Class Recording',
        sourceType: 'upload',
        status: 'pending',
        durationSeconds: 0,
        transcriptStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const readyVideo: VideoRecord = {
        ...pendingVideo,
        status: 'ready',
        transcriptStatus: 'ready',
        durationSeconds: 300,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, video: readyVideo }),
      } as any);

      const processed = await processVideoById('vid_job_1');
      expect(processed.status).toBe('ready');
      expect(processed.transcriptStatus).toBe('ready');
      expect(processed.durationSeconds).toBe(300);
    });
  });

  // ----------------------------------------------------
  // Test 14: Video Deletion
  // ----------------------------------------------------
  describe('14. Video Deletion', () => {
    it('deletes video successfully when user is the owner', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, message: 'Video deleted successfully' }),
      } as any);

      const success = await deleteVideoById('vid_test_1');
      expect(success).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Test 15: AI Tutor Citation Rendering & Seek
  // ----------------------------------------------------
  describe('15. AI Tutor Citation Rendering and Seek Callback', async () => {
    it('renders citation timestamps in AI Video Tutor and seeks on click', async () => {
      const mockSeek = vi.fn();
      const mockVideo: VideoRecord = {
        id: 'vid_os_1',
        userId: 'student_1',
        title: 'Virtual Memory',
        sourceType: 'youtube',
        status: 'ready',
        durationSeconds: 900,
        transcriptStatus: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            videoId: 'vid_os_1',
            question: 'What is paging?',
            response: 'Paging divides memory into fixed-size pages.',
            citations: [
              {
                chunk_id: 'c1',
                seek_seconds: 720,
                formatted_timestamp: '12:00',
                citation_label: '[12:00]',
              },
            ],
            grounded: true,
          }),
      } as any);

      render(<VideoAITutorPanel video={mockVideo} onSeek={mockSeek} />);

      const input = screen.getByPlaceholderText(/Ask a question about this lecture/i);
      fireEvent.change(input, { target: { value: 'What is paging?' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('[12:00]')).toBeInTheDocument();
      });

      const citationBtn = screen.getByText('[12:00]');
      fireEvent.click(citationBtn);

      expect(mockSeek).toHaveBeenCalledWith(720);
    });
  });

  // ----------------------------------------------------
  // Test 16: Strict Transcript Duration Bounds & Integrity
  // ----------------------------------------------------
  describe('16. Strict Transcript Duration Bounds & Integrity Validation', () => {
    const mediaDuration = 219; // 3:39 multiplexing lecture

    it('accepts valid segments within verified media duration', () => {
      const validSegments = [
        { start: 0, end: 60, text: 'Introduction to Multiplexing' },
        { start: 60, end: 150, text: 'Time Division Multiplexing principles' },
        { start: 150, end: 218, text: 'Frequency Division Multiplexing summary' },
      ];

      const res = validateTranscriptSegments(validSegments, mediaDuration);
      expect(res.valid).toBe(true);
      expect(res.segments).toHaveLength(3);
    });

    it('strictly REJECTS out-of-bounds segments (e.g. 5:00 / 300s on 3:39 video) without clamping', () => {
      const invalidSegments = [
        { start: 0, end: 60, text: 'Introduction' },
        { start: 300, end: 600, text: 'Detailed Walkthrough at 5 to 10 minutes' },
      ];

      const res = validateTranscriptSegments(invalidSegments, mediaDuration);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds verified media duration');
      // Verify no clamping occurred
      expect(res.segments).toBeUndefined();
    });

    it('rejects negative or malformed timestamps', () => {
      const negativeStart = [{ start: -5, end: 30, text: 'Negative timestamp' }];
      expect(validateTranscriptSegments(negativeStart, 100).valid).toBe(false);

      const invertedOrder = [{ start: 50, end: 20, text: 'End before start' }];
      expect(validateTranscriptSegments(invertedOrder, 100).valid).toBe(false);
    });

    it('detects and rejects synthetic placeholder template text masquerading as real transcript', () => {
      const syntheticSegments = [
        {
          start: 0,
          end: 60,
          text: 'Introduction to Operating system. Overview of core architectural concepts, prerequisites',
          subtopic: 'Introduction & Overview',
        },
        {
          start: 60,
          end: 120,
          text: 'Detailed analysis of fundamental mechanisms',
          subtopic: 'Detailed Walkthrough',
        },
      ];

      expect(isSyntheticOrInvalidTranscript(syntheticSegments, 300)).toBe(true);
      const res = validateTranscriptSegments(syntheticSegments, 300);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('synthetic placeholder');
    });
  });

  // ----------------------------------------------------
  // Test 17: Video Unavailable Transcript State & Grounding Refusal
  // ----------------------------------------------------
  describe('17. Video Unavailable Transcript State & Grounding Refusal', () => {
    it('renders explicit notice when transcript is unavailable in VideoTranscriptPanel', () => {
      render(
        <VideoTranscriptPanel
          segments={[]}
          currentTime={0}
          onSeek={vi.fn()}
          transcriptStatus="unavailable"
        />
      );

      expect(screen.getByText('No verified transcript available for this lecture')).toBeInTheDocument();
      expect(
        screen.getByText(/Verbatim transcript evidence is not available for this lecture/i)
      ).toBeInTheDocument();
    });

    it('displays ungrounded mode badge in AI Tutor when transcript is unavailable', () => {
      const ungroundedVideo: VideoRecord = {
        id: 'vid_no_transcript',
        userId: 'student_1',
        title: 'Multiplexing Lecture',
        sourceType: 'youtube',
        durationSeconds: 219,
        status: 'ready',
        transcriptStatus: 'unavailable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<VideoAITutorPanel video={ungroundedVideo} onSeek={vi.fn()} />);

      expect(screen.getByText('Ungrounded Mode')).toBeInTheDocument();
      expect(screen.getByText(/Transcript unavailable - conceptual help without citations/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------
  // Test 18: Video Switching Cleans Stale Chat & Citations
  // ----------------------------------------------------
  describe('18. Video Switching Cleans Stale Chat & Citations', () => {
    const videoA: VideoRecord = {
      id: 'vid_A',
      userId: 'student_1',
      title: 'Lecture A: Computer Networks',
      sourceType: 'youtube',
      status: 'ready',
      durationSeconds: 219,
      transcriptStatus: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const videoB: VideoRecord = {
      id: 'vid_B',
      userId: 'student_1',
      title: 'Lecture B: Operating Systems',
      sourceType: 'youtube',
      status: 'ready',
      durationSeconds: 300,
      transcriptStatus: 'unavailable',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('resets conversation history and citations when active video changes', async () => {
      const { rerender } = render(<VideoAITutorPanel video={videoA} onSeek={vi.fn()} />);

      expect(screen.getByText(/Lecture A: Computer Networks/i)).toBeInTheDocument();

      // Switch to video B
      rerender(<VideoAITutorPanel video={videoB} onSeek={vi.fn()} />);

      // Must now show Video B welcome and NOT Video A
      await waitFor(() => {
        expect(screen.getByText(/Lecture B: Operating Systems/i)).toBeInTheDocument();
        expect(screen.queryByText(/Lecture A: Computer Networks/i)).toBeNull();
        expect(screen.getByText('Ungrounded Mode')).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------
  // Test 19: Expand Left Pane Viewing Mode
  // ----------------------------------------------------
  describe('19. Expand Left Pane Viewing Mode', () => {
    const sampleVideo: VideoRecord = {
      id: 'vid_expand_test',
      userId: 'default_user',
      title: 'Multiplexing In Computer Networks',
      sourceType: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeVideoId: 'dQw4w9WgXcQ',
      status: 'ready',
      durationSeconds: 219,
      transcriptStatus: 'ready',
      transcriptJson: JSON.stringify([
        { start: 0, end: 60, text: 'Multiplexing principles' },
      ]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('ming_user_videos', JSON.stringify([sampleVideo]));
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, videos: [sampleVideo] }),
      } as any);
    });

    it('provides labelled mode control with accessible aria-pressed and toggles workspace view', async () => {
      render(<VideoLearningPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Multiplexing In Computer Networks').length).toBeGreaterThan(0);
      });

      const toggleBtn = screen.getByRole('button', { name: /expand left pane/i });
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

      // Click to toggle to expanded-left
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /restore default view/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /restore default view/i })).toHaveAttribute(
          'aria-pressed',
          'true'
        );
      });

      // Click again to restore default
      const restoreBtn = screen.getByRole('button', { name: /restore default view/i });
      fireEvent.click(restoreBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /expand left pane/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /expand left pane/i })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
      });
    });
  });

  // ----------------------------------------------------
  // Test 20: ASR Trailing Caption Timing Tolerance & Provenance Rendering
  // ----------------------------------------------------
  describe('20. ASR Trailing Caption Timing Tolerance & Provenance', () => {
    it('accepts trailing ASR caption cue within documented tolerance across rounded 219s and 220s durations', () => {
      const cues = [
        { start: 0.02, end: 4.13, text: 'अब हम लोग स्टार्ट करेंगे मल्टीप्लेक्सिंग के बारे में' },
        { start: 218.3, end: 220.96, text: 'डिविजन मल्टीप्ल एक्सेस तो यह तीन तरीके हैं' },
      ];

      expect(MEDIA_START_TOLERANCE_SECONDS).toBe(1.5);
      expect(CAPTION_CUE_END_TOLERANCE_SECONDS).toBe(3.0);

      expect(validateTranscriptSegments(cues, 220).valid).toBe(true);
      expect(validateTranscriptSegments(cues, 219).valid).toBe(true);
      expect(validateTranscriptSegments([{ start: 218.0, end: 225.0, text: 'Too long beyond video' }], 220).valid).toBe(false);
    });

    it('throws honestly in processVideoById instead of masquerading failure as ready', async () => {
      const staleLocal: VideoRecord = {
        id: 'vid_fail_honest',
        userId: 'student_1',
        title: 'Test Video',
        sourceType: 'youtube',
        status: 'processing',
        durationSeconds: 0,
        transcriptStatus: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('ming_user_videos', JSON.stringify([staleLocal]));

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'Extraction subprocess timed out' }),
      } as any);

      await expect(processVideoById('vid_fail_honest')).rejects.toThrow(/timed out/i);
    });

    it('renders caption language, ASR provenance badge, and polls processing -> ready transition cleanly', async () => {
      const processingVideo: VideoRecord = {
        id: 'vid_poll_yt',
        userId: 'default_user',
        title: 'YouTube Lecture (za87oqLhGaI)',
        sourceType: 'youtube',
        youtubeUrl: 'https://youtu.be/za87oqLhGaI',
        youtubeVideoId: 'za87oqLhGaI',
        status: 'processing',
        durationSeconds: 0,
        transcriptStatus: 'processing',
        extractionStatus: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const readyVideo: VideoRecord = {
        ...processingVideo,
        title: '35. intro to multiplexing',
        channelName: 'GATE CSE LECTURES BY AMIT KHURANA',
        durationSeconds: 220,
        durationSource: 'yt-dlp',
        captionLanguage: 'hi',
        captionLanguageName: 'Hindi (Original)',
        captionKind: 'asr',
        isAutoGenerated: true,
        captionProvider: 'yt-dlp:json3',
        extractionStatus: 'ready',
        status: 'ready',
        transcriptStatus: 'ready',
        transcriptJson: JSON.stringify([
          { start: 0.02, end: 4.13, text: 'अब हम लोग स्टार्ट करेंगे मल्टीप्लेक्सिंग के बारे में' },
          { start: 120.04, end: 128.5, text: 'ट्रांसमिशन ऑफ मल्टीपल सिग्नल सिंगल डाटा लिंक' },
        ]),
      };

      localStorage.clear();
      localStorage.setItem('ming_user_videos', JSON.stringify([processingVideo]));

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/api/videos/vid_poll_yt') && !String(url).includes('/transcript')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ success: true, video: readyVideo }),
          } as any;
        }
        return {
          ok: true,
          text: async () => JSON.stringify({ success: true, videos: [processingVideo] }),
        } as any;
      });

      render(<VideoLearningPage />);

      await waitFor(() => {
        expect(screen.getAllByText('35. intro to multiplexing').length).toBeGreaterThan(0);
        expect(screen.getByText('GATE CSE LECTURES BY AMIT KHURANA')).toBeInTheDocument();
        expect(screen.getByText(/Hindi \(Original\) • Auto ASR/i)).toBeInTheDocument();
        expect(screen.getByText('अब हम लोग स्टार्ट करेंगे मल्टीप्लेक्सिंग के बारे में')).toBeInTheDocument();
      }, { timeout: 4000 });
    });
  });

  // ----------------------------------------------------
  // Test 21: Strict YouTube URL & Markdown Normalization
  // ----------------------------------------------------
  describe('21. Strict YouTube URL & Markdown Link Normalization', () => {
    it('normalizes valid plain and Markdown YouTube links into canonical watch URLs', () => {
      const plain = parseYouTubeInput('https://youtu.be/za87oqLhGaI');
      expect(plain.valid).toBe(true);
      expect(plain.videoId).toBe('za87oqLhGaI');
      expect(plain.canonicalUrl).toBe('https://www.youtube.com/watch?v=za87oqLhGaI');
      expect(plain.wasMarkdown).toBe(false);

      const md = parseYouTubeInput('[35. intro to multiplexing](https://youtu.be/za87oqLhGaI)');
      expect(md.valid).toBe(true);
      expect(md.videoId).toBe('za87oqLhGaI');
      expect(md.canonicalUrl).toBe('https://www.youtube.com/watch?v=za87oqLhGaI');
      expect(md.wasMarkdown).toBe(true);

      const angle = parseYouTubeInput('<https://youtu.be/za87oqLhGaI>');
      expect(angle.valid).toBe(true);
      expect(angle.canonicalUrl).toBe('https://www.youtube.com/watch?v=za87oqLhGaI');
      expect(angle.wasMarkdown).toBe(true);

      const matchingLabel = parseYouTubeInput(
        '[https://youtu.be/za87oqLhGaI](https://www.youtube.com/watch?v=za87oqLhGaI)'
      );
      expect(matchingLabel.valid).toBe(true);
      expect(matchingLabel.videoId).toBe('za87oqLhGaI');
    });

    it('rejects spoofed Markdown labels, malformed links, non-YouTube domains, and bare IDs by default', () => {
      expect(parseYouTubeInput('[https://youtu.be/za87oqLhGaI](https://evil.com/watch?v=za87oqLhGaI)').valid).toBe(false);
      expect(parseYouTubeInput('[https://youtu.be/za87oqLhGaI](https://youtu.be/dQw4w9WgXcQ)').valid).toBe(false);
      expect(parseYouTubeInput('[broken](https://youtu.be/za87oqLhGaI').valid).toBe(false);
      expect(parseYouTubeInput('https://evil.com/?q=youtu.be/za87oqLhGaI').valid).toBe(false);
      expect(parseYouTubeInput('za87oqLhGaI', { allowBareId: false }).valid).toBe(false);
      expect(isValidYouTubeUrl('za87oqLhGaI')).toBe(false);
      expect(normalizeYouTubeUrl('[title](https://youtu.be/za87oqLhGaI)')).toBe(
        'https://www.youtube.com/watch?v=za87oqLhGaI'
      );
    });
  });

  // ----------------------------------------------------
  // Test 22: AddVideoModal Normalization, Auth Preservation & Draft Restore
  // ----------------------------------------------------
  describe('22. AddVideoModal Normalization, Auth Error Form Preservation & Draft Restore', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null });
      (supabase.auth.refreshSession as any).mockResolvedValue({ data: { session: null }, error: null });
    });

    it('normalizes valid Markdown YouTube link and submits canonical URL to /api/videos', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: 'valid-learner-jwt', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        error: null,
      });

      const createdVideo: VideoRecord = {
        id: 'vid_multiplex_1',
        userId: 'learner_1',
        title: '35. intro to multiplexing',
        sourceType: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=za87oqLhGaI',
        youtubeVideoId: 'za87oqLhGaI',
        status: 'processing',
        durationSeconds: 0,
        transcriptStatus: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ success: true, video: createdVideo }),
      });
      global.fetch = fetchMock as any;

      const onVideoAdded = vi.fn();
      const onClose = vi.fn();

      render(<AddVideoModal isOpen={true} onClose={onClose} onVideoAdded={onVideoAdded} />);

      fireEvent.change(screen.getByLabelText(/YouTube URL \*/i), {
        target: { value: '[35. intro to multiplexing](https://youtu.be/za87oqLhGaI)' },
      });

      expect(screen.getByText(/Valid Video ID:/i)).toBeInTheDocument();
      expect(screen.getByText('za87oqLhGaI')).toBeInTheDocument();
      expect(screen.getByText('https://www.youtube.com/watch?v=za87oqLhGaI')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Lecture Title/i), {
        target: { value: '35. intro to multiplexing' },
      });

      const submitBtn = screen.getByRole('button', { name: /Add YouTube Video/i });
      expect(submitBtn).toBeEnabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onVideoAdded).toHaveBeenCalledWith(expect.objectContaining({ id: 'vid_multiplex_1' }));
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [reqUrl, reqInit] = fetchMock.mock.calls[0];
      expect(reqUrl).toBe('/api/videos');
      expect(reqInit.headers.Authorization).toBe('Bearer valid-learner-jwt');
      expect(JSON.parse(reqInit.body).youtubeUrl).toBe('https://www.youtube.com/watch?v=za87oqLhGaI');
    });

    it('rejects spoofed Markdown links and keeps submit button disabled', () => {
      render(<AddVideoModal isOpen={true} onClose={vi.fn()} onVideoAdded={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/YouTube URL \*/i), {
        target: { value: '[https://youtu.be/za87oqLhGaI](https://youtu.be/dQw4w9WgXcQ)' },
      });

      expect(screen.getByText(/different URLs or videos/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add YouTube Video/i })).toBeDisabled();
    });

    it('preserves entered form fields on 401, surfaces Sign In CTA, saves draft, and restores it after sign-in', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Authentication required' }),
      }) as any;

      const onSignInRequest = vi.fn();
      const { unmount } = render(
        <AddVideoModal
          isOpen={true}
          onClose={vi.fn()}
          onVideoAdded={vi.fn()}
          onSignInRequest={onSignInRequest}
        />
      );

      fireEvent.change(screen.getByLabelText(/YouTube URL \*/i), {
        target: { value: 'https://youtu.be/za87oqLhGaI' },
      });
      fireEvent.change(screen.getByLabelText(/Lecture Title/i), {
        target: { value: 'Multiplexing Preserved Draft' },
      });
      fireEvent.change(screen.getByLabelText(/Optional Transcript/i), {
        target: { value: '[00:00] Draft segment text' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add YouTube Video/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Authentication required/i);
      });

      expect((screen.getByLabelText(/YouTube URL \*/i) as HTMLInputElement).value).toBe('https://youtu.be/za87oqLhGaI');
      expect((screen.getByLabelText(/Lecture Title/i) as HTMLInputElement).value).toBe('Multiplexing Preserved Draft');
      expect((screen.getByLabelText(/Optional Transcript/i) as HTMLTextAreaElement).value).toBe('[00:00] Draft segment text');

      const signInBtn = screen.getByRole('button', { name: /Sign In/i });
      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(onSignInRequest).toHaveBeenCalledTimes(1);
      });

      const savedRaw = sessionStorage.getItem(PENDING_VIDEO_DRAFT_KEY);
      expect(savedRaw).toBeTruthy();
      expect(JSON.parse(savedRaw!)).toMatchObject({
        ytUrl: 'https://youtu.be/za87oqLhGaI',
        ytTitle: 'Multiplexing Preserved Draft',
        ytTranscript: '[00:00] Draft segment text',
      });

      unmount();

      // Returning to VideoLearningPage / reopening AddVideoModal restores the draft
      render(<AddVideoModal isOpen={true} onClose={vi.fn()} onVideoAdded={vi.fn()} />);
      expect((screen.getByLabelText(/YouTube URL \*/i) as HTMLInputElement).value).toBe('https://youtu.be/za87oqLhGaI');
      expect((screen.getByLabelText(/Lecture Title/i) as HTMLInputElement).value).toBe('Multiplexing Preserved Draft');
      expect((screen.getByLabelText(/Optional Transcript/i) as HTMLTextAreaElement).value).toBe('[00:00] Draft segment text');
      expect(sessionStorage.getItem(PENDING_VIDEO_DRAFT_KEY)).toBeNull();
    });
  });

  // ----------------------------------------------------
  // Test 23: videoAPI Token Refresh, 401 Single Retry & Pre-flight URL Check
  // ----------------------------------------------------
  describe('23. videoAPI Auth Token Refresh & Retry Handling', () => {
    beforeEach(() => {
      localStorage.clear();
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null });
      (supabase.auth.refreshSession as any).mockResolvedValue({ data: { session: null }, error: null });
    });

    it('proactively refreshes near-expiry session token before calling /api/videos', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: {
          session: {
            access_token: 'expiring-token',
            expires_at: Math.floor(Date.now() / 1000) + 10, // inside 60s refresh buffer
          },
        },
        error: null,
      });
      (supabase.auth.refreshSession as any).mockResolvedValue({
        data: {
          session: {
            access_token: 'fresh-refreshed-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            success: true,
            video: {
              id: 'vid_refreshed',
              userId: 'u1',
              title: '35. intro to multiplexing',
              sourceType: 'youtube',
              youtubeUrl: 'https://www.youtube.com/watch?v=za87oqLhGaI',
              youtubeVideoId: 'za87oqLhGaI',
              status: 'processing',
              durationSeconds: 0,
              transcriptStatus: 'processing',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
      });
      global.fetch = fetchMock as any;

      await addYouTubeVideo('35. intro to multiplexing', 'https://youtu.be/za87oqLhGaI');

      expect((supabase.auth as any).refreshSession).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh-refreshed-token');
    });

    it('retries once on 401 after refreshing session and throws VideoAuthError if still unauthorized', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: {
          session: {
            access_token: 'stale-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      });
      (supabase.auth.refreshSession as any).mockResolvedValue({
        data: {
          session: {
            access_token: 'retried-fresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ error: 'Expired JWT' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          text: async () =>
            JSON.stringify({
              success: true,
              video: {
                id: 'vid_retry_ok',
                userId: 'u1',
                title: '35. intro to multiplexing',
                sourceType: 'youtube',
                youtubeUrl: 'https://www.youtube.com/watch?v=za87oqLhGaI',
                youtubeVideoId: 'za87oqLhGaI',
                status: 'processing',
                durationSeconds: 0,
                transcriptStatus: 'processing',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
        });
      global.fetch = fetchMock as any;

      const res = await addYouTubeVideo('35. intro to multiplexing', 'https://youtu.be/za87oqLhGaI');
      expect(res.id).toBe('vid_retry_ok');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer stale-token');
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer retried-fresh-token');

      // Persistent 401 without refresh -> VideoAuthError
      (supabase.auth.refreshSession as any).mockResolvedValue({ data: { session: null }, error: null });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Unauthorized' }),
      }) as any;

      let caught: unknown;
      try {
        await addYouTubeVideo('Test', 'https://youtu.be/za87oqLhGaI');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(VideoAuthError);
      expect(isVideoAuthError(caught)).toBe(true);
    });

    it('rejects malformed Markdown links client-side before sending fetch', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as any;

      await expect(
        addYouTubeVideo('Spoofed Domain', '[https://youtu.be/za87oqLhGaI](https://evil.com/watch?v=za87oqLhGaI)')
      ).rejects.toThrow(/Destination must be a valid YouTube video URL/i);
      await expect(
        addYouTubeVideo('Spoofed ID', '[https://youtu.be/za87oqLhGaI](https://youtu.be/dQw4w9WgXcQ)')
      ).rejects.toThrow(/different URLs or videos/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------
  // Test 24: Lecture, Player & Transcript Mismatch Guard
  // ----------------------------------------------------
  describe('24. Lecture, Player & Transcript Mismatch Integrity Guard', () => {
    const fakeMitVideo: VideoRecord = {
      id: 'vid_mit_mismatch_local',
      userId: 'learner_1',
      title: 'MIT 18.06 Linear Algebra – The Geometry of Linear Equations',
      sourceType: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=7UJ4CFRGd-U',
      youtubeVideoId: '7UJ4CFRGd-U',
      status: 'ready',
      durationSeconds: 2382,
      transcriptStatus: 'ready',
      transcriptJson: JSON.stringify([
        {
          start: 480,
          end: 510,
          text: 'The row picture versus the column picture of linear systems.',
        },
      ]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('removes legacy hardcoded sample records and never injects sample videos into empty library', () => {
      localStorage.setItem(
        'ming_user_videos',
        JSON.stringify([
          {
            id: 'vid_sample_mit_linear_algebra',
            userId: 'default_user',
            title: 'MIT 18.06 Linear Algebra – The Geometry of Linear Equations',
            sourceType: 'youtube',
            youtubeUrl: 'https://www.youtube.com/watch?v=7UJ4CFRGd-U',
            youtubeVideoId: '7UJ4CFRGd-U',
            status: 'ready',
            durationSeconds: 2382,
            transcriptStatus: 'ready',
          },
        ])
      );

      expect(getStoredVideos()).toEqual([]);
      expect(isKnownMismatchedVideoRecord(fakeMitVideo)).toMatch(/7UJ4CFRGd-U/i);
    });

    it('withholds mismatched 8:00 transcript and forces Ungrounded Mode on conflicted MIT/7UJ4CFRGd-U record', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, videos: [fakeMitVideo] }),
      }) as any;

      render(<VideoLearningPage />);

      await waitFor(() => {
        expect(screen.getByText(/Source Integrity Notice — Ungrounded Mode Active/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Ungrounded Mode')).toBeInTheDocument();
      expect(screen.queryByText('Grounded')).not.toBeInTheDocument();
      expect(screen.getByText('Verified transcript withheld (source mismatch)')).toBeInTheDocument();
      expect(screen.queryByText(/The row picture versus the column picture/i)).not.toBeInTheDocument();
      expect(screen.queryByText('8:00')).not.toBeInTheDocument();
    });

    it('switches to Ungrounded Mode when embedded player postMessage reports a different video_id', async () => {
      const mismatchedRuntimeVideo: VideoRecord = {
        id: 'vid_runtime_check',
        userId: 'learner_1',
        title: 'Lecture with mismatched player telemetry',
        sourceType: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=za87oqLhGaI',
        youtubeVideoId: 'za87oqLhGaI',
        status: 'ready',
        durationSeconds: 220,
        transcriptStatus: 'ready',
        transcriptJson: JSON.stringify([
          { start: 0, end: 25, text: 'Multiplexing transmits multiple signals over a shared medium.' },
        ]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ success: true, videos: [mismatchedRuntimeVideo] }),
      }) as any;

      render(<VideoLearningPage />);

      await waitFor(() => {
        expect(screen.getByText('Grounded')).toBeInTheDocument();
        expect(screen.getByText(/Multiplexing transmits multiple signals/i)).toBeInTheDocument();
      });

      fireEvent(
        window,
        new MessageEvent('message', {
          origin: 'https://www.youtube.com',
          data: JSON.stringify({
            event: 'infoDelivery',
            info: {
              duration: 454,
              videoData: {
                video_id: '7UJ4CFRGd-U',
                title: 'Gilbert Strang Interview',
              },
            },
          }),
        })
      );

      await waitFor(() => {
        expect(screen.getByText(/Source Integrity Notice — Ungrounded Mode Active/i)).toBeInTheDocument();
        expect(screen.getByText('Ungrounded Mode')).toBeInTheDocument();
        expect(screen.queryByText(/Multiplexing transmits multiple signals/i)).not.toBeInTheDocument();
      });
    });

    it('blocks iframe playback on URL-vs-ID conflict and rejects foreign source_id citations in askVideoQuestion', async () => {
      const conflictedVideo: VideoRecord = {
        id: 'vid_url_conflict',
        userId: 'learner_1',
        title: 'Conflicted Video Record',
        sourceType: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'za87oqLhGaI',
        status: 'ready',
        durationSeconds: 220,
        transcriptStatus: 'unavailable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<VideoPlayer video={conflictedVideo} />);
      expect(screen.getByText('YouTube Source Mismatch')).toBeInTheDocument();
      expect(document.querySelector('iframe')).toBeNull();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            videoId: 'vid_target',
            question: 'What is multiplexing?',
            response: 'Claim [EVIDENCE_1]',
            grounded: true,
            citations: [
              {
                chunk_id: 'foreign_chunk',
                evidence_id: 'EVIDENCE_1',
                source_id: 'vid_other_video',
                seek_seconds: 10,
                formatted_timestamp: '0:10',
                citation_label: '[0:10]',
              },
            ],
          }),
      }) as any;

      const askRes = await askVideoQuestion('vid_target', 'What is multiplexing?');
      expect(askRes.grounded).toBe(false);
      expect(askRes.insufficient_evidence).toBe(true);
      expect(askRes.citations).toEqual([]);
    });
  });
});
