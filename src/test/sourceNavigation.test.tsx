import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Citation } from '@/components/chat/Citation';
import { SourceViewer } from '@/components/viewer/SourceViewer';
import { PdfViewer } from '@/components/viewer/PdfViewer';
import { PresentationViewer } from '@/components/viewer/PresentationViewer';
import { ImageViewer } from '@/components/viewer/ImageViewer';
import { VideoViewer } from '@/components/viewer/VideoViewer';
import { AudioViewer } from '@/components/viewer/AudioViewer';
import { TextViewer } from '@/components/viewer/TextViewer';
import { getResourceFileUrl, fetchResourceFile } from '@/api/resourceAPI';
import type { CitationData } from '@/types/resource';

describe('CANONICAL PHASE 3 STEP 4: Exact Source Viewers & Citation Navigation', () => {
  const originalFetch = global.fetch;
  const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-uuid');
  const mockRevokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Helper to create mock authenticated fetch response
  const setupMockFileFetch = (content = 'test file content', status = 200, contentType = 'application/octet-stream') => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/resources/')) {
        if (status !== 200) {
          return {
            ok: false,
            status,
            statusText: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : status === 404 ? 'Not Found' : 'Error',
            json: async () => ({ error: 'Error response' }),
            text: async () => 'Error response',
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
      // For getSourceLocation
      return {
        ok: true,
        json: async () => ({
          chunk_id: 'chk_1',
          source_type: 'PDF',
          page_number: 7,
          preview: 'Operating systems manage hardware abstraction',
        }),
      };
    });
  };

  // --------------------------------------------------------------------------
  // 1 & 2. PDF Viewer & Navigation
  // --------------------------------------------------------------------------
  it('1. Verified PDF citation opens PDF viewer', async () => {
    setupMockFileFetch('PDF content', 200, 'application/pdf');

    const pdfCitation: CitationData = {
      chunk_id: 'chunk_pdf_7',
      resource_id: 'res_os_textbook',
      source_type: 'PDF',
      page_number: 7,
      citation_label: 'Page 7',
      snippet: 'Virtual memory isolates processes from physical addresses.',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={pdfCitation} />);

    await waitFor(() => {
      expect(screen.getByTestId('source-viewer-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-viewport-frame')).toBeInTheDocument();
      expect(screen.getByText(/Verified Citation/i)).toBeInTheDocument();
    });
  });

  it('2. PDF citation navigates to correct page', async () => {
    setupMockFileFetch('PDF content', 200, 'application/pdf');

    render(
      <PdfViewer
        resourceId="res_os_textbook"
        pageNumber={7}
        title="OS Textbook"
        excerpt="Virtual memory isolates processes"
      />
    );

    await waitFor(() => {
      const iframe = screen.getByTestId('pdf-viewport-frame') as HTMLIFrameElement;
      expect(iframe.src).toContain('#page=7');
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 3 & 4. PPT / Presentation Viewer & Navigation
  // --------------------------------------------------------------------------
  it('3. Verified PPT citation opens presentation viewer', async () => {
    setupMockFileFetch('PPTX binary content', 200, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

    const pptCitation: CitationData = {
      chunk_id: 'chunk_ppt_12',
      resource_id: 'res_lec_slides',
      source_type: 'PPTX',
      slide_number: 12,
      citation_label: 'Slide 12',
      snippet: 'Amdahls Law determines speedup limits on parallel processors.',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={pptCitation} />);

    await waitFor(() => {
      expect(screen.getByTestId('source-viewer-dialog')).toBeInTheDocument();
      expect(screen.getAllByText(/Slide #?12/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Amdahls Law/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('4. PPT citation navigates to correct slide', async () => {
    setupMockFileFetch('PPTX data', 200);

    render(
      <PresentationViewer
        resourceId="res_lec_slides"
        slideNumber={12}
        title="Computer Architecture"
        excerpt="Amdahls Law dictates theoretical speedup."
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Slide #12')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Image Viewer
  // --------------------------------------------------------------------------
  it('5. Verified image citation opens image viewer', async () => {
    setupMockFileFetch('PNG bytes', 200, 'image/png');

    const imgCitation: CitationData = {
      chunk_id: 'chunk_img_1',
      resource_id: 'res_flowchart_img',
      source_type: 'IMAGE',
      citation_label: 'Architecture Diagram',
      snippet: 'Three-tier architecture diagram showing API gateway and database.',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={imgCitation} />);

    await waitFor(() => {
      const img = screen.getByTestId('image-viewer-element') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('blob:');
    });
  });

  // --------------------------------------------------------------------------
  // 6, 7 & 8. Video Player & Timestamp Seeking
  // --------------------------------------------------------------------------
  it('6. Verified video citation opens video player', async () => {
    setupMockFileFetch('video bytes', 200, 'video/mp4');

    const videoCitation: CitationData = {
      chunk_id: 'chunk_vid_1',
      resource_id: 'res_lecture_video',
      source_type: 'VIDEO',
      timestamp_start: 125.4,
      timestamp_end: 180.0,
      citation_label: '02:05',
      snippet: 'Professor explains mutual exclusion algorithm.',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={videoCitation} />);

    await waitFor(() => {
      expect(screen.getByTestId('video-player-element')).toBeInTheDocument();
    });
  });

  it('7. Video citation seeks to exact timestamp_start', async () => {
    setupMockFileFetch('video bytes', 200, 'video/mp4');

    render(
      <VideoViewer
        resourceId="res_lecture_video"
        timestampStart={125.4}
        timestampEnd={180.0}
        title="Operating Systems Lecture 4"
      />
    );

    await waitFor(() => {
      const video = screen.getByTestId('video-player-element') as HTMLVideoElement;
      expect(video).toBeInTheDocument();
      // Simulate loadedmetadata event
      fireEvent.loadedMetadata(video);
      expect(video.currentTime).toBe(125.4);
    });
  });

  it('8. Video citation respects timestamp_end when available', async () => {
    setupMockFileFetch('video bytes', 200, 'video/mp4');

    render(
      <VideoViewer
        resourceId="res_lecture_video"
        timestampStart={100}
        timestampEnd={105}
        title="Concurrency Lecture"
      />
    );

    await waitFor(() => {
      const video = screen.getByTestId('video-player-element') as HTMLVideoElement;
      expect(video).toBeInTheDocument();

      // Simulate playback crossing timestamp_end
      Object.defineProperty(video, 'currentTime', { value: 106, writable: true });
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      const pauseSpy = vi.spyOn(video, 'pause');

      fireEvent.timeUpdate(video);
      expect(pauseSpy).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 9 & 10. Audio Player & Timestamp Seeking
  // --------------------------------------------------------------------------
  it('9. Verified audio citation opens audio player', async () => {
    setupMockFileFetch('audio bytes', 200, 'audio/mpeg');

    const audioCitation: CitationData = {
      chunk_id: 'chunk_aud_1',
      resource_id: 'res_podcast_aud',
      source_type: 'AUDIO',
      timestamp_start: 102.5,
      timestamp_end: 150.0,
      citation_label: '01:42',
      snippet: 'Key points on distributed hash tables.',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={audioCitation} />);

    await waitFor(() => {
      expect(screen.getByTestId('audio-player-element')).toBeInTheDocument();
    });
  });

  it('10. Audio citation seeks to exact timestamp_start', async () => {
    setupMockFileFetch('audio bytes', 200, 'audio/mpeg');

    render(
      <AudioViewer
        resourceId="res_podcast_aud"
        timestampStart={102.5}
        timestampEnd={150.0}
        title="Distributed Systems Audio Brief"
      />
    );

    await waitFor(() => {
      const audio = screen.getByTestId('audio-player-element') as HTMLAudioElement;
      expect(audio).toBeInTheDocument();
      fireEvent.loadedMetadata(audio);
      expect(audio.currentTime).toBe(102.5);
    });
  });

  // --------------------------------------------------------------------------
  // 11. NOTE / Text Source View
  // --------------------------------------------------------------------------
  it('11. NOTE citation opens text source', async () => {
    setupMockFileFetch('Complete notes on Dijkstra shortest path algorithm', 200, 'text/plain');

    const noteCitation: CitationData = {
      chunk_id: 'chunk_note_1',
      resource_id: 'res_study_notes',
      source_type: 'NOTE',
      citation_label: 'Graph Algorithms Notes',
      snippet: 'Dijkstra finds shortest path in non-negative weighted graphs.',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={noteCitation} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Verified Evidence Excerpt/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Dijkstra finds shortest path/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 12. Unverified citation cannot trigger trusted source navigation
  // --------------------------------------------------------------------------
  it('12. Unverified citation cannot trigger trusted source navigation', async () => {
    const unverifiedCitation: CitationData = {
      chunk_id: 'chunk_unverified_1',
      resource_id: 'res_untrusted',
      source_type: 'PDF',
      page_number: 99,
      citation_label: 'Page 99',
      snippet: 'Hallucinated claim without evidence.',
      verification_status: 'UNVERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={unverifiedCitation} />);

    expect(screen.getByTestId('source-viewer-blocked-dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Unverified/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('pdf-viewport-frame')).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 13. SOURCE_UNAVAILABLE displays source unavailable state
  // --------------------------------------------------------------------------
  it('13. SOURCE_UNAVAILABLE displays source unavailable state', async () => {
    const deletedCitation: CitationData = {
      chunk_id: 'chunk_deleted_1',
      resource_id: 'res_deleted',
      source_type: 'PDF',
      page_number: 4,
      citation_label: 'Page 4',
      snippet: 'Historical text from deleted file.',
      verification_status: 'SOURCE_UNAVAILABLE',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={deletedCitation} />);

    expect(screen.getByTestId('source-viewer-blocked-dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Source Unavailable/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/deleted or removed/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 14. CROSS_TENANT_REJECTED cannot open private source
  // --------------------------------------------------------------------------
  it('14. CROSS_TENANT_REJECTED cannot open private source', async () => {
    const crossTenantCitation: CitationData = {
      chunk_id: 'chunk_user_b_private',
      resource_id: 'res_other_tenant',
      source_type: 'PDF',
      page_number: 10,
      citation_label: 'Page 10',
      snippet: 'Other students private assignment notes.',
      verification_status: 'CROSS_TENANT_REJECTED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={crossTenantCitation} />);

    expect(screen.getByTestId('source-viewer-blocked-dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Cross-Tenant Access Prohibited/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/belongs to another private user workspace/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 15. COORDINATE_MISMATCH cannot trigger navigation
  // --------------------------------------------------------------------------
  it('15. COORDINATE_MISMATCH cannot trigger navigation', async () => {
    const mismatchCitation: CitationData = {
      chunk_id: 'chunk_page_2',
      resource_id: 'res_doc',
      source_type: 'PDF',
      page_number: 9999, // Mismatched coordinate
      citation_label: 'Page 9999',
      snippet: 'Coordinate mismatch text.',
      verification_status: 'COORDINATE_MISMATCH',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={mismatchCitation} />);

    expect(screen.getByTestId('source-viewer-blocked-dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Coordinate Mismatch/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('pdf-viewport-frame')).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 16. Deleted resource produces controlled error state
  // --------------------------------------------------------------------------
  it('16. Deleted resource produces controlled error state', async () => {
    setupMockFileFetch('Not Found', 404);

    render(
      <PdfViewer
        resourceId="res_deleted_at_runtime"
        pageNumber={5}
        title="Deleted PDF"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Source Material Unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/has been removed, deleted, or relocated/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 17. 401 response produces authentication state
  // --------------------------------------------------------------------------
  it('17. 401 response produces authentication state', async () => {
    setupMockFileFetch('Unauthorized', 401);

    render(
      <PdfViewer
        resourceId="res_protected"
        pageNumber={1}
        title="Protected Resource"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Authentication Required/i)).toBeInTheDocument();
      expect(screen.getByText(/active session has expired/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 18. 403 response produces access-denied state
  // --------------------------------------------------------------------------
  it('18. 403 response produces access-denied state', async () => {
    setupMockFileFetch('Forbidden', 403);

    render(
      <PdfViewer
        resourceId="res_forbidden"
        pageNumber={1}
        title="Forbidden Resource"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(screen.getByText(/belongs to another student workspace/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 19. 404 response produces source-unavailable state
  // --------------------------------------------------------------------------
  it('19. 404 response produces source-unavailable state', async () => {
    setupMockFileFetch('Not Found', 404);

    render(
      <VideoViewer
        resourceId="res_missing_video"
        timestampStart={30}
        title="Missing Lecture Video"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Video Unavailable/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 20. Citation click no longer invokes simulated navigation
  // --------------------------------------------------------------------------
  it('20. Citation click no longer invokes simulated navigation', async () => {
    setupMockFileFetch('PDF bytes', 200, 'application/pdf');

    const pdfCitation: CitationData = {
      chunk_id: 'chunk_pdf_42',
      resource_id: 'res_pdf_42',
      source_type: 'PDF',
      page_number: 42,
      citation_label: 'Page 42',
      snippet: 'Real navigation without fake toast simulations.',
      verification_status: 'VERIFIED',
    };

    render(<Citation citation={pdfCitation} />);

    // Click badge to open summary dialog
    const badge = screen.getByTestId('citation-chunk_pdf_42');
    fireEvent.click(badge);

    // Wait for dialog and click "Jump to Page 42"
    const jumpBtn = await screen.findByTestId('jump-to-page-btn');
    fireEvent.click(jumpBtn);

    // Verify SourceViewer is opened and no simulation toast text is present
    await waitFor(() => {
      expect(screen.getByTestId('source-viewer-dialog')).toBeInTheDocument();
      expect(screen.queryByText(/Simulating document viewport navigation/i)).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 21. Resource URL is generated only through getResourceFileUrl()
  // --------------------------------------------------------------------------
  it('21. Resource URL is generated only through getResourceFileUrl()', () => {
    const url = getResourceFileUrl('res_test_123');
    expect(url).toBe('/api/resources/res_test_123/file');
    // Ensure no direct filesystem or storage URLs
    expect(url).not.toContain('/Users/');
    expect(url).not.toContain('file://');
    expect(url).not.toContain('blob.core.windows.net');
    expect(url).not.toContain('s3.amazonaws.com');
  });

  // --------------------------------------------------------------------------
  // 22. No local filesystem path appears in frontend output
  // --------------------------------------------------------------------------
  it('22. No local filesystem path appears in frontend output', async () => {
    setupMockFileFetch('safe text content', 200);

    const citation: CitationData = {
      chunk_id: 'chk_safe',
      resource_id: 'res_safe',
      source_type: 'TEXT',
      citation_label: 'Safe Source',
      snippet: 'Safe excerpt text.',
      verification_status: 'VERIFIED',
    };

    const { container } = render(<SourceViewer isOpen={true} onClose={() => {}} citation={citation} />);

    await waitFor(() => {
      const html = container.innerHTML;
      expect(html).not.toMatch(/\/Users\//i);
      expect(html).not.toMatch(/\/home\//i);
      expect(html).not.toMatch(/\/tmp\//i);
      expect(html).not.toMatch(/\/var\//i);
    });
  });

  // --------------------------------------------------------------------------
  // 23. No Supabase service-role key appears in frontend output
  // --------------------------------------------------------------------------
  it('23. No Supabase service-role key appears in frontend output', async () => {
    setupMockFileFetch('secure text content', 200);

    const citation: CitationData = {
      chunk_id: 'chk_sec',
      resource_id: 'res_sec',
      source_type: 'TEXT',
      citation_label: 'Security Test',
      snippet: 'Zero credential leakage in client views.',
      verification_status: 'VERIFIED',
    };

    const { container } = render(<SourceViewer isOpen={true} onClose={() => {}} citation={citation} />);

    await waitFor(() => {
      const html = container.innerHTML;
      expect(html).not.toContain('service_role');
      expect(html).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(html).not.toContain('eyJh'); // JWT service key prefix
    });
  });

  // --------------------------------------------------------------------------
  // 24. Multiple citations can open independently
  // --------------------------------------------------------------------------
  it('24. Multiple citations can open independently', async () => {
    setupMockFileFetch('PDF data', 200);

    const citationA: CitationData = {
      chunk_id: 'chk_a',
      resource_id: 'res_a',
      source_type: 'PDF',
      page_number: 3,
      citation_label: 'Page 3',
      snippet: 'Snippet A',
      verification_status: 'VERIFIED',
    };

    const citationB: CitationData = {
      chunk_id: 'chk_b',
      resource_id: 'res_b',
      source_type: 'PPTX',
      slide_number: 8,
      citation_label: 'Slide 8',
      snippet: 'Snippet B',
      verification_status: 'VERIFIED',
    };

    const { rerender } = render(<SourceViewer isOpen={true} onClose={() => {}} citation={citationA} />);

    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewport-frame')).toBeInTheDocument();
    });

    // Switch to citation B
    rerender(<SourceViewer isOpen={true} onClose={() => {}} citation={citationB} />);

    await waitFor(() => {
      expect(screen.getByText('Slide #8')).toBeInTheDocument();
      expect(screen.queryByTestId('pdf-viewport-frame')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 25. Mobile viewer renders without breaking layout
  // --------------------------------------------------------------------------
  it('25. Mobile viewer renders without breaking layout', async () => {
    setupMockFileFetch('mobile responsive content', 200);

    const citation: CitationData = {
      chunk_id: 'chk_mob',
      resource_id: 'res_mob',
      source_type: 'PDF',
      page_number: 1,
      citation_label: 'Mobile Doc',
      verification_status: 'VERIFIED',
    };

    render(<SourceViewer isOpen={true} onClose={() => {}} citation={citation} className="w-[360px]" />);

    await waitFor(() => {
      const dialog = screen.getByTestId('source-viewer-dialog');
      expect(dialog).toBeInTheDocument();
      // Ensure flex container classes for responsiveness
      expect(dialog.className).toContain('flex');
      expect(dialog.className).toContain('flex-col');
    });
  });
});
