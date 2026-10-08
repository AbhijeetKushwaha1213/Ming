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
      slide_number: loc.slide_number !== undefined ? loc.slide_number : c.slide_number,
      timestamp_start: loc.timestamp_start !== undefined ? loc.timestamp_start : c.timestamp_start,
      timestamp_end: loc.timestamp_end !== undefined ? loc.timestamp_end : c.timestamp_end,
      extraction_method: (c.extraction_method || 'NATIVE_TEXT') as ExtractionMethod,
      content_hash: c.content_hash || '',
      chunk_index: c.chunk_index !== undefined ? c.chunk_index : idx,
      section: c.section || null,
      heading: c.heading || null,
      embedding_model: c.embedding_model || 'text-embedding-3-small',
      embedding_version: c.embedding_version || 'v1',
      created_at: c.created_at || new Date().toISOString(),
      relevance_score: c.score !== undefined ? c.score : (c.relevance_score ?? 1.0),
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
      const locStr =
        item.page_number !== null && item.page_number !== undefined
          ? `Page ${item.page_number}`
          : item.slide_number !== null && item.slide_number !== undefined
          ? `Slide ${item.slide_number}`
          : item.timestamp_start !== null && item.timestamp_start !== undefined
          ? `Timestamp ${Math.floor(item.timestamp_start / 60)}m${Math.floor(item.timestamp_start % 60)}s`
          : 'Document Excerpt';

      return (
        `${item.evidence_ref}\n` +
        `Source Type: ${item.source_type} | Location: ${locStr}\n` +
        `Resource ID: ${item.resource_id}\n` +
        `Extraction Method: ${item.extraction_method}\n` +
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
 */
export function extractClaimsFromAnswer(answerText: string): ProposedClaim[] {
  if (!answerText || !answerText.trim()) return [];

  const sentences = answerText
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const claims: ProposedClaim[] = [];

  sentences.forEach((sentence, idx) => {
    // Look for [EVIDENCE_n] or [CHUNK_id] tokens
    const evTokens = sentence.match(/\[(EVIDENCE_\d+|[a-zA-Z0-9_\-]+)\]/g) || [];
    const evidenceIds = evTokens.map((t) => t.replace(/[\[\]]/g, ''));
    const cleanText = sentence.replace(/\[(EVIDENCE_\d+|[a-zA-Z0-9_\-]+)\]/g, '').trim();

    if (cleanText) {
      claims.push({
        claim_id: `claim_${idx + 1}`,
        text: cleanText,
        evidence_ids: evidenceIds,
      });
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

  // If citation specifies a resource_id and it differs from canonical provenance -> spoofed resource ID
  if (citation.resource_id && citation.resource_id !== canonical.resource_id) {
    return {
      citation_id: `cit_unverified_spoofed_${canonical.chunk_id}`,
      chunk_id: canonical.chunk_id,
      resource_id: canonical.resource_id,
      source_title: citation.source_title || 'Spoofed Resource Citation',
      source_type: canonical.source_type,
      location: {
        source_type: canonical.source_type,
        page_number: canonical.page_number,
        slide_number: canonical.slide_number,
        timestamp_start: canonical.timestamp_start,
        timestamp_end: canonical.timestamp_end,
      },
      excerpt: citation.excerpt || '',
      verification_status: 'UNVERIFIED',
    };
  }

  // 2. Revalidate tenant security boundary (server-side authenticated identity only)
  const isOwner = canonical.user_id === authenticatedUserId;
  const isSystemPublic =
    canonical.tenant_type === 'SYSTEM_PUBLIC' ||
    canonical.user_id === 'system_public' ||
    canonical.user_id === 'default_user';

  if (!isOwner && !isSystemPublic) {
    return {
      citation_id: `cit_cross_tenant_${canonical.chunk_id}`,
      chunk_id: canonical.chunk_id,
      resource_id: canonical.resource_id,
      source_title: citation.source_title || 'Cross-Tenant Resource',
      source_type: canonical.source_type,
      location: {
        source_type: canonical.source_type,
        page_number: canonical.page_number,
        slide_number: canonical.slide_number,
        timestamp_start: canonical.timestamp_start,
        timestamp_end: canonical.timestamp_end,
      },
      excerpt: citation.excerpt || '',
      verification_status: 'CROSS_TENANT_REJECTED',
    };
  }

  // 3. Revalidate resource existence & deletion state via authoritative check
  const resourceRecord = await checkResource(canonical.resource_id);
  if (!resourceRecord || !resourceRecord.exists || resourceRecord.isDeleted) {
    return {
      citation_id: `cit_unavailable_${canonical.chunk_id}`,
      chunk_id: canonical.chunk_id,
      resource_id: canonical.resource_id,
      source_title: citation.source_title || 'Unavailable Resource',
      source_type: canonical.source_type,
      location: {
        source_type: canonical.source_type,
        page_number: canonical.page_number,
        slide_number: canonical.slide_number,
        timestamp_start: canonical.timestamp_start,
        timestamp_end: canonical.timestamp_end,
      },
      excerpt: citation.excerpt || '',
      verification_status: 'SOURCE_UNAVAILABLE',
    };
  }

  // Revalidate resource record tenant authorization
  const isRecordPublic =
    resourceRecord.tenantType === 'SYSTEM_PUBLIC' ||
    resourceRecord.userId === 'system_public' ||
    resourceRecord.userId === 'default_user';

  if (resourceRecord.userId !== authenticatedUserId && !isRecordPublic) {
    return {
      citation_id: `cit_cross_tenant_${canonical.chunk_id}`,
      chunk_id: canonical.chunk_id,
      resource_id: canonical.resource_id,
      source_title: citation.source_title || 'Cross-Tenant Resource',
      source_type: canonical.source_type,
      location: {
        source_type: canonical.source_type,
        page_number: canonical.page_number,
        slide_number: canonical.slide_number,
        timestamp_start: canonical.timestamp_start,
        timestamp_end: canonical.timestamp_end,
      },
      excerpt: citation.excerpt || '',
      verification_status: 'CROSS_TENANT_REJECTED',
    };
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
    return {
      citation_id: `cit_coord_mismatch_${canonical.chunk_id}`,
      chunk_id: canonical.chunk_id,
      resource_id: canonical.resource_id,
      source_title: citation.source_title || 'Coordinate Mismatched Citation',
      source_type: canonical.source_type,
      // Retain canonical navigation metadata, but flag status explicitly as COORDINATE_MISMATCH
      location: {
        source_type: canonical.source_type,
        page_number: canonical.page_number,
        slide_number: canonical.slide_number,
        timestamp_start: canonical.timestamp_start,
        timestamp_end: canonical.timestamp_end,
      },
      excerpt: citation.excerpt || '',
      verification_status: 'COORDINATE_MISMATCH',
    };
  }

  // 5. Excerpt / Content alignment
  if (citation.excerpt && citation.excerpt.trim()) {
    const alignCheck = checkExcerptAlignment(citation.excerpt, canonical.text);
    if (!alignCheck.aligned) {
      return {
        citation_id: `cit_unaligned_${canonical.chunk_id}`,
        chunk_id: canonical.chunk_id,
        resource_id: canonical.resource_id,
        source_title: citation.source_title || 'Unaligned Excerpt Citation',
        source_type: canonical.source_type,
        location: {
          source_type: canonical.source_type,
          page_number: canonical.page_number,
          slide_number: canonical.slide_number,
          timestamp_start: canonical.timestamp_start,
          timestamp_end: canonical.timestamp_end,
        },
        excerpt: citation.excerpt,
        verification_status: 'UNVERIFIED',
      };
    } else if (alignCheck.partial) {
      return {
        citation_id: `cit_partially_aligned_${canonical.chunk_id}`,
        chunk_id: canonical.chunk_id,
        resource_id: canonical.resource_id,
        source_title: citation.source_title || 'Partially Aligned Citation',
        source_type: canonical.source_type,
        location: {
          source_type: canonical.source_type,
          page_number: canonical.page_number,
          slide_number: canonical.slide_number,
          timestamp_start: canonical.timestamp_start,
          timestamp_end: canonical.timestamp_end,
        },
        excerpt: citation.excerpt,
        verification_status: 'PARTIALLY_VERIFIED',
      };
    }
  }

  // 6. Citation fully verified! Retains complete canonical navigation coordinates.
  return {
    citation_id: `cit_${canonical.evidence_id.toLowerCase()}_${canonical.chunk_id}`,
    chunk_id: canonical.chunk_id,
    resource_id: canonical.resource_id,
    source_title: citation.source_title || `Source ${canonical.resource_id}`,
    source_type: canonical.source_type,
    location: {
      source_type: canonical.source_type,
      page_number: canonical.page_number,
      slide_number: canonical.slide_number,
      timestamp_start: canonical.timestamp_start,
      timestamp_end: canonical.timestamp_end,
    },
    excerpt: citation.excerpt || canonical.text.slice(0, 200),
    verification_status: 'VERIFIED',
  };
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

    const evaluatedClaim: GroundedClaim = {
      claim_id: claimId,
      text: c.text,
      claim: c.text,
      evidence_ids: evidenceIds,
      support_status: supportStatus,
      supportStatus: supportStatus,
      citations: claimCitations,
    };

    verifiedClaims.push(evaluatedClaim);
    if (supportStatus !== 'VERIFIED' && supportStatus !== 'SUPPORTED') {
      unsupportedClaims.push(evaluatedClaim);
    }
  }

  // Compile final verified citations list
  const finalCitations = Array.from(citationMap.values());

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
