import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SourceViewer } from '@/components/viewer/SourceViewer';
import { PdfViewer } from '@/components/viewer/PdfViewer';
import { VideoViewer } from '@/components/viewer/VideoViewer';
import { Citation } from '@/components/chat/Citation';
import { ChatMessageRenderer } from '@/components/chat/ChatMessageRenderer';
import {
  buildCanonicalEvidenceIndex,
  verifyCitation,
  verifyGroundedAnswer,
  extractClaimsFromAnswer,
  type VerificationContext,
  type ResourceVerificationRecord,
} from '../../server/citationVerifier.ts';
import type { CitationData } from '@/types/resource';

describe('EXACT EVIDENCE CITATION & 6 REPRESENTATIVE FIXTURES VERIFICATION', () => {
  const originalFetch = global.fetch;
  const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-exact-evidence');
  const mockRevokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const setupMockFileFetch = (content = 'dummy binary content', status = 200, contentType = 'application/pdf') => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/resources/')) {
        if (status !== 200) {
          return {
            ok: false,
            status,
            statusText: status === 403 ? 'Forbidden' : 'Not Found',
            json: async () => ({ error: 'Access denied' }),
            text: async () => 'Access denied',
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Type': contentType,
            'Content-Length': String(content.length),
          }),
          blob: async () => new Blob([content], { type: contentType }),
        };
      }
      return {
        ok: true,
        json: async () => ({}),
      };
    });
  };

  // Authoritative Resource Checker for Deterministic Citation Engine
  const authoritativeResourceChecker = async (resourceId: string): Promise<ResourceVerificationRecord | null> => {
    if (resourceId === 'res_normal_pdf') {
      return {
        userId: 'student_123',
        tenantType: 'USER_PRIVATE',
        exists: true,
        isDeleted: false,
      };
    }
    if (resourceId === 'res_scanned_pdf') {
      return {
        userId: 'student_123',
        tenantType: 'USER_PRIVATE',
        exists: true,
        isDeleted: false,
      };
    }
    if (resourceId === 'res_mixed_pdf') {
      return {
        userId: 'student_123',
        tenantType: 'USER_PRIVATE',
        exists: true,
        isDeleted: false,
      };
    }
    if (resourceId === 'res_lecture_video') {
      return {
        userId: 'student_123',
        tenantType: 'USER_PRIVATE',
        exists: true,
        isDeleted: false,
      };
    }
    if (resourceId === 'res_other_tenant_pdf') {
      return {
        userId: 'other_user_999',
        tenantType: 'USER_PRIVATE',
        exists: true,
        isDeleted: false,
      };
    }
    return null;
  };

  // ============================================================================
  // FIXTURE 1: Normal Text PDF (Selectable text + Bounding coordinates + Page Label)
  // ============================================================================
  describe('Fixture 1: Normal Text PDF', () => {
    it('1.1. Ingestion preserves exact bounding box coordinates and displayed page label', () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_pdf_text_1',
          resource_id: 'res_normal_pdf',
          source_type: 'PDF',
          page_number: 3,
          page_label: 'iii',
          physical_page_index: 3,
          evidence_type: 'TEXT_PASSAGE',
          has_precise_coordinates: true,
          bounding_box: { x: 12.5, y: 24.0, width: 75.0, height: 8.5, unit: 'percent' },
          text: 'Virtual memory isolates process address spaces and translates virtual pages to physical frames.',
        },
      ], 'student_123');

      const item = evidenceIndex.byChunkId.get('chk_pdf_text_1');
      expect(item).toBeDefined();
      expect(item?.page_label).toBe('iii');
      expect(item?.physical_page_index).toBe(3);
      expect(item?.has_precise_coordinates).toBe(true);
      expect(item?.bounding_box).toEqual({ x: 12.5, y: 24.0, width: 75.0, height: 8.5, unit: 'percent' });
    });

    it('1.2. PDF viewer renders exact coordinate highlight and displays clean page label', async () => {
      setupMockFileFetch('Normal PDF text content', 200, 'application/pdf');

      render(
        <PdfViewer
          resourceId="res_normal_pdf"
          pageNumber={3}
          pageLabel="iii"
          title="Operating Systems Principles"
          excerpt="Virtual memory isolates process address spaces"
          hasPreciseCoordinates={true}
          boundingBox={{ x: 12.5, y: 24.0, width: 75.0, height: 8.5, unit: 'percent' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('iii')).toBeInTheDocument();
        const highlight = screen.getByTestId('pdf-coordinate-highlight');
        expect(highlight).toBeInTheDocument();
        expect(highlight.style.left).toBe('12.5%');
        expect(highlight.style.top).toBe('24%');
        expect(highlight.style.width).toBe('75%');
        expect(highlight.style.height).toBe('8.5%');
      });
    });

    it('1.3. Rotates and zooms PDF viewport without losing coordinate highlight overlay', async () => {
      setupMockFileFetch('Normal PDF text content', 200, 'application/pdf');

      render(
        <PdfViewer
          resourceId="res_normal_pdf"
          pageNumber={3}
          pageLabel="iii"
          title="Operating Systems Principles"
          excerpt="Virtual memory isolates process address spaces"
          hasPreciseCoordinates={true}
          boundingBox={{ x: 12.5, y: 24.0, width: 75.0, height: 8.5, unit: 'percent' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-coordinate-highlight')).toBeInTheDocument();
      });

      // Rotate 90 degrees
      const rotateBtn = screen.getByTitle('Rotate 90°');
      fireEvent.click(rotateBtn);

      // Zoom in
      const zoomInBtn = screen.getByTitle('Zoom In');
      fireEvent.click(zoomInBtn);

      expect(screen.getByText('120%')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-coordinate-highlight')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // FIXTURE 2: Scanned PDF (Full-page OCR without fake bounding boxes)
  // ============================================================================
  describe('Fixture 2: Scanned PDF', () => {
    it('2.1. Ingestion marks coordinates unavailable and never invents fake coordinates', () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_scanned_p1',
          resource_id: 'res_scanned_pdf',
          source_type: 'PDF',
          page_number: 1,
          page_label: '1',
          physical_page_index: 1,
          evidence_type: 'TEXT_PASSAGE',
          has_precise_coordinates: false,
          bounding_box: null,
          uncertainty_score: 0.15,
          uncertainty_note: 'Scanned document page: full-page OCR extracted; precise coordinate highlight unavailable.',
          text: 'Paging mechanisms translate virtual page numbers to physical page frame numbers using page tables.',
        },
      ], 'student_123');

      const item = evidenceIndex.byChunkId.get('chk_scanned_p1');
      expect(item).toBeDefined();
      expect(item?.has_precise_coordinates).toBe(false);
      expect(item?.bounding_box).toBeNull();
      expect(item?.uncertainty_note).toContain('precise coordinate highlight unavailable');
    });

    it('2.2. PDF viewer renders full-page scan notice and does NOT draw an invented highlight', async () => {
      setupMockFileFetch('Scanned PDF image stream', 200, 'application/pdf');

      render(
        <PdfViewer
          resourceId="res_scanned_pdf"
          pageNumber={1}
          pageLabel="1"
          title="Historical Computing Scans"
          excerpt="Paging mechanisms translate virtual page numbers"
          hasPreciseCoordinates={false}
          boundingBox={null}
          uncertaintyNote="Scanned document page: full-page OCR extracted; precise coordinate highlight unavailable."
        />
      );

      await waitFor(() => {
        // Notice must be displayed
        const scanNotice = screen.getByTestId('pdf-highlight-unavailable-notice');
        expect(scanNotice).toBeInTheDocument();
        expect(scanNotice).toHaveTextContent(/Precise coordinate highlight unavailable for this document scan/i);
        expect(screen.getByText('Full-Page Scan')).toBeInTheDocument();

        // Must NEVER render an invented highlight overlay
        expect(screen.queryByTestId('pdf-coordinate-highlight')).toBeNull();
      });
    });

    it('2.3. Renders multi-region passage in column 1 without bridging into column 2', async () => {
      setupMockFileFetch('Two-column scanned document', 200, 'application/pdf');

      const col1Regions = [
        { x: 5.0, y: 18.0, width: 42.0, height: 3.2, unit: 'percent' as const },
        { x: 5.0, y: 22.0, width: 42.0, height: 3.2, unit: 'percent' as const },
        { x: 5.0, y: 26.0, width: 39.0, height: 3.2, unit: 'percent' as const },
      ];

      render(
        <PdfViewer
          resourceId="res_scanned_pdf"
          pageNumber={1}
          pageLabel="1"
          title="Two-Column Spectroscopy Notes"
          excerpt="In wave mechanics and spectroscopy, radiation is characterized by wave vectors"
          hasPreciseCoordinates={true}
          regions={col1Regions}
          localizationConfidence={0.98}
          evidenceType="TEXT_PASSAGE"
        />
      );

      await waitFor(() => {
        const highlights = screen.getAllByTestId('pdf-coordinate-highlight');
        expect(highlights).toHaveLength(3);

        // Every line region must be strictly confined to Column 1 (x + width <= 48%)
        highlights.forEach((hl, idx) => {
          expect(hl).toHaveAttribute('data-region-index', String(idx));
          const leftVal = parseFloat(hl.style.left);
          const widthVal = parseFloat(hl.style.width);
          expect(leftVal).toBe(5.0);
          expect(leftVal + widthVal).toBeLessThanOrEqual(48.0);
        });

        // First region displays supporting evidence label badge
        expect(screen.getByText('Supporting Evidence Passage')).toBeInTheDocument();
      });
    });

    it('2.4. Scanned equation displays authentic crop and optical ambiguity note while confining highlight to column 2', async () => {
      setupMockFileFetch('Scanned equation page', 200, 'application/pdf');
      const mockAuthenticCrop = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      const col2Regions = [
        { x: 54.0, y: 17.5, width: 41.0, height: 13.0, unit: 'percent' as const },
      ];

      render(
        <PdfViewer
          resourceId="res_scanned_pdf"
          pageNumber={1}
          pageLabel="1"
          title="Two-Column Spectroscopy Notes"
          excerpt="~nu = 1 / lambda"
          hasPreciseCoordinates={true}
          regions={col2Regions}
          localizationConfidence={0.96}
          evidenceType="EQUATION"
          equationCropData={mockAuthenticCrop}
          equationNotation="~nu = 1 / lambda"
          surroundingContext="where lambda denotes vacuum wavelength in meters."
          uncertaintyNote="Optical symbol ambiguity detected in scanned notation (~nu vs nu_0); inspect original visual evidence crop."
        />
      );

      await waitFor(() => {
        // Highlight in Column 2 (left >= 50%)
        const highlights = screen.getAllByTestId('pdf-coordinate-highlight');
        expect(highlights).toHaveLength(1);
        expect(parseFloat(highlights[0].style.left)).toBe(54.0);

        // Authentic crop panel
        const cropPanel = screen.getByTestId('pdf-evidence-crop-panel');
        expect(cropPanel).toBeInTheDocument();
        expect(screen.getByText('~nu = 1 / lambda')).toBeInTheDocument();
        expect(screen.getByAltText('Authentic Supporting Document Crop')).toBeInTheDocument();

        // Ambiguity callout
        const uncCallout = screen.getByTestId('pdf-uncertainty-callout');
        expect(uncCallout).toBeInTheDocument();
        expect(uncCallout).toHaveTextContent(/Optical symbol ambiguity detected/i);
      });
    });

    it('2.5. Supports rotated page (90 deg clockwise) coordinate transformation and viewer alignment', async () => {
      setupMockFileFetch('Rotated scanned page', 200, 'application/pdf');

      // Coordinates after 90 deg clockwise transformation
      const rotatedRegions = [
        { x: 76.0, y: 6.0, width: 4.5, height: 88.0, unit: 'percent' as const },
        { x: 72.0, y: 6.0, width: 4.5, height: 88.0, unit: 'percent' as const },
      ];

      render(
        <PdfViewer
          resourceId="res_scanned_pdf"
          pageNumber={2}
          pageLabel="2"
          title="Planck Radiation Sheet"
          excerpt="Planck's radiation law describes spectral energy density"
          hasPreciseCoordinates={true}
          regions={rotatedRegions}
          localizationConfidence={0.95}
          evidenceType="TEXT_PASSAGE"
        />
      );

      await waitFor(() => {
        const highlights = screen.getAllByTestId('pdf-coordinate-highlight');
        expect(highlights).toHaveLength(2);
        expect(parseFloat(highlights[0].style.left)).toBe(76.0);
        expect(parseFloat(highlights[0].style.height)).toBe(88.0);
      });
    });

    it('2.6. Degraded archival scan displays full-page fallback notice without inventing coordinates', async () => {
      setupMockFileFetch('Degraded archival scan', 200, 'application/pdf');

      render(
        <PdfViewer
          resourceId="res_scanned_pdf"
          pageNumber={3}
          pageLabel="3"
          title="Archival Fragment 3"
          excerpt="Degraded historical manuscript with severe ink bleeding"
          hasPreciseCoordinates={false}
          boundingBox={null}
          regions={null}
          localizationConfidence={null}
          uncertaintyNote="Scanned document page 3: degraded archival scan; precise coordinate highlight unavailable."
        />
      );

      await waitFor(() => {
        const fallbackNotice = screen.getByTestId('pdf-highlight-unavailable-notice');
        expect(fallbackNotice).toBeInTheDocument();
        expect(fallbackNotice).toHaveTextContent(/Precise coordinate highlight unavailable for this document scan. Showing Page 3/i);
        expect(screen.queryByTestId('pdf-coordinate-highlight')).toBeNull();
      });
    });

    it('2.7. Separates localization confidence from mathematical interpretation uncertainty in canonical evidence index', () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_col2_eq',
          resource_id: 'res_scanned_pdf',
          source_type: 'PDF',
          page_number: 1,
          page_label: '1',
          evidence_type: 'EQUATION',
          has_precise_coordinates: true,
          regions: [{ x: 54.0, y: 17.5, width: 41.0, height: 13.0, unit: 'percent' }],
          localization_confidence: 0.96, // Spatial coordinate certainty is HIGH
          uncertainty_score: 0.45,       // Mathematical notation interpretation is AMBIGUOUS
          uncertainty_note: 'Optical symbol ambiguity detected in scanned notation (~nu vs nu_0); inspect original visual evidence crop.',
          text: 'Spectroscopic wavenumber formulation: ~nu = 1 / lambda',
        },
      ], 'student_123');

      const item = evidenceIndex.byChunkId.get('chk_col2_eq');
      expect(item).toBeDefined();
      expect(item?.has_precise_coordinates).toBe(true);
      expect(item?.localization_confidence).toBe(0.96);
      expect(item?.uncertainty_score).toBe(0.45);
      expect(item?.uncertainty_note).toContain('Optical symbol ambiguity detected');
      expect(item?.regions).toHaveLength(1);
    });
  });

  // ============================================================================
  // FIXTURE 3: Mixed PDF (Selectable prose + Image-only Equations + Context)
  // ============================================================================
  describe('Fixture 3: Mixed PDF with Equations & Context', () => {
    it('3.1. Bundles equation crop data, notation, and surrounding context definitions', () => {
      const mockCropData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_mixed_eq_4',
          resource_id: 'res_mixed_pdf',
          source_type: 'PDF',
          page_number: 4,
          page_label: '4',
          physical_page_index: 4,
          evidence_type: 'EQUATION',
          has_precise_coordinates: true,
          bounding_box: { x: 20.0, y: 45.0, width: 60.0, height: 12.0, unit: 'percent' },
          equation_crop_data: mockCropData,
          equation_notation: 'E = m c^2',
          surrounding_context: 'Where E denotes relativistic energy, m denotes invariant rest mass, and c is the speed of light in vacuum.',
          text: 'Relativistic Energy Equation: E = mc^2. Where E denotes relativistic energy and m denotes invariant mass.',
        },
      ], 'student_123');

      const item = evidenceIndex.byChunkId.get('chk_mixed_eq_4');
      expect(item).toBeDefined();
      expect(item?.evidence_type).toBe('EQUATION');
      expect(item?.equation_crop_data).toBe(mockCropData);
      expect(item?.equation_notation).toBe('E = m c^2');
      expect(item?.surrounding_context).toContain('invariant rest mass');
    });

    it('3.2. PDF viewer renders authentic equation crop panel and context definitions', async () => {
      setupMockFileFetch('Mixed PDF content', 200, 'application/pdf');
      const mockCropData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      render(
        <PdfViewer
          resourceId="res_mixed_pdf"
          pageNumber={4}
          pageLabel="4"
          title="Physics and Relativity"
          excerpt="E = mc^2"
          hasPreciseCoordinates={true}
          evidenceType="EQUATION"
          equationCropData={mockCropData}
          equationNotation="E = m c^2"
          surroundingContext="Where E denotes relativistic energy, m denotes invariant rest mass, and c is the speed of light in vacuum."
        />
      );

      await waitFor(() => {
        const cropPanel = screen.getByTestId('pdf-evidence-crop-panel');
        expect(cropPanel).toBeInTheDocument();
        expect(screen.getByText('E = m c^2')).toBeInTheDocument();
        expect(screen.getByText(/Authentic Document Evidence Crop/i)).toBeInTheDocument();
        expect(screen.getByText(/Where E denotes relativistic energy/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // FIXTURE 4: Lecture with Timestamped Transcript vs Video Frame Evidence
  // ============================================================================
  describe('Fixture 4: Lecture Media (Transcript vs Video Frame)', () => {
    it('4.1. Ingestion distinguishes spoken transcript from on-screen video frames', () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_lec_trans_1',
          resource_id: 'res_lecture_video',
          source_type: 'VIDEO',
          timestamp_start: 145.0,
          timestamp_end: 180.0,
          timing_precision: 'SEGMENT',
          evidence_type: 'TRANSCRIPT',
          text: 'The professor explains: Amdahls law governs the theoretical speedup of latency with fixed workload.',
        },
        {
          chunk_id: 'chk_lec_frame_2',
          resource_id: 'res_lecture_video',
          source_type: 'VIDEO',
          timestamp_start: 160.0,
          timestamp_end: 165.0,
          timing_precision: 'FRAME',
          evidence_type: 'VIDEO_FRAME',
          text: 'On-screen slide diagram displays formula: Speedup(s) = 1 / ((1 - p) + p/s)',
        },
      ], 'student_123');

      const transChunk = evidenceIndex.byChunkId.get('chk_lec_trans_1');
      const frameChunk = evidenceIndex.byChunkId.get('chk_lec_frame_2');

      expect(transChunk?.evidence_type).toBe('TRANSCRIPT');
      expect(transChunk?.timing_precision).toBe('SEGMENT');
      expect(frameChunk?.evidence_type).toBe('VIDEO_FRAME');
      expect(frameChunk?.timing_precision).toBe('FRAME');
    });

    it('4.2. Video viewer shows segment precision and spoken transcript label', async () => {
      setupMockFileFetch('Video binary media', 200, 'video/mp4');

      render(
        <VideoViewer
          resourceId="res_lecture_video"
          timestampStart={145.0}
          timestampEnd={180.0}
          timingPrecision="SEGMENT"
          evidenceType="TRANSCRIPT"
          title="CS101 Lecture 4: Parallel Architecture"
          excerpt="Amdahls law governs theoretical speedup"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('video-player-element')).toBeInTheDocument();
        expect(screen.getByText(/Segment Precision/i)).toBeInTheDocument();
        expect(screen.getByText(/Spoken Audio Transcript/i)).toBeInTheDocument();
      });
    });

    it('4.3. Video viewer shows on-screen visual frame badge for video frame evidence', async () => {
      setupMockFileFetch('Video binary media', 200, 'video/mp4');

      render(
        <VideoViewer
          resourceId="res_lecture_video"
          timestampStart={160.0}
          timestampEnd={165.0}
          timingPrecision="FRAME"
          evidenceType="VIDEO_FRAME"
          title="CS101 Lecture 4: Parallel Architecture"
          excerpt="Speedup(s) = 1 / ((1 - p) + p/s)"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('video-player-element')).toBeInTheDocument();
        expect(screen.getByText(/Visual Video Frame/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // FIXTURE 5: Ambiguous Equation (Uncertainty Note without silent repair)
  // ============================================================================
  describe('Fixture 5: Ambiguous Equation & Honest Limitations', () => {
    it('5.1. Citation verification preserves equation uncertainty score and note', async () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_ambiguous_eq_1',
          resource_id: 'res_mixed_pdf',
          source_type: 'PDF',
          page_number: 6,
          page_label: '6',
          evidence_type: 'EQUATION',
          has_precise_coordinates: true,
          equation_notation: '\\tilde{\\nu} \\approx c / \\lambda',
          uncertainty_score: 0.38,
          uncertainty_note: 'Ambiguous optical character: symbol resembles tilde nu (\\tilde{\\nu}) or nu subscript zero (\\nu_0).',
          text: 'Wavenumber equation: \\tilde{\\nu} \\approx c / \\lambda',
        },
      ], 'student_123');

      const context: VerificationContext = {
        authenticatedUserId: 'student_123',
        evidenceIndex,
        resourceChecker: authoritativeResourceChecker,
      };

      const result = await verifyCitation(
        {
          chunk_id: 'chk_ambiguous_eq_1',
          resource_id: 'res_mixed_pdf',
          page_number: 6,
          excerpt: 'Wavenumber equation: \\tilde{\\nu} \\approx c / \\lambda',
        },
        context
      );

      expect(result.verification_status).toBe('VERIFIED');
      expect(result.uncertainty_score).toBe(0.38);
      expect(result.uncertainty_note).toContain('Ambiguous optical character');
    });

    it('5.2. UI displays explicit uncertainty alert banner without concealing limitations', async () => {
      render(
        <Citation
          citationIndex={1}
          citation={{
            chunk_id: 'chk_ambiguous_eq_1',
            resource_id: 'res_mixed_pdf',
            source_type: 'PDF',
            page_number: 6,
            citation_label: 'Page 6',
            snippet: 'Wavenumber equation',
            evidence_type: 'EQUATION',
            uncertainty_note: 'Ambiguous optical character: symbol resembles tilde nu or nu_0.',
            verification_status: 'VERIFIED',
          }}
          onClick={() => {}}
        />
      );

      // Clicking the citation pill opens the citation detail dialog
      const trigger = screen.getByRole('button', { name: /Formula/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const note = screen.getByTestId('citation-uncertainty-note');
        expect(note).toBeInTheDocument();
        expect(note).toHaveTextContent(/Ambiguous optical character/i);
      });

      // Also verify PDF viewer callout renders directly
      setupMockFileFetch('PDF content', 200, 'application/pdf');
      render(
        <PdfViewer
          resourceId="res_mixed_pdf"
          pageNumber={6}
          title="Math Physics"
          uncertaintyNote="Ambiguous optical character: symbol resembles tilde nu or nu_0."
        />
      );

      await waitFor(() => {
        const callout = screen.getByTestId('pdf-uncertainty-callout');
        expect(callout).toBeInTheDocument();
        expect(callout).toHaveTextContent(/Ambiguous optical character/i);
      });
    });
  });

  // ============================================================================
  // FIXTURE 6: Unsupported Question & Segregated Outside Knowledge
  // ============================================================================
  describe('Fixture 6: Unsupported Question & Outside Knowledge Segregation', () => {
    it('6.1. Rejects answers citing non-existent evidence or unsupported course claims', async () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_os_1',
          resource_id: 'res_normal_pdf',
          source_type: 'PDF',
          page_number: 1,
          text: 'Operating system kernels manage hardware devices and CPU scheduling.',
        },
      ], 'student_123');

      const context: VerificationContext = {
        authenticatedUserId: 'student_123',
        evidenceIndex,
        resourceChecker: authoritativeResourceChecker,
      };

      // Learner asked: "What is quantum superposition?"
      // LLM tries to fabricate an answer citing non-existent evidence
      const result = await verifyGroundedAnswer(
        {
          answer: 'Quantum superposition allows particles to exist in multiple states simultaneously [EVIDENCE_99].',
        },
        context
      );

      expect(result.grounded).toBe(false);
      expect(result.unsupported_claims.length).toBeGreaterThan(0);
      expect(result.claims[0].support_status).toBe('UNVERIFIED');
    });

    it('6.2. Clearly segregates permitted outside knowledge from course-supported claims', () => {
      const answerWithOutsideKnowledge = `
According to the textbook, virtual memory protects process memory from unauthorized tampering [1].

### 🌐 General Knowledge (Outside Course Materials)
In modern quantum cryptography, quantum key distribution provides theoretical forward secrecy.
      `;

      const claims = extractClaimsFromAnswer(answerWithOutsideKnowledge);
      expect(claims.length).toBe(2);

      // Claim 1 is course material
      expect((claims[0] as any).is_outside_knowledge).toBeFalsy();
      expect(claims[0].evidence_ids).toEqual(['EVIDENCE_1']);

      // Claim 2 is outside knowledge
      expect((claims[1] as any).is_outside_knowledge).toBe(true);
      expect(claims[1].text).toContain('quantum key distribution');
    });
  });

  // ============================================================================
  // CLAIM-LEVEL NUMBERED CITATIONS & CHAT RENDERING
  // ============================================================================
  describe('Claim-to-Evidence Mapping & Clickable Numbered Citations', () => {
    it('7.1. Assigns sequential numbered citations [1], [2] to grounded claims', async () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_ev_1',
          resource_id: 'res_normal_pdf',
          source_type: 'PDF',
          page_number: 2,
          page_label: '2',
          text: 'Process isolation prevents user applications from writing kernel memory directly.',
        },
        {
          chunk_id: 'chk_ev_2',
          resource_id: 'res_normal_pdf',
          source_type: 'PDF',
          page_number: 5,
          page_label: '5',
          text: 'Page tables translate 48-bit virtual addresses into physical RAM frames.',
        },
      ], 'student_123');

      const context: VerificationContext = {
        authenticatedUserId: 'student_123',
        evidenceIndex,
        resourceChecker: authoritativeResourceChecker,
      };

      const rawAnswer = 'Process isolation prevents tampering [EVIDENCE_1]. Virtual addresses map to physical RAM [EVIDENCE_2].';
      const verified = await verifyGroundedAnswer({ answer: rawAnswer }, context);

      expect(verified.grounded).toBe(true);
      expect(verified.claims.length).toBe(2);
      expect(verified.citations.length).toBe(2);
      expect(verified.citations[0].citation_number).toBe(1);
      expect(verified.citations[1].citation_number).toBe(2);
    });

    it('7.2. Chat message renderer parses inline citation pills and triggers onCitationClick', () => {
      const handleCitationClick = vi.fn();
      const citations: CitationData[] = [
        {
          chunk_id: 'chk_ev_1',
          resource_id: 'res_normal_pdf',
          source_type: 'PDF',
          page_number: 2,
          citation_number: 1,
          citation_label: 'Page 2',
          snippet: 'Process isolation prevents user applications from writing kernel memory',
          verification_status: 'VERIFIED',
        },
      ];

      render(
        <ChatMessageRenderer
          content="Process isolation prevents unauthorized tampering [1]."
          citations={citations}
          onOpenCitation={handleCitationClick}
        />
      );

      const pill = screen.getByRole('button', { name: /\[1\]/i });
      expect(pill).toBeInTheDocument();
      fireEvent.click(pill);

      expect(handleCitationClick).toHaveBeenCalledTimes(1);
      expect(handleCitationClick).toHaveBeenCalledWith(citations[0]);
    });
  });

  // ============================================================================
  // NAVIGATION, PERSISTENCE & TENANT ISOLATION
  // ============================================================================
  describe('Navigation, Reload State & Tenant Isolation', () => {
    it('8.1. Blocks cross-tenant citation verification deterministically', async () => {
      const evidenceIndex = buildCanonicalEvidenceIndex([
        {
          chunk_id: 'chk_tenant_b_1',
          resource_id: 'res_other_tenant_pdf', // Belongs to other_user_999
          user_id: 'other_user_999',
          tenant_type: 'USER_PRIVATE',
          source_type: 'PDF',
          page_number: 1,
          text: 'Private proprietary notes belonging to Tenant B.',
        },
      ], 'student_123');

      const context: VerificationContext = {
        authenticatedUserId: 'student_123', // Active requester
        evidenceIndex,
        resourceChecker: authoritativeResourceChecker,
      };

      const result = await verifyCitation(
        {
          chunk_id: 'chk_tenant_b_1',
          resource_id: 'res_other_tenant_pdf',
          page_number: 1,
          excerpt: 'Private proprietary notes',
        },
        context
      );

      expect(result.verification_status).toBe('CROSS_TENANT_REJECTED');
    });

    it('8.2. Source viewer handles CROSS_TENANT_REJECTED with zero-trust modal boundary', async () => {
      const unauthorizedCitation: CitationData = {
        chunk_id: 'chk_tenant_b_1',
        resource_id: 'res_other_tenant_pdf',
        source_type: 'PDF',
        page_number: 1,
        citation_label: 'Page 1',
        verification_status: 'CROSS_TENANT_REJECTED',
      };

      render(
        <SourceViewer
          isOpen={true}
          onClose={() => {}}
          citation={unauthorizedCitation}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cross-Tenant Access Prohibited')).toBeInTheDocument();
        expect(screen.getByText(/This cited evidence belongs to another private user workspace/i)).toBeInTheDocument();
      });
    });

    it('8.3. Source viewer handles 403 Forbidden on unauthorized document file download', async () => {
      setupMockFileFetch('Unauthorized document', 403, 'application/pdf');

      const forbiddenCitation: CitationData = {
        chunk_id: 'chk_forbidden_1',
        resource_id: 'res_other_tenant_pdf',
        source_type: 'PDF',
        page_number: 1,
        citation_label: 'Page 1',
        verification_status: 'VERIFIED',
      };

      render(
        <SourceViewer
          isOpen={true}
          onClose={() => {}}
          citation={forbiddenCitation}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
        expect(screen.getByText(/This resource belongs to another student workspace and cannot be accessed/i)).toBeInTheDocument();
      });
    });

    it('8.4. Persists citations and highlights consistently across component reloads', async () => {
      setupMockFileFetch('Persisted document content', 200, 'application/pdf');

      const citation: CitationData = {
        chunk_id: 'chk_pdf_text_1',
        resource_id: 'res_normal_pdf',
        source_type: 'PDF',
        page_number: 3,
        page_label: 'iii',
        bounding_box: { x: 12.5, y: 24.0, width: 75.0, height: 8.5, unit: 'percent' },
        has_precise_coordinates: true,
        verification_status: 'VERIFIED',
      };

      const { unmount } = render(
        <SourceViewer
          isOpen={true}
          onClose={() => {}}
          citation={citation}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-coordinate-highlight')).toBeInTheDocument();
      });

      // Simulate page reload / unmount and remount
      unmount();

      render(
        <SourceViewer
          isOpen={true}
          onClose={() => {}}
          citation={citation}
        />
      );

      await waitFor(() => {
        const highlight = screen.getByTestId('pdf-coordinate-highlight');
        expect(highlight).toBeInTheDocument();
        expect(highlight.style.left).toBe('12.5%');
        expect(highlight.style.top).toBe('24%');
      });
    });
  });
});
