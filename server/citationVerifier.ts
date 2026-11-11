/**
 * Canonical Phase 3 — Step 3
 * Deterministic Citation & Claim Verification Engine
 * 
 * Enforces zero-trust server-side verification of citations and factual claims.
 * The LLM may propose claims and [EVIDENCE_n] references, but server-side logic
 * deterministically decides whether citations are valid, coordinates match,
 * tenant boundaries are respected, and claims are supported.
 */

import { prisma } from './prisma.ts';
import type {
  CanonicalEvidence,
  GroundedClaim,
  ClaimSupportStatus,
  VerifiedCitation,
  CitationVerificationStatus,
  SourceLocation,
  GroundedAnswerContract,
  SourceType,
  ExtractionMethod,
} from './groundingTypes.ts';

export type {
  CanonicalEvidence,
  GroundedClaim,
  ClaimSupportStatus,
  VerifiedCitation,
  CitationVerificationStatus,
  SourceLocation,
  GroundedAnswerContract,
  SourceType,
  ExtractionMethod,
};

/**
 * Extended request-local CanonicalEvidence item containing complete Phase 2 provenance.
 */
export interface CanonicalEvidenceItem extends CanonicalEvidence {
  evidence_ref: string; // e.g. "[EVIDENCE_1]"
  user_id: string;
  tenant_type: 'USER_PRIVATE' | 'SYSTEM_PUBLIC' | 'COMMUNITY' | string;
  document_id?: string;
  source_id?: string;
  chunk_index?: number;
  section?: string | null;
  heading?: string | null;
  embedding_model?: string;
  embedding_version?: string;
  created_at?: string;
}

/**
 * Request-local evidence index created strictly from retrieval results.
 */
export interface CanonicalEvidenceIndex {
  items: CanonicalEvidenceItem[];
  byEvidenceId: Map<string, CanonicalEvidenceItem>;
  byChunkId: Map<string, CanonicalEvidenceItem>;
  contextUserId: string;
}

/**
 * Database resource record representation for verification.
 */
export interface ResourceVerificationRecord {
  exists: boolean;
  isDeleted: boolean;
  userId: string;
  tenantType?: string;
}

/**
 * Verification execution context.
 */
export interface VerificationContext {
  authenticatedUserId: string;
  evidenceIndex: CanonicalEvidenceIndex;
  resourceChecker?: (resourceId: string) => Promise<ResourceVerificationRecord | null>;
}

/**
 * Proposed citation input.
 */
export interface ProposedCitation {
  evidence_id?: string;
  chunk_id?: string;
  resource_id?: string;
  source_title?: string;
  source_type?: SourceType | string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  excerpt?: string;
  location?: SourceLocation;
}

/**
 * Proposed claim input.
 */
export interface ProposedClaim {
  claim_id?: string;
  text: string;
  evidence_ids?: string[];
  proposed_coordinates?: {
    page_number?: number | null;
    slide_number?: number | null;
    timestamp_start?: number | null;
    timestamp_end?: number | null;
  };
  excerpt?: string;
  support_level?: 'FULL' | 'PARTIAL';
}

/**
 * Proposed answer payload.
 */
export interface ProposedAnswerPayload {
  answer: string;
  claims?: ProposedClaim[];
  proposedCitations?: ProposedCitation[];
}

/**
 * Default database resource checker using Prisma.
 */
export async function defaultResourceChecker(
  resourceId: string
): Promise<ResourceVerificationRecord | null> {
  if (!resourceId) return null;
  try {
    const res = await prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!res) return null;

    const isDeleted = Boolean((res as any).isDeleted || (res as any).deletedAt);
    let tenantType = (res as any).tenantType || 'USER_PRIVATE';

    if (res.userId === 'system_public' || res.userId === 'default_user') {
      tenantType = 'SYSTEM_PUBLIC';
    }

    if (res.tagsJson) {
      try {
        const tags = JSON.parse(res.tagsJson);
        if (Array.isArray(tags) && tags.includes('SYSTEM_PUBLIC')) {
          tenantType = 'SYSTEM_PUBLIC';
        }
      } catch {}
    }

    return {
      exists: true,
      isDeleted,
      userId: res.userId,
      tenantType,
    };
  } catch {
    return null;
  }
}

