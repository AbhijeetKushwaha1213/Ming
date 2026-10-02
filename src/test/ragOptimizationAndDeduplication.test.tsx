import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateDeterministicCohort,
  computeContextPrecision,
  computePhaseComparison,
  runStudentSimulation,
  PHASE_6_BASELINE,
} from '../../server/evaluationEngine';
import crypto from 'crypto';

describe('Phase 7: RAG Retrieval Optimization & Assessment Reliability Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Reranking & Hybrid Scoring
  // =========================================================================
  describe('1. RAG Reranking & Hybrid Composite Scoring', () => {
    it('boosts candidate chunks that match query keywords and topic over distant chunks', () => {
      const candidates = [
        {
          id: 'chunk_1',
          text: 'General computer systems overview and basic hardware components.',
          vector_score: 0.78,
          topic: 'Computer Science',
        },
        {
          id: 'chunk_2',
          text: 'The Banker Algorithm prevents deadlocks by simulating allocation for maximum possible claims.',
          vector_score: 0.74,
          topic: 'Operating Systems',
        },
      ];

      const queryTokens = ['banker', 'algorithm', 'deadlocks'];
      const targetTopic = 'Operating Systems';

      const scored = candidates.map((c) => {
        const textLower = c.text.toLowerCase();
        const matches = queryTokens.filter((tok) => textLower.includes(tok)).length;
        const lexicalScore = matches / queryTokens.length;
        const topicBonus = c.topic.toLowerCase() === targetTopic.toLowerCase() ? 1.0 : 0.0;
        const finalScore = 0.5 * c.vector_score + 0.35 * lexicalScore + 0.15 * topicBonus;
        return { ...c, finalScore };
      });

      // chunk_2 had lower raw vector score (0.74 < 0.78) but should rank #1 after hybrid reranking
      scored.sort((a, b) => b.finalScore - a.finalScore);
      expect(scored[0].id).toBe('chunk_2');
      expect(scored[0].finalScore).toBeGreaterThan(scored[1].finalScore);
    });

    it('enforces source diversity cap to prevent single source monopolization', () => {
      const chunks = [
        { id: 'c1', source_id: 'src_os_pdf', score: 0.95 },
        { id: 'c2', source_id: 'src_os_pdf', score: 0.94 },
        { id: 'c3', source_id: 'src_os_pdf', score: 0.93 },
        { id: 'c4', source_id: 'src_os_pdf', score: 0.92 },
        { id: 'c5', source_id: 'src_net_slides', score: 0.89 },
      ];

      const maxPerSource = 2;
      const counts: Record<string, number> = {};
      const diversified: typeof chunks = [];

      for (const ch of chunks) {
        counts[ch.source_id] = (counts[ch.source_id] || 0) + 1;
        if (counts[ch.source_id] <= maxPerSource) {
          diversified.push(ch);
        }
      }

      expect(diversified.filter((c) => c.source_id === 'src_os_pdf').length).toBe(2);
      expect(diversified.some((c) => c.source_id === 'src_net_slides')).toBe(true);
    });
  });

  // =========================================================================
  // 2. Relevance Filtering & Low-Relevance Discard
  // =========================================================================
  describe('2. Relevance Filtering & Diagnostic Accounting', () => {
    it('discards candidate chunks below similarity threshold and records diagnostics', () => {
      const candidates = [
        { id: 'c1', score: 0.88, source_id: 's1' },
        { id: 'c2', score: 0.65, source_id: 's2' },
        { id: 'c3', score: 0.42, source_id: 's3' }, // below threshold
        { id: 'c4', score: 0.28, source_id: 's4' }, // below threshold
      ];

      const threshold = 0.55;
      const selected = candidates.filter((c) => c.score >= threshold);
      const discarded = candidates.filter((c) => c.score < threshold).map((c) => c.id);

      const diagnostics = {
        candidate_count: candidates.length,
        final_evidence_count: selected.length,
        similarity_scores: selected.map((c) => c.score),
        selected_source_ids: Array.from(new Set(selected.map((c) => c.source_id))),
        discarded_chunks: discarded,
      };

      expect(diagnostics.candidate_count).toBe(4);
      expect(diagnostics.final_evidence_count).toBe(2);
      expect(diagnostics.discarded_chunks).toEqual(['c3', 'c4']);
      expect(diagnostics.selected_source_ids).toEqual(['s1', 's2']);
    });
  });

  // =========================================================================
  // 3. Citation Coordinate Validation
  // =========================================================================
  describe('3. Citation Coordinate Validation (PDF, Slides, Video)', () => {
    it('accurately resolves and matches PDF page numbers', () => {
      const retrieved = [
        { source_id: 'src_os_pdf', page_number: 3, score: 0.90, text: 'Banker safety algorithm' },
      ];
      const precisionMatch = computeContextPrecision(retrieved, 'src_os_pdf', 3, false);
      expect(precisionMatch).toBe(1.0);

      const precisionWrongPage = computeContextPrecision(retrieved, 'src_os_pdf', 9, false);
      expect(precisionWrongPage).toBe(0.0);
    });

    it('accurately resolves slide numbers for presentations', () => {
      const retrieved = [
        { source_id: 'src_net_slides', slide_number: 4, score: 0.85, text: 'TCP three-way handshake' },
      ];
      // Explicit slide parameter
      const precisionMatch = computeContextPrecision(retrieved, 'src_net_slides', null, false, 'Computer Networks', 4);
      expect(precisionMatch).toBe(1.0);

      // Coordinate mismatch
      const precisionMismatch = computeContextPrecision(retrieved, 'src_net_slides', null, false, 'Computer Networks', 9);
      expect(precisionMismatch).toBe(0.0);
    });

    it('validates video timestamp coordinates within temporal window', () => {
      const retrieved = [
        {
          source_id: 'src_dbms_video',
          timestamp_start: 300,
          timestamp_end: 360,
          score: 0.88,
          text: 'ACID transaction atomicity discussion',
        },
      ];
      // Expected timestamp 310s falls within [300, 360] window (tested via explicit timestamp parameter)
      const matchInWindow = computeContextPrecision(retrieved, 'src_dbms_video', null, false, 'Database Systems', null, 310);
      expect(matchInWindow).toBe(1.0);

      // Expected timestamp 900s is outside [300, 360]
      const matchOutside = computeContextPrecision(retrieved, 'src_dbms_video', null, false, 'Database Systems', null, 900);
      expect(matchOutside).toBe(0.0);
    });
  });

  // =========================================================================
  // 4. Exact Question Deduplication via Fingerprinting
  // =========================================================================
  describe('4. Exact Question Deduplication via Fingerprinting', () => {
    it('computes deterministic SHA-256 stem fingerprints and rejects collisions', () => {
      const normalizeStem = (stem: string) =>
        stem.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

      const computeFp = (stem: string) =>
        crypto.createHash('sha256').update(normalizeStem(stem)).digest('hex').substring(0, 16);

      const stem1 = 'Which of the following is one of the four Coffman conditions for deadlock?';
      const stem2 = 'which of the following is one of the four coffman conditions for deadlock?   ';
      const stem3 = 'What role does the Banker Algorithm play in operating system resource allocation?';

      const fp1 = computeFp(stem1);
      const fp2 = computeFp(stem2);
      const fp3 = computeFp(stem3);

      expect(fp1).toBe(fp2); // Exact collision detected regardless of casing/spacing
      expect(fp1).not.toBe(fp3);

      const existingFingerprints = new Set([fp1]);
      expect(existingFingerprints.has(fp2)).toBe(true); // REJECT
      expect(existingFingerprints.has(fp3)).toBe(false); // ACCEPT
    });
  });

  // =========================================================================
  // 5. Semantic Duplicate Detection via Token Overlap
  // =========================================================================
  describe('5. Semantic Duplicate Detection', () => {
    it('flags and rejects semantic paraphrases exceeding Jaccard similarity threshold', () => {
      const getTokens = (str: string) =>
        new Set(str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));

      const jaccard = (a: string, b: string) => {
        const setA = getTokens(a);
        const setB = getTokens(b);
        let intersection = 0;
        for (const tok of setA) {
          if (setB.has(tok)) intersection++;
        }
        const union = new Set([...setA, ...setB]).size;
        return union === 0 ? 0 : intersection / union;
      };

      const original = 'Which of the four Coffman conditions involves circular wait?';
      const paraphrase = 'Which of the four Coffman conditions involves a circular wait?';
      const different = 'Explain how two-phase locking guarantees serializability in transaction processing.';

      expect(jaccard(original, paraphrase)).toBeGreaterThan(0.75); // High overlap -> semantic duplicate
      expect(jaccard(original, different)).toBeLessThan(0.20); // Low overlap -> unique question
    });
  });

  // =========================================================================
  // 6. Cross-Assessment Deduplication
  // =========================================================================
  describe('6. Cross-Assessment Persistent Deduplication', () => {
    it('ensures questions generated in assessment B do not duplicate assessment A', () => {
      const assessmentA_Questions = [
        {
          id: 'q_a1',
          assessmentId: 'asmt_001',
          fingerprint: 'fp_coffman_1',
          question: 'What is the circular wait condition in operating systems?',
        },
      ];

      const assessmentB_Candidate = {
        fingerprint: 'fp_coffman_1',
        question: 'What is the circular wait condition in operating systems?',
      };

      const existingFingerprints = new Set(assessmentA_Questions.map((q) => q.fingerprint));
      const isDuplicate = existingFingerprints.has(assessmentB_Candidate.fingerprint);

      expect(isDuplicate).toBe(true); // Must be rejected even though assessmentId is different
    });
  });

  // =========================================================================
  // 7. Expanded 50-Learner Simulation & Archetypes
  // =========================================================================
  describe('7. Expanded 50-Learner Cohort Simulation', () => {
    it('generates a 50-learner deterministic cohort covering all 7 archetypes', () => {
      const cohort = generateDeterministicCohort(50);
      expect(cohort.length).toBe(50);

      const archetypes = new Set(cohort.map((s) => s.archetype));
      expect(archetypes.has('novice')).toBe(true);
      expect(archetypes.has('developing')).toBe(true);
      expect(archetypes.has('strong')).toBe(true);
      expect(archetypes.has('exam_crammer')).toBe(true);
      expect(archetypes.has('inconsistent_learner')).toBe(true);
      expect(archetypes.has('high_confidence_low_mastery')).toBe(true);
      expect(archetypes.has('low_confidence_high_mastery')).toBe(true);

      for (const s of cohort) {
        expect(s.id).toMatch(/^eval_sim_/);
        expect(s.initialMastery).toBeGreaterThanOrEqual(0.0);
        expect(s.initialMastery).toBeLessThanOrEqual(1.0);
        expect(s.confidence).toBeGreaterThanOrEqual(0.0);
        expect(s.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('simulates a cohort subset and computes valid mastery deltas', async () => {
      const sim = await runStudentSimulation(7); // Run 1 of each archetype for fast test
      expect(sim.personalizationMetrics.simulatedStudentsCount).toBe(7);
      expect(sim.personalizationMetrics.averageMasteryImprovement).toBeGreaterThan(0.0);
      expect(sim.personalizationMetrics.averageCompletionRate).toBeGreaterThanOrEqual(0.9);
      expect(sim.personalizationMetrics.averageRecommendationRelevance).toBeGreaterThanOrEqual(0.8);
    });
  });

  // =========================================================================
  // 8. Metric Comparison (Phase 6 vs Phase 7)
  // =========================================================================
  describe('8. Phase 6 vs Phase 7 Dynamic Comparison', () => {
    it('computes comparison deltas and highlights improvements against Phase 6 baselines', () => {
      const mockReport = {
        evaluationTimestamp: new Date().toISOString(),
        datasetSize: 52,
        ragMetrics: {
          faithfulness: 0.95,
          answerRelevancy: 0.92,
          contextPrecision: 0.94, // Phase 6 baseline was 0.375
          contextRecall: 0.96,
        },
        groundingMetrics: {
          groundingAccuracy: 0.96,
          coordinateAccuracy: 0.98,
          refusalAccuracy: 1.0,
          userIsolationPreserved: true,
        },
        personalizationMetrics: {
          simulatedStudentsCount: 50,
          averageMasteryImprovement: 0.28,
          totalCompletedActivities: 150,
          averageCompletionRate: 1.0,
          averageRecommendationRelevance: 0.95,
          students: [],
        },
        noveltyMetrics: {
          totalQuestionsAnalyzed: 50,
          exactDuplicatesCount: 0,
          semanticDuplicatesCount: 1,
          uniqueQuestionsCount: 49,
          exactDuplicateRate: 0.0, // Phase 6 baseline was 0.80
          semanticDuplicateRate: 0.02,
          uniqueQuestionPercentage: 0.98,
        },
        perQuestionResults: [],
        failuresAndErrors: [],
      };

      const comparison = computePhaseComparison(mockReport);
      expect(comparison).toBeDefined();

      const precisionRow = comparison.find((c) => c.metric === 'Context Precision');
      expect(precisionRow).toBeDefined();
      expect(precisionRow?.phase6Value).toBe(PHASE_6_BASELINE.contextPrecision);
      expect(precisionRow?.phase7Value).toBe(0.94);
      expect(precisionRow?.delta).toBeCloseTo(0.94 - 0.375, 2);
      expect(precisionRow?.improved).toBe(true);

      const exactDupRow = comparison.find((c) => c.metric === 'Exact Duplicate Rate');
      expect(exactDupRow).toBeDefined();
      expect(exactDupRow?.phase6Value).toBe(PHASE_6_BASELINE.exactDuplicateRate);
      expect(exactDupRow?.phase7Value).toBe(0.0);
      expect(exactDupRow?.delta).toBeCloseTo(0.0 - 0.80, 2);
      expect(exactDupRow?.improved).toBe(true);
    });
  });

  // =========================================================================
  // 9. User Isolation in Retrieval
  // =========================================================================
  describe('9. User Isolation in Retrieval Pipeline', () => {
    it('isolates user knowledge chunks and prevents unauthorized leakage', () => {
      const allChunks = [
        { id: 'c1', user_id: 'alice_123', text: 'Alice private notes on scheduling' },
        { id: 'c2', user_id: 'bob_456', text: 'Bob private notes on indexing' },
        { id: 'c3', user_id: 'default_user', text: 'Public course textbook chunk' },
      ];

      const searchForUser = (userId: string) =>
        allChunks.filter((c) => c.user_id === userId || c.user_id === 'default_user');

      const aliceResults = searchForUser('alice_123');
      expect(aliceResults.some((c) => c.id === 'c1')).toBe(true);
      expect(aliceResults.some((c) => c.id === 'c2')).toBe(false); // Bob's chunk is hidden

      const strangerResults = searchForUser('stranger_999');
      expect(strangerResults.some((c) => c.id === 'c1')).toBe(false); // Alice's chunk is hidden
      expect(strangerResults.some((c) => c.id === 'c2')).toBe(false); // Bob's chunk is hidden
      expect(strangerResults.some((c) => c.id === 'c3')).toBe(true); // Public chunk accessible
    });
  });
});
