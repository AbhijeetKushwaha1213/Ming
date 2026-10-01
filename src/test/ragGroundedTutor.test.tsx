import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { askGroundedTutor, searchChunks, getSourceLocation } from '@/api/ragAPI';
import { Citation } from '@/components/chat/Citation';
import type { CitationData } from '@/types/resource';

// Mock global fetch for API calls
const originalFetch = global.fetch;

describe('Phase 2: Source-Grounded AI Tutor & Citation System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------
  // Test 1: Grounded Question
  // ----------------------------------------------------
  describe('1. Grounded Question Handling', () => {
    it('answers question using retrieved evidence and attaches inline chunk citations', async () => {
      const mockGroundedResponse = {
        response:
          '### 📚 Course Material Evidence\n\nThe Coffman conditions for deadlock are mutual exclusion, hold and wait, no preemption, and circular wait [doc_os_p4_c1].',
        citations: [
          {
            chunk_id: 'doc_os_p4_c1',
            source_id: 'src_os_1',
            document_id: 'doc_os',
            source_type: 'PDF',
            page_number: 4,
            slide_number: null,
            timestamp_start: null,
            timestamp_end: null,
            citation_label: 'Page 4',
            snippet: 'The four Coffman conditions for deadlock are mutual exclusion, hold and wait...',
          },
        ],
        grounded: true,
        insufficient_evidence: false,
        retrieved_count: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGroundedResponse,
      } as any);

      const result = await askGroundedTutor({
        message: 'What are the Coffman conditions for deadlock?',
        userId: 'student_123',
        topic: 'Operating Systems',
      });

      expect(result.grounded).toBe(true);
      expect(result.insufficient_evidence).toBe(false);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].chunk_id).toBe('doc_os_p4_c1');
      expect(result.citations[0].page_number).toBe(4);
      expect(result.response).toContain('[doc_os_p4_c1]');
    });
  });

  // ----------------------------------------------------
  // Test 2: Multiple Retrieved Sources
  // ----------------------------------------------------
  describe('2. Multiple Retrieved Sources Handling', () => {
    it('synthesizes answers across multiple sources (PDF and Slides) preserving coordinates', async () => {
      const mockMultiSourceResponse = {
        response:
          '### 📚 Course Material Evidence\n\nCPU scheduling algorithms include FCFS and SJF [doc_book_p12_c1]. In lecture slides, Round Robin was demonstrated with time quantum q=4ms [doc_deck_s5_c1].',
        citations: [
          {
            chunk_id: 'doc_book_p12_c1',
            source_type: 'PDF',
            page_number: 12,
            slide_number: null,
            timestamp_start: null,
            timestamp_end: null,
            citation_label: 'Page 12',
            snippet: 'CPU scheduling algorithms include FCFS and SJF...',
          },
          {
            chunk_id: 'doc_deck_s5_c1',
            source_type: 'SLIDE',
            page_number: null,
            slide_number: 5,
            timestamp_start: null,
            timestamp_end: null,
            citation_label: 'Slide 5',
            snippet: 'Round Robin was demonstrated with time quantum q=4ms...',
          },
        ],
        grounded: true,
        insufficient_evidence: false,
        retrieved_count: 2,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMultiSourceResponse,
      } as any);

      const result = await askGroundedTutor({
        message: 'Compare SJF and Round Robin',
        userId: 'student_123',
      });

      expect(result.grounded).toBe(true);
      expect(result.citations).toHaveLength(2);
      expect(result.citations[0].source_type).toBe('PDF');
      expect(result.citations[0].page_number).toBe(12);
      expect(result.citations[1].source_type).toBe('SLIDE');
      expect(result.citations[1].slide_number).toBe(5);
    });
  });

  // ----------------------------------------------------
  // Test 3: Unsupported / Off-Material Question
  // ----------------------------------------------------
  describe('3. Unsupported / Off-Material Question', () => {
    it('declines to hallucinate when evidence is insufficient and informs user clearly', async () => {
      const mockRefusalResponse = {
        response:
          'The uploaded course materials do not contain sufficient information to answer this question. Please upload relevant course materials (such as lecture slides, PDFs, or video recordings) for this topic.',
        citations: [],
        grounded: false,
        insufficient_evidence: true,
        retrieved_count: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRefusalResponse,
      } as any);

      const result = await askGroundedTutor({
        message: 'How do you bake a red velvet cheesecake?',
        userId: 'student_123',
      });

      expect(result.grounded).toBe(false);
      expect(result.insufficient_evidence).toBe(true);
      expect(result.citations).toHaveLength(0);
      expect(result.response).toContain('do not contain sufficient information');
    });
  });

  // ----------------------------------------------------
  // Test 4: Missing Citation Metadata
  // ----------------------------------------------------
  describe('4. Missing Citation Metadata Resilience', () => {
    it('gracefully handles missing page/slide/timestamp without fabricating coordinates', () => {
      const citationWithMissingMeta: CitationData = {
        chunk_id: 'doc_txt_c1',
        source_type: 'TEXT',
        page_number: null,
        slide_number: null,
        timestamp_start: null,
        timestamp_end: null,
        citation_label: 'Source Excerpt',
        snippet: 'General syllabus details without page numbers.',
      };

      const { getByText } = render(<Citation citation={citationWithMissingMeta} />);

      // Should display "Source Excerpt" or "Course Notes" rather than fabricating a fake page or slide
      expect(getByText(/Source Excerpt|Course Notes/i)).toBeInTheDocument();
      expect(screen.queryByText(/Page null/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Slide null/i)).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------------------
  // Test 5: Authenticated User Isolation
  // ----------------------------------------------------
  describe('5. Authenticated User Isolation', () => {
    it('passes userId in retrieval payload ensuring student materials remain strictly isolated', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: 'Database Normalization',
          total_results: 1,
          results: [
            {
              chunk_id: 'doc_alice_c1',
              user_id: 'alice_101',
              text: '3NF requires that every non-key attribute is non-transitively dependent...',
              score: 0.88,
              location: { source_type: 'PDF', page_number: 14 },
            },
          ],
        }),
      } as any);

      await searchChunks('Database Normalization', {
        userId: 'alice_101',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/rag/search',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"userId":"alice_101"'),
        })
      );
    });
  });

  // ----------------------------------------------------
  // Test 6: Citation Rendering & Interactive Modal
  // ----------------------------------------------------
  describe('6. Citation Component Rendering & Dialog Interaction', () => {
    it('renders PDF citation with page badge and opens inspection dialog on click', async () => {
      const pdfCitation: CitationData = {
        chunk_id: 'pdf_chunk_42',
        source_type: 'PDF',
        page_number: 9,
        citation_label: 'Page 9',
        snippet: 'Operating systems manage hardware abstraction and CPU scheduling.',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          chunk_id: 'pdf_chunk_42',
          page_number: 9,
          source_type: 'PDF',
          citation_label: 'Page 9',
          preview: 'Operating systems manage hardware abstraction and CPU scheduling.',
        }),
      } as any);

      render(<Citation citation={pdfCitation} />);

      // Badge renders Page 9
      const badge = screen.getByTestId('citation-pdf_chunk_42');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Page 9');

      // Click to open dialog
      fireEvent.click(badge);

      // Dialog content appears with verified evidence
      await waitFor(() => {
        expect(screen.getByText(/Textbook \/ PDF Document/i)).toBeInTheDocument();
        expect(screen.getByText(/Jump to Page 9/i)).toBeInTheDocument();
      });
    });

    it('renders Slide citation with slide number badge', () => {
      const slideCitation: CitationData = {
        chunk_id: 'slide_chunk_3',
        source_type: 'PPTX',
        slide_number: 7,
        citation_label: 'Slide 7',
        snippet: 'Amdahls law formula and speedup calculation.',
      };

      render(<Citation citation={slideCitation} />);

      const badge = screen.getByTestId('citation-slide_chunk_3');
      expect(badge).toHaveTextContent('Slide 7');
    });

    it('renders Video citation with formatted timestamp badge', () => {
      const videoCitation: CitationData = {
        chunk_id: 'vid_chunk_1',
        source_type: 'VIDEO',
        timestamp_start: 185, // 3m 05s
        timestamp_end: 215,
        citation_label: '03:05',
        snippet: 'Professor explains Peterson algorithm on the whiteboard.',
      };

      render(<Citation citation={videoCitation} />);

      const badge = screen.getByTestId('citation-vid_chunk_1');
      expect(badge).toHaveTextContent('03:05');
    });
  });
});