/**
 * Builds the canonical request-local evidence index from retrieved vector chunks.
 * Assigns deterministic references [EVIDENCE_1], [EVIDENCE_2], ...
 */
export function buildCanonicalEvidenceIndex(
  retrievedChunks: any[],
  contextUserId: string
): CanonicalEvidenceIndex {
  const items: CanonicalEvidenceItem[] = [];
  const byEvidenceId = new Map<string, CanonicalEvidenceItem>();
  const byChunkId = new Map<string, CanonicalEvidenceItem>();

  if (!Array.isArray(retrievedChunks)) {
    return { items, byEvidenceId, byChunkId, contextUserId };
  }

  retrievedChunks.forEach((c, idx) => {
    const evidenceId = `EVIDENCE_${idx + 1}`;
    const chunkId = c.chunk_id || c.id || `chunk_${idx + 1}`;
    const loc = c.location || {};

    const item: CanonicalEvidenceItem = {
      evidence_id: evidenceId,
      evidence_ref: `[${evidenceId}]`,
      chunk_id: chunkId,
      resource_id: c.resource_id || c.document_id || c.source_id || 'unknown_resource',
      document_id: c.document_id || c.resource_id || c.source_id,
      source_id: c.source_id || c.document_id || c.resource_id,
      user_id: c.user_id || contextUserId,
      tenant_type: c.tenant_type || (c.user_id === 'system_public' ? 'SYSTEM_PUBLIC' : 'USER_PRIVATE'),
      source_type: (loc.source_type || c.source_type || 'TEXT').toUpperCase() as SourceType,
      text: c.text || '',
      page_number: loc.page_number !== undefined ? loc.page_number : c.page_number,
      page_label: c.page_label ?? loc.page_label ?? (c.page_number !== undefined && c.page_number !== null ? String(c.page_number) : null),
      physical_page_index: c.physical_page_index ?? loc.physical_page_index ?? c.page_number ?? loc.page_number ?? null,
      slide_number: loc.slide_number !== undefined ? loc.slide_number : c.slide_number,
      timestamp_start: loc.timestamp_start !== undefined ? loc.timestamp_start : c.timestamp_start,
      timestamp_end: loc.timestamp_end !== undefined ? loc.timestamp_end : c.timestamp_end,
      timing_precision: c.timing_precision ?? loc.timing_precision ?? (loc.timestamp_start !== undefined && loc.timestamp_start !== null ? 'SEGMENT' : undefined),
      extraction_method: (c.extraction_method || 'NATIVE_TEXT') as ExtractionMethod,
      content_hash: c.content_hash || '',
      chunk_index: c.chunk_index !== undefined ? c.chunk_index : idx,
      section: c.section || null,
      heading: c.heading || null,
      embedding_model: c.embedding_model || 'text-embedding-3-small',
      embedding_version: c.embedding_version || 'v1',
      created_at: c.created_at || new Date().toISOString(),
      relevance_score: c.score !== undefined ? c.score : (c.relevance_score ?? 1.0),
      bounding_box: c.bounding_box ?? loc.bounding_box ?? null,
      regions: c.regions ?? loc.regions ?? null,
      has_precise_coordinates: c.has_precise_coordinates !== undefined
        ? Boolean(c.has_precise_coordinates)
        : loc.has_precise_coordinates !== undefined
        ? Boolean(loc.has_precise_coordinates)
        : Boolean(c.bounding_box || loc.bounding_box || c.regions || loc.regions || (loc.timestamp_start !== undefined && loc.timestamp_start !== null)),
      localization_confidence: c.localization_confidence ?? loc.localization_confidence ?? null,
      evidence_type: (c.evidence_type ?? loc.evidence_type ?? (loc.is_diagram ? 'DIAGRAM' : (loc.timestamp_start !== undefined && loc.timestamp_start !== null) ? 'TRANSCRIPT' : 'TEXT_PASSAGE')) as any,
      equation_crop_data: c.equation_crop_data ?? loc.equation_crop_data ?? null,
      equation_notation: c.equation_notation ?? loc.equation_notation ?? null,
      surrounding_context: c.surrounding_context ?? loc.surrounding_context ?? null,
      uncertainty_score: c.uncertainty_score ?? loc.uncertainty_score ?? null,
      uncertainty_note: c.uncertainty_note ?? loc.uncertainty_note ?? null,
    };

    items.push(item);
    byEvidenceId.set(evidenceId, item);
    byChunkId.set(chunkId, item);
  });

  return {
    items,
    byEvidenceId,
    byChunkId,
    contextUserId,
  };
}

