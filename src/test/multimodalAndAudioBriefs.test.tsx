import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AudioBriefViewer, type AudioBriefData } from '@/components/flashcards/AudioBriefViewer';
import { Citation } from '@/components/chat/Citation';
import type { CitationData } from '@/types/resource';

// Mock clipboard and toast
const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockClipboardWriteText,
  },
  writable: true,
  configurable: true,
});

// Mock SpeechSynthesisUtterance for testing environment
class MockSpeechSynthesisUtterance {
  text: string;
  rate: number = 1;
  pitch: number = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
(global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/api/ragAPI', () => ({
  getSourceLocation: vi.fn().mockResolvedValue({
    chunk_id: 'test_chunk_diagram_1',
    is_diagram: true,
    diagram_caption: 'Figure 4.2: Resource Allocation Graph with deadlock cycle',
    source_type: 'PDF',
    page_number: 42,
    citation_label: 'Figure (Page 42)',
    preview: 'Resource allocation graph indicating circular hold and wait.',
  }),
}));

describe('Track D Multimodal Figures and Audio Briefs (Req 1d & 6b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AudioBriefViewer (Req 6b)', () => {
    const mockBrief: AudioBriefData = {
      title: 'Deadlock Detection & Recovery — Spoken Brief',
      topic: 'Operating Systems',
      target_concept: 'Resource Allocation Graph Cycles',
      mastery_score: 0.28, // Weak area (< 40%)
      duration_minutes: 2,
      script: 'Welcome to this 2-minute high-yield spoken revision on Deadlock Detection. Remember the four necessary Coffman conditions: mutual exclusion, hold and wait, no preemption, and circular wait [CHUNK_101].',
      key_takeaways: [
        'A cycle in a single-instance RAG is necessary and sufficient for deadlock',
        'In multi-instance systems, Banker algorithm safety checks must be executed',
      ],
      citations: [
        { label: 'Silberschatz OS Concepts', coordinate: 'Page 318', source_type: 'PDF' },
        { label: 'OS Lecture 14 Slides', coordinate: 'Slide 22', source_type: 'PPTX' },
      ],
    };

    it('renders the 2-minute spoken audio brief with weak area badge', () => {
      render(<AudioBriefViewer brief={mockBrief} />);

      expect(screen.getByText('2-Min Spoken Audio Brief')).toBeDefined();
      expect(screen.getByText(/Targeting Weak Area \(28% Mastery\)/i)).toBeDefined();
      expect(screen.getByText('Deadlock Detection & Recovery — Spoken Brief')).toBeDefined();
      expect(screen.getByText(/High-Yield Exam Takeaways/i)).toBeDefined();
      expect(screen.getByText(/A cycle in a single-instance RAG/i)).toBeDefined();
    });

    it('supports play and pause controls with speech synthesis', () => {
      // Mock SpeechSynthesis
      const mockSpeak = vi.fn();
      const mockCancel = vi.fn();
      const mockPause = vi.fn();
      const mockResume = vi.fn();

      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: mockSpeak,
          cancel: mockCancel,
          pause: mockPause,
          resume: mockResume,
          paused: false,
        },
        writable: true,
        configurable: true,
      });

      render(<AudioBriefViewer brief={mockBrief} />);

      const playBtn = screen.getByTitle('Play Audio Brief');
      fireEvent.click(playBtn);

      expect(mockSpeak).toHaveBeenCalledTimes(1);

      // Now it's playing, pause button should be present
      const pauseBtn = screen.getByTitle('Pause Audio Brief');
      expect(pauseBtn).toBeDefined();

      fireEvent.click(pauseBtn);
      expect(mockPause).toHaveBeenCalledTimes(1);
    });

    it('displays source citations with exact coordinates', () => {
      render(<AudioBriefViewer brief={mockBrief} />);

      expect(screen.getByText('Silberschatz OS Concepts')).toBeDefined();
      expect(screen.getByText('(Page 318)')).toBeDefined();
      expect(screen.getByText('OS Lecture 14 Slides')).toBeDefined();
      expect(screen.getByText('(Slide 22)')).toBeDefined();
    });
  });

  describe('Multimodal Diagram Citation (Req 1d & 2a)', () => {
    const mockDiagramCitation: CitationData = {
      chunk_id: 'test_chunk_diagram_1',
      source_id: 'src_doc_101',
      document_id: 'doc_textbook_42',
      source_type: 'PDF',
      page_number: 42,
      slide_number: null,
      timestamp_start: null,
      timestamp_end: null,
      is_diagram: true,
      diagram_caption: 'Figure 4.2: Resource Allocation Graph with deadlock cycle',
      citation_label: 'Figure (Page 42)',
      snippet: 'Resource allocation graph indicating circular hold and wait.',
    };

    it('renders a primary multimodal Figure / Diagram badge for diagram chunks', () => {
      render(<Citation citation={mockDiagramCitation} />);

      const citationBtn = screen.getByTestId('citation-test_chunk_diagram_1');
      expect(citationBtn).toBeDefined();
      expect(citationBtn.textContent).toContain('Figure (Page 42)');
      expect(citationBtn.className).toContain('text-primary');
    });

    it('opens modal with diagram details and copy deep link option', async () => {
      render(<Citation citation={mockDiagramCitation} />);

      const citationBtn = screen.getByTestId('citation-test_chunk_diagram_1');
      fireEvent.click(citationBtn);

      // Dialog opens
      expect(await screen.findByText('Multimodal Figure / Diagram')).toBeDefined();
      expect(screen.getByText('Copy Deep Link')).toBeDefined();
      expect(screen.getByText('Copy Reference')).toBeDefined();

      // Click Copy Deep Link
      const copyDeepLinkBtn = screen.getByText('Copy Deep Link');
      fireEvent.click(copyDeepLinkBtn);

      expect(mockClipboardWriteText).toHaveBeenCalled();
      const copiedText = mockClipboardWriteText.mock.calls[0][0];
      expect(copiedText).toContain('#cite=test_chunk_diagram_1');
      expect(copiedText).toContain('page=42');
    });
  });
});
