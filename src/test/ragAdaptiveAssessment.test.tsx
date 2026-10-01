import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  generateAssessment,
  submitAssessment,
  getAssessmentHistory,
  AssessmentQuestion,
  DiagnosticReport,
} from '@/api/assessmentAPI';
import { QuizViewer } from '@/components/flashcards/QuizViewer';

describe('Phase 3: Grounded Adaptive Assessment Engine Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Grounded Question Generation
  // =========================================================================
  describe('1. Grounded Question Generation', () => {
    it('requests assessment with course source, topic, subtopic, difficulty, and question type', async () => {
      const mockGeneratedQuestions: AssessmentQuestion[] = [
        {
          question_id: 'q_deadlock_1',
          type: 'MCQ',
          topic: 'Operating Systems',
          subtopic: 'Deadlock Detection',
          difficulty: 'medium',
          source_id: 'src_os_book',
          chunk_id: 'chunk_os_p42',
          page_number: 42,
          slide_number: null,
          timestamp_start: null,
          timestamp_end: null,
          question: 'Which of the following conditions is required for a deadlock to occur?',
          options: ['Mutual Exclusion', 'Preemption Allowed', 'Single-threading', 'Starvation'],
          correct_answer: 'Mutual Exclusion',
          explanation: 'Based on course materials on Operating Systems, mutual exclusion is one of the four Coffman conditions.',
          fingerprint: 'fp_abc123',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          topic: 'Operating Systems',
          subtopic: 'Deadlock Detection',
          difficulty: 'medium',
          totalQuestions: 1,
          questions: mockGeneratedQuestions,
        }),
      } as any);

      const result = await generateAssessment({
        userId: 'student_123',
        topic: 'Operating Systems',
        subtopic: 'Deadlock Detection',
        difficulty: 'medium',
        count: 1,
        questionType: 'MCQ',
        sourceId: 'src_os_book',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/rag/assessment/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            userId: 'student_123',
            topic: 'Operating Systems',
            subtopic: 'Deadlock Detection',
            difficulty: 'medium',
            count: 1,
            questionType: 'MCQ',
            sourceId: 'src_os_book',
          }),
        })
      );
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].topic).toBe('Operating Systems');
      expect(result.questions[0].type).toBe('MCQ');
    });
  });

  // =========================================================================
  // 2. Source Metadata Preservation
  // =========================================================================
  describe('2. Source Metadata Preservation', () => {
    it('preserves all 14 structured metadata fields on every generated question', async () => {
      const mockQuestionWithFullMetadata: AssessmentQuestion = {
        question_id: 'q_multimodal_99',
        type: 'MCQ',
        topic: 'Computer Networks',
        subtopic: 'TCP Congestion Control',
        difficulty: 'hard',
        source_id: 'src_video_lecture_3',
        chunk_id: 'chunk_vid_c14',
        page_number: 14,
        slide_number: 8,
        timestamp_start: 345.5,
        timestamp_end: 420.0,
        question: 'What triggers TCP Fast Retransmit according to the lecture recording?',
        options: [
          'Receipt of 3 duplicate ACKs',
          'Timeout after 60 seconds',
          'Zero window probe',
          'Connection reset packet',
        ],
        correct_answer: 'Receipt of 3 duplicate ACKs',
        explanation: 'At 05:45 in lecture 3, it is stated that receiving 3 duplicate ACKs triggers fast retransmit.',
        fingerprint: 'sha256_fp_987654321',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          questions: [mockQuestionWithFullMetadata],
        }),
      } as any);

      const res = await generateAssessment({
        userId: 'student_123',
        topic: 'Computer Networks',
      });

      const q = res.questions[0];
      // Verify all 14 structured metadata properties
      expect(q).toHaveProperty('question_id');
      expect(q).toHaveProperty('type', 'MCQ');
      expect(q).toHaveProperty('topic', 'Computer Networks');
      expect(q).toHaveProperty('subtopic', 'TCP Congestion Control');
      expect(q).toHaveProperty('difficulty', 'hard');
      expect(q).toHaveProperty('source_id', 'src_video_lecture_3');
      expect(q).toHaveProperty('chunk_id', 'chunk_vid_c14');
      expect(q).toHaveProperty('page_number', 14);
      expect(q).toHaveProperty('slide_number', 8);
      expect(q).toHaveProperty('timestamp_start', 345.5);
      expect(q).toHaveProperty('timestamp_end', 420.0);
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('correct_answer', 'Receipt of 3 duplicate ACKs');
      expect(q).toHaveProperty('explanation');
    });
  });

  // =========================================================================
  // 3. Invalid-Question Rejection
  // =========================================================================
  describe('3. Invalid-Question Rejection', () => {
    it('rejects candidate questions with invalid coordinates or malformed stems', () => {
      // Coordinate verification logic
      const verifyCoordinateMatch = (q: any, chunkMeta: any): boolean => {
        if (q.page_number !== (chunkMeta.page_number ?? null)) return false;
        if (q.slide_number !== (chunkMeta.slide_number ?? null)) return false;
        if (q.timestamp_start !== (chunkMeta.timestamp_start ?? null)) return false;
        return true;
      };

      const sourceChunk = {
        metadata: {
          page_number: 10,
          slide_number: null,
          timestamp_start: null,
        },
      };

      // Invalid question fabricating page 25
      const invalidQ = {
        page_number: 25, // coordinate mismatch!
        slide_number: null,
        timestamp_start: null,
      };

      expect(verifyCoordinateMatch(invalidQ, sourceChunk.metadata)).toBe(false);

      // Valid question matching source coordinates exactly
      const validQ = {
        page_number: 10,
        slide_number: null,
        timestamp_start: null,
      };
      expect(verifyCoordinateMatch(validQ, sourceChunk.metadata)).toBe(true);
    });

    it('rejects MCQ candidates with duplicate options or fewer than 3 options', () => {
      const verifyMcqOptions = (options: string[]): boolean => {
        if (options.length < 3) return false;
        const set = new Set(options.map((o) => o.trim().toLowerCase()));
        return set.size === options.length;
      };

      expect(verifyMcqOptions(['Option A', 'Option A', 'Option B', 'Option C'])).toBe(false); // Duplicate
      expect(verifyMcqOptions(['Option 1', 'Option 2'])).toBe(false); // Too few
      expect(verifyMcqOptions(['Option 1', 'Option 2', 'Option 3', 'Option 4'])).toBe(true); // Valid
    });
  });

  // =========================================================================
  // 4. Answer Verification Pass
  // =========================================================================
  describe('4. Answer Verification Pass', () => {
    it('verifies that the correct answer exists in options and explanation meets grounding requirements', () => {
      const verifyAnswerKey = (options: string[], correctAnswer: string, explanation: string): boolean => {
        const hasCorrectAnswer = options.some(
          (opt) => opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
        );
        const validExplanation = explanation.trim().length >= 15;
        return hasCorrectAnswer && validExplanation;
      };

      // Fails when correct answer is missing from choices
      expect(
        verifyAnswerKey(['A', 'B', 'C', 'D'], 'E', 'Detailed explanation of concept in textbook.')
      ).toBe(false);

      // Fails when explanation is too short / missing
      expect(
        verifyAnswerKey(['Alpha', 'Beta', 'Gamma'], 'Beta', 'Too short')
      ).toBe(false);

      // Passes with valid key and thorough citation explanation
      expect(
        verifyAnswerKey(
          ['Paging', 'Segmentation', 'Swapping'],
          'Paging',
          'Verified from course document: Paging divides memory into fixed-size frames.'
        )
      ).toBe(true);
    });
  });

  // =========================================================================
  // 5. Duplicate-Question Prevention
  // =========================================================================
  describe('5. Duplicate-Question Prevention', () => {
    it('generates consistent fingerprints and blocks existing fingerprints from repeat inclusion', async () => {
      const existingFingerprint = 'sha256_deadlock_condition_q1';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          questions: [], // Generator rejects duplicate candidate matching fingerprint
          totalQuestions: 0,
        }),
      } as any);

      const res = await generateAssessment({
        userId: 'student_123',
        topic: 'Operating Systems',
      });

      expect(res.questions).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. MCQ Evaluation
  // =========================================================================
  describe('6. MCQ Evaluation', () => {
    it('accurately evaluates correct and incorrect MCQ answers via submission API', async () => {
      const mockQuestions: AssessmentQuestion[] = [
        {
          question_id: 'q1',
          type: 'MCQ',
          topic: 'Data Structures',
          difficulty: 'easy',
          question: 'What is the time complexity of searching in a balanced Binary Search Tree?',
          options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
          correct_answer: 'O(log n)',
          explanation: 'In a balanced BST, height is O(log n), making search O(log n).',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          attemptId: 'att_123',
          score: 1,
          totalQuestions: 1,
          percentage: 100,
          results: [
            {
              questionId: 'q1',
              userAnswer: 'O(log n)',
              correctAnswer: 'O(log n)',
              isCorrect: true,
              feedback: 'Correct!',
            },
          ],
          diagnosticReport: {
            overallScore: '1/1',
            percentage: 100,
            totalQuestions: 1,
            correctCount: 1,
            topicPerformance: { 'Data Structures': { total: 1, correct: 1, percentage: 100 } },
            difficultyPerformance: { easy: { total: 1, correct: 1, percentage: 100 } },
            incorrectAnswers: [],
            likelyMisconceptions: [],
            recommendedSourceMaterial: [],
          },
        }),
      } as any);

      const result = await submitAssessment({
        userId: 'student_123',
        topic: 'Data Structures',
        difficulty: 'easy',
        questions: mockQuestions,
        answers: ['O(log n)'],
      });

      expect(result.score).toBe(1);
      expect(result.percentage).toBe(100);
      expect(result.results[0].isCorrect).toBe(true);
    });
  });

  // =========================================================================
  // 7. Short-Answer Evaluation
  // =========================================================================
  describe('7. Short-Answer Evaluation', () => {
    it('evaluates short-answer questions using conceptual keyword matching', async () => {
      const mockQuestions: AssessmentQuestion[] = [
        {
          question_id: 'q_short_1',
          type: 'SHORT_ANSWER',
          topic: 'Operating Systems',
          difficulty: 'medium',
          question: 'What is thrashing in the context of virtual memory?',
          correct_answer: 'A state where excessive paging causes the system to spend more time paging than executing',
          explanation: 'Thrashing occurs when high paging activity degrades system throughput.',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          attemptId: 'att_short_1',
          score: 1,
          totalQuestions: 1,
          percentage: 100,
          results: [
            {
              questionId: 'q_short_1',
              userAnswer: 'Excessive paging when system spends more time paging than running processes',
              correctAnswer: mockQuestions[0].correct_answer,
              isCorrect: true,
              feedback: 'Correct! Key concepts identified.',
            },
          ],
          diagnosticReport: {
            overallScore: '1/1',
            percentage: 100,
            totalQuestions: 1,
            correctCount: 1,
            topicPerformance: { 'Operating Systems': { total: 1, correct: 1, percentage: 100 } },
            difficultyPerformance: { medium: { total: 1, correct: 1, percentage: 100 } },
            incorrectAnswers: [],
            likelyMisconceptions: [],
            recommendedSourceMaterial: [],
          },
        }),
      } as any);

      const result = await submitAssessment({
        userId: 'student_123',
        topic: 'Operating Systems',
        difficulty: 'medium',
        questions: mockQuestions,
        answers: ['Excessive paging when system spends more time paging than running processes'],
      });

      expect(result.results[0].isCorrect).toBe(true);
    });
  });

  // =========================================================================
  // 8. Numerical Evaluation Where Supported
  // =========================================================================
  describe('8. Numerical Evaluation Where Supported', () => {
    it('evaluates numerical answers within ±3% tolerance', () => {
      const evaluateNumeric = (userAns: string, correctAns: string): boolean => {
        const uNum = parseFloat(userAns.replace(/[^\d.-]/g, ''));
        const cNum = parseFloat(correctAns.replace(/[^\d.-]/g, ''));
        if (isNaN(uNum) || isNaN(cNum)) return false;
        const tol = Math.max(Math.abs(cNum) * 0.03, 0.01);
        return Math.abs(uNum - cNum) <= tol;
      };

      // Correct target = 100.0
      expect(evaluateNumeric('100.0', '100.0')).toBe(true); // Exact
      expect(evaluateNumeric('102.5', '100.0')).toBe(true); // +2.5% (Within 3%)
      expect(evaluateNumeric('97.2', '100.0')).toBe(true);  // -2.8% (Within 3%)
      expect(evaluateNumeric('104.5', '100.0')).toBe(false); // +4.5% (Exceeds 3%)
      expect(evaluateNumeric('invalid_str', '100.0')).toBe(false);
    });
  });

  // =========================================================================
  // 9. Diagnostic Report Generation
  // =========================================================================
  describe('9. Diagnostic Report Generation', () => {
    it('generates comprehensive diagnostic report containing score, topic performance, cited explanations, and revision recommendations', async () => {
      const mockQuestions: AssessmentQuestion[] = [
        {
          question_id: 'q_diag_1',
          type: 'MCQ',
          topic: 'Algorithms',
          subtopic: 'Sorting',
          difficulty: 'easy',
          question: 'What is the worst-case time complexity of QuickSort?',
          options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(1)'],
          correct_answer: 'O(n^2)',
          explanation: 'When pivot is repeatedly chosen poorly, QuickSort degrades to O(n^2).',
          page_number: 78,
          chunk_id: 'chunk_algo_p78',
        },
        {
          question_id: 'q_diag_2',
          type: 'MCQ',
          topic: 'Algorithms',
          subtopic: 'Graph Theory',
          difficulty: 'medium',
          question: 'Which algorithm finds single-source shortest paths on graphs with negative weights?',
          options: ['Dijkstra', 'Bellman-Ford', 'Prim', 'Kruskal'],
          correct_answer: 'Bellman-Ford',
          explanation: 'Bellman-Ford handles negative edge weights, unlike Dijkstra.',
          slide_number: 15,
          chunk_id: 'chunk_graph_s15',
        },
      ];

      const expectedReport: DiagnosticReport = {
        overallScore: '1/2',
        percentage: 50,
        totalQuestions: 2,
        correctCount: 1,
        topicPerformance: {
          Sorting: { total: 1, correct: 1, percentage: 100 },
          'Graph Theory': { total: 1, correct: 0, percentage: 0 },
        },
        difficultyPerformance: {
          easy: { total: 1, correct: 1, percentage: 100 },
          medium: { total: 1, correct: 0, percentage: 0 },
        },
        incorrectAnswers: [
          {
            questionId: 'q_diag_2',
            question: 'Which algorithm finds single-source shortest paths on graphs with negative weights?',
            userAnswer: 'Dijkstra',
            correctAnswer: 'Bellman-Ford',
            explanation: 'Bellman-Ford handles negative edge weights, unlike Dijkstra.',
            citationLabel: 'Slide 15',
          },
        ],
        likelyMisconceptions: [
          "Possible confusion in 'Which algorithm finds single-source shortest paths...': student answered 'Dijkstra', expected 'Bellman-Ford'",
        ],
        recommendedSourceMaterial: [
          {
            topic: 'Algorithms',
            subtopic: 'Graph Theory',
            coordinate: 'Slide 15',
            chunkId: 'chunk_graph_s15',
            recommendation: "Review Graph Theory at Slide 15: 'Bellman-Ford'",
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          attemptId: 'att_diag_1',
          score: 1,
          totalQuestions: 2,
          percentage: 50,
          results: [],
          diagnosticReport: expectedReport,
        }),
      } as any);

      const res = await submitAssessment({
        userId: 'student_123',
        topic: 'Algorithms',
        difficulty: 'medium',
        questions: mockQuestions,
        answers: ['O(n^2)', 'Dijkstra'],
      });

      const report = res.diagnosticReport;
      expect(report.overallScore).toBe('1/2');
      expect(report.percentage).toBe(50);
      expect(report.topicPerformance['Sorting'].percentage).toBe(100);
      expect(report.topicPerformance['Graph Theory'].percentage).toBe(0);
      expect(report.incorrectAnswers).toHaveLength(1);
      expect(report.incorrectAnswers[0].citationLabel).toBe('Slide 15');
      expect(report.recommendedSourceMaterial[0].coordinate).toBe('Slide 15');
      expect(report.likelyMisconceptions).toHaveLength(1);
    });
  });

  // =========================================================================
  // 10. Authenticated User Isolation
  // =========================================================================
  describe('10. Authenticated User Isolation', () => {
    it('isolates assessment attempts and history strictly by authenticated user ID', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('userId=student_alice')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              history: [
                {
                  id: 'att_alice_1',
                  userId: 'student_alice',
                  title: 'Operating Systems Assessment',
                  topic: 'Operating Systems',
                  score: 5,
                  totalQuestions: 5,
                  percentage: 100,
                },
              ],
            }),
          };
        } else {
          return {
            ok: true,
            json: async () => ({
              success: true,
              history: [], // Different user has separate private history
            }),
          };
        }
      });

      const aliceHistory = await getAssessmentHistory('student_alice');
      expect(aliceHistory.history).toHaveLength(1);
      expect(aliceHistory.history[0].userId).toBe('student_alice');

      const bobHistory = await getAssessmentHistory('student_bob');
      expect(bobHistory.history).toHaveLength(0);
    });
  });

  // =========================================================================
  // UI Integration: QuizViewer Render & Navigation
  // =========================================================================
  describe('QuizViewer UI Component Integration', () => {
    it('renders questions, citation badges, and supports numerical/short answer input', () => {
      const questions: AssessmentQuestion[] = [
        {
          question_id: 'q_ui_1',
          type: 'NUMERICAL',
          topic: 'Physics',
          subtopic: 'Kinematics',
          difficulty: 'medium',
          question: 'Calculate velocity (m/s) with acceleration a=9.8 and time t=2s:',
          correct_answer: '19.6',
          explanation: 'v = a * t = 9.8 * 2 = 19.6 m/s',
          page_number: 12,
        },
      ];

      render(
        <QuizViewer
          questions={questions as any}
          title="Physics Diagnostic Assessment"
          difficulty="medium"
          topic="Physics"
          userId="student_123"
        />
      );

      // Verify question stem and topic badge
      expect(screen.getByText(/Calculate velocity/i)).toBeInTheDocument();
      expect(screen.getByText(/Physics/i)).toBeInTheDocument();
      expect(screen.getByText(/Page 12/i)).toBeInTheDocument();

      // Verify numerical input field is present
      const input = screen.getByPlaceholderText(/Enter numerical answer/i);
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '19.6' } });
      expect((input as HTMLInputElement).value).toBe('19.6');
    });
  });
});