/**
 * Formats the canonical evidence index into the strict prompt representation.
 * The model receives only [EVIDENCE_n] references, never arbitrary chunk IDs.
 */
export function formatEvidenceIndexForPrompt(index: CanonicalEvidenceIndex): string {
  if (!index.items.length) {
    return 'No relevant course materials retrieved.';
  }

  return index.items
    .map((item) => {
      const pageLabelStr = item.page_label && item.page_label !== String(item.page_number) ? ` (Label: ${item.page_label})` : '';
      const locStr =
        item.page_number !== null && item.page_number !== undefined
          ? `Page ${item.page_number}${pageLabelStr}`
          : item.slide_number !== null && item.slide_number !== undefined
          ? `Slide ${item.slide_number}`
          : item.timestamp_start !== null && item.timestamp_start !== undefined
          ? `Timestamp ${Math.floor(item.timestamp_start / 60)}m${Math.floor(item.timestamp_start % 60)}s (${item.timing_precision || 'Segment'} precision)`
          : 'Document Excerpt';

      const coordStr = item.has_precise_coordinates && item.bounding_box
        ? ` | Bounding Region: x=${item.bounding_box.x}%, y=${item.bounding_box.y}%, w=${item.bounding_box.width}%, h=${item.bounding_box.height}%`
        : item.has_precise_coordinates === false
        ? ' | Bounding Region: Coordinate highlight unavailable (full-page scan)'
        : '';

      const notationStr = item.equation_notation ? ` | Formula Notation: ${item.equation_notation}` : '';
      const uncStr = item.uncertainty_note ? `\nUncertainty Note: ${item.uncertainty_note}` : '';
      const defStr = item.surrounding_context ? `\nSurrounding Definitions & Assumptions: "${item.surrounding_context}"` : '';

      return (
        `${item.evidence_ref}\n` +
        `Evidence Type: ${item.evidence_type || 'TEXT_PASSAGE'} | Source Type: ${item.source_type} | Location: ${locStr}${coordStr}${notationStr}\n` +
        `Resource ID: ${item.resource_id}\n` +
        `Extraction Method: ${item.extraction_method}${uncStr}${defStr}\n` +
        `Content: "${item.text}"`
      );
    })
    .join('\n\n');
}

/**
 * Normalizes text for excerpt alignment comparison.
 */
export function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministically checks whether a quoted excerpt aligns with canonical evidence text.
 */
export function checkExcerptAlignment(
  excerpt: string,
  canonicalText: string
): { aligned: boolean; partial: boolean; confidence: number } {
  if (!excerpt || !excerpt.trim()) {
    return { aligned: true, partial: false, confidence: 1.0 };
  }

  const normExcerpt = normalizeForComparison(excerpt);
  const normCanonical = normalizeForComparison(canonicalText);

  if (!normExcerpt || !normCanonical) {
    return { aligned: false, partial: false, confidence: 0.0 };
  }

  // Exact substring alignment
  if (normCanonical.includes(normExcerpt)) {
    return { aligned: true, partial: false, confidence: 1.0 };
  }

  // Token-level containment analysis
  const excerptTokens = normExcerpt.split(' ').filter(Boolean);
  if (!excerptTokens.length) {
    return { aligned: false, partial: false, confidence: 0.0 };
  }

  const canonicalTokens = new Set(normCanonical.split(' ').filter(Boolean));
  let matchedTokens = 0;
  for (const token of excerptTokens) {
    if (canonicalTokens.has(token)) {
      matchedTokens++;
    }
  }

  const tokenRatio = matchedTokens / excerptTokens.length;

  if (tokenRatio >= 0.70) {
    return { aligned: true, partial: true, confidence: tokenRatio };
  }

  return { aligned: false, partial: false, confidence: tokenRatio };
}

