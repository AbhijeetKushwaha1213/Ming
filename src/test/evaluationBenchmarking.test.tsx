import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  loadEvaluationDataset,
  computeContextPrecision,
  computeContextRecall,
  computeFaithfulness,
  computeAnswerRelevancy,
  evaluateRagAndGrounding,
  runStudentSimulation,
  evaluateQuestionNovelty,
  type EvaluationDatasetItem,
} from '../../server/evaluationEngine';
import {
  getLatestEvaluation,
  runEvaluationSuite,
  getEvaluationCsvDownloadUrl,
} from '@/api/evaluationAPI';
import { EvaluationDashboard } from '@/components/dev/EvaluationDashboard';

describe('Phase 6: StudyMate Evaluation & Benchmarking Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Dataset Loading & Schema Validation
  // =========================================================================
  describe('1. Dataset Loading & Coverage', () => {
    it('loads evaluation dataset and verifies all required question types', async () => {
      const dataset = await loadEvaluationDataset();
      expect(dataset).toBeDefined();
      expect(dataset.length).toBeGreaterThanOrEqual(5);

      const types = new Set(dataset.map((d) => d.question_type));
      expect(types.has('factual')).toBe(true);
      expect(types.has('conceptual')).toBe(true);
      expect(types.has('multi-source')).toBe(true);
      expect(types.has('reasoning')).toBe(true);
      expect(types.has('off-material')).toBe(true);

      for (const item of dataset) {
        expect(item.id).toBeDefined();
        expect(item.question).toBeDefined();
        expect(item.expected_answer).toBeDefined();
        expect(typeof item.off_material).toBe('boolean');
        expect(item.topic).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 2. Source-Coordinate Validation
  // =========================================================================
  describe('2. Source-Coordinate Validation', () => {
    it('validates that retrieved chunk coordinates match expected source and page numbers', () => {
      const retrievedChunks = [
        { source_id: 'src_os_1', page_number: 1, score: 0.85, text: 'Coffman conditions' },
        { source_id: 'src_os_1', page_number: 2, score: 0.70, text: 'Deadlock avoidance' },
      ];

      // Exact match
      const precisionMatch = computeContextPrecision(retrievedChunks, 'src_os_1', 1, false);
      expect(precisionMatch).toBeGreaterThan(0.0);
      expect(precisionMatch).toBeCloseTo(1.0, 1);

      // Unmatched source
      const precisionMismatch = computeContextPrecision(retrievedChunks, 'src_unrelated_99', 5, false);
      expect(precisionMismatch).toBe(0.0);
    });

    it('handles text sources without physical page numbers cleanly', () => {
      const textChunks = [
        { source_id: 'src_text_1', source_type: 'TEXT', page_number: null, score: 0.88, text: 'Banker algorithm' },
      ];
      const precision = computeContextPrecision(textChunks, 'src_text_1', 1, false);
      expect(precision).toBeGreaterThan(0.5);
    });
  });

  // =========================================================================
  // 3. Off-Material Evaluation & Refusal Accuracy
  // =========================================================================
  describe('3. Off-Material Evaluation & Refusal Accuracy', () => {
    it('scores faithfulness and relevancy as 1.0 when out-of-scope query is properly refused', () => {
      const refusalAnswer =
        'The uploaded course materials do not contain sufficient information to answer this question. Please upload relevant course materials for this topic.';

      const faithfulness = computeFaithfulness(refusalAnswer, '', true);
      const relevancy = computeAnswerRelevancy(refusalAnswer, 'quantum entanglement', refusalAnswer, true);

      expect(faithfulness).toBe(1.0);
      expect(relevancy).toBe(1.0);
    });

    it('penalizes off-material queries if the model attempts to hallucinate an answer', () => {
      const hallucinatedAnswer =
        'Quantum entanglement is a physical phenomenon where particles interact in ways such that quantum states cannot be described independently.';

      const faithfulness = computeFaithfulness(hallucinatedAnswer, '', true);
      expect(faithfulness).toBe(0.0);
    });
  });

  // =========================================================================
  // 4. Metric Calculation (RAGAS-equivalent Mathematical Formulations)
  // =========================================================================
  describe('4. Metric Calculation Formulas', () => {
    it('computes Context Recall based on key reference phrase recovery', () => {
      const chunks = [
        { snippet: 'The four Coffman conditions are mutual exclusion, hold and wait, no preemption, and circular wait.' },
      ];
      const keyPhrases = ['mutual exclusion', 'hold and wait', 'no preemption', 'circular wait'];
      const recall = computeContextRecall(chunks, keyPhrases, false);
      expect(recall).toBe(1.0);

      const partialPhrases = ['mutual exclusion', 'non-existent condition'];
      const partialRecall = computeContextRecall(chunks, partialPhrases, false);
      expect(partialRecall).toBe(0.5);
    });

    it('computes Faithfulness by checking sentence claim support against retrieved context', () => {
      const context = 'A deadlock occurs when processes are waiting for resources held by each other.';
      const supportedAnswer = 'A deadlock occurs when processes wait for resources held by each other.';
      const unsupportedAnswer = 'Processes are immediately terminated whenever memory reaches ninety percent.';

      const faithHigh = computeFaithfulness(supportedAnswer, context, false);
      const faithLow = computeFaithfulness(unsupportedAnswer, context, false);

      expect(faithHigh).toBeGreaterThan(faithLow);
      expect(faithHigh).toBeGreaterThanOrEqual(0.7);
      expect(faithLow).toBeLessThan(0.3);
    });

    it('computes Answer Relevancy based on query and expected concept overlap', () => {
      const expected = 'A deadlock occurs when processes wait for resources held by each other.';
      const query = 'What causes a deadlock?';
      const answer = 'According to the materials, a deadlock occurs when processes are waiting for resources held by each other.';

      const relevancy = computeAnswerRelevancy(answer, query, expected, false);
      expect(relevancy).toBeGreaterThan(0.60);
    });
  });

  // =========================================================================
  // 5. Student Simulation Framework
  // =========================================================================
  describe('5. Student Simulation Framework', () => {
    it('runs simulated students through multi-session priority study loops on isolated IDs', async () => {
      const sim = await runStudentSimulation();
      expect(sim.personalizationMetrics).toBeDefined();
      expect(sim.personalizationMetrics.simulatedStudentsCount).toBe(3);
      expect(sim.personalizationMetrics.totalCompletedActivities).toBeGreaterThan(0);

      for (const student of sim.personalizationMetrics.students) {
        expect(student.studentId).toContain('eval_sim_');
        expect(student.masteryBefore).toBeGreaterThanOrEqual(0.0);
        expect(student.masteryAfter).toBeGreaterThanOrEqual(student.masteryBefore);
        expect(student.sessionSteps.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 6. Mastery Improvement Calculation
  // =========================================================================
  describe('6. Mastery Improvement Calculation', () => {
    it('verifies non-negative mastery gains computed from real BKT updates', async () => {
      const sim = await runStudentSimulation();
      const avgDelta = sim.personalizationMetrics.averageMasteryImprovement;
      expect(avgDelta).toBeGreaterThan(0.0);

      for (const s of sim.personalizationMetrics.students) {
        expect(s.masteryImprovement).toBeCloseTo(s.masteryAfter - s.masteryBefore, 3);
      }
    });
  });

  // =========================================================================
  // 7. Question Novelty & Duplicate Detection
  // =========================================================================
  describe('7. Question Novelty & Duplicate Detection', () => {
    it('calculates exact and semantic duplicate rates accurately', async () => {
      const novelty = await evaluateQuestionNovelty();
      expect(novelty).toBeDefined();
      expect(novelty.uniqueQuestionPercentage).toBeGreaterThanOrEqual(0.0);
      expect(novelty.uniqueQuestionPercentage).toBeLessThanOrEqual(1.0);
      expect(novelty.exactDuplicateRate).toBeGreaterThanOrEqual(0.0);
      expect(novelty.exactDuplicateRate).toBeLessThanOrEqual(1.0);
    });
  });

  // =========================================================================
  // 8. User Isolation Preservation
  // =========================================================================
  describe('8. User Isolation in Evaluation', () => {
    it('ensures evaluating one student does not leak chunks or mastery to another student', async () => {
      const mockSearch = vi.fn().mockImplementation(async (query: string, topic?: string, userId?: string) => {
        if (userId === 'unauthorized_stranger_user_999') {
          return { results: [] };
        }
        return {
          results: [{ chunk_id: 'c1', user_id: 'student_alice', text: 'deadlock material' }],
        };
      });

      const mockChat = vi.fn().mockResolvedValue({ response: 'Safe answer' });
      const dataset: EvaluationDatasetItem[] = [
        {
          id: 'test_q_iso',
          topic: 'Operating Systems',
          question_type: 'factual',
          off_material: false,
          question: 'What is deadlock?',
          expected_answer: 'Mutual waiting',
          expected_source_id: null,
        },
      ];

      const res = await evaluateRagAndGrounding(dataset, mockSearch, mockChat);
      expect(res.groundingMetrics.userIsolationPreserved).toBe(true);
    });
  });

  // =========================================================================
  // 9. Reproducibility
  // =========================================================================
  describe('9. Metric Reproducibility', () => {
    it('produces identical metric outputs given identical inputs', () => {
      const query = 'What are Coffman conditions?';
      const expected = 'Mutual exclusion, hold and wait, no preemption, circular wait.';
      const answer = 'The conditions are mutual exclusion, hold and wait, no preemption, circular wait.';

      const rel1 = computeAnswerRelevancy(answer, query, expected, false);
      const rel2 = computeAnswerRelevancy(answer, query, expected, false);

      expect(rel1).toBe(rel2);
    });
  });

  // =========================================================================
  // 10. UI Component Rendering
  // =========================================================================
  describe('10. EvaluationDashboard UI Component', () => {
    it('renders all 8 required KPI metric cards with Evaluation / Benchmarking title', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          report: {
            evaluationTimestamp: '2026-10-02T12:00:00.000Z',
            datasetSize: 8,
            ragMetrics: {
              faithfulness: 0.85,
              answerRelevancy: 0.82,
              contextPrecision: 0.80,
              contextRecall: 0.78,
            },
            groundingMetrics: {
              groundingAccuracy: 0.90,
              coordinateAccuracy: 0.88,
              refusalAccuracy: 1.0,
              userIsolationPreserved: true,
            },
            personalizationMetrics: {
              simulatedStudentsCount: 3,
              averageMasteryImprovement: 0.45,
              totalCompletedActivities: 6,
              students: [],
            },
            noveltyMetrics: {
              totalQuestionsAnalyzed: 10,
              exactDuplicatesCount: 0,
              semanticDuplicatesCount: 0,
              uniqueQuestionsCount: 10,
              exactDuplicateRate: 0.0,
              semanticDuplicateRate: 0.0,
              uniqueQuestionPercentage: 1.0,
            },
            perQuestionResults: [],
            failuresAndErrors: [],
          },
        }),
      } as any);

      render(
        <BrowserRouter>
          <EvaluationDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Evaluation \/ Benchmarking/i)).toBeDefined();
        expect(screen.getByText(/Developer Only/i)).toBeDefined();
        expect(screen.getAllByText('Faithfulness').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Answer Relevancy').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Context Precision').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Context Recall').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Grounding Accuracy').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Refusal Accuracy').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Question Novelty/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Mastery Delta/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
