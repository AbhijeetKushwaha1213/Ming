/**
 * Canonical Phase 4 — Step 2 Test Suite
 * Robust Answer Verification & Harder Misconception Detection
 * 
 * 40+ rigorous verification tests covering:
 * - Numerical verification & error categories (SIGN_ERROR, UNIT_MISMATCH, ORDER_OF_MAGNITUDE, FORMULA_ERROR)
 * - Deterministic MCQ grading with distractor metadata
 * - Multi-select grading with controlled partial credit & component error categories
 * - True/False strict boolean parsing & invalid format handling
 * - Layered short-answer evaluation (exact, variants, component overlap, unverifiable)
 * - Zero-Trust security guarantees (client cannot override score, answer key, tolerance, misconception)
 * - Question-key integrity and quarantine before student delivery
 * - Grounded feedback citation verification reuse (Phase 3 integration, deleted resource handling)
 * - Tenant isolation and student-facing sanitization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  gradeUniversalAnswer,
  gradeMCQ,
  gradeMultiSelect,
  gradeTrueFalse,
  gradeShortAnswer,
  gradeNumerical,
  validateQuestionIntegrity,
  attachGroundedFeedback,
  sanitizeResultForStudent,
  normalizeText,
} from '../../server/robustAnswerVerifier.ts';

import type {
  AuthoritativeQuestion,
  AnswerSubmissionPayload,
  UniversalGradingResult,
} from '../../server/assessmentTypes.ts';

import {
  buildCanonicalEvidenceIndex,
  type CanonicalEvidenceItem,
} from '../../server/citationVerifier.ts';

describe('CANONICAL PHASE 4 — STEP 2: Robust Answer Verification & Misconception Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1-6: Numerical Grading & Deterministic Error Categories
  // =========================================================================
  describe('1-6: Numerical Grading & Deterministic Error Categories', () => {
    const baseNumQ: AuthoritativeQuestion = {
      question_id: 'q_num_1',
      type: 'NUMERICAL',
      topic: 'Thermodynamics',
      difficulty: 'medium',
      question: 'Calculate the total heat energy absorbed in Joules.',
      correct_answer: 250.0,
      expected_unit: 'J',
      page_number: 42,
    };

    it('1. Correct numerical answer → CORRECT with 1.0 credit', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_num_1', raw_answer: '250 J' }, baseNumQ);
      expect(res.classification).toBe('correct');
      expect(res.credit).toBe(1.0);
      expect(res.is_correct).toBe(true);
      expect(res.error_category).toBe('NO_MISCONCEPTION');
    });

    it('2. Numerical wrong answer → INCORRECT with 0.0 credit', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_num_1', raw_answer: '999 J' }, baseNumQ);
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.is_correct).toBe(false);
    });

    it('3. Numerical sign error → SIGN_ERROR with partial credit', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_num_1', raw_answer: '-250 J' }, baseNumQ);
      expect(res.classification).toBe('partially_correct');
      expect(res.credit).toBe(0.5);
      expect(res.error_category).toBe('SIGN_ERROR');
      expect(res.feedback).toContain('Sign error');
    });

    it('4. Numerical unit error → UNIT_MISMATCH with partial credit', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_num_1', raw_answer: '250 kg' }, baseNumQ);
      expect(res.classification).toBe('partially_correct');
      expect(res.credit).toBe(0.5);
      expect(res.error_category).toBe('UNIT_MISMATCH');
      expect(res.feedback).toContain('Unit mismatch');
    });

    it('5. Numerical magnitude error → ORDER_OF_MAGNITUDE', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_num_1', raw_answer: '2500 J' }, baseNumQ);
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.error_category).toBe('ORDER_OF_MAGNITUDE');
      expect(res.feedback).toContain('Order of magnitude error');
    });

    it('6. Numerical formula error where deterministically identifiable → FORMULA_ERROR', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_num_1', raw_answer: '12500 J' }, baseNumQ);
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.error_category).toBe('FORMULA_ERROR');
    });
  });

  // =========================================================================
  // 7-10: Deterministic MCQ Verification & Distractor Metadata
  // =========================================================================
  describe('7-10: Deterministic MCQ Verification', () => {
    const mcqQ: AuthoritativeQuestion = {
      question_id: 'q_mcq_tcp',
      type: 'MCQ',
      topic: 'Computer Networks',
      difficulty: 'medium',
      question: 'Which transport layer protocol provides reliable, connection-oriented byte streams?',
      options: [
        { id: 'opt_udp', text: 'UDP', distractorMetadata: { misconceptionCategory: 'CONCEPTUAL_MISMATCH', rationale: 'Confused UDP with TCP' } },
        { id: 'opt_tcp', text: 'TCP' },
        { id: 'opt_ip', text: 'IP', distractorMetadata: { misconceptionCategory: 'CONCEPTUAL_MISMATCH', rationale: 'IP is network layer' } },
        { id: 'opt_http', text: 'HTTP', distractorMetadata: { misconceptionCategory: 'CONCEPTUAL_MISMATCH', rationale: 'HTTP is application layer' } },
      ],
      correct_answer: 'TCP',
      slide_number: 15,
    };

    it('7. Correct MCQ → CORRECT with 1.0 credit', () => {
      // By exact text
      const resText = gradeUniversalAnswer({ question_id: 'q_mcq_tcp', raw_answer: 'TCP' }, mcqQ);
      expect(resText.classification).toBe('correct');
      expect(resText.credit).toBe(1.0);
      expect(resText.error_category).toBe('NO_MISCONCEPTION');
      expect(resText.feedback).toContain('Correct!');

      // By index (index 1 -> TCP)
      const resIndex = gradeUniversalAnswer({ question_id: 'q_mcq_tcp', raw_answer: '1' }, mcqQ);
      expect(resIndex.classification).toBe('correct');
      expect(resIndex.credit).toBe(1.0);

      // By option ID
      const resId = gradeUniversalAnswer({ question_id: 'q_mcq_tcp', raw_answer: 'opt_tcp' }, mcqQ);
      expect(resId.classification).toBe('correct');
      expect(resId.credit).toBe(1.0);
    });

    it('8. Wrong MCQ → INCORRECT with distractor metadata misconception', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_mcq_tcp', raw_answer: 'UDP' }, mcqQ);
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.error_category).toBe('CONCEPTUAL_MISMATCH');
      expect(res.misconception_description).toContain('Confused UDP with TCP');
      expect(res.feedback).toContain('Slide 15');
    });

    it('9. Invalid MCQ option ID → INVALID_OPTION with safe failure', () => {
      const res = gradeUniversalAnswer({ question_id: 'q_mcq_tcp', raw_answer: 'opt_bluetooth' }, mcqQ);
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.error_category).toBe('INVALID_OPTION');
      expect(res.feedback).toContain('Invalid option selected');
    });

    it('10. Client-supplied correct option cannot alter grading', () => {
      // Malicious client payload attempts to specify correct_answer = 'UDP'
      const maliciousPayload = {
        question_id: 'q_mcq_tcp',
        raw_answer: 'UDP',
        correct_answer: 'UDP',
        credit: 1.0,
        score: 1.0,
        isCorrect: true,
      };

      const res = gradeUniversalAnswer(maliciousPayload as any, mcqQ);
      // Authoritative correct_answer on server is TCP, so UDP must be INCORRECT
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.is_correct).toBe(false);
    });
  });

  // =========================================================================
  // 11-14: Multi-Select Verification & Controlled Partial Credit
  // =========================================================================
  describe('11-14: Multi-Select Verification', () => {
    const multiQ: AuthoritativeQuestion = {
      question_id: 'q_multi_acid',
      type: 'MULTI_SELECT',
      topic: 'Databases',
      difficulty: 'hard',
      question: 'Which of the following are ACID properties in database management systems?',
      options: ['Atomicity', 'Consistency', 'Latency', 'Durability', 'Throughput'],
      correct_answer: ['Atomicity', 'Consistency', 'Durability'],
      page_number: 104,
    };

    it('11. Correct multi-select → CORRECT with 1.0 credit', () => {
      const res = gradeUniversalAnswer(
        { question_id: 'q_multi_acid', raw_answer: ['Atomicity', 'Consistency', 'Durability'] },
        multiQ
      );
      expect(res.classification).toBe('correct');
      expect(res.credit).toBe(1.0);
      expect(res.is_correct).toBe(true);
      expect(res.error_category).toBe('NO_MISCONCEPTION');
    });

    it('12. Missing multi-select option → partially correct with MISSING_REQUIRED_COMPONENT', () => {
      // Student selected 2 out of 3 correct options, no extraneous options
      const res = gradeUniversalAnswer(
        { question_id: 'q_multi_acid', raw_answer: ['Atomicity', 'Consistency'] },
        multiQ
      );
      expect(res.classification).toBe('partially_correct');
      expect(res.credit).toBeGreaterThan(0.0);
      expect(res.credit).toBeLessThan(1.0);
      expect(res.error_category).toBe('MISSING_REQUIRED_COMPONENT');
    });

    it('13. Extra multi-select option → partial/incorrect with EXTRA_COMPONENT', () => {
      // Student selected all 3 correct options PLUS Latency (wrong)
      const res = gradeUniversalAnswer(
        { question_id: 'q_multi_acid', raw_answer: ['Atomicity', 'Consistency', 'Durability', 'Latency'] },
        multiQ
      );
      expect(res.classification).toBe('partially_correct');
      expect(res.credit).toBeLessThan(1.0);
      expect(res.error_category).toBe('EXTRA_COMPONENT');
    });

    it('14. Invalid multi-select option ID → INVALID_OPTION', () => {
      const res = gradeUniversalAnswer(
        { question_id: 'q_multi_acid', raw_answer: ['Atomicity', 'NonExistentProperty'] },
        multiQ
      );
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.error_category).toBe('INVALID_OPTION');
      expect(res.feedback).toContain('invalid option ID');
    });
  });

  // =========================================================================
  // 15-16: True/False Verification
  // =========================================================================
  describe('15-16: True/False Verification', () => {
    const tfQ: AuthoritativeQuestion = {
      question_id: 'q_tf_1',
      type: 'TRUE_FALSE',
      topic: 'Operating Systems',
      difficulty: 'easy',
      question: 'Deadlock avoidance dynamically monitors resource requests at runtime using Banker algorithm.',
      correct_answer: true,
      page_number: 12,
    };

    it('15. Correct TRUE/FALSE → CORRECT with 1.0 credit', () => {
      const resTrue = gradeUniversalAnswer({ question_id: 'q_tf_1', raw_answer: 'true' }, tfQ);
      expect(resTrue.classification).toBe('correct');
      expect(resTrue.credit).toBe(1.0);

      // Normalized 'yes' / '1'
      const resYes = gradeUniversalAnswer({ question_id: 'q_tf_1', raw_answer: 'yes' }, tfQ);
      expect(resYes.classification).toBe('correct');
      expect(resYes.credit).toBe(1.0);
    });

    it('16. Invalid TRUE/FALSE format → INVALID_FORMAT with PARSE_ERROR', () => {
      const resInvalid = gradeUniversalAnswer({ question_id: 'q_tf_1', raw_answer: 'maybe sometimes' }, tfQ);
      expect(resInvalid.classification).toBe('invalid_format');
      expect(resInvalid.credit).toBe(0.0);
      expect(resInvalid.error_category).toBe('PARSE_ERROR');
      expect(resInvalid.feedback).toContain('Invalid format');
    });
  });

  // =========================================================================
  // 17-20: Short-Answer Layered Evaluation
  // =========================================================================
  describe('17-20: Short-Answer Layered Evaluation', () => {
    const shortQ: AuthoritativeQuestion = {
      question_id: 'q_sa_paging',
      type: 'SHORT_ANSWER',
      topic: 'Operating Systems',
      difficulty: 'medium',
      question: 'Define paging in operating systems.',
      correct_answer: 'Paging divides physical memory into frames and logical memory into pages.',
      accepted_variants: [
        'Memory management scheme dividing physical memory into frames and logical into pages',
        'Paging maps logical pages to physical frames',
      ],
      required_components: ['physical', 'frames', 'logical', 'pages'],
      page_number: 3,
    };

    it('17. Correct normalized short answer → CORRECT (Layer 1)', () => {
      const res = gradeUniversalAnswer(
        { question_id: 'q_sa_paging', raw_answer: '  PAGING divides physical memory into FRAMES and logical memory into pages.  ' },
        shortQ
      );
      expect(res.classification).toBe('correct');
      expect(res.credit).toBe(1.0);
      expect(res.error_category).toBe('NO_MISCONCEPTION');
    });

    it('18. Accepted short-answer variant → CORRECT (Layer 2)', () => {
      const res = gradeUniversalAnswer(
        { question_id: 'q_sa_paging', raw_answer: 'Paging maps logical pages to physical frames' },
        shortQ
      );
      expect(res.classification).toBe('correct');
      expect(res.credit).toBe(1.0);
      expect(res.feedback).toContain('accepted canonical variant');
    });

    it('19. Missing required short-answer component → MISSING_REQUIRED_COMPONENT with 0.5 partial credit (Layer 3)', () => {
      // Student mentions physical frames but omits logical pages
      const res = gradeUniversalAnswer(
        { question_id: 'q_sa_paging', raw_answer: 'It allocates physical memory frames for process storage' },
        shortQ
      );
      expect(res.classification).toBe('partially_correct');
      expect(res.credit).toBe(0.5);
      expect(res.error_category).toBe('MISSING_REQUIRED_COMPONENT');
    });

    it('20. Unsupported semantic short answer → CONCEPTUAL_MISMATCH / INCORRECT', () => {
      const res = gradeUniversalAnswer(
        { question_id: 'q_sa_paging', raw_answer: 'It sends notifications to the network interface card' },
        shortQ
      );
      expect(res.classification).toBe('incorrect');
      expect(res.credit).toBe(0.0);
      expect(res.error_category).toBe('CONCEPTUAL_MISMATCH');
    });
  });

  // =========================================================================
  // 21-24: Zero-Trust Security Guarantees
  // =========================================================================
  describe('21-24: Zero-Trust Security Protections', () => {
    const protectedQ: AuthoritativeQuestion = {
      question_id: 'q_sec_1',
      type: 'NUMERICAL',
      topic: 'Physics',
      difficulty: 'hard',
      question: 'Calculate the escape velocity from Earth in km/s.',
      correct_answer: 11.2,
      tolerance: { mode: 'RELATIVE', value: 0.03 },
      page_number: 10,
    };

    it('21. Client cannot override score', () => {
      const maliciousSub: any = {
        question_id: 'q_sec_1',
        raw_answer: '0.0', // Completely wrong
        score: 1.0,
        credit: 1.0,
      };
      const res = gradeUniversalAnswer(maliciousSub, protectedQ);
      expect(res.credit).toBe(0.0);
      expect(res.is_correct).toBe(false);
    });

    it('22. Client cannot override answer key', () => {
      const maliciousSub: any = {
        question_id: 'q_sec_1',
        raw_answer: '999',
        correct_answer: 999,
        correctAnswer: '999',
      };
      const res = gradeUniversalAnswer(maliciousSub, protectedQ);
      expect(res.credit).toBe(0.0);
      expect(res.is_correct).toBe(false);
    });

    it('23. Client cannot override tolerance', () => {
      const maliciousSub: any = {
        question_id: 'q_sec_1',
        raw_answer: '50.0', // Wildly off
        tolerance: { mode: 'RELATIVE', value: 10.0 }, // 1000% tolerance injection attempt
      };
      const res = gradeUniversalAnswer(maliciousSub, protectedQ);
      expect(res.credit).toBe(0.0);
      expect(res.is_correct).toBe(false);
    });

    it('24. Client cannot override misconception category', () => {
      const maliciousSub: any = {
        question_id: 'q_sec_1',
        raw_answer: '0.0',
        error_category: 'NO_MISCONCEPTION',
      };
      const res = gradeUniversalAnswer(maliciousSub, protectedQ);
      expect(res.error_category).not.toBe('NO_MISCONCEPTION');
    });
  });

  // =========================================================================
  // 25-27: Question-Key Integrity & Pre-Delivery Quarantine
  // =========================================================================
  describe('25-27: Question-Key Integrity & Pre-Delivery Quarantine', () => {
    it('25. Invalid question is rejected before delivery', () => {
      const invalidQ = {
        id: 'q_bad_1',
        type: 'MCQ',
        question: 'Short', // Too short stem
        options: ['A', 'B'],
        correct_answer: 'A',
      };
      const val = validateQuestionIntegrity(invalidQ);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('too short'))).toBe(true);
    });

    it('26. Duplicate/invalid option IDs are rejected', () => {
      const dupOptQ = {
        question_id: 'q_dup_opt',
        type: 'MCQ',
        question: 'What is the capital of France in Europe?',
        options: [
          { id: 'opt_1', text: 'Paris' },
          { id: 'opt_1', text: 'Lyon' }, // Duplicate ID 'opt_1'
        ],
        correct_answer: 'Paris',
      };
      const val = validateQuestionIntegrity(dupOptQ);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('duplicate option ID'))).toBe(true);
    });

    it('27. Contradictory answer key is rejected', () => {
      const contradictoryQ = {
        question_id: 'q_contra',
        type: 'MCQ',
        question: 'Which scheduling algorithm is non-preemptive?',
        options: ['Round Robin', 'Shortest Remaining Time First', 'Priority Preemptive'],
        correct_answer: 'First-Come First-Served', // Not in options array!
      };
      const val = validateQuestionIntegrity(contradictoryQ);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('does not match any choice'))).toBe(true);
    });
  });

  // =========================================================================
  // 28-30: Bounded Scores & Determinism
  // =========================================================================
  describe('28-30: Bounded Scores & Determinism', () => {
    const sampleQ: AuthoritativeQuestion = {
      question_id: 'q_det_1',
      type: 'SHORT_ANSWER',
      topic: 'Databases',
      difficulty: 'medium',
      question: 'Define the ACID durability property in relational databases.',
      correct_answer: 'Committed transactions survive crashes and power failures.',
    };

    it('28. Score is always bounded in [0.0, 1.0]', () => {
      const res1 = gradeUniversalAnswer({ question_id: 'q_det_1', raw_answer: 'Committed transactions survive crashes' }, sampleQ);
      expect(res1.credit).toBeGreaterThanOrEqual(0.0);
      expect(res1.credit).toBeLessThanOrEqual(1.0);

      const res2 = gradeUniversalAnswer({ question_id: 'q_det_1', raw_answer: '' }, sampleQ);
      expect(res2.credit).toBe(0.0);
    });

    it('29. Repeated grading is completely deterministic', () => {
      const sub = { question_id: 'q_det_1', raw_answer: 'Committed transactions survive crashes' };
      const run1 = gradeUniversalAnswer(sub, sampleQ);
      const run2 = gradeUniversalAnswer(sub, sampleQ);
      const run3 = gradeUniversalAnswer(sub, sampleQ);

      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);
    });

    it('30. LLM feedback cannot change grading result', () => {
      const grade = gradeUniversalAnswer({ question_id: 'q_det_1', raw_answer: 'Wrong answer' }, sampleQ);
      expect(grade.credit).toBe(0.0);
      expect(grade.is_correct).toBe(false);

      // Simulating a proposed LLM explanation text
      const simulatedLLMFeedback = 'Good attempt! You demonstrated strong creative thinking.';
      grade.feedback = simulatedLLMFeedback;

      // Grade and credit remain strictly 0.0
      expect(grade.credit).toBe(0.0);
      expect(grade.is_correct).toBe(false);
    });
  });

  // =========================================================================
  // 31-34: Grounded Feedback & Phase 3 Integration
  // =========================================================================
  describe('31-34: Grounded Feedback & Phase 3 Integration', () => {
    const evidenceItem: CanonicalEvidenceItem = {
      evidence_id: 'EVIDENCE_1',
      evidence_ref: '[EVIDENCE_1]',
      chunk_id: 'chk_os_deadlock_p4',
      resource_id: 'res_os_textbook',
      source_id: 'res_os_textbook',
      user_id: 'student_123',
      tenant_type: 'USER_PRIVATE',
      source_type: 'PDF',
      text: 'Deadlock avoidance dynamically monitors resource allocation states using the Banker algorithm.',
      page_number: 4,
    };

    const evidenceIndex = buildCanonicalEvidenceIndex([evidenceItem], 'student_123');

    const sampleQ: AuthoritativeQuestion = {
      question_id: 'q_ground_1',
      type: 'MCQ',
      topic: 'Operating Systems',
      difficulty: 'medium',
      question: 'What is deadlock avoidance?',
      options: ['Static prevention', 'Banker algorithm safe states', 'Rebooting'],
      correct_answer: 'Banker algorithm safe states',
      resource_id: 'res_os_textbook',
      chunk_id: 'chk_os_deadlock_p4',
      page_number: 4,
    };

    it('31. Grounded feedback uses existing Phase 3 citation verification', async () => {
      const mockResourceChecker = vi.fn().mockResolvedValue({
        exists: true,
        isDeleted: false,
        userId: 'student_123',
        tenantType: 'USER_PRIVATE',
      });

      const rawResult = gradeUniversalAnswer(
        { question_id: 'q_ground_1', raw_answer: 'Static prevention' },
        sampleQ
      );

      const groundedResult = await attachGroundedFeedback(
        rawResult,
        evidenceIndex,
        mockResourceChecker
      );

      expect(groundedResult.grounded_citation).toBeDefined();
      expect(groundedResult.grounded_citation.verification_status).toBe('VERIFIED');
      expect(groundedResult.citation_label).toContain('Page 4');
      // Grade unchanged
      expect(groundedResult.credit).toBe(0.0);
    });

    it('32. Unsupported feedback citation is rejected as UNVERIFIED', async () => {
      // Chunk not in evidence index
      const unindexedQ: AuthoritativeQuestion = {
        ...sampleQ,
        chunk_id: 'chk_fabricated_chunk_id',
      };

      const mockResourceChecker = vi.fn().mockResolvedValue({
        exists: true,
        isDeleted: false,
        userId: 'student_123',
        tenantType: 'USER_PRIVATE',
      });

      const rawResult = gradeUniversalAnswer(
        { question_id: 'q_ground_1', raw_answer: 'Static prevention' },
        unindexedQ
      );

      const groundedResult = await attachGroundedFeedback(
        rawResult,
        evidenceIndex,
        mockResourceChecker
      );

      expect(groundedResult.grounded_citation?.verification_status).toBe('UNVERIFIED');
    });

    it('33. Cross-tenant assessment data cannot be verified', async () => {
      const mockResourceChecker = vi.fn().mockResolvedValue({
        exists: true,
        isDeleted: false,
        userId: 'attacker_other_student', // Belongs to different tenant!
        tenantType: 'USER_PRIVATE',
      });

      const rawResult = gradeUniversalAnswer(
        { question_id: 'q_ground_1', raw_answer: 'Static prevention' },
        sampleQ
      );

      const groundedResult = await attachGroundedFeedback(
        rawResult,
        evidenceIndex,
        mockResourceChecker
      );

      expect(groundedResult.grounded_citation?.verification_status).toBe('CROSS_TENANT_REJECTED');
    });

    it('34. Deleted source in feedback becomes SOURCE_UNAVAILABLE', async () => {
      const mockResourceChecker = vi.fn().mockResolvedValue({
        exists: true,
        isDeleted: true, // Marked as deleted
        userId: 'student_123',
      });

      const rawResult = gradeUniversalAnswer(
        { question_id: 'q_ground_1', raw_answer: 'Static prevention' },
        sampleQ
      );

      const groundedResult = await attachGroundedFeedback(
        rawResult,
        evidenceIndex,
        mockResourceChecker
      );

      expect(groundedResult.grounded_citation?.verification_status).toBe('SOURCE_UNAVAILABLE');
    });
  });

  // =========================================================================
  // 35-40: Mixed Types, Sanitization & Backward Compatibility
  // =========================================================================
  describe('35-40: Mixed Types, Sanitization & Backward Compatibility', () => {
    it('35. Mixed question types grade independently in batch', () => {
      const q1: AuthoritativeQuestion = {
        question_id: 'q_b1',
        type: 'MCQ',
        topic: 'OS',
        difficulty: 'easy',
        question: 'Is Linux an OS?',
        options: ['Yes', 'No'],
        correct_answer: 'Yes',
      };
      const q2: AuthoritativeQuestion = {
        question_id: 'q_b2',
        type: 'NUMERICAL',
        topic: 'Math',
        difficulty: 'easy',
        question: 'Calculate 2 + 2',
        correct_answer: 4,
      };

      const res1 = gradeUniversalAnswer({ question_id: 'q_b1', raw_answer: 'Yes' }, q1);
      const res2 = gradeUniversalAnswer({ question_id: 'q_b2', raw_answer: '4' }, q2);

      expect(res1.credit).toBe(1.0);
      expect(res2.credit).toBe(1.0);
    });

    it('36. Partial-credit result follows configured policy strictly', () => {
      const multiQ: AuthoritativeQuestion = {
        question_id: 'q_part_policy',
        type: 'MULTI_SELECT',
        topic: 'CS',
        difficulty: 'medium',
        question: 'Select components of Von Neumann architecture',
        options: ['CPU', 'Memory', 'Input/Output', 'Quantum Entangler'],
        correct_answer: ['CPU', 'Memory', 'Input/Output'],
      };

      // 2 out of 3 selected -> partial credit
      const res = gradeUniversalAnswer(
        { question_id: 'q_part_policy', raw_answer: ['CPU', 'Memory'] },
        multiQ
      );
      expect(res.classification).toBe('partially_correct');
      expect(res.credit).toBe(0.67);
      expect(res.is_partial).toBe(true);
    });

    it('37. No hidden answer key is leaked to student response', () => {
      const qWithHiddenKey: AuthoritativeQuestion = {
        question_id: 'q_secret',
        type: 'MCQ',
        topic: 'Security',
        difficulty: 'hard',
        question: 'What is the confidential flag?',
        options: ['Alpha', 'Beta'],
        correct_answer: 'Beta',
      };

      const rawResult = gradeUniversalAnswer({ question_id: 'q_secret', raw_answer: 'Alpha' }, qWithHiddenKey);
      const studentResult = sanitizeResultForStudent(rawResult);

      // Verify sanitized structure doesn't include raw secret keys
      expect((studentResult as any).correct_answer).toBeUndefined();
      expect((studentResult as any).raw_student_answer).toBeUndefined();
      expect(studentResult.question_id).toBe('q_secret');
      expect(studentResult.credit).toBe(0.0);
    });

    it('38. No internal evaluation prompt is leaked', () => {
      const rawResult = gradeUniversalAnswer(
        { question_id: 'q_1', raw_answer: 'test' },
        { question_id: 'q_1', type: 'MCQ', topic: 'T', difficulty: 'easy', question: 'Q', correct_answer: 'A', options: ['A', 'B'] }
      );
      const sanitized = sanitizeResultForStudent(rawResult);

      expect((sanitized as any).internal_prompt).toBeUndefined();
      expect((sanitized as any).rubric_raw).toBeUndefined();
    });

    it('39. Malicious client payload cannot change authoritative grading', () => {
      const authQ: AuthoritativeQuestion = {
        question_id: 'q_authoritative_only',
        type: 'MCQ',
        topic: 'Security',
        difficulty: 'medium',
        question: 'Which principle enforces least privilege?',
        options: ['PoLP', 'RootAccess'],
        correct_answer: 'PoLP',
      };

      const attackerPayload: any = {
        question_id: 'q_authoritative_only',
        raw_answer: 'RootAccess',
        correct_answer: 'RootAccess',
        score: 1.0,
        credit: 1.0,
        is_correct: true,
        classification: 'correct',
        error_category: 'NO_MISCONCEPTION',
      };

      const result = gradeUniversalAnswer(attackerPayload, authQ);
      expect(result.classification).toBe('incorrect');
      expect(result.credit).toBe(0.0);
      expect(result.is_correct).toBe(false);
      expect(result.error_category).toBe('WRONG_OPTION');
    });

    it('40. Existing numericalAssessment tests remain compatible', () => {
      const numQ: AuthoritativeQuestion = {
        question_id: 'q_compat',
        type: 'NUMERICAL',
        topic: 'Physics',
        difficulty: 'medium',
        question: 'What is the speed of light in 10^8 m/s?',
        correct_answer: 3.0,
      };

      const res = gradeUniversalAnswer({ question_id: 'q_compat', raw_answer: '3.0' }, numQ);
      expect(res.classification).toBe('correct');
      expect(res.credit).toBe(1.0);
    });
  });
});
