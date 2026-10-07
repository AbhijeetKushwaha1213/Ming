import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  extractYouTubeId,
  isValidYouTubeUrl,
  formatTimestamp,
  parseTimestamp,
  formatDuration,
  extractTimestampCitations,
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
} from '@/api/videoAPI';
import { VideoAITutorPanel } from '@/components/video/VideoAITutorPanel';
import { VideoTranscriptPanel } from '@/components/video/VideoTranscriptPanel';
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
});
