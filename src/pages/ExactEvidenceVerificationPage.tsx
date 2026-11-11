import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SourceViewer } from '@/components/viewer/SourceViewer';
import { Citation } from '@/components/chat/Citation';
import type { CitationData } from '@/types/resource';

export const ExactEvidenceVerificationPage: React.FC = () => {
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Pre-configured test cases matching our 5 canonical fixtures
  const testCases: Record<string, CitationData> = {
    mixed: {
      chunk_id: 'chk_mixed_01',
      resource_id: 'doc_mixed_eq',
      source_id: 'src_mixed_eq',
      document_id: 'doc_mixed_eq',
      source_type: 'PDF',
      source_title: 'single_page_mixed_equation.pdf',
      page_number: 1,
      page_label: '1',
      citation_number: 1,
      citation_label: 'Page 1 Formula',
      snippet: 'In quantum electrodynamics, photon energy is proportional to electromagnetic radiation frequency: E = h * nu',
      excerpt: 'The fundamental relation governing discrete quanta is expressed as: E = h * nu',
      evidence_type: 'EQUATION',
      has_precise_coordinates: true,
      bounding_box: { x: 10.0, y: 20.0, width: 80.0, height: 28.0, unit: 'percent' },
      equation_crop_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAB4CAYAAAA/0MB9AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAB9KADAAQAAAABAAAAeAAAAAB9tX4RAAAcb0lEQVR4Ae3dCYBVVZ0H8D/v8573fc+f933f933f933f933f933f',
      equation_notation: 'E = h * nu',
      surrounding_context: 'where E is photon energy in Joules, h denotes Planck constant, and nu is frequency in Hertz.',
      verification_status: 'VERIFIED',
    },
    vector: {
      chunk_id: 'chk_vec_01',
      resource_id: 'doc_vec_eq',
      source_id: 'src_vec_eq',
      document_id: 'doc_vec_eq',
      source_type: 'PDF',
      source_title: 'vector_equation.pdf',
      page_number: 1,
      page_label: '1',
      citation_number: 2,
      citation_label: 'Page 1 Vector Path',
      snippet: 'Vector graphics path mathematical formulation for relativistic mass.',
      excerpt: 'Formula 2.1: Relativistic Mass with Lorentz Factor m_rel = m_0 / sqrt(1 - v^2/c^2)',
      evidence_type: 'EQUATION',
      has_precise_coordinates: true,
      bounding_box: { x: 16.34, y: 14.77, width: 14.71, height: 3.79, unit: 'percent' },
      equation_notation: 'm_rel = m_0 / sqrt(1 - v^2 / c^2)',
      surrounding_context: 'where m_0 is rest mass, v is particle velocity, and c is the speed of light in vacuum.',
      verification_status: 'VERIFIED',
    },
    scanned: {
      chunk_id: 'chk_scanned_01',
      resource_id: 'doc_scanned_eq',
      source_id: 'src_scanned_eq',
      document_id: 'doc_scanned_eq',
      source_type: 'PDF',
      source_title: 'scanned_equation.pdf',
      page_number: 1,
      page_label: '1',
      citation_number: 3,
      citation_label: 'Page 1 Scan',
      snippet: 'Spectroscopic wavenumber formulation in archival manuscript.',
      excerpt: '~nu = 1 / lambda (Wavenumber Formulation)',
      evidence_type: 'TEXT_PASSAGE',
      has_precise_coordinates: false,
      bounding_box: null,
      uncertainty_score: 0.12,
      uncertainty_note: 'Scanned document page 1: full-page OCR extracted; precise coordinate highlight unavailable.',
      verification_status: 'VERIFIED',
    },
    scanned_col1: {
      chunk_id: 'chk_scanned_col1',
      resource_id: 'doc_scanned_eq',
      source_id: 'src_scanned_eq',
      document_id: 'doc_scanned_eq',
      source_type: 'PDF',
      source_title: 'scanned_equation.pdf',
      page_number: 1,
      page_label: '1',
      citation_number: 3,
      citation_label: 'Page 1 Col 1',
      snippet: 'In wave mechanics and spectroscopy, radiation is characterized by wave vectors and spatial frequency in dispersive media.',
      excerpt: 'Spatial periodicity is quantified by wave numbers per unit distance across fronts.',
      evidence_type: 'TEXT_PASSAGE',
      has_precise_coordinates: true,
      localization_confidence: 0.98,
      regions: [
        { x: 5.0, y: 18.0, width: 42.0, height: 3.2, unit: 'percent' },
        { x: 5.0, y: 22.0, width: 42.0, height: 3.2, unit: 'percent' },
        { x: 5.0, y: 26.0, width: 39.0, height: 3.2, unit: 'percent' },
      ],
      bounding_box: { x: 5.0, y: 18.0, width: 42.0, height: 11.2, unit: 'percent' },
      verification_status: 'VERIFIED',
    },
    scanned_col2: {
      chunk_id: 'chk_scanned_col2',
      resource_id: 'doc_scanned_eq',
      source_id: 'src_scanned_eq',
      document_id: 'doc_scanned_eq',
      source_type: 'PDF',
      source_title: 'scanned_equation.pdf',
      page_number: 1,
      page_label: '1',
      citation_number: 4,
      citation_label: 'Page 1 Col 2 Eq',
      snippet: 'Spectroscopic wavenumber formulation: ~nu = 1 / lambda',
      excerpt: '~nu = 1 / lambda where lambda denotes vacuum wavelength in meters.',
      evidence_type: 'EQUATION',
      has_precise_coordinates: true,
      localization_confidence: 0.96,
      regions: [
        { x: 54.0, y: 17.5, width: 41.0, height: 13.0, unit: 'percent' },
      ],
      bounding_box: { x: 54.0, y: 17.5, width: 41.0, height: 13.0, unit: 'percent' },
      equation_crop_data: 'data:image/png;base64,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VRVFSZvU8MViPp/PpZM6vFgfGRlObXeT9OpMTNO1bTsIksyODiFskDo1NTc2Nup5/vXXX18oFFasWHEisPgcRzuO43ne7Oysqqqeh9dOQ8PDlUrR87BTKoT4p7As63lBZobF84yqqvV6q1wuHTp0bGCgEARxLpdjGGZmZsHzPFnma7WaKIqtlqEoSqfTMU07c27kOC5zxSP0CadNPEmSLFs2tHfvH8bGxr75zW9edNFFk5OrHn/8CV3vqqrKcXi57/vhyMhwsYhb8noebjmdzyumiRu1qao4P18vlbRarUbT2P7gzjvv3Lbt6zMzM67rhmEYpeZ1EMI33nhjw4YNkiRkKbjUXbR17NixK664Yt26C37605+KoggAWLt27de+9rXzz9/wwAMPfOELX/jAB8596qmnfB87kAZBcNddd91yyy2f+9zndu3abRjGVVdddc0113z5y19GCMmyPDc398lPfnLt2rXbt28/XeNJeBd0DP1rwXFco7F05plndjqdUqn0q1/9amlp6eKLL3711VejKBoawtO2IAiiCPsihmGoKJLjePv3H9y6dWuj0RgZGYmi6Ic//KEsy2naLVerlY8dm42iqFTSHCeAEJqmS9P0s88+e/PNN1uWI4pilrsbGCh9+9vf3rZt29jY2KZNmz71qU+lPeDDq6+++pZbblm/fv2OHTt4nr/sssv+9V9vRogzTXPDhg133nnnY489dvfddzMMs3nz5quuuurJJ5/cvn2753n33nvvF7/4xbPOOuu8887bsmXL6RpSwntNPKn/LsjllJmZubGx4W9841vPP//8zTffXCzmO53OxMREtVq98cYb0y6EBV3XPQ/3vBVFMetgSNP0wsKCLEueF3a73dWrVz700ENRFOXzimHYuZycJHgGmLb2RcPDw2lXa7xRk7aiTzRNXlxcTDu+h7Zta5oiCEKjsbR169Ynn3zykUceydrzZj1Hzz//fJgyPj6ez+c4jrMsm+M4WZYvvBC3pb/mmmvuuusu27bvu+8+COGGDRtUVWVZ9vbbb//Nb37zzDPPtNvtUz2ehD6atnEcp2nK0lJ7bGxY160jR448+OCDL7/88r333qsoypo1qzPr7HSHh8t2MGVZ7HQ6AwMljuO63e7k5OS+ffs9zxsaqjz//IvXXXfdNddcc/HF/7Rly5aZmXnLslPLEC4IgiNHjoyN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',
      equation_notation: '~nu = 1 / lambda',
      surrounding_context: 'where lambda denotes vacuum wavelength in meters. Optical symbol ambiguity present: ~nu may resemble tilde nu (wavenumber) or nu_0 (threshold frequency).',
      uncertainty_score: 0.45,
      uncertainty_note: 'Optical symbol ambiguity detected in scanned notation (~nu vs nu_0); inspect original visual evidence crop.',
      verification_status: 'VERIFIED',
    },
    scanned_rotated: {
      chunk_id: 'chk_scanned_rot2',
      resource_id: 'doc_scanned_eq',
      source_id: 'src_scanned_eq',
      document_id: 'doc_scanned_eq',
      source_type: 'PDF',
      source_title: 'scanned_equation.pdf',
      page_number: 2,
      page_label: '2',
      citation_number: 5,
      citation_label: 'Page 2 Rotated 90°',
      snippet: "Planck's radiation law describes spectral energy density of black-body radiation at absolute temperature T.",
      excerpt: "Spectral energy distribution across wavelengths satisfies the Planck distribution function.",
      evidence_type: 'TEXT_PASSAGE',
      has_precise_coordinates: true,
      localization_confidence: 0.95,
      regions: [
        { x: 81.5, y: 6.0, width: 4.5, height: 88.0, unit: 'percent' },
        { x: 77.5, y: 6.0, width: 4.5, height: 88.0, unit: 'percent' },
      ],
      bounding_box: { x: 77.5, y: 6.0, width: 8.5, height: 88.0, unit: 'percent' },
      verification_status: 'VERIFIED',
    },
    scanned_degraded: {
      chunk_id: 'chk_scanned_deg3',
      resource_id: 'doc_scanned_eq',
      source_id: 'src_scanned_eq',
      document_id: 'doc_scanned_eq',
      source_type: 'PDF',
      source_title: 'scanned_equation.pdf',
      page_number: 3,
      page_label: '3',
      citation_number: 6,
      citation_label: 'Page 3 Fallback',
      snippet: 'Archival Fragment 3: Degraded historical manuscript with severe ink bleeding.',
      excerpt: 'Line localization confidence is below reliable threshold.',
      evidence_type: 'TEXT_PASSAGE',
      has_precise_coordinates: false,
      bounding_box: null,
      regions: null,
      localization_confidence: null,
      uncertainty_score: 0.40,
      uncertainty_note: 'Scanned document page 3: degraded archival scan; precise coordinate highlight unavailable.',
      verification_status: 'VERIFIED',
    },
    custom_labels: {
      chunk_id: 'chk_custom_03',
      resource_id: 'doc_custom_labels',
      source_id: 'src_custom_labels',
      document_id: 'doc_custom_labels',
      source_type: 'PDF',
      source_title: 'custom_page_labels.pdf',
      page_number: 3,
      page_label: 'Ch1-1',
      citation_number: 4,
      citation_label: 'Page Ch1-1',
      snippet: 'Multi-Level Page Table Translation in 64-bit architectures.',
      excerpt: 'In 64-bit architectures, 4-level paging maps 48-bit linear addresses to physical frames.',
      evidence_type: 'TEXT_PASSAGE',
      has_precise_coordinates: true,
      bounding_box: { x: 8.17, y: 5.05, width: 9.8, height: 3.0, unit: 'percent' },
      verification_status: 'VERIFIED',
    },
    lecture: {
      chunk_id: 'chk_lecture_02',
      resource_id: 'doc_lecture_media',
      source_id: 'src_lecture_media',
      document_id: 'doc_lecture_media',
      source_type: 'VIDEO',
      source_title: 'lecture_exact_timestamps.mp4',
      citation_number: 5,
      citation_label: '02:25',
      timestamp_start: 145.0,
      timestamp_end: 180.0,
      timing_precision: 'SEGMENT',
      evidence_type: 'TRANSCRIPT',
      snippet: "The professor emphasizes: Amdahl's Law defines the maximum theoretical speedup in parallel processors.",
      excerpt: "The professor emphasizes: Amdahl's Law defines the maximum theoretical speedup achievable by parallelizing a fixed workload: S_latency = 1 / ((1 - p) + p / s).",
      has_precise_coordinates: true,
      verification_status: 'VERIFIED',
    },
  };

  const handleOpenCase = (caseKey: string) => {
    setSelectedCitation(testCases[caseKey]);
    setIsViewerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-6xl mx-auto space-y-8 font-sans">
      <header className="border-b border-border pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-primary/30 text-primary bg-primary/10">
            Acceptance Harness
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">Answer with Exact Evidence: Browser Verification</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Interactive browser verification suite testing real evidence rendering, coordinate highlighting, zoom & rotation alignment, custom page labels, and lecture timestamps.
        </p>
      </header>

      {/* Simulated AI Chat Message with Real Clickable Citations */}
      <section className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <span>AI Tutor Answer with Exact Citations</span>
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 text-[10px]">
            Zero-Trust Grounded
          </Badge>
        </h2>

        <div className="bg-muted/40 p-5 rounded-lg border border-border/80 text-sm leading-relaxed space-y-3">
          <p>
            Photon energy is fundamentally related to frequency through Planck's relation{' '}
            <Citation citation={testCases.mixed} inline directOpen />. In this formulation,{' '}
            <strong>E</strong> represents photon energy in Joules, <strong>h</strong> denotes Planck's constant, and{' '}
            <strong>&nu;</strong> is frequency in Hertz.
          </p>
          <p>
            Similarly, under special relativity, moving particle mass scales with velocity as defined by the Lorentz factor{' '}
            <Citation citation={testCases.vector} inline directOpen />.
          </p>
          <p>
            Historical spectroscopy defined wavenumber as the reciprocal of wavelength{' '}
            <Citation citation={testCases.scanned} inline directOpen />.
          </p>
          <p>
            In modern memory architectures, 4-level paging maps 48-bit linear addresses to physical frames as documented in the paging manual{' '}
            <Citation citation={testCases.custom_labels} inline directOpen />.
          </p>
          <p>
            Finally, theoretical speedup in parallel processors is governed by Amdahl's Law as stated during the lecture{' '}
            <Citation citation={testCases.lecture} inline directOpen />.
          </p>
        </div>
      </section>

      {/* Case-by-Case Test Triggers */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Direct Evidence Navigation Test Triggers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <Button
            data-testid="btn-case-mixed"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('mixed')}
          >
            <span className="font-semibold text-xs text-primary">Case 1: Mixed PDF (Equation Crop)</span>
            <span className="text-[11px] text-muted-foreground">Selectable prose + authentic raster equation crop</span>
          </Button>

          <Button
            data-testid="btn-case-vector"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('vector')}
          >
            <span className="font-semibold text-xs text-primary">Case 2: Vector Path Equation</span>
            <span className="text-[11px] text-muted-foreground">Radical & fraction lines with vector path bbox</span>
          </Button>

          <Button
            data-testid="btn-case-scanned-col1"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('scanned_col1')}
          >
            <span className="font-semibold text-xs text-primary">Case 3A: Scanned Two-Column Multiline</span>
            <span className="text-[11px] text-muted-foreground">3 distinct line regions in Column 1 (no gutter bridging)</span>
          </Button>

          <Button
            data-testid="btn-case-scanned-col2"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('scanned_col2')}
          >
            <span className="font-semibold text-xs text-primary">Case 3B: Scanned Ambiguous Equation</span>
            <span className="text-[11px] text-muted-foreground">Authentic crop + optical ambiguity warning (~nu vs nu_0)</span>
          </Button>

          <Button
            data-testid="btn-case-scanned-rotated"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('scanned_rotated')}
          >
            <span className="font-semibold text-xs text-primary">Case 3C: Rotated Page (90° Clockwise)</span>
            <span className="text-[11px] text-muted-foreground">Coordinates transformed for 90 deg rotated viewport</span>
          </Button>

          <Button
            data-testid="btn-case-scanned-degraded"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('scanned_degraded')}
          >
            <span className="font-semibold text-xs text-primary">Case 3D: Degraded Archival Fallback</span>
            <span className="text-[11px] text-muted-foreground">Honest fallback notice; no fake highlight overlay</span>
          </Button>

          <Button
            data-testid="btn-case-custom-labels"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('custom_labels')}
          >
            <span className="font-semibold text-xs text-primary">Case 4: Custom Page Labels</span>
            <span className="text-[11px] text-muted-foreground">Physical page 3 displaying label Ch1-1</span>
          </Button>

          <Button
            data-testid="btn-case-lecture"
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left border-border hover:border-primary/50"
            onClick={() => handleOpenCase('lecture')}
          >
            <span className="font-semibold text-xs text-primary">Case 5: Lecture Timestamp</span>
            <span className="text-[11px] text-muted-foreground">Seeks video to 02:25 with segment precision badge</span>
          </Button>
        </div>
      </section>

      {/* Selected Citation State Inspector */}
      {selectedCitation && (
        <section className="bg-muted/30 border border-border rounded-xl p-4 text-xs font-mono space-y-1">
          <div className="text-muted-foreground font-semibold uppercase">Active Selected Citation Metadata:</div>
          <div data-testid="active-citation-resource-id">resource_id: {selectedCitation.resource_id}</div>
          <div data-testid="active-citation-page-label">page_label: {selectedCitation.page_label}</div>
          <div data-testid="active-citation-evidence-type">evidence_type: {selectedCitation.evidence_type}</div>
          <div data-testid="active-citation-precise">precise_coords: {String(selectedCitation.has_precise_coordinates)}</div>
          {selectedCitation.timestamp_start !== undefined && (
            <div data-testid="active-citation-timestamp">timestamp_start: {selectedCitation.timestamp_start}s</div>
          )}
        </section>
      )}

      {/* Active Source Viewer Dialog */}
      <SourceViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        citation={selectedCitation}
      />
    </div>
  );
};

export default ExactEvidenceVerificationPage;

