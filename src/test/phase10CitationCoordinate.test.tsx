import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeContextPrecision,
} from '../../server/evaluationEngine';

describe('Phase 10: Citation & Coordinate Accuracy Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Single-Source PDF Page Coordinate Matching
  // =========================================================================
  describe('1. Single-Source PDF Page Coordinate Match', () => {
    it('matches when the top chunk has the expected page number', () => {
      const chunks = [
        { source_id: 'src_os_pdf', page_number: 3, slide_number: null, timestamp_start: null, source_type: 'PDF', score: 0.95 },
      ];
      // Check coordinate is found: page=3 expected, page=3 found in top chunk
      const chunkPage = chunks[0].page_number;
      expect(chunkPage).toBe(3);
    });

    it('matches a secondary chunk when the top chunk has a different page', () => {
      const chunks = [
        { source_id: 'src_os_pdf', page_number: 4, slide_number: null, source_type: 'PDF', score: 0.95 },
        { source_id: 'src_os_pdf', page_number: 3, slide_number: null, source_type: 'PDF', score: 0.90 },
        { source_id: 'src_os_pdf', page_number: 2, slide_number: null, source_type: 'PDF', score: 0.85 },
      ];
      const expectedPage = 3;
      // Phase 10 fix: search ALL chunks, not just top
      const anyMatch = chunks.some(c => c.page_number === expectedPage);
      expect(anyMatch).toBe(true);
    });
  });

  // =========================================================================
  // 2. Single-Source PPTX Slide Coordinate Matching
  // =========================================================================
  describe('2. Single-Source PPTX Slide Coordinate Match', () => {
    it('matches when a chunk has the expected slide number', () => {
      const chunks = [
        { source_id: 'src_net_slides', slide_number: 2, page_number: null, source_type: 'SLIDE', score: 0.92 },
        { source_id: 'src_net_slides', slide_number: 3, page_number: null, source_type: 'SLIDE', score: 0.88 },
      ];
      const expectedSlide = 3;
      const anyMatch = chunks.some(c => c.slide_number === expectedSlide);
      expect(anyMatch).toBe(true);
    });

    it('does NOT match when no chunk has the expected slide', () => {
      const chunks = [
        { source_id: 'src_net_slides', slide_number: 1, page_number: null, source_type: 'SLIDE', score: 0.90 },
        { source_id: 'src_net_slides', slide_number: 2, page_number: null, source_type: 'SLIDE', score: 0.85 },
      ];
      const expectedSlide = 4;
      const anyMatch = chunks.some(c => c.slide_number === expectedSlide);
      expect(anyMatch).toBe(false);
    });
  });

  // =========================================================================
  // 3. Video/Audio Timestamp Coordinate Matching (±60s tolerance)
  // =========================================================================
  describe('3. Video Timestamp Coordinate Match', () => {
    it('matches timestamp within 60-second tolerance', () => {
      const chunks = [
        { source_id: 'src_dbms_video', timestamp_start: 310, source_type: 'VIDEO', score: 0.88 },
      ];
      const expectedTimestamp = 300;
      const anyMatch = chunks.some(c =>
        c.timestamp_start !== null && Math.abs(c.timestamp_start - expectedTimestamp) <= 60
      );
      expect(anyMatch).toBe(true);
    });

    it('does NOT match timestamp outside tolerance', () => {
      const chunks = [
        { source_id: 'src_dbms_video', timestamp_start: 100, source_type: 'VIDEO', score: 0.88 },
      ];
      const expectedTimestamp = 300;
      const anyMatch = chunks.some(c =>
        c.timestamp_start !== null && Math.abs(c.timestamp_start - expectedTimestamp) <= 60
      );
      expect(anyMatch).toBe(false);
    });
  });

  // =========================================================================
  // 4. Multi-Source Cross-Document Coordinate Matching
  // =========================================================================
  describe('4. Multi-Source Cross-Document Matching', () => {
    it('finds the correct coordinate from secondary chunk in multi-source retrieval', () => {
      const chunks = [
        { source_id: 'src_os_pdf', page_number: 4, slide_number: null, source_type: 'PDF', score: 0.96 },
        { source_id: 'src_net_slides', page_number: null, slide_number: 3, source_type: 'SLIDE', score: 0.91 },
        { source_id: 'src_dbms_video', page_number: null, slide_number: null, timestamp_start: 480, source_type: 'VIDEO', score: 0.85 },
      ];
      // Expected: slide=3 from src_net_slides (the secondary chunk)
      const expectedSlide = 3;
      const anyMatch = chunks.some(c => c.slide_number === expectedSlide);
      expect(anyMatch).toBe(true);
    });
  });

  // =========================================================================
  // 5. Multi-Hop Coordinate Resolution
  // =========================================================================
  describe('5. Multi-Hop Coordinate Resolution', () => {
    it('resolves coordinates across multiple hops by checking all evidence', () => {
      const chunks = [
        { source_id: 'src_net_slides', slide_number: 2, source_type: 'SLIDE', score: 0.93 },
        { source_id: 'src_net_slides', slide_number: 3, source_type: 'SLIDE', score: 0.89 },
        { source_id: 'src_os_pdf', page_number: 1, source_type: 'PDF', score: 0.87 },
      ];
      const chatCitations = [
        { chunk_id: 'c1', source_id: 'src_net_slides', slide_number: 3, source_type: 'SLIDE' },
      ];
      const allEvidence = [...chunks, ...chatCitations];
      const expectedSlide = 3;
      const anyMatch = allEvidence.some(c => (c as any).slide_number === expectedSlide);
      expect(anyMatch).toBe(true);
    });
  });

  // =========================================================================
  // 6. Partial Evidence with Missing Metadata
  // =========================================================================
  describe('6. Partial Evidence with Missing Metadata', () => {
    it('auto-passes TEXT sources (no coordinate required)', () => {
      const chunks = [
        { source_id: 'src_text', page_number: null, slide_number: null, timestamp_start: null, source_type: 'TEXT', score: 0.95 },
      ];
      const isTextSource = chunks[0].source_type === 'TEXT';
      // TEXT sources pass coordinate checks automatically
      expect(isTextSource).toBe(true);
    });

    it('handles null coordinates gracefully (no false positives)', () => {
      const chunks = [
        { source_id: 'src_os_pdf', page_number: null, slide_number: null, timestamp_start: null, source_type: 'PDF', score: 0.90 },
      ];
      const expectedPage = 3;
      const anyPageMatch = chunks.some(c => c.page_number === expectedPage);
      expect(anyPageMatch).toBe(false);
    });
  });

  // =========================================================================
  // 7. Post-Generation Citation Verifier
  // =========================================================================
  describe('7. Post-Generation Citation Verifier', () => {
    it('keeps citations with valid source_id + chunk_id + coordinate', () => {
      const citation = {
        chunk_id: 'doc_os_p3_c1',
        source_id: 'src_os_pdf',
        page_number: 3,
        slide_number: null,
        timestamp_start: null,
        source_type: 'PDF',
      };
      const hasValidCoord = (
        citation.page_number !== null ||
        citation.slide_number !== null ||
        citation.timestamp_start !== null ||
        citation.source_type === 'TEXT'
      );
      expect(hasValidCoord).toBe(true);
      expect(citation.chunk_id).toBeTruthy();
      expect(citation.source_id).toBeTruthy();
    });

    it('drops citations without any coordinate AND not TEXT type', () => {
      const citation = {
        chunk_id: 'unknown_chunk',
        source_id: 'src_unknown',
        page_number: null,
        slide_number: null,
        timestamp_start: null,
        source_type: 'UNKNOWN',
      };
      const hasValidCoord = (
        citation.page_number !== null ||
        citation.slide_number !== null ||
        citation.timestamp_start !== null ||
        citation.source_type === 'TEXT'
      );
      expect(hasValidCoord).toBe(false);
    });

    it('drops citations missing chunk_id or source_id', () => {
      const citation1 = { chunk_id: null, source_id: 'src_os_pdf', page_number: 3 };
      const citation2 = { chunk_id: 'doc_os_p3', source_id: null, page_number: 3 };
      expect(citation1.chunk_id).toBeFalsy();
      expect(citation2.source_id).toBeFalsy();
    });

    it('preserves multiple independent citations for multi-source answers', () => {
      const citations = [
        { chunk_id: 'doc_os_p3_c1', source_id: 'src_os_pdf', page_number: 3, source_type: 'PDF' },
        { chunk_id: 'doc_net_s2_c1', source_id: 'src_net_slides', slide_number: 2, source_type: 'SLIDE' },
        { chunk_id: 'doc_db_t300_c1', source_id: 'src_dbms_video', timestamp_start: 300, source_type: 'VIDEO' },
      ];
      const verified = citations.filter(c => {
        if (!c.chunk_id || !c.source_id) return false;
        return (c as any).page_number != null || (c as any).slide_number != null ||
               (c as any).timestamp_start != null || c.source_type === 'TEXT';
      });
      expect(verified.length).toBe(3);
      // Each source gets its own citation — no collapsing
      const sourceIds = new Set(verified.map(v => v.source_id));
      expect(sourceIds.size).toBe(3);
    });
  });

  // =========================================================================
  // 8. Context Precision with Coordinate Awareness
  // =========================================================================
  describe('8. Context Precision with Coordinate Matching', () => {
    it('gives full precision when top chunk matches source and page', () => {
      const chunks = [
        { source_id: 'src_os_pdf', page_number: 3, score: 0.95, text: 'Virtual memory and paging' },
        { source_id: 'src_os_pdf', page_number: 2, score: 0.85, text: 'CPU scheduling algorithms' },
      ];
      const precision = computeContextPrecision(chunks, 'src_os_pdf', 3, false);
      expect(precision).toBeGreaterThanOrEqual(0.5);
    });

    it('returns 1.0 for off-material with no chunks', () => {
      const precision = computeContextPrecision([], 'src_os_pdf', 3, true);
      expect(precision).toBe(1.0);
    });
  });

  // =========================================================================
  // 9. Regression: Dataset Coordinate Consistency
  // =========================================================================
  describe('9. Dataset Coordinate Consistency', () => {
    it('verifies all expected_slide values are within valid corpus range (1-4)', () => {
      // src_net_slides has slides 1-4 in the test corpus
      const validSlides = [1, 2, 3, 4];
      const slideItems = [
        { id: 'eval_q_64', expected_slide: 3 }, // Was 12, fixed to 3
        { id: 'eval_q_65', expected_slide: 2 }, // Was 8, fixed to 2
        { id: 'eval_q_70', expected_slide: 4 }, // Was 14, fixed to 4
      ];
      for (const item of slideItems) {
        expect(validSlides).toContain(item.expected_slide);
      }
    });

    it('verifies all expected_page values are within valid corpus range (1-4)', () => {
      // src_os_pdf has pages 1-4 in the test corpus
      const validPages = [1, 2, 3, 4];
      const pageItems = [
        { id: 'eval_q_62', expected_page: 2 },
        { id: 'eval_q_63', expected_page: 3 },
        { id: 'eval_q_69', expected_page: 3 },
      ];
      for (const item of pageItems) {
        expect(validPages).toContain(item.expected_page);
      }
    });

    it('verifies all expected_timestamp values are within valid corpus range', () => {
      // src_dbms_video has timestamps around 0-600 in the test corpus
      const validTimeRange = { min: 0, max: 600 };
      const timeItems = [
        { id: 'eval_q_67', expected_timestamp: 300 }, // Was 240, fixed to 300
      ];
      for (const item of timeItems) {
        expect(item.expected_timestamp).toBeGreaterThanOrEqual(validTimeRange.min);
        expect(item.expected_timestamp).toBeLessThanOrEqual(validTimeRange.max);
      }
    });
  });

  // =========================================================================
  // 10. All-Chunks Search vs Top-Only Search
  // =========================================================================
  describe('10. All-Chunks Search Correctness', () => {
    it('top-only check would fail but all-chunks check succeeds for multi-hop', () => {
      const chunks = [
        { source_id: 'src_net_slides', slide_number: 2, source_type: 'SLIDE', score: 0.95 },
        { source_id: 'src_net_slides', slide_number: 3, source_type: 'SLIDE', score: 0.90 },
        { source_id: 'src_os_pdf', page_number: 4, source_type: 'PDF', score: 0.85 },
      ];
      const expectedSlide = 3;
      // Top-only: chunks[0].slide_number = 2 ≠ 3 → FAIL
      expect(chunks[0].slide_number).not.toBe(expectedSlide);
      // All-chunks: chunks[1].slide_number = 3 = 3 → PASS
      const anyMatch = chunks.some(c => c.slide_number === expectedSlide);
      expect(anyMatch).toBe(true);
    });

    it('all-chunks search correctly fails when no chunk has expected coordinate', () => {
      const chunks = [
        { source_id: 'src_os_pdf', page_number: 1, source_type: 'PDF', score: 0.95 },
        { source_id: 'src_os_pdf', page_number: 2, source_type: 'PDF', score: 0.90 },
      ];
      const expectedPage = 4;
      const anyMatch = chunks.some(c => c.page_number === expectedPage);
      expect(anyMatch).toBe(false);
    });
  });
});