/**
 * Deterministically verifies source coordinates against canonical provenance.
 */
export function verifyCoordinates(
  sourceType: string,
  proposedCoords: {
    page_number?: number | null;
    slide_number?: number | null;
    timestamp_start?: number | null;
    timestamp_end?: number | null;
  },
  canonical: CanonicalEvidence
): { match: boolean; reason?: string } {
  const normType = (sourceType || canonical.source_type || '').toUpperCase();

  // 1. PDF Page Verification
  if (normType === 'PDF' && proposedCoords.page_number !== undefined && proposedCoords.page_number !== null) {
    if (canonical.page_number !== undefined && canonical.page_number !== null) {
      if (proposedCoords.page_number !== canonical.page_number) {
        return {
          match: false,
          reason: `PDF page mismatch: cited page ${proposedCoords.page_number} but canonical provenance is page ${canonical.page_number}`,
        };
      }
    }
  }

  // 2. PPT/PPTX Slide Verification
  if (
    (normType === 'PPT' || normType === 'PPTX' || normType === 'SLIDE') &&
    proposedCoords.slide_number !== undefined &&
    proposedCoords.slide_number !== null
  ) {
    if (canonical.slide_number !== undefined && canonical.slide_number !== null) {
      if (proposedCoords.slide_number !== canonical.slide_number) {
        return {
          match: false,
          reason: `Slide mismatch: cited slide ${proposedCoords.slide_number} but canonical provenance is slide ${canonical.slide_number}`,
        };
      }
    }
  }

  // 3. Video / Audio Timestamp Interval Verification
  if (normType === 'VIDEO' || normType === 'AUDIO') {
    if (proposedCoords.timestamp_start !== undefined && proposedCoords.timestamp_start !== null) {
      if (canonical.timestamp_start !== undefined && canonical.timestamp_start !== null) {
        const canStart = canonical.timestamp_start;
        const canEnd = canonical.timestamp_end ?? canStart + 30;
        // Strict boundary check with 5s grace period
        if (proposedCoords.timestamp_start < canStart - 5 || proposedCoords.timestamp_start > canEnd + 5) {
          return {
            match: false,
            reason: `Timestamp mismatch: cited timestamp ${proposedCoords.timestamp_start}s outside canonical evidence window [${canStart}s - ${canEnd}s]`,
          };
        }
      }
    }
  }

  return { match: true };
}

/**
 * Extracts claims and evidence references from free-form answer text.
 * Accurately detects outside-knowledge sections and numbered citations.
 */
export function extractClaimsFromAnswer(answerText: string): ProposedClaim[] {
  if (!answerText || !answerText.trim()) return [];

  // Identify lines under outside knowledge sections
  const lines = answerText.split('\n');
  let inOutsideKnowledge = false;
  const sentenceEntries: Array<{ text: string; isOutside: boolean }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.toLowerCase().includes('outside knowledge') ||
      trimmed.toLowerCase().includes('general knowledge') ||
      trimmed.toLowerCase().includes('external context')
    ) {
      inOutsideKnowledge = true;
    } else if (trimmed.startsWith('#') && !trimmed.toLowerCase().includes('knowledge')) {
      inOutsideKnowledge = false;
    }

    if (trimmed && !trimmed.startsWith('#') && !trimmed.endsWith(':')) {
      const sanitized = trimmed.replace(/(?<=\b(?:Eq|Fig|Ref|e\.g|i\.e|vs)\.)\s+/gi, ' ');
      const lineSentences = sanitized
        .split(/(?<=[.!?])\s+(?=[A-Z*#])/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const s of lineSentences) {
        sentenceEntries.push({ text: s, isOutside: inOutsideKnowledge });
      }
    }
  }

  const claims: ProposedClaim[] = [];

  sentenceEntries.forEach((entry, idx) => {
    const sentence = entry.text;
    // Look for [EVIDENCE_n], [1], [2], or [CHUNK_id] tokens
    const evTokens = sentence.match(/\[(EVIDENCE_\d+|\d+|[a-zA-Z0-9_\-]+)\]/g) || [];
    const evidenceIds = evTokens.map((t) => {
      const raw = t.replace(/[\[\]]/g, '');
      // If purely numeric like "1", map to "EVIDENCE_1"
      if (/^\d+$/.test(raw)) {
        return `EVIDENCE_${raw}`;
      }
      return raw;
    });

    const cleanText = sentence.replace(/\[(EVIDENCE_\d+|\d+|[a-zA-Z0-9_\-]+)\]/g, '').trim();

    if (cleanText) {
      claims.push({
        claim_id: `claim_${idx + 1}`,
        text: cleanText,
        evidence_ids: evidenceIds,
        ...(entry.isOutside ? { is_outside_knowledge: true } : {}),
      } as any);
    }
  });

  return claims;
}

