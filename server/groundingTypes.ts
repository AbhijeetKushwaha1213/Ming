/**
 * Canonical Phase 3 — Grounding Data Models & Contracts
 * 
 * Defines canonical contracts for:
 * 1. CanonicalEvidence: Exact retrieved and verified knowledge units
 * 2. GroundedClaim: Individual factual claims linked to supporting evidence
 * 3. VerifiedCitation: Application-verified citation reference with exact coordinates
 * 4. GroundedAnswerContract: Structured AI answer payload guaranteeing provenance and refusal integrity
 *
 * Preserves all Phase 1 zero-trust tenant boundaries and Phase 2 provenance schemas.
 */

import type { SourceType, ExtractionMethod } from './ingestionTypes.ts';

/**
 * Re-export foundational Phase 2 provenance types for grounding consumers
 */
export type { SourceType, ExtractionMethod };

/**
 * Canonical Evidence Object
 * Normalized atomic unit of verified knowledge retrieved from the vector store
 * to support response generation and citation navigation.
 */
export interface CanonicalEvidence {
  evidence_id: string;
  chunk_id: string;
  resource_id: string;
  source_type: SourceType;
  text: string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  extraction_method: ExtractionMethod;
  content_hash: string;
  relevance_score: number;
}

/**
 * Support status classification for factual claims in generated answers.
 * Incorporates canonical Phase 3 Step 3 deterministic verification outcomes.
 */
export type ClaimSupportStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'UNSUPPORTED'
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED'
  | 'SOURCE_UNAVAILABLE'
  | 'CROSS_TENANT_REJECTED'
  | 'COORDINATE_MISMATCH';

/**
 * Grounded Claim Object
 * Represents an individual factual assertion within an AI answer,
 * linked to the retrieved evidence IDs that substantiate it.
 */
export interface GroundedClaim {
  claim_id: string;
  text: string;
  claim?: string; // Canonical alias for claim text
  evidence_ids: string[];
  support_status: ClaimSupportStatus;
  supportStatus?: ClaimSupportStatus; // Canonical alias for support_status
  citations?: VerifiedCitation[];
}

/**
 * Verification state of an application-controlled citation
 */
export type CitationVerificationStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED'
  | 'SOURCE_UNAVAILABLE'
  | 'CROSS_TENANT_REJECTED'
  | 'COORDINATE_MISMATCH';

/**
 * Normalized source coordinates for navigating into original media
 */
export interface SourceLocation {
  source_type: SourceType | string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  is_diagram?: boolean;
  diagram_caption?: string;
}

/**
 * Verified Citation Object
 * Deterministic application-verified reference displayed alongside answers.
 * Resolves to the actual retrieved chunk and authentic source media location.
 */
export interface VerifiedCitation {
  citation_id: string;
  chunk_id: string;
  resource_id: string;
  source_title: string;
  source_type: SourceType | string;
  location: SourceLocation;
  excerpt: string;
  verification_status: CitationVerificationStatus | string;
}

/**
 * Grounded Answer Contract
 * Structured AI response payload containing the answer prose, individual claims,
 * verified citations, and unsupported claim telemetry.
 */
export interface GroundedAnswerContract {
  answer: string;
  claims: GroundedClaim[];
  citations: VerifiedCitation[];
  unsupported_claims: GroundedClaim[];
  grounded: boolean;
  coverage_score: number;
}
