/**
 * Canonical Phase 5 — Step 1 Test Suite
 * Learner Evidence & Mastery Model Foundation
 * 
 * 40+ comprehensive tests covering:
 * 1. Concept taxonomy normalization & identity stability
 * 2. Deterministic idempotency key calculation
 * 3. Authoritative evidence extraction from Phase 4 evaluations
 * 4. Discarding invalid & unverifiable submissions without penalty
 * 5. Deterministic Bayesian Knowledge Tracing mastery updates & bounds [0.01, 0.99]
 * 6. Confidence vs. mastery separation & sufficiency scaling
 * 7. Event idempotency & duplicate attempt protection
 * 8. 100% auditable replayability & verification
 * 9. Zero-trust security & multi-tenant isolation
 * 10. Query & audit API contracts
 * 11. End-to-end integration with Phase 4 assessment pipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeCanonicalConceptId,
  normalizeConceptString,
  createIdempotencyKey,
  extractLearnerEvidence,
  recordLearnerEvidence,
  getTopicMasteryState,
  getLearnerMasteryAudit,
  replayEvidenceMastery,
} from '../../server/learnerEvidenceService.ts';
import type {
  CanonicalLearnerEvidence,
  EvidenceValidity,
} from '../../server/learnerTypes.ts';
import {
  calculateBKTUpdate,
  calculateConfidence,
  getDifficultyBKTParameters,
} from '../../server/bktService.ts';
import { learnerHandler } from '../../server/learnerHandler.ts';
import { gradeNumericalAnswer } from '../../server/numericalVerifier.ts';
import { gradeUniversalAnswer } from '../../server/robustAnswerVerifier.ts';
import { rateLimitMap } from '../../server/authMiddleware.ts';

// Mock helper for Express-like req/res
function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3001/api/learner/mastery',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
  };

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(data?: any) {
      if (data && !this.body) {
        try {
          this.body = JSON.parse(data);
        } catch {
          this.body = data;
        }
      }
    },
  };

  return { req, res };
}

describe('CANONICAL PHASE 5 — STEP 1: LEARNER EVIDENCE & MASTERY FOUNDATION', () => {
  beforeEach(() => {
    rateLimitMap.clear();
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
    process.env.MING_TEST_SECRET = 'phase5-test-secret-key';
  });

  // =========================================================================
  // 1. Concept Taxonomy Normalization & Stability (Part 4)
  // =========================================================================
  describe('1. Concept Taxonomy Normalization & Stability', () => {
    it('1.1 should normalize strings with punctuation, excess spaces, and mixed case', () => {
      const raw = '  Newton\'s Second Law: F = m*a!  ';
      const normalized = normalizeConceptString(raw);
      expect(normalized).toBe('newton s second law f m a');
    });

    it('1.2 should compute identical concept IDs for functionally identical topic/concept pairs', () => {
      const c1 = computeCanonicalConceptId('Physics', 'Kinematics', "Newton's First Law");
      const c2 = computeCanonicalConceptId('physics', 'kinematics', 'newton s first law');
      const c3 = computeCanonicalConceptId('  PHYSICS  ', ' KINEMATICS ', 'Newton\'s First Law   ');

      expect(c1.concept_id).toBe(c2.concept_id);
      expect(c1.concept_id).toBe(c3.concept_id);
      expect(c1.concept_id.startsWith('c_')).toBe(true);
    });

    it('1.3 should compute distinct concept IDs for semantically different concepts', () => {
      const c1 = computeCanonicalConceptId('Physics', 'Kinematics', 'Velocity');
      const c2 = computeCanonicalConceptId('Physics', 'Kinematics', 'Acceleration');
      const c3 = computeCanonicalConceptId('Chemistry', 'Kinetics', 'Reaction Rate');

      expect(c1.concept_id).not.toBe(c2.concept_id);
      expect(c1.concept_id).not.toBe(c3.concept_id);
      expect(c2.concept_id).not.toBe(c3.concept_id);
    });

    it('1.4 should gracefully handle missing subtopic or concept name by falling back to topic', () => {
      const c = computeCanonicalConceptId('Calculus', null, null);
      expect(c.concept_id).toBeDefined();
      expect(c.concept_name).toBe('Calculus');
      expect(c.subtopic).toBeNull();
    });

    it('1.5 should normalize empty or undefined topics to General fallback', () => {
      const c = computeCanonicalConceptId('', undefined, '');
      expect(c.topic).toBe('General');
      expect(c.concept_name).toBe('core_concept');
      expect(c.concept_id.startsWith('c_')).toBe(true);
    });
  });

  // =========================================================================
  // 2. Deterministic Idempotency Key Generation (Part 9)
  // =========================================================================
  describe('2. Deterministic Idempotency Key Generation', () => {
    it('2.1 should generate stable idempotency keys from user, attempt, and question IDs', () => {
      const key1 = createIdempotencyKey('user_123', 'att_456', 'q_789');
      const key2 = createIdempotencyKey('user_123', 'att_456', 'q_789');
      expect(key1).toBe('idem_user_123_att_456_q_789');
      expect(key1).toBe(key2);
    });

    it('2.2 should distinguish distinct questions within the same attempt', () => {
      const keyQ1 = createIdempotencyKey('user_1', 'att_A', 'q_1');
      const keyQ2 = createIdempotencyKey('user_1', 'att_A', 'q_2');
      expect(keyQ1).not.toBe(keyQ2);
    });

    it('2.3 should distinguish distinct attempts for the same question', () => {
      const keyAttempt1 = createIdempotencyKey('user_1', 'att_A', 'q_1');
      const keyAttempt2 = createIdempotencyKey('user_1', 'att_B', 'q_1');
      expect(keyAttempt1).not.toBe(keyAttempt2);
    });

    it('2.4 should distinguish different users attempting the same question', () => {
      const keyUserA = createIdempotencyKey('user_alice', 'att_1', 'q_1');
      const keyUserB = createIdempotencyKey('user_bob', 'att_1', 'q_1');
      expect(keyUserA).not.toBe(keyUserB);
    });

    it('2.5 should trim whitespace from input tokens', () => {
      const key = createIdempotencyKey('  user_1  ', ' att_2 ', ' q_3 ');
      expect(key).toBe('idem_user_1_att_2_q_3');
    });
  });

  // =========================================================================
  // 3. Authoritative Evidence Extraction (Part 5)
  // =========================================================================
  describe('3. Authoritative Evidence Extraction from Phase 4 Pipeline', () => {
    const baseContext = {
      userId: 'test_student_phase5',
      attemptId: 'att_exam_001',
      topic: 'Thermodynamics',
      subtopic: 'Carnot Engines',
      difficulty: 'hard',
      tenantId: 'tenant_omega',
    };

    it('3.1 should extract VALID_EVIDENCE for authoritative CORRECT evaluations', () => {
      const evalOutput = {
        questionId: 'q_carnot_1',
        questionType: 'NUMERICAL',
        classification: 'correct',
        credit: 1.0,
        isCorrect: true,
        location: { source_id: 'res_physics_book', chunk_id: 'chk_99' },
        citation_label: '[1] p. 142',
      };

      const evidence = extractLearnerEvidence(evalOutput, baseContext);

      expect(evidence.validity).toBe('VALID_EVIDENCE');
      expect(evidence.is_correct).toBe(true);
      expect(evidence.credit).toBe(1.0);
      expect(evidence.user_id).toBe(baseContext.userId);
      expect(evidence.tenant_id).toBe(baseContext.tenantId);
      expect(evidence.attempt_id).toBe(baseContext.attemptId);
      expect(evidence.source_id).toBe('res_physics_book');
      expect(evidence.chunk_id).toBe('chk_99');
      expect(evidence.source_coordinate).toBe('[1] p. 142');
      expect(evidence.idempotency_key).toBe('idem_test_student_phase5_att_exam_001_q_carnot_1');
    });

    it('3.2 should extract VALID_EVIDENCE for authoritative INCORRECT evaluations with error category', () => {
      const evalOutput = {
        questionId: 'q_carnot_2',
        questionType: 'NUMERICAL',
        classification: 'incorrect',
        credit: 0.0,
        isCorrect: false,
        errorCategory: 'SIGN_ERROR',
        detectedMisconception: { concept: 'Entropy change sign reversal' },
      };

      const evidence = extractLearnerEvidence(evalOutput, baseContext);

      expect(evidence.validity).toBe('VALID_EVIDENCE');
      expect(evidence.is_correct).toBe(false);
      expect(evidence.credit).toBe(0.0);
      expect(evidence.error_category).toBe('SIGN_ERROR');
      expect(evidence.concept_name).toBe('Entropy change sign reversal');
    });

    it('3.3 should extract VALID_EVIDENCE for PARTIALLY_CORRECT evaluations with fractional credit', () => {
      const evalOutput = {
        questionId: 'q_carnot_3',
        questionType: 'SHORT_ANSWER',
        classification: 'partially_correct',
        credit: 0.5,
        isCorrect: false,
      };

      const evidence = extractLearnerEvidence(evalOutput, baseContext);

      expect(evidence.validity).toBe('VALID_EVIDENCE');
      expect(evidence.credit).toBe(0.5);
      expect(evidence.is_correct).toBe(false);
      expect(evidence.classification).toBe('partially_correct');
    });

    it('3.4 should flag INVALID_FORMAT submissions as DISCARDED_INVALID', () => {
      const evalOutput = {
        questionId: 'q_carnot_invalid',
        questionType: 'NUMERICAL',
        classification: 'invalid_format',
        credit: 0.0,
        isCorrect: false,
      };

      const evidence = extractLearnerEvidence(evalOutput, baseContext);
      expect(evidence.validity).toBe('DISCARDED_INVALID');
    });

    it('3.5 should flag UNVERIFIABLE questions as DISCARDED_UNVERIFIABLE', () => {
      const evalOutput = {
        questionId: 'q_carnot_unverifiable',
        questionType: 'MCQ',
        classification: 'unverifiable',
        credit: 0.0,
        isCorrect: false,
      };

      const evidence = extractLearnerEvidence(evalOutput, baseContext);
      expect(evidence.validity).toBe('DISCARDED_UNVERIFIABLE');
    });
  });

  // =========================================================================
  // 4. Discarded Evidence Filtering & Safety (Part 5)
  // =========================================================================
  describe('4. Discarded Evidence Filtering & Non-Penalization', () => {
    it('4.1 should reject DISCARDED_INVALID evidence without mutating learner mastery', async () => {
      const evidence: CanonicalLearnerEvidence = {
        evidence_id: 'evd_invalid_01',
        idempotency_key: 'idem_user_discard_1_att_1_q_1',
        user_id: 'user_discard_test_1',
        tenant_id: 'tenant_1',
        attempt_id: 'att_1',
        question_id: 'q_1',
        question_type: 'NUMERICAL',
        topic: 'Linear Algebra',
        subtopic: null,
        concept_id: 'c_linalg',
        concept_name: 'Matrix Rank',
        timestamp: new Date().toISOString(),
        classification: 'invalid_format',
        credit: 0.0,
        is_correct: false,
        error_category: null,
        difficulty: 'medium',
        source_id: null,
        chunk_id: null,
        source_coordinate: null,
        validity: 'DISCARDED_INVALID',
      };

      const result = await recordLearnerEvidence(evidence);

      expect(result.applied).toBe(false);
      expect(result.discarded).toBe(true);
      expect(result.discard_reason).toContain('DISCARDED_INVALID');

      // Mastery should remain unassessed with 0 trials
      const state = await getTopicMasteryState('user_discard_test_1', 'Linear Algebra');
      expect(state.evidence_count).toBe(0);
      expect(state.status).toBe('unassessed');
    });

    it('4.2 should reject DISCARDED_UNVERIFIABLE evidence without penalizing student', async () => {
      const evidence: CanonicalLearnerEvidence = {
        evidence_id: 'evd_unverifiable_01',
        idempotency_key: 'idem_user_discard_2_att_1_q_1',
        user_id: 'user_discard_test_2',
        tenant_id: 'tenant_1',
        attempt_id: 'att_1',
        question_id: 'q_1',
        question_type: 'SHORT_ANSWER',
        topic: 'Quantum Physics',
        subtopic: null,
        concept_id: 'c_quantum',
        concept_name: 'Superposition',
        timestamp: new Date().toISOString(),
        classification: 'unverifiable',
        credit: 0.0,
        is_correct: false,
        error_category: null,
        difficulty: 'hard',
        source_id: null,
        chunk_id: null,
        source_coordinate: null,
        validity: 'DISCARDED_UNVERIFIABLE',
      };

      const result = await recordLearnerEvidence(evidence);

      expect(result.applied).toBe(false);
      expect(result.discarded).toBe(true);
      expect(result.discard_reason).toContain('DISCARDED_UNVERIFIABLE');

      const state = await getTopicMasteryState('user_discard_test_2', 'Quantum Physics');
      expect(state.evidence_count).toBe(0);
    });
  });

  // =========================================================================
  // 5. Initial Mastery Model & Update Semantics (Parts 6 & 8)
  // =========================================================================
  describe('5. Initial Mastery Model & Deterministic Update Semantics', () => {
    const testUser = 'user_mastery_dynamics_' + Date.now();
    const testTopic = 'Classical Mechanics';

    it('5.1 should initialize first evidence from default difficulty prior (pL0 = 0.15 for medium)', async () => {
      const evidence: CanonicalLearnerEvidence = {
        evidence_id: `evd_init_${Date.now()}`,
        idempotency_key: `idem_${testUser}_att1_q1`,
        user_id: testUser,
        tenant_id: testUser,
        attempt_id: 'att1',
        question_id: 'q1',
        question_type: 'MCQ',
        topic: testTopic,
        subtopic: null,
        concept_id: 'c_mech_01',
        concept_name: 'Kinematics',
        timestamp: new Date().toISOString(),
        classification: 'correct',
        credit: 1.0,
        is_correct: true,
        error_category: null,
        difficulty: 'medium',
        source_id: null,
        chunk_id: null,
        source_coordinate: null,
        validity: 'VALID_EVIDENCE',
      };

      const result = await recordLearnerEvidence(evidence);

      expect(result.applied).toBe(true);
      expect(result.updated_state).toBeDefined();
      expect(result.updated_state!.prior_mastery).toBe(0.15);
      // Posterior for correct answer should strictly exceed prior
      expect(result.updated_state!.mastery_estimate).toBeGreaterThan(0.15);
      expect(result.updated_state!.evidence_count).toBe(1);
      expect(result.updated_state!.correct_count).toBe(1);
      expect(result.updated_state!.incorrect_count).toBe(0);
    });

    it('5.2 should decrease mastery probability on incorrect answer', async () => {
      const user = `user_incorrect_${Date.now()}`;
      const evidence: CanonicalLearnerEvidence = {
        evidence_id: `evd_inc_${Date.now()}`,
        idempotency_key: `idem_${user}_att1_q1`,
        user_id: user,
        tenant_id: user,
        attempt_id: 'att1',
        question_id: 'q1',
        question_type: 'NUMERICAL',
        topic: 'Optics',
        subtopic: null,
        concept_id: 'c_optics_01',
        concept_name: 'Refraction',
        timestamp: new Date().toISOString(),
        classification: 'incorrect',
        credit: 0.0,
        is_correct: false,
        error_category: 'FORMULA_ERROR',
        difficulty: 'medium',
        source_id: null,
        chunk_id: null,
        source_coordinate: null,
        validity: 'VALID_EVIDENCE',
      };

      const result = await recordLearnerEvidence(evidence);

      expect(result.applied).toBe(true);
      expect(result.updated_state!.mastery_estimate).toBeLessThan(0.15);
      expect(result.updated_state!.incorrect_count).toBe(1);
    });

    it('5.3 should scale partial credit (0.50) between full correct and full incorrect update', async () => {
      const prior = 0.50;
      const params = getDifficultyBKTParameters('medium');

      const correct = calculateBKTUpdate(prior, true, params, 1.0);
      const partial = calculateBKTUpdate(prior, false, params, 0.5);
      const incorrect = calculateBKTUpdate(prior, false, params, 0.0);

      expect(correct.posterior).toBeGreaterThan(partial.posterior);
      expect(partial.posterior).toBeGreaterThan(incorrect.posterior);
    });

    it('5.4 should avoid declaring full mastery from a single lucky correct answer (no leap)', () => {
      const params = getDifficultyBKTParameters('medium');
      const { posterior } = calculateBKTUpdate(0.15, true, params, 1.0);

      // Single correct answer should increase mastery moderately, never leaping to > 0.80
      expect(posterior).toBeLessThan(0.65);
      expect(posterior).toBeGreaterThan(0.20);
    });

    it('5.5 should avoid catastrophic mastery collapse from a single mistake', () => {
      const highPrior = 0.85;
      const params = getDifficultyBKTParameters('medium');
      const { posterior } = calculateBKTUpdate(highPrior, false, params, 0.0);

      // Single mistake from 0.85 should degrade gracefully, not crash to 0.05
      expect(posterior).toBeGreaterThan(0.40);
    });

    it('5.6 should strictly bound mastery within [0.01, 0.99] across 30 repeated correct trials', () => {
      const params = getDifficultyBKTParameters('medium');
      let currentMastery = 0.15;

      for (let i = 0; i < 30; i++) {
        const { posterior } = calculateBKTUpdate(currentMastery, true, params, 1.0);
        expect(posterior).toBeGreaterThanOrEqual(0.01);
        expect(posterior).toBeLessThanOrEqual(0.99);
        currentMastery = posterior;
      }

      // Asymptotically bounded at or below 0.99
      expect(currentMastery).toBeLessThanOrEqual(0.99);
      expect(currentMastery).toBeGreaterThan(0.90);
    });

    it('5.7 should strictly bound mastery within [0.01, 0.99] across 30 repeated incorrect trials', () => {
      const params = getDifficultyBKTParameters('medium');
      let currentMastery = 0.50;

      for (let i = 0; i < 30; i++) {
        const { posterior } = calculateBKTUpdate(currentMastery, false, params, 0.0);
        expect(posterior).toBeGreaterThanOrEqual(0.01);
        expect(posterior).toBeLessThanOrEqual(0.99);
        currentMastery = posterior;
      }

      // Asymptotically bounded at or above 0.01 (medium diff floor ~0.114 due to pT=0.10)
      expect(currentMastery).toBeGreaterThanOrEqual(0.01);
      expect(currentMastery).toBeLessThan(0.15);
    });

    it('5.8 should be 100% deterministic: identical sequence produces identical posterior', () => {
      const params = getDifficultyBKTParameters('hard');
      const seq = [true, false, true, true, false, true];

      let pA = params.pL0;
      for (const res of seq) {
        pA = calculateBKTUpdate(pA, res, params, res ? 1.0 : 0.0).posterior;
      }

      let pB = params.pL0;
      for (const res of seq) {
        pB = calculateBKTUpdate(pB, res, params, res ? 1.0 : 0.0).posterior;
      }

      expect(pA).toBe(pB);
    });
  });

  // =========================================================================
  // 6. Confidence vs. Mastery Separation (Part 7)
  // =========================================================================
  describe('6. Confidence vs. Mastery Separation', () => {
    it('6.1 should maintain 0.0 confidence when 0 trials exist', () => {
      const conf = calculateConfidence(0);
      expect(conf).toBe(0.0);
    });

    it('6.2 should monotonically increase confidence with trial count regardless of correctness', () => {
      const c1 = calculateConfidence(1);
      const c3 = calculateConfidence(3);
      const c7 = calculateConfidence(7);
      const c15 = calculateConfidence(15);

      expect(c1).toBeLessThan(c3);
      expect(c3).toBeLessThan(c7);
      expect(c7).toBeLessThan(c15);
      expect(c15).toBeGreaterThanOrEqual(0.85);
    });

    it('6.3 should permit LOW_MASTERY with HIGH_CONFIDENCE (repeated incorrect answers)', () => {
      const params = getDifficultyBKTParameters('medium');
      let mastery = params.pL0;
      const trials = 12;

      for (let i = 0; i < trials; i++) {
        mastery = calculateBKTUpdate(mastery, false, params, 0.0).posterior;
      }
      const confidence = calculateConfidence(trials);

      expect(mastery).toBeLessThan(0.15); // Low mastery bounded by pT floor
      expect(confidence).toBeGreaterThan(0.80); // High confidence that student does NOT know concept
    });

    it('6.4 should permit MODERATE_MASTERY with LOW_CONFIDENCE (single correct answer)', () => {
      const params = getDifficultyBKTParameters('medium');
      const { posterior: mastery } = calculateBKTUpdate(params.pL0, true, params, 1.0);
      const confidence = calculateConfidence(1);

      expect(mastery).toBeGreaterThan(0.35); // Elevated mastery
      expect(confidence).toBeLessThan(0.35); // Low confidence due to sparse evidence
    });
  });

  // =========================================================================
  // 7. Event Idempotency & Duplicate Protection (Part 9)
  // =========================================================================
  describe('7. Event Idempotency & Duplicate Attempt Handling', () => {
    const idempotentUser = `user_idem_${Date.now()}`;
    const topic = 'Organic Chemistry';

    const evidence: CanonicalLearnerEvidence = {
      evidence_id: `evd_idem_${Date.now()}`,
      idempotency_key: `idem_${idempotentUser}_att_idem_001_q_99`,
      user_id: idempotentUser,
      tenant_id: idempotentUser,
      attempt_id: 'att_idem_001',
      question_id: 'q_99',
      question_type: 'MCQ',
      topic,
      subtopic: 'Stereochemistry',
      concept_id: 'c_chirality',
      concept_name: 'Chirality',
      timestamp: new Date().toISOString(),
      classification: 'correct',
      credit: 1.0,
      is_correct: true,
      error_category: null,
      difficulty: 'medium',
      source_id: null,
      chunk_id: null,
      source_coordinate: null,
      validity: 'VALID_EVIDENCE',
    };

    it('7.1 should ingest the first occurrence and update state', async () => {
      const first = await recordLearnerEvidence(evidence);
      expect(first.applied).toBe(true);
      expect(first.duplicate).toBe(false);
      expect(first.updated_state!.evidence_count).toBe(1);
    });

    it('7.2 should detect the second identical occurrence as duplicate and NOT double-count', async () => {
      const second = await recordLearnerEvidence(evidence);
      expect(second.applied).toBe(false);
      expect(second.duplicate).toBe(true);

      // Verify database state: trials should still be 1, NOT 2
      const state = await getTopicMasteryState(idempotentUser, topic, 'Stereochemistry');
      expect(state.evidence_count).toBe(1);
      expect(state.correct_count).toBe(1);
    });

    it('7.3 should safely accept a different question in the same attempt without collision', async () => {
      const differentQuestionEvidence: CanonicalLearnerEvidence = {
        ...evidence,
        evidence_id: `evd_idem_${Date.now()}_q100`,
        idempotency_key: `idem_${idempotentUser}_att_idem_001_q_100`,
        question_id: 'q_100',
      };

      const res = await recordLearnerEvidence(differentQuestionEvidence);
      expect(res.applied).toBe(true);
      expect(res.duplicate).toBe(false);

      const state = await getTopicMasteryState(idempotentUser, topic, 'Stereochemistry');
      expect(state.evidence_count).toBe(2);
    });
  });

  // =========================================================================
  // 8. Mastery Auditability & Replayability (Part 12)
  // =========================================================================
  describe('8. Mastery Auditability & Replayability', () => {
    const auditUser = `user_audit_${Date.now()}`;
    const auditTopic = 'Electromagnetism';

    it('8.1 should record granular audit events and return complete audit record', async () => {
      // Ingest 3 events: correct, partial, incorrect
      const ev1: CanonicalLearnerEvidence = {
        evidence_id: `evd_aud1_${Date.now()}`,
        idempotency_key: `idem_${auditUser}_att1_q1`,
        user_id: auditUser,
        tenant_id: auditUser,
        attempt_id: 'att1',
        question_id: 'q1',
        question_type: 'MCQ',
        topic: auditTopic,
        subtopic: null,
        concept_id: 'c_em_01',
        concept_name: 'Coulomb Law',
        timestamp: new Date().toISOString(),
        classification: 'correct',
        credit: 1.0,
        is_correct: true,
        error_category: null,
        difficulty: 'medium',
        source_id: 'res_halliday',
        chunk_id: 'chk_coulomb_1',
        source_coordinate: 'Chapter 21, p. 560',
        validity: 'VALID_EVIDENCE',
      };

      const ev2: CanonicalLearnerEvidence = {
        ...ev1,
        evidence_id: `evd_aud2_${Date.now()}`,
        idempotency_key: `idem_${auditUser}_att1_q2`,
        question_id: 'q2',
        classification: 'partially_correct',
        credit: 0.5,
        is_correct: false,
      };

      const ev3: CanonicalLearnerEvidence = {
        ...ev1,
        evidence_id: `evd_aud3_${Date.now()}`,
        idempotency_key: `idem_${auditUser}_att1_q3`,
        question_id: 'q3',
        classification: 'incorrect',
        credit: 0.0,
        is_correct: false,
        error_category: 'ROUNDING_ERROR',
      };

      await recordLearnerEvidence(ev1);
      await recordLearnerEvidence(ev2);
      await recordLearnerEvidence(ev3);

      const audit = await getLearnerMasteryAudit(auditUser, auditTopic);

      expect(audit).toBeDefined();
      expect(audit.user_id).toBe(auditUser);
      expect(audit.topic).toBe(auditTopic);
      expect(audit.evidence_count).toBe(3);
      expect(audit.events.length).toBe(3);

      // Verify provenance preserved
      expect(audit.events[0].question_id).toBe('q1');
      expect(audit.events[0].source_id).toBe('res_halliday');
      expect(audit.events[0].source_coordinate).toBe('Chapter 21, p. 560');
      expect(audit.events[2].error_category).toBe('ROUNDING_ERROR');
    });

    it('8.2 should accurately replay underlying events and verify mathematical posterior', async () => {
      const replay = await replayEvidenceMastery(auditUser, auditTopic);

      expect(replay.verified).toBe(true);
      expect(replay.event_count).toBe(3);
      expect(replay.delta).toBeLessThanOrEqual(0.001);
      expect(Math.abs(replay.replayed_mastery - replay.recorded_mastery)).toBeLessThanOrEqual(0.001);
    });
  });

  // =========================================================================
  // 9. Zero-Trust Security & Multi-Tenant Isolation (Part 10)
  // =========================================================================
  describe('9. Zero-Trust Security & Multi-Tenant Isolation', () => {
    it('9.1 should forbid client from overriding learner identity in POST /api/learner/update', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/learner/update',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': 'student_legit',
        },
        body: {
          userId: 'student_victim', // Malicious attempt to spoof victim
          topic: 'Computer Networks',
          isCorrect: true,
          credit: 1.0,
        },
      });

      await learnerHandler(req as any, res as any);
      expect(res.statusCode).toBe(200);

      // The returned update must strictly belong to student_legit, NOT student_victim
      expect(res.body.success).toBe(true);
      expect(res.body.update.user_id).toBe('student_legit');
      expect(res.body.update.user_id).not.toBe('student_victim');
    });

    it('9.2 should reject unauthenticated requests to learner API (401)', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/learner/mastery?topic=Physics',
        headers: {}, // No auth header
      });

      await learnerHandler(req as any, res as any);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('9.3 should reject client-injected arbitrary masteryProbability in POST /api/learner/update', async () => {
      const { req, res } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/learner/update',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': 'student_hacker',
        },
        body: {
          topic: 'Cryptography',
          isCorrect: false, // Student failed question
          masteryProbability: 0.99, // Hacked attempt to claim instant 99% mastery
        },
      });

      await learnerHandler(req as any, res as any);
      expect(res.statusCode).toBe(200);

      // Server MUST compute BKT update deterministically from isCorrect=false, ignoring injected 0.99
      expect(res.body.update.mastery_estimate).toBeLessThan(0.15);
      expect(res.body.update.mastery_percentage).toBeLessThan(15);
    });

    it('9.4 should isolate mastery audit queries between distinct tenants', async () => {
      // Setup mastery for user_alice
      const aliceEvidence: CanonicalLearnerEvidence = {
        evidence_id: `evd_alice_${Date.now()}`,
        idempotency_key: `idem_alice_att1_q1`,
        user_id: 'user_alice_isolated',
        tenant_id: 'tenant_alice',
        attempt_id: 'att1',
        question_id: 'q1',
        question_type: 'MCQ',
        topic: 'Operating Systems',
        subtopic: null,
        concept_id: 'c_os_01',
        concept_name: 'Virtual Memory',
        timestamp: new Date().toISOString(),
        classification: 'correct',
        credit: 1.0,
        is_correct: true,
        error_category: null,
        difficulty: 'medium',
        source_id: null,
        chunk_id: null,
        source_coordinate: null,
        validity: 'VALID_EVIDENCE',
      };
      await recordLearnerEvidence(aliceEvidence);

      // Now bob queries their own audit for Operating Systems
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/learner/mastery/audit?topic=Operating%20Systems',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': 'user_bob_isolated',
        },
      });

      await learnerHandler(req as any, res as any);
      expect(res.statusCode).toBe(200);
      // Bob should have 0 evidence, never seeing Alice's records
      expect(res.body.audit.user_id).toBe('user_bob_isolated');
      expect(res.body.audit.evidence_count).toBe(0);
      expect(res.body.audit.events.length).toBe(0);
    });
  });

  // =========================================================================
  // 10. Query & Audit API Contracts (Part 11)
  // =========================================================================
  describe('10. Query & Audit API Contracts', () => {
    it('10.1 GET /api/learner/mastery/audit requires topic param (400 if missing)', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/learner/mastery/audit',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': 'student_contracts',
        },
      });

      await learnerHandler(req as any, res as any);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Topic is required');
    });

    it('10.2 GET /api/learner/mastery/audit returns valid schema with evidence breakdown', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/learner/mastery/audit?topic=Calculus',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': 'student_contracts',
        },
      });

      await learnerHandler(req as any, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.audit).toHaveProperty('user_id');
      expect(res.body.audit).toHaveProperty('topic');
      expect(res.body.audit).toHaveProperty('mastery_estimate');
      expect(res.body.audit).toHaveProperty('confidence');
      expect(res.body.audit).toHaveProperty('evidence_count');
      expect(res.body.audit).toHaveProperty('events');
      expect(Array.isArray(res.body.audit.events)).toBe(true);
    });

    it('10.3 POST /api/learner/update handles duplicate idempotency key idempotently', async () => {
      const graphStudent = `student_graph_${Date.now()}`;
      const payload = {
        topic: 'Graph Theory',
        isCorrect: true,
        attemptId: 'att_graph_1',
        questionId: 'q_dijkstra_1',
      };

      // Call 1
      const { req: req1, res: res1 } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/learner/update',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': graphStudent,
        },
        body: payload,
      });
      await learnerHandler(req1 as any, res1 as any);
      expect(res1.statusCode).toBe(200);
      expect(res1.body.duplicate).toBe(false);

      // Call 2 (identical retry)
      const { req: req2, res: res2 } = createMockReqRes({
        method: 'POST',
        url: 'http://localhost:3001/api/learner/update',
        headers: {
          'x-ming-test-key': 'phase5-test-secret-key',
          'x-ming-user-id': graphStudent,
        },
        body: payload,
      });
      await learnerHandler(req2 as any, res2 as any);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.duplicate).toBe(true);
      expect(res2.body.applied).toBe(false);
    });
  });

  // =========================================================================
  // 11. End-to-End Pipeline Integration with Phase 4 Grading (Part 5)
  // =========================================================================
  describe('11. Integration with Phase 4 Grading Outputs', () => {
    it('11.1 should convert Phase 4 numerical grading into valid learner evidence', () => {
      const grading = gradeNumericalAnswer(
        {
          question_id: 'num_q1',
          raw_answer: '20 N',
        },
        {
          question_id: 'num_q1',
          question: 'Calculate force with m=10kg and a=2m/s^2',
          type: 'NUMERICAL',
          correct_answer: 20,
          expected_unit: 'N',
          explanation: 'F = m*a = 20 N',
        }
      );

      expect(grading.classification).toBe('correct');

      const evidence = extractLearnerEvidence(
        {
          questionId: 'num_q1',
          ...grading,
        },
        {
          userId: 'num_student_1',
          attemptId: 'att_num_1',
          topic: 'Dynamics',
        }
      );

      expect(evidence.validity).toBe('VALID_EVIDENCE');
      expect(evidence.is_correct).toBe(true);
      expect(evidence.credit).toBe(1.0);
    });

    it('11.2 should convert Phase 4 universal grading into valid learner evidence with error category', () => {
      const grading = gradeUniversalAnswer(
        {
          question_id: 'univ_q1',
          raw_answer: 'Ribosome',
        },
        {
          question_id: 'univ_q1',
          question: 'What is the powerhouse of the cell?',
          type: 'SHORT_ANSWER',
          correct_answer: 'Mitochondria',
          options: [],
          explanation: 'Mitochondria generate ATP.',
        }
      );

      expect(grading.classification).toBe('incorrect');

      const evidence = extractLearnerEvidence(
        {
          questionId: 'univ_q1',
          ...grading,
        },
        {
          userId: 'bio_student_1',
          attemptId: 'att_bio_1',
          topic: 'Cell Biology',
        }
      );

      expect(evidence.validity).toBe('VALID_EVIDENCE');
      expect(evidence.is_correct).toBe(false);
      expect(evidence.credit).toBe(0.0);
    });
  });
});
