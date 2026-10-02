import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateSingleAnswer,
  detectDeterministicMisconception,
  detectRepeatedMistakes,
  processAssessmentIntelligence,
  getUserMisconceptions,
  getAttemptDiagnostic,
} from '../../server/assessmentIntelligenceService.ts';
import { calculateBKTUpdate } from '../../server/bktService.ts';
import { computeDeterministicPriorities, generatePersonalizedDailyPlan } from '../../server/studyAgentService.ts';
import { submitAssessment, getMisconceptions, getDiagnosticAttempt } from '@/api/assessmentAPI';
import { prisma } from '../../server/prisma.ts';

describe('Phase 9: Adaptive Assessment Intelligence & Misconception Detection Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Correct Answers (MCQ, Short Answer, Numerical)
  // =========================================================================
  describe('1. Correct Answers Evaluation', () => {
    it('evaluates exact string and option index matches as correct for MCQ', () => {
      // Exact text match
      const resExact = evaluateSingleAnswer({
        questionId: 'q_mcq_1',
        type: 'MCQ',
        question: 'What protocol provides reliable byte stream transport?',
        userAnswer: 'TCP',
        correctAnswer: 'TCP',
        options: ['UDP', 'TCP', 'IP'],
        pageNumber: 5,
      });

      expect(resExact.classification).toBe('correct');
      expect(resExact.isCorrect).toBe(true);
      expect(resExact.credit).toBe(1.0);
      expect(resExact.feedback).toContain('Correct!');
      expect(resExact.feedback).toContain('Page 5');

      // Option index match (index 1 -> TCP)
      const resIndex = evaluateSingleAnswer({
        questionId: 'q_mcq_2',
        type: 'MCQ',
        question: 'What protocol provides reliable byte stream transport?',
        userAnswer: '1',
        correctAnswer: 'TCP',
        options: ['UDP', 'TCP', 'IP'],
        slideNumber: 12,
      });

      expect(resIndex.classification).toBe('correct');
      expect(resIndex.isCorrect).toBe(true);
      expect(resIndex.credit).toBe(1.0);
      expect(resIndex.feedback).toContain('Option 2 (TCP)');
    });

    it('evaluates exact and comprehensive token overlap as correct for short answer', () => {
      const res = evaluateSingleAnswer({
        questionId: 'q_sa_1',
        type: 'SHORT_ANSWER',
        question: 'Define paging in operating systems.',
        userAnswer: 'Paging divides physical memory into frames and logical memory into pages to eliminate contiguous allocation.',
        correctAnswer: 'Paging divides physical memory into frames and logical memory into pages.',
        pageNumber: 3,
      });

      expect(res.classification).toBe('correct');
      expect(res.isCorrect).toBe(true);
      expect(res.credit).toBe(1.0);
      expect(res.feedback).toContain('Correct!');
    });
  });

  // =========================================================================
  // 2. Incorrect Answers Evaluation
  // =========================================================================
  describe('2. Incorrect Answers Evaluation', () => {
    it('evaluates incorrect MCQ option and provides source-grounded correction', () => {
      const res = evaluateSingleAnswer({
        questionId: 'q_mcq_wrong',
        type: 'MCQ',
        question: 'Which page replacement policy replaces the oldest page regardless of recency?',
        userAnswer: 'LRU',
        correctAnswer: 'FIFO',
        options: ['LRU', 'FIFO', 'Optimal'],
        slideNumber: 8,
      });

      expect(res.classification).toBe('incorrect');
      expect(res.isCorrect).toBe(false);
      expect(res.credit).toBe(0.0);
      expect(res.feedback).toContain('Incorrect');
      expect(res.feedback).toContain('FIFO');
      expect(res.feedback).toContain('Slide 8');
    });

    it('evaluates short answer with poor conceptual overlap as incorrect', () => {
      const res = evaluateSingleAnswer({
        questionId: 'q_sa_wrong',
        type: 'SHORT_ANSWER',
        question: 'What is deadlock avoidance?',
        userAnswer: 'It sends email alerts to the administrator when CPU is idle',
        correctAnswer: 'Dynamically monitors resource allocation states using the Banker algorithm',
        pageNumber: 4,
      });

      expect(res.classification).toBe('incorrect');
      expect(res.isCorrect).toBe(false);
      expect(res.credit).toBe(0.0);
      expect(res.feedback).toContain('Incorrect');
    });
  });

  // =========================================================================
  // 3. Partial Answers Evaluation & Credit Window
  // =========================================================================
  describe('3. Partial Answers Evaluation', () => {
    it('awards partial credit (0.5) for short answer with partial conceptual coverage (35% to 75%)', () => {
      const res = evaluateSingleAnswer({
        questionId: 'q_sa_partial',
        type: 'SHORT_ANSWER',
        question: 'What is flow control in TCP?',
        userAnswer: 'Flow control uses receiver buffer capacity to regulate sender speed.',
        correctAnswer: 'Flow control protects receiver buffer capacity from fast sender using the receive window rwnd.',
        slideNumber: 14,
      });

      expect(res.classification).toBe('partially_correct');
      expect(res.isPartial).toBe(true);
      expect(res.credit).toBe(0.5);
      expect(res.feedback).toContain('Partially correct');
      expect(res.feedback).toContain('Slide 14');
    });

    it('awards partial credit for numerical sign error when magnitude is correct', () => {
      const res = evaluateSingleAnswer({
        questionId: 'q_num_sign',
        type: 'NUMERICAL',
        question: 'What is the change in entropy?',
        userAnswer: '-42.5',
        correctAnswer: '42.5',
        pageNumber: 7,
      });

      expect(res.classification).toBe('partially_correct');
      expect(res.isPartial).toBe(true);
      expect(res.credit).toBe(0.5);
      expect(res.feedback).toContain('Sign error');
    });
  });

  // =========================================================================
  // 4. Numerical Tolerance Evaluation
  // =========================================================================
  describe('4. Numerical Tolerance Evaluation', () => {
    it('accepts numerical values within ±3% tolerance as fully correct', () => {
      // Expected = 1000. 1025 is +2.5% (within 3%)
      const resWithin = evaluateSingleAnswer({
        questionId: 'q_num_tol_ok',
        type: 'NUMERICAL',
        question: 'Calculate network throughput in Mbps',
        userAnswer: '1025',
        correctAnswer: '1000',
        slideNumber: 6,
      });

      expect(resWithin.classification).toBe('correct');
      expect(resWithin.isCorrect).toBe(true);
      expect(resWithin.credit).toBe(1.0);
      expect(resWithin.feedback).toContain('±3% tolerance');
    });

    it('classifies numerical values within ±10% margin as partially correct', () => {
      // Expected = 1000. 1080 is +8.0% (between 3% and 10%)
      const resClose = evaluateSingleAnswer({
        questionId: 'q_num_tol_part',
        type: 'NUMERICAL',
        question: 'Calculate network throughput in Mbps',
        userAnswer: '1080',
        correctAnswer: '1000',
        slideNumber: 6,
      });

      expect(resClose.classification).toBe('partially_correct');
      expect(resClose.credit).toBe(0.5);
      expect(resClose.feedback).toContain('Close proximity');
      expect(resClose.feedback).toContain('±10% margin');
    });

    it('classifies numerical values beyond ±10% margin as incorrect', () => {
      const resWrong = evaluateSingleAnswer({
        questionId: 'q_num_tol_fail',
        type: 'NUMERICAL',
        question: 'Calculate network throughput in Mbps',
        userAnswer: '1500',
        correctAnswer: '1000',
        slideNumber: 6,
      });

      expect(resWrong.classification).toBe('incorrect');
      expect(resWrong.credit).toBe(0.0);
      expect(resWrong.feedback).toContain('Incorrect');
    });
  });

  // =========================================================================
  // 5. Misconception Detection (Deterministic Rules)
  // =========================================================================
  describe('5. Misconception Detection Engine', () => {
    it('detects Deadlock Avoidance vs Prevention confusion', () => {
      const mc = detectDeterministicMisconception(
        {
          questionId: 'q_mc_deadlock',
          type: 'MCQ',
          question: 'How does deadlock avoidance guarantee progress?',
          userAnswer: 'By statically eliminating Coffman conditions before runtime',
          correctAnswer: 'By dynamically monitoring safe states using the Banker algorithm',
          pageNumber: 4,
          sourceId: 'src_os_pdf',
          chunkId: 'chk_os_p4',
        },
        'incorrect'
      );

      expect(mc.topic).toBe('Operating Systems');
      expect(mc.subtopic).toBe('Deadlocks');
      expect(mc.concept).toBe('Deadlock Avoidance vs Prevention');
      expect(mc.misconceptionType).toBe('CONCEPT_CONFUSION');
      expect(mc.sourceCoordinate).toBe('Page 4');
      expect(mc.severity).toBe('high');
      expect(mc.description).toContain('Deadlock Prevention');
    });

    it('detects Flow Control vs Congestion Control confusion', () => {
      const mc = detectDeterministicMisconception(
        {
          questionId: 'q_mc_flow',
          type: 'SHORT_ANSWER',
          question: 'What is the objective of TCP flow control?',
          userAnswer: 'Preventing router traffic collapse with slow start and congestion window',
          correctAnswer: 'Preventing the sender from overwhelming receiver buffer capacity using receive window',
          slideNumber: 12,
          sourceId: 'src_net_slides',
        },
        'incorrect'
      );

      expect(mc.topic).toBe('Computer Networks');
      expect(mc.subtopic).toBe('Transport Layer');
      expect(mc.concept).toBe('Flow Control vs Congestion Control');
      expect(mc.misconceptionType).toBe('MECHANISM_INVERSION');
      expect(mc.sourceCoordinate).toBe('Slide 12');
      expect(mc.severity).toBe('high');
    });

    it('detects B+ Tree node layout misconception (records in internal nodes)', () => {
      const mc = detectDeterministicMisconception(
        {
          questionId: 'q_mc_bplus',
          type: 'MCQ',
          question: 'Where are data records stored in a B+ Tree?',
          userAnswer: 'In both internal and leaf nodes',
          correctAnswer: 'Exclusively in the leaf nodes',
          pageNumber: 10,
        },
        'incorrect'
      );

      expect(mc.topic).toBe('Database Systems');
      expect(mc.concept).toBe('B+ Tree Node Layout');
      expect(mc.description).toContain('internal nodes');
    });
  });

  // =========================================================================
  // 6. Repeated Misconception Detection
  // =========================================================================
  describe('6. Repeated Misconception Detection', () => {
    it('flags repeated conceptual mistakes when identical concept was missed in prior assessments', async () => {
      const testUserId = `test_rep_user_${Date.now()}`;
      const dummyMisconception = {
        topic: 'Operating Systems',
        subtopic: 'Deadlocks',
        concept: 'Deadlock Avoidance vs Prevention',
        misconceptionType: 'CONCEPT_CONFUSION' as const,
        description: 'Confused deadlock prevention with avoidance',
        evidenceQuote: 'Banker algorithm monitors safe states',
        sourceCoordinate: 'Page 4',
        severity: 'high' as const,
      };

      // Mock DB historical misconception
      vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([
        {
          topic: 'Operating Systems',
          subtopic: 'Deadlocks',
          concept: 'Deadlock Avoidance vs Prevention',
          description: 'Previous confusion in attempt att_old_1',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          attemptId: 'att_old_1',
        },
      ] as any);

      const repeated = await detectRepeatedMistakes(testUserId, [dummyMisconception]);
      expect(repeated).toHaveLength(1);
      expect(repeated[0].concept).toBe('Deadlock Avoidance vs Prevention');
      expect(repeated[0].frequency).toBe(2);
      expect(repeated[0].previousAttemptIds).toContain('att_old_1');
      expect(repeated[0].patternSummary).toContain('Persistent difficulty');
    });
  });

  // =========================================================================
  // 7. Source-Grounded Feedback
  // =========================================================================
  describe('7. Source-Grounded Feedback', () => {
    it('guarantees source coordinates are embedded in feedback across all modalities', () => {
      // PDF page coordinate
      const fbPdf = evaluateSingleAnswer({
        questionId: 'q_fb_1',
        type: 'MCQ',
        question: 'What is a TLB?',
        userAnswer: 'cache',
        correctAnswer: 'Translation Lookaside Buffer',
        pageNumber: 15,
      });
      expect(fbPdf.sourceCitation).toBe('Page 15');
      expect(fbPdf.feedback).toContain('Page 15');

      // Slides coordinate
      const fbSlide = evaluateSingleAnswer({
        questionId: 'q_fb_2',
        type: 'MCQ',
        question: 'What is BGP?',
        userAnswer: 'routing',
        correctAnswer: 'Border Gateway Protocol',
        slideNumber: 22,
      });
      expect(fbSlide.sourceCitation).toBe('Slide 22');
      expect(fbSlide.feedback).toContain('Slide 22');

      // Video timestamp coordinate
      const fbVideo = evaluateSingleAnswer({
        questionId: 'q_fb_3',
        type: 'MCQ',
        question: 'Explain 2PL',
        userAnswer: 'locking',
        correctAnswer: 'Two-Phase Locking',
        timestampStart: 185, // 3m5s
      });
      expect(fbVideo.sourceCitation).toBe('3m5s');
      expect(fbVideo.feedback).toContain('3m5s');
    });
  });

  // =========================================================================
  // 8. BKT Update Correctness & Partial Credit
  // =========================================================================
  describe('8. BKT Update Correctness & Partial Credit', () => {
    it('updates mastery strictly based on evidence with monotonic ordering', () => {
      const prior = 0.40;
      const params = { pL0: 0.15, pT: 0.10, pG: 0.20, pS: 0.10 };

      const upCorrect = calculateBKTUpdate(prior, true, params, 1.0);
      const upPartial = calculateBKTUpdate(prior, false, params, 0.5);
      const upIncorrect = calculateBKTUpdate(prior, false, params, 0.0);

      // Correct answer must strictly increase mastery above prior
      expect(upCorrect.posterior).toBeGreaterThan(prior);

      // Incorrect answer must strictly decrease mastery below prior
      expect(upIncorrect.posterior).toBeLessThan(prior);

      // Partial credit (0.5) must lie strictly between incorrect and correct posteriors
      expect(upPartial.posterior).toBeGreaterThan(upIncorrect.posterior);
      expect(upPartial.posterior).toBeLessThan(upCorrect.posterior);
    });
  });

  // =========================================================================
  // 9. Authenticated User Isolation
  // =========================================================================
  describe('9. Authenticated User Isolation', () => {
    it('scopes misconception queries strictly to authenticated userId', async () => {
      const mockQuery = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([]);

      await getUserMisconceptions('student_alice');

      expect(mockQuery).toHaveBeenCalled();
      const calledQuery = mockQuery.mock.calls[0][0];
      const calledUserId = mockQuery.mock.calls[0][1];
      expect(calledQuery).toContain('WHERE userId = ?');
      expect(calledUserId).toBe('student_alice');
    });
  });

  // =========================================================================
  // 10. Persistence Across Sessions
  // =========================================================================
  describe('10. Persistence Across Sessions', () => {
    it('retrieves saved diagnostic report and evaluations by attemptId', async () => {
      const mockReport = {
        overallScore: '2/2',
        percentage: 100,
        weakConcepts: [],
        repeatedMistakes: [],
      };

      vi.spyOn(prisma, '$queryRawUnsafe')
        .mockResolvedValueOnce([
          {
            id: 'att_persisted_1',
            userId: 'student_123',
            title: 'Midterm Prep',
            topic: 'Operating Systems',
            score: 2,
            totalQuestions: 2,
            percentage: 100,
            completedAt: new Date().toISOString(),
            diagnosticJson: JSON.stringify(mockReport),
            questionsJson: '[]',
            answersJson: '[]',
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'eval_1',
            attemptId: 'att_persisted_1',
            questionText: 'What is a thread?',
            classification: 'correct',
            credit: 1.0,
          },
        ] as any);

      const result = await getAttemptDiagnostic('att_persisted_1', 'student_123');
      expect(result).not.toBeNull();
      expect(result.attemptId).toBe('att_persisted_1');
      expect(result.diagnosticReport.overallScore).toBe('2/2');
      expect(result.evaluations).toHaveLength(1);
    });
  });

  // =========================================================================
  // 11. Study Agent Integration
  // =========================================================================
  describe('11. Study Agent Integration with Assessment Intelligence', () => {
    it('prioritizes topics with active misconceptions and generates RESOLVE_MISCONCEPTION activities', async () => {
      // Mock mastery record
      vi.spyOn(prisma, '$queryRawUnsafe')
        .mockImplementation(async (sql: string) => {
          if (sql.includes('learner_mastery')) {
            return [
              {
                id: 'lm_1',
                userId: 'student_agent_test',
                topic: 'Deadlocks',
                subtopic: null,
                masteryProbability: 0.35,
                attempts: 2,
                confidence: 0.40,
                status: 'developing',
              },
            ];
          }
          if (sql.includes('assessment_misconceptions')) {
            return [
              {
                topic: 'Deadlocks',
                subtopic: null,
                concept: 'Deadlock Avoidance vs Prevention',
                severity: 'high',
                createdAt: new Date().toISOString(),
              },
            ];
          }
          if (sql.includes('resources')) {
            return [
              {
                id: 'res_os_1',
                title: 'Operating Systems Deadlocks Lecture',
                type: 'PDF',
              },
            ];
          }
          return [];
        });

      const { priorities } = await computeDeterministicPriorities({
        userId: 'student_agent_test',
      });

      const deadlockPriority = priorities.find((p) => p.topic === 'Deadlocks');
      expect(deadlockPriority).toBeDefined();
      expect(deadlockPriority?.details.activeMisconceptionsCount).toBe(1);

      // Generate personalized plan
      const plan = await generatePersonalizedDailyPlan({
        userId: 'student_agent_test',
        targetMinutes: 60,
        forceRegenerate: true,
      });

      const resolveItem = plan.items.find((i) => i.activityType === 'RESOLVE_MISCONCEPTION');
      expect(resolveItem).toBeDefined();
      expect(resolveItem?.title).toContain('Resolve Misconception');
      expect(resolveItem?.topic).toBe('Deadlocks');
    });
  });

  // =========================================================================
  // 12. Regression Against Phase 8
  // =========================================================================
  describe('12. Regression Against Phase 8 Safeguards', () => {
    it('preserves diagnostic report backward compatibility with Phase 3/8 UI keys', async () => {
      const mockQuestions = [
        {
          question_id: 'q_reg_1',
          type: 'MCQ',
          question: 'What is virtual memory?',
          correct_answer: 'Memory abstraction combining RAM and disk storage',
          page_number: 4,
          topic: 'Operating Systems',
        },
      ];

      const { diagnosticReport } = await processAssessmentIntelligence({
        userId: 'test_student_reg',
        title: 'Compatibility Check',
        topic: 'Operating Systems',
        questions: mockQuestions,
        answers: ['Memory abstraction combining RAM and disk storage'],
        attemptId: 'att_reg_1',
      });

      // Phase 9 rich keys
      expect(diagnosticReport.overallScore).toBe('1/1');
      expect(diagnosticReport.topicWiseMastery).toBeDefined();
      expect(diagnosticReport.likelyMisconceptions).toBeDefined();
      expect(diagnosticReport.recommendedNextActions).toBeDefined();

      // Legacy Phase 3/8 keys
      expect(diagnosticReport.topicPerformance).toBeDefined();
      expect(diagnosticReport.difficultyPerformance).toBeDefined();
      expect(diagnosticReport.recommendedSourceMaterial).toBeDefined();
      expect(diagnosticReport.incorrectAnswers).toBeDefined();
    });
  });
});