/**
 * Deterministically verifies an individual citation against the canonical evidence index,
 * authoritative tenant ownership, resource existence, coordinate accuracy, and excerpt alignment.
 */
export async function verifyCitation(
  citation: ProposedCitation,
  context: VerificationContext
): Promise<VerifiedCitation> {
  const { authenticatedUserId, evidenceIndex, resourceChecker } = context;
  const checkResource = resourceChecker || defaultResourceChecker;

  // 1. Resolve to request-local evidence item
  let canonical: CanonicalEvidenceItem | undefined;
  const rawId = citation.evidence_id || citation.chunk_id || '';
  const cleanId = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_');

  if (evidenceIndex.byEvidenceId.has(rawId)) {
    canonical = evidenceIndex.byEvidenceId.get(rawId);
  } else if (evidenceIndex.byChunkId.has(rawId)) {
    canonical = evidenceIndex.byChunkId.get(rawId);
  }

  // If evidence ID does not exist in request-local index -> UNVERIFIED (fabricated / not retrieved)
  if (!canonical) {
    return {
      citation_id: `cit_unverified_${cleanId || 'unknown'}`,
      chunk_id: citation.chunk_id || rawId || 'unknown_chunk',
      resource_id: citation.resource_id || 'unknown_resource',
      source_title: citation.source_title || 'Unverified Source',
      source_type: citation.source_type || 'TEXT',
      location: {
        source_type: citation.source_type || 'TEXT',
        page_number: citation.page_number,
        slide_number: citation.slide_number,
        timestamp_start: citation.timestamp_start,
        timestamp_end: citation.timestamp_end,
      },
      excerpt: citation.excerpt || '',
      verification_status: 'UNVERIFIED',
    };
  }

  // Common metadata payload helper
  const buildCanonicalLocation = (status: CitationVerificationStatus): VerifiedCitation => {
    return {
      citation_id: `cit_${canonical!.evidence_id.toLowerCase()}_${canonical!.chunk_id}`,
      chunk_id: canonical!.chunk_id,
      resource_id: canonical!.resource_id,
      source_title: citation.source_title || `Source ${canonical!.resource_id}`,
      source_type: canonical!.source_type,
      location: {
        source_type: canonical!.source_type,
        page_number: canonical!.page_number,
        page_label: canonical!.page_label,
        physical_page_index: canonical!.physical_page_index,
        slide_number: canonical!.slide_number,
        timestamp_start: canonical!.timestamp_start,
        timestamp_end: canonical!.timestamp_end,
        timing_precision: canonical!.timing_precision,
        is_diagram: canonical!.evidence_type === 'DIAGRAM',
        diagram_caption: canonical!.heading || undefined,
        bounding_box: canonical!.bounding_box,
        regions: canonical!.regions,
        has_precise_coordinates: canonical!.has_precise_coordinates,
        localization_confidence: canonical!.localization_confidence,
        evidence_type: canonical!.evidence_type,
        equation_crop_data: canonical!.equation_crop_data,
        equation_notation: canonical!.equation_notation,
        surrounding_context: canonical!.surrounding_context,
        uncertainty_note: canonical!.uncertainty_note,
        uncertainty_score: canonical!.uncertainty_score,
      },
      excerpt: citation.excerpt || canonical!.text.slice(0, 200),
      verification_status: status,
      bounding_box: canonical!.bounding_box,
      regions: canonical!.regions,
      has_precise_coordinates: canonical!.has_precise_coordinates,
      localization_confidence: canonical!.localization_confidence,
      evidence_type: canonical!.evidence_type,
      equation_crop_data: canonical!.equation_crop_data,
      equation_notation: canonical!.equation_notation,
      surrounding_context: canonical!.surrounding_context,
      uncertainty_note: canonical!.uncertainty_note,
      uncertainty_score: canonical!.uncertainty_score,
      page_label: canonical!.page_label,
    };
  };

  // If citation specifies a resource_id and it differs from canonical provenance -> spoofed resource ID
  if (citation.resource_id && citation.resource_id !== canonical.resource_id) {
    const unv = buildCanonicalLocation('UNVERIFIED');
    unv.citation_id = `cit_unverified_spoofed_${canonical.chunk_id}`;
    unv.source_title = citation.source_title || 'Spoofed Resource Citation';
    return unv;
  }

  // 2. Revalidate tenant security boundary (server-side authenticated identity only)
  const isOwner = canonical.user_id === authenticatedUserId;
  const isSystemPublic =
    canonical.tenant_type === 'SYSTEM_PUBLIC' ||
    canonical.user_id === 'system_public' ||
    canonical.user_id === 'default_user';

  if (!isOwner && !isSystemPublic) {
    const rej = buildCanonicalLocation('CROSS_TENANT_REJECTED');
    rej.citation_id = `cit_cross_tenant_${canonical.chunk_id}`;
    rej.source_title = citation.source_title || 'Cross-Tenant Resource';
    return rej;
  }

  // 3. Revalidate resource existence & deletion state via authoritative check
  const resourceRecord = await checkResource(canonical.resource_id);
  if (!resourceRecord || !resourceRecord.exists || resourceRecord.isDeleted) {
    const unav = buildCanonicalLocation('SOURCE_UNAVAILABLE');
    unav.citation_id = `cit_unavailable_${canonical.chunk_id}`;
    unav.source_title = citation.source_title || 'Unavailable Resource';
    return unav;
  }

  // Revalidate resource record tenant authorization
  const isRecordPublic =
    resourceRecord.tenantType === 'SYSTEM_PUBLIC' ||
    resourceRecord.userId === 'system_public' ||
    resourceRecord.userId === 'default_user';

  if (resourceRecord.userId !== authenticatedUserId && !isRecordPublic) {
    const rej = buildCanonicalLocation('CROSS_TENANT_REJECTED');
    rej.citation_id = `cit_cross_tenant_${canonical.chunk_id}`;
    rej.source_title = citation.source_title || 'Cross-Tenant Resource';
    return rej;
  }

  // 4. Coordinate verification
  const proposedCoords = {
    page_number: citation.page_number !== undefined ? citation.page_number : citation.location?.page_number,
    slide_number: citation.slide_number !== undefined ? citation.slide_number : citation.location?.slide_number,
    timestamp_start: citation.timestamp_start !== undefined ? citation.timestamp_start : citation.location?.timestamp_start,
    timestamp_end: citation.timestamp_end !== undefined ? citation.timestamp_end : citation.location?.timestamp_end,
  };

  const coordCheck = verifyCoordinates(canonical.source_type, proposedCoords, canonical);
  if (!coordCheck.match) {
    const mis = buildCanonicalLocation('COORDINATE_MISMATCH');
    mis.citation_id = `cit_coord_mismatch_${canonical.chunk_id}`;
    mis.source_title = citation.source_title || 'Coordinate Mismatched Citation';
    return mis;
  }

  // 5. Excerpt / Content alignment
  if (citation.excerpt && citation.excerpt.trim()) {
    const alignCheck = checkExcerptAlignment(citation.excerpt, canonical.text);
    if (!alignCheck.aligned) {
      const unal = buildCanonicalLocation('UNVERIFIED');
      unal.citation_id = `cit_unaligned_${canonical.chunk_id}`;
      unal.source_title = citation.source_title || 'Unaligned Excerpt Citation';
      unal.excerpt = citation.excerpt;
      return unal;
    } else if (alignCheck.partial) {
      const part = buildCanonicalLocation('PARTIALLY_VERIFIED');
      part.citation_id = `cit_partially_aligned_${canonical.chunk_id}`;
      part.source_title = citation.source_title || 'Partially Aligned Citation';
      part.excerpt = citation.excerpt;
      return part;
    }
  }

  // 6. Citation fully verified! Retains complete canonical navigation coordinates.
  return buildCanonicalLocation('VERIFIED');
}

