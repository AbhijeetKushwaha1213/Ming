/**
 * Canonical Phase 5 — Step 1
 * Learner Evidence & Mastery Model Contracts
 * 
 * Defines server-authoritative data contracts for:
 * 1. CanonicalLearnerEvidence: Immutable record of an observed learning event.
 * 2. ConceptIdentity: Normalized canonical concept taxonomy reference.
 * 3. EvidenceBasedMasteryState: Bounded, explainable topic and concept mastery state.
 * 4. MasteryAuditRecord: Reproducible evidence trail for auditing mastery updates.
 * 
 * ZERO-TRUST BOUNDARIES:
 * - Learners must NEVER submit, overwrite, or mutate mastery state directly.
 * - Mastery state is derived ONLY from verified, authoritative Phase 4 assessment outcomes.
 * - Unverified, quarantined, or invalid submissions are discarded and never update mastery.
 */

import type { SupportedQuestionType, MisconceptionCategory } from './assessmentTypes.ts';
import type { BKTParameters, MasteryStatus } from './bktService.ts';

export type { BKTParameters, MasteryStatus };

/**
 * Validation classification of learning evidence:
 * - VALID_EVIDENCE: Authoritative Phase 4 response (CORRECT, PARTIAL, INCORRECT)
 * - DISCARDED_INVALID: Rejected input, invalid format, or quarantined question
 * - DISCARDED_UNVERIFIABLE: Short answer or question that could not be verified
 */
export type EvidenceValidity =
  | 'VALID_EVIDENCE'
  | 'DISCARDED_INVALID'
  | 'DISCARDED_UNVERIFIABLE';

/**
 * Normalized canonical concept identity.
 */
export interface ConceptIdentity {
  concept_id: string;           // Stable deterministic identifier (e.g. "c_8f1a...")
  concept_name: string;         // Human-readable concept title
  topic: string;                // Parent topic (e.g. "Biology")
  subtopic?: string | null;     // Optional subtopic (e.g. "Cellular Respiration")
}

/**
 * Immutable canonical learner evidence event.
 */
export interface CanonicalLearnerEvidence {
  evidence_id: string;          // Unique event ID (e.g. "evd_...")
  idempotency_key: string;      // Stable idempotency key: "idem_<userId>_<attemptId>_<questionId>"
  user_id: string;              // Authenticated student identifier
  tenant_id?: string;           // Tenant isolation namespace
  attempt_id: string;           // Authoritative assessment attempt ID
  question_id: string;          // Authoritative question ID
  question_type: SupportedQuestionType;
  topic: string;
  subtopic?: string | null;
  concept_id: string;           // Normalized concept ID
  concept_name: string;
  timestamp: string;            // ISO-8601 UTC timestamp
  
  // Performance outcome (derived exclusively from Phase 4 verification)
  classification: 'correct' | 'partially_correct' | 'incorrect' | 'invalid_format' | 'unverifiable';
  credit: number;               // Normalized score bounded in [0.0, 1.0]
  is_correct: boolean;
  error_category?: MisconceptionCategory | null;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  
  // Provenance (Phase 2 & 3 Grounding coordinates)
  source_id?: string | null;
  chunk_id?: string | null;
  source_coordinate?: string | null;
  
  // Evidentiary validity status
  validity: EvidenceValidity;
}

/**
 * Server-authoritative learner mastery state for a topic or concept.
 */
export interface EvidenceBasedMasteryState {
  user_id: string;
  topic: string;
  subtopic?: string | null;
  concept_id?: string | null;
  
  // Estimates & Confidence
  mastery_estimate: number;     // Bounded in [0.0, 1.0] (Bayesian posterior)
  mastery_percentage: number;   // 0 - 100
  confidence: number;           // Evidence sufficiency metric in [0.0, 1.0]
  status: MasteryStatus;        // 'unassessed' | 'developing' | 'proficient' | 'mastered'
  
  // Evidence metrics
  evidence_count: number;       // Total valid evaluated trials
  correct_count: number;
  partial_count: number;
  incorrect_count: number;
  
  // Audit metadata
  prior_mastery: number;        // State before most recent update
  last_evaluated_at: string | null;
  bkt_parameters: BKTParameters;
}

/**
 * Complete auditable proof explaining how a mastery estimate was constructed.
 */
export interface MasteryAuditRecord {
  user_id: string;
  topic: string;
  subtopic: string | null;
  current_state: EvidenceBasedMasteryState;
  evidence_trail: CanonicalLearnerEvidence[];
  reproducible: boolean;
  replayed_posterior: number;
  audit_timestamp: string;
}

/**
 * Ingestion outcome for an evidence record.
 */
export interface EvidenceIngestionResult {
  applied: boolean;
  duplicate: boolean;
  discarded: boolean;
  discard_reason?: string;
  idempotency_key: string;
  updated_state?: EvidenceBasedMasteryState;
}
