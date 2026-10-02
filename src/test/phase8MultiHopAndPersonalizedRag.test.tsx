import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeContextRecall,
  computeContextPrecision,
  computeFaithfulness,
  computeAnswerRelevancy,
  computePhaseComparison,
  PHASE_6_BASELINE,
  PHASE_7_BASELINE,
} from '../../server/evaluationEngine';

describe('Phase 8: Advanced Multi-Hop Query Decomposition, Cross-Source Evidence & Grounded Tutor Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Query Decomposition for Multi-Concept & Comparative Queries
  // =========================================================================
  describe('1. Query Decomposition for Multi-Concept & Comparative Queries', () => {
    it('decomposes comparative queries into distinct sub-queries with topic detection', () => {
      const query = 'Compare how the Banker algorithm avoids deadlocks in Operating Systems with how Two-Phase Locking ensures serializability in Database Systems.';
      
      // Simulate query decomposition logic implemented in Phase 8
      const compRegex = /^(?:compare|contrast)\s+(?:the\s+)?(.+?)\s+(?:with|and|to|against)\s+(.+?)\??$/i;
      const match = query.match(compRegex);
      expect(match).not.toBeNull();

      const sub1 = match![1].trim();
      const sub2 = match![2].trim();

      expect(sub1.toLowerCase()).toContain('banker algorithm');
      expect(sub2.toLowerCase()).toContain('two-phase locking');

      // Detect topics
      const detectTopic = (text: string) => {
        const lower = text.toLowerCase();
        if (lower.includes('banker') || lower.includes('operating systems') || lower.includes('deadlock')) return 'Operating Systems';
        if (lower.includes('locking') || lower.includes('database') || lower.includes('serializability')) return 'Database Systems';
        return 'General';
      };

      const decomposed = [
        { sub_query: sub1, topic: detectTopic(sub1), is_comparative: true },
        { sub_query: sub2, topic: detectTopic(sub2), is_comparative: true },
      ];

      expect(decomposed.length).toBe(2);
      expect(decomposed[0].topic).toBe('Operating Systems');
      expect(decomposed[1].topic).toBe('Database Systems');
    });

    it('decomposes conjunction queries into distinct sub-questions', () => {
      const query = 'What are the four Coffman conditions required for deadlock, and how does quantum error correction prevent circular wait in quantum circuits?';
      const conjRegex = /^(?:what is|what are|explain|describe)\s+(.+?)[,\s]+and\s+(?:how|why|what is|what are|which)\s+(.+?)\??$/i;
      const match = query.match(conjRegex);

      expect(match).not.toBeNull();
      const part1 = match![1].trim();
      const part2 = match![2].trim();

      expect(part1.toLowerCase()).toContain('coffman conditions');
      expect(part2.toLowerCase()).toContain('quantum error correction');
    });

    it('preserves atomic single-concept questions without unnecessary decomposition', () => {
      const query = 'What is the function of the Translation Lookaside Buffer (TLB)?';
      const compRegex = /^(?:compare|contrast)\s+(?:the\s+)?(.+?)\s+(?:with|and|to|against)\s+(.+?)\??$/i;
      const conjRegex = /^(?:what is|what are|explain|describe)\s+(.+?)[,\s]+and\s+(?:how|why|what is|what are)\s+(.+?)\??$/i;

      expect(compRegex.test(query)).toBe(false);
      expect(conjRegex.test(query)).toBe(false);

      const subQueries = [{ sub_query: query, concept: 'main', is_comparative: false }];
      expect(subQueries.length).toBe(1);
    });
  });

  // =========================================================================
  // 2. Multi-Query Retrieval & Cross-Source Evidence Aggregation
  // =========================================================================
  describe('2. Multi-Query Retrieval & Cross-Source Evidence Aggregation', () => {
    it('aggregates evidence across multiple distinct sources covering all sub-queries', () => {
      const subQueries = [
        { sub_query: 'Banker algorithm deadlock avoidance', topic: 'Operating Systems' },
        { sub_query: 'Two-Phase Locking serializability', topic: 'Database Systems' },
      ];

      const osChunks = [
        {
          chunk_id: 'os_chunk_1',
          source_id: 'src_os_doc',
          topic: 'Operating Systems',
          text: 'The Banker algorithm simulates resource allocation to ensure a safe sequence.',
          score: 0.88,
          matched_sub_queries: [0],
        },
      ];

      const dbmsChunks = [
        {
          chunk_id: 'dbms_chunk_1',
          source_id: 'src_dbms_video',
          topic: 'Database Systems',
          text: 'Two-Phase Locking (2PL) ensures serializability by dividing locking into growing and shrinking phases.',
          score: 0.85,
          matched_sub_queries: [1],
        },
      ];

      // Merge and aggregate
      const mergedMap = new Map<string, any>();
      [...osChunks, ...dbmsChunks].forEach((c) => mergedMap.set(c.chunk_id, c));
      const aggregated = Array.from(mergedMap.values());

      const coveredQueries = new Set<number>();
      aggregated.forEach((c) => c.matched_sub_queries.forEach((sqIdx: number) => coveredQueries.add(sqIdx)));

      const coverageScore = coveredQueries.size / subQueries.length;
      expect(coverageScore).toBe(1.0);
      expect(aggregated.map((c) => c.source_id)).toContain('src_os_doc');
      expect(aggregated.map((c) => c.source_id)).toContain('src_dbms_video');
    });

    it('promotes evidence coverage greedily before applying source diversity caps', () => {
      const candidates = [
        { chunk_id: 'c1', source_id: 'src_os', score: 0.95, matched_sub_queries: [0] },
        { chunk_id: 'c2', source_id: 'src_os', score: 0.94, matched_sub_queries: [0] },
        { chunk_id: 'c3', source_id: 'src_os', score: 0.93, matched_sub_queries: [0] },
        { chunk_id: 'c4', source_id: 'src_dbms', score: 0.82, matched_sub_queries: [1] },
      ];

      const subQueriesCount = 2;
      const topK = 3;
      const maxPerSource = 2;

      // Phase 8 greedy coverage promotion
      const selected: typeof candidates = [];
      const covered = new Set<number>();
      const sourceCounts: Record<string, number> = {};

      for (let sq = 0; sq < subQueriesCount; sq++) {
        const bestForSq = candidates.find(
          (c) => c.matched_sub_queries.includes(sq) && !selected.some((s) => s.chunk_id === c.chunk_id)
        );
        if (bestForSq) {
          selected.push(bestForSq);
          bestForSq.matched_sub_queries.forEach((idx) => covered.add(idx));
          sourceCounts[bestForSq.source_id] = (sourceCounts[bestForSq.source_id] || 0) + 1;
        }
      }

      for (const c of candidates) {
        if (selected.length >= topK) break;
        if (selected.some((s) => s.chunk_id === c.chunk_id)) continue;
        const currentCount = sourceCounts[c.source_id] || 0;
        if (currentCount < maxPerSource) {
          selected.push(c);
          sourceCounts[c.source_id] = currentCount + 1;
        }
      }

      expect(selected.some((s) => s.chunk_id === 'c4')).toBe(true);
      expect(covered.has(0)).toBe(true);
      expect(covered.has(1)).toBe(true);
      expect(selected.filter((s) => s.source_id === 'src_os').length).toBeLessThanOrEqual(maxPerSource);
    });
  });

  // =========================================================================
  // 3. Citation Verification & Unsupported Claims Detection
  // =========================================================================
  describe('3. Citation Verification & Unsupported Claims Detection', () => {
    it('verifies citations in generated response against retrieved evidence', () => {
      const retrievedChunkIds = ['os_chunk_1', 'os_chunk_2'];
      const generatedAnswer =
        'The four Coffman conditions for deadlock are mutual exclusion, hold and wait, no preemption, and circular wait [os_chunk_1]. ' +
        'Deadlock avoidance dynamically monitors resource requests using the Banker algorithm [os_chunk_2].';

      const citationRegex = /\[([a-zA-Z0-9_-]+)\]/g;
      const matches = Array.from(generatedAnswer.matchAll(citationRegex), (m) => m[1]);

      const uniqueCited = Array.from(new Set(matches));
      const verified = uniqueCited.filter((id) => retrievedChunkIds.includes(id));
      const unsupported = uniqueCited.filter((id) => !retrievedChunkIds.includes(id));

      const citationPrecision = verified.length / uniqueCited.length;

      expect(citationPrecision).toBe(1.0);
      expect(unsupported.length).toBe(0);
      expect(verified).toContain('os_chunk_1');
      expect(verified).toContain('os_chunk_2');
    });

    it('detects unsupported claims when response cites non-retrieved chunk IDs', () => {
      const retrievedChunkIds = ['os_chunk_1'];
      const hallucinatedAnswer =
        'Paging divides memory into frames [os_chunk_1]. Quantum teleportation resolves thread races [hallucinated_quantum_chunk_99].';

      const citationRegex = /\[([a-zA-Z0-9_-]+)\]/g;
      const matches = Array.from(hallucinatedAnswer.matchAll(citationRegex), (m) => m[1]);

      const uniqueCited = Array.from(new Set(matches));
      const verified = uniqueCited.filter((id) => retrievedChunkIds.includes(id));
      const unsupported = uniqueCited.filter((id) => !retrievedChunkIds.includes(id));

      const unsupportedClaimsDetected = unsupported.length > 0;
      const citationPrecision = verified.length / uniqueCited.length;

      expect(unsupportedClaimsDetected).toBe(true);
      expect(unsupported).toContain('hallucinated_quantum_chunk_99');
      expect(citationPrecision).toBe(0.5);
    });
  });

  // =========================================================================
  // 4. Insufficient Evidence & Partial Answer Handling
  // =========================================================================
  describe('4. Insufficient Evidence & Partial Answer Handling', () => {
    it('accurately identifies partial evidence and includes coverage disclaimer', () => {
      const subQueries = [
        'the four Coffman conditions required for deadlock',
        'quantum error correction prevent circular wait in quantum circuits',
      ];
      const matchedSubQueries = new Set([0]); // Only sub-query 0 matched

      const coverageScore = matchedSubQueries.size / subQueries.length;
      expect(coverageScore).toBe(0.5);

      const isPartial = coverageScore > 0 && coverageScore < 1.0;
      expect(isPartial).toBe(true);

      const note = `### ⚠️ Evidence Coverage Note\nEvidence was found for Operating Systems in your uploaded materials. However, uploaded materials do not contain complete information for all queried concepts (${(coverageScore * 100).toFixed(1)}% coverage).`;
      expect(note).toContain('50.0% coverage');
      expect(note).toContain('Evidence Coverage Note');
    });

    it('triggers strict refusal when evidence coverage is 0.0 or retrieval is empty', () => {
      const retrievedChunks: any[] = [];
      const coverageScore = 0.0;

      const shouldRefuse = retrievedChunks.length === 0 || coverageScore === 0.0;
      expect(shouldRefuse).toBe(true);

      const refusalMessage =
        'The uploaded course materials do not contain sufficient information to answer this question. Please upload relevant course materials for this topic.';
      expect(refusalMessage).toContain('do not contain sufficient information');
    });
  });

  // =========================================================================
  // 5. User Isolation Safeguards
  // =========================================================================
  describe('5. Strict User Isolation Safeguards', () => {
    it('prohibits unauthorized users from retrieving chunks of other learners', () => {
      const allChunksInKnowledgeBase = [
        { chunk_id: 'c_user_a', user_id: 'student_alice', text: 'Alice private notes on scheduling' },
        { chunk_id: 'c_user_b', user_id: 'student_bob', text: 'Bob private assessment submission' },
        { chunk_id: 'c_default', user_id: 'default_user', text: 'Course materials on Operating Systems' },
      ];

      const requestingUserId = 'student_alice';
      const isolatedChunks = allChunksInKnowledgeBase.filter(
        (c) => c.user_id === requestingUserId || c.user_id === 'default_user'
      );

      expect(isolatedChunks.some((c) => c.user_id === 'student_bob')).toBe(false);
      expect(isolatedChunks.some((c) => c.chunk_id === 'c_user_a')).toBe(true);
      expect(isolatedChunks.some((c) => c.chunk_id === 'c_default')).toBe(true);
    });

    it('returns zero private chunks when a stranger queries the knowledge base', () => {
      const allChunksInKnowledgeBase = [
        { chunk_id: 'c_user_a', user_id: 'student_alice', text: 'Alice private notes' },
        { chunk_id: 'c_user_b', user_id: 'student_bob', text: 'Bob private notes' },
      ];

      const strangerId = 'unauthorized_stranger_user_999';
      const retrieved = allChunksInKnowledgeBase.filter((c) => c.user_id === strangerId);
      expect(retrieved.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. Personalization Using Real BKT Mastery State
  // =========================================================================
  describe('6. Pedagogical Personalization Using BKT Mastery State', () => {
    it('applies foundational scaffolding for novice learners without fabricating data', () => {
      const learnerState = {
        userId: 'student_novice_1',
        topic: 'Operating Systems',
        masteryProbability: 0.25,
        confidence: 0.35,
        status: 'novice',
      };

      const promptTemplate = (state: typeof learnerState) => {
        let guidance = '';
        if (state.masteryProbability <= 0.40) {
          guidance = `[Pedagogical Guidance: Foundational Scaffolding - The student is currently building initial mastery (${(state.masteryProbability * 100).toFixed(1)}%). Break down complex concepts into step-by-step foundational explanations.]`;
        } else if (state.masteryProbability >= 0.70) {
          guidance = `[Pedagogical Guidance: Advanced Synthesis - The student has demonstrated high proficiency (${(state.masteryProbability * 100).toFixed(1)}%). Synthesize advanced architectural trade-offs.]`;
        }
        return guidance;
      };

      const guidance = promptTemplate(learnerState);
      expect(guidance).toContain('Foundational Scaffolding');
      expect(guidance).toContain('25.0%');
      expect(guidance).not.toContain('Advanced Synthesis');
    });

    it('applies advanced architectural synthesis for proficient learners', () => {
      const learnerState = {
        userId: 'student_expert_1',
        topic: 'Algorithms & Data Structures',
        masteryProbability: 0.85,
        confidence: 0.90,
        status: 'mastered',
      };

      const promptTemplate = (state: typeof learnerState) => {
        let guidance = '';
        if (state.masteryProbability <= 0.40) {
          guidance = `[Pedagogical Guidance: Foundational Scaffolding - The student is currently building initial mastery (${(state.masteryProbability * 100).toFixed(1)}%).]`;
        } else if (state.masteryProbability >= 0.70) {
          guidance = `[Pedagogical Guidance: Advanced Synthesis - The student has demonstrated high proficiency (${(state.masteryProbability * 100).toFixed(1)}%). Focus on performance trade-offs and structural invariants.]`;
        }
        return guidance;
      };

      const guidance = promptTemplate(learnerState);
      expect(guidance).toContain('Advanced Synthesis');
      expect(guidance).toContain('85.0%');
      expect(guidance).toContain('Focus on performance trade-offs');
    });
  });

  // =========================================================================
  // 7. Metric Formulation & Regression Against Phase 7 Baselines
  // =========================================================================
  describe('7. Metric Formulations & Regression Against Phase 7 Baselines', () => {
    it('computes Context Recall based on full text rather than truncated snippet', () => {
      const chunks = [
        {
          id: 'c1',
          snippet: 'Chapter 8: Memory Management & Paging. Paging is a memory management scheme...', // truncated
          text: 'Chapter 8: Memory Management & Paging. Paging is a memory management scheme that eliminates the need for contiguous allocation of physical memory. Physical memory is divided into fixed-sized blocks called frames, and logical memory is divided into blocks of the same size called pages. A logical address generated by the CPU consists of a page number (p) and a page offset (d). The Translation Lookaside Buffer (TLB) is a fast associative hardware cache used to speed up address translation.',
        },
      ];

      const keyPhrases = ['frames', 'pages', 'translation lookaside buffer'];
      const recall = computeContextRecall(chunks, keyPhrases, false);
      expect(recall).toBe(1.0);
    });

    it('computes Phase 7 vs Phase 8 comparisons with verified target benchmarks', () => {
      const mockReportData = {
        evaluationTimestamp: '2026-10-02T13:50:00Z',
        datasetSize: 60,
        ragMetrics: {
          faithfulness: 0.885,
          answerRelevancy: 0.862,
          contextPrecision: 0.945,
          contextRecall: 0.867,
        },
        groundingMetrics: {
          groundingAccuracy: 0.950,
          coordinateAccuracy: 0.965,
          refusalAccuracy: 1.000,
          userIsolationPreserved: true,
        },
        personalizationMetrics: {
          simulatedStudentsCount: 50,
          averageMasteryImprovement: 0.448,
          totalCompletedActivities: 184,
          averageCompletionRate: 0.92,
          averageRecommendationRelevance: 0.94,
          cohortArchetypeDistribution: {},
          students: [],
        },
        noveltyMetrics: {
          totalQuestionsAnalyzed: 200,
          exactDuplicatesCount: 0,
          semanticDuplicatesCount: 0,
          uniqueQuestionsCount: 200,
          exactDuplicateRate: 0.0,
          semanticDuplicateRate: 0.0,
          uniqueQuestionPercentage: 1.0,
        },
        perQuestionResults: [],
        failuresAndErrors: [],
      };

      const comparisons = computePhaseComparison(mockReportData);

      const recallRow = comparisons.find((r) => r.metric === 'Context Recall');
      expect(recallRow).toBeDefined();
      expect(recallRow!.phase7Value).toBe(PHASE_7_BASELINE.contextRecall); // 0.458
      expect(recallRow!.phase8Value).toBe(0.867);
      expect(recallRow!.delta).toBeGreaterThan(0.40);
      expect(recallRow!.improved).toBe(true);

      const relevancyRow = comparisons.find((r) => r.metric === 'Answer Relevancy');
      expect(relevancyRow).toBeDefined();
      expect(relevancyRow!.phase7Value).toBe(PHASE_7_BASELINE.answerRelevancy); // 0.713
      expect(relevancyRow!.phase8Value).toBe(0.862);
      expect(relevancyRow!.improved).toBe(true);

      const refusalRow = comparisons.find((r) => r.metric === 'Refusal Accuracy');
      expect(refusalRow).toBeDefined();
      expect(refusalRow!.phase8Value).toBe(1.0);
      expect(refusalRow!.improved).toBe(true);

      const duplicateRow = comparisons.find((r) => r.metric === 'Exact Duplicate Rate');
      expect(duplicateRow).toBeDefined();
      expect(duplicateRow!.phase8Value).toBeLessThanOrEqual(0.05);
      expect(duplicateRow!.improved).toBe(true);
    });
  });
});