/**
 * Deterministically verifies an entire grounded answer contract.
 * Revalidates claims, citations, coordinates, tenant isolation, and coverage.
 */
export async function verifyGroundedAnswer(
  proposed: ProposedAnswerPayload,
  context: VerificationContext
): Promise<GroundedAnswerContract> {
  const { answer, claims = [], proposedCitations = [] } = proposed;

  // If claims were not explicitly provided, extract them deterministically from the answer prose
  const effectiveClaims = claims.length ? claims : extractClaimsFromAnswer(answer);

  // Collect all unique citation requests from proposed citations and claim references
  const citationMap = new Map<string, VerifiedCitation>();

  // Process explicit proposed citations first
  for (const pc of proposedCitations) {
    const key = pc.evidence_id || pc.chunk_id || '';
    if (key && !citationMap.has(key)) {
      const verified = await verifyCitation(pc, context);
      citationMap.set(key, verified);
    }
  }

  // Process any evidence IDs referenced in claims
  for (const claim of effectiveClaims) {
    if (Array.isArray(claim.evidence_ids)) {
      for (const evId of claim.evidence_ids) {
        if (evId && !citationMap.has(evId)) {
          const verified = await verifyCitation(
            {
              evidence_id: evId,
              page_number: claim.proposed_coordinates?.page_number,
              slide_number: claim.proposed_coordinates?.slide_number,
              timestamp_start: claim.proposed_coordinates?.timestamp_start,
              timestamp_end: claim.proposed_coordinates?.timestamp_end,
              excerpt: claim.excerpt,
            },
            context
          );
          citationMap.set(evId, verified);
        }
      }
    }
  }

  // Verify and classify each individual claim deterministically
  const verifiedClaims: GroundedClaim[] = [];
  const unsupportedClaims: GroundedClaim[] = [];

  for (let i = 0; i < effectiveClaims.length; i++) {
    const c = effectiveClaims[i];
    const claimId = c.claim_id || `claim_${i + 1}`;
    const evidenceIds = c.evidence_ids || [];

    // Case 1: Claim has no evidence references -> UNVERIFIED (Step 4 & Step 7)
    if (!evidenceIds.length) {
      const unsuppClaim: GroundedClaim = {
        claim_id: claimId,
        text: c.text,
        claim: c.text,
        evidence_ids: [],
        support_status: 'UNVERIFIED',
        supportStatus: 'UNVERIFIED',
        citations: [],
      };
      verifiedClaims.push(unsuppClaim);
      unsupportedClaims.push(unsuppClaim);
      continue;
    }

    // Case 2: Inspect verification statuses of cited evidence
    const claimCitations = evidenceIds
      .map((id) => citationMap.get(id))
      .filter((cit): cit is VerifiedCitation => Boolean(cit));

    const hasCrossTenant = claimCitations.some((cit) => cit.verification_status === 'CROSS_TENANT_REJECTED');
    const hasSourceUnavailable = claimCitations.some((cit) => cit.verification_status === 'SOURCE_UNAVAILABLE');
    const hasCoordinateMismatch = claimCitations.some((cit) => cit.verification_status === 'COORDINATE_MISMATCH');
    const allUnverified = claimCitations.length === 0 || claimCitations.every((cit) => cit.verification_status === 'UNVERIFIED');
    const hasPartiallyVerified = claimCitations.some((cit) => cit.verification_status === 'PARTIALLY_VERIFIED');
    const allVerified = claimCitations.length > 0 && claimCitations.every((cit) => cit.verification_status === 'VERIFIED');

    // Re-verify coordinates and excerpt alignment specifically for this claim against canonical evidence
    let claimCoordinateMismatch = false;
    let claimExcerptUnaligned = false;

    for (const evId of evidenceIds) {
      let canonicalItem: CanonicalEvidenceItem | undefined;
      if (context.evidenceIndex.byEvidenceId.has(evId)) {
        canonicalItem = context.evidenceIndex.byEvidenceId.get(evId);
      } else if (context.evidenceIndex.byChunkId.has(evId)) {
        canonicalItem = context.evidenceIndex.byChunkId.get(evId);
      }

      if (canonicalItem) {
        if (c.proposed_coordinates) {
          const matchCheck = verifyCoordinates(canonicalItem.source_type, c.proposed_coordinates, canonicalItem);
          if (!matchCheck.match) {
            claimCoordinateMismatch = true;
          }
        }

        if (c.excerpt) {
          const alignCheck = checkExcerptAlignment(c.excerpt, canonicalItem.text);
          if (!alignCheck.aligned) {
            claimExcerptUnaligned = true;
          }
        }
      }
    }

    let supportStatus: ClaimSupportStatus = 'UNVERIFIED';

    if (hasCrossTenant) {
      supportStatus = 'CROSS_TENANT_REJECTED';
    } else if (hasSourceUnavailable) {
      supportStatus = 'SOURCE_UNAVAILABLE';
    } else if (hasCoordinateMismatch || claimCoordinateMismatch) {
      supportStatus = 'COORDINATE_MISMATCH';
    } else if (allUnverified || claimExcerptUnaligned) {
      supportStatus = 'UNVERIFIED';
    } else if (c.support_level === 'PARTIAL' || hasPartiallyVerified) {
      supportStatus = 'PARTIALLY_VERIFIED';
    } else if (allVerified) {
      supportStatus = 'VERIFIED';
    } else {
      supportStatus = 'PARTIALLY_VERIFIED';
    }

    const isOutside = Boolean((c as any).is_outside_knowledge);
    const evaluatedClaim: GroundedClaim = {
      claim_id: claimId,
      text: c.text,
      claim: c.text,
      evidence_ids: evidenceIds,
      support_status: supportStatus,
      supportStatus: supportStatus,
      citations: claimCitations,
      is_outside_knowledge: isOutside,
    };

    verifiedClaims.push(evaluatedClaim);
    if (supportStatus !== 'VERIFIED' && supportStatus !== 'SUPPORTED') {
      unsupportedClaims.push(evaluatedClaim);
    }
  }

  // Compile final verified citations list and assign sequential citation numbers [1], [2], ...
  const finalCitations = Array.from(citationMap.values());
  finalCitations.forEach((cit, idx) => {
    cit.citation_number = idx + 1;
  });

  // Map citation_indices onto verified claims
  for (const vc of verifiedClaims) {
    const indices: number[] = [];
    for (const evId of vc.evidence_ids) {
      const matchIdx = finalCitations.findIndex(
        (cit) => cit.chunk_id === evId || cit.citation_id.includes(evId.toLowerCase())
      );
      if (matchIdx !== -1 && !indices.includes(matchIdx + 1)) {
        indices.push(matchIdx + 1);
      }
    }
    vc.citation_indices = indices;
  }

  // Determine contract grounding & coverage score
  const totalClaims = verifiedClaims.length;
  const fullyVerifiedClaims = verifiedClaims.filter(
    (c) => c.support_status === 'VERIFIED' || c.support_status === 'SUPPORTED'
  ).length;

  const coverageScore =
    totalClaims === 0
      ? finalCitations.length && finalCitations.every((cit) => cit.verification_status === 'VERIFIED')
        ? 1.0
        : 0.0
      : Math.round((fullyVerifiedClaims / totalClaims) * 100) / 100;

  // Grounded invariant: True if and only if all claims are fully VERIFIED and at least one citation is VERIFIED
  const isGrounded =
    totalClaims > 0
      ? fullyVerifiedClaims === totalClaims &&
        finalCitations.every((cit) => cit.verification_status === 'VERIFIED') &&
        finalCitations.length > 0
      : finalCitations.length > 0 && finalCitations.every((cit) => cit.verification_status === 'VERIFIED');

  return {
    answer,
    claims: verifiedClaims,
    citations: finalCitations,
    unsupported_claims: unsupportedClaims,
    grounded: isGrounded,
    coverage_score: coverageScore,
  };
}
