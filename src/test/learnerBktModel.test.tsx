import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import {
  getDifficultyBKTParameters,
  calculateBKTUpdate,
  calculateConfidence,
  determineMasteryStatus,
  DEFAULT_BKT_PARAMS,
} from '../../server/bktService';
import {
  getLearnerMastery,
  getTopicMastery,
  getLearnerEvents,
  updateLearnerMastery,
  initializeDiagnosticState,
  LearnerMasteryRecord,
} from '@/api/learnerAPI';
import { LearnerMasteryCard } from '@/components/dashboard/LearnerMasteryCard';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test_student', user_id: 'test_student', name: 'Test Student' },
  }),
}));

describe('Phase 4: Learner Model & Bayesian Knowledge Tracing (BKT) Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Cold-Start User Handling
  // =========================================================================
  describe('1. Cold-Start User Handling', () => {
    it('returns unassessed state with zero mastery for a new user with no activity', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          topicMastery: {
            userId: 'new_student',
            topic: 'Operating Systems',
            subtopic: null,
            masteryProbability: 0.0,
            masteryPercentage: 0,
            attempts: 0,
            correctCount: 0,
            incorrectCount: 0,
            confidence: 0.0,
            status: 'unassessed',
            lastAssessedAt: null,
          },
        }),
      } as any);

      const res = await getTopicMastery('new_student', 'Operating Systems');
      expect(res.topicMastery.status).toBe('unassessed');
      expect(res.topicMastery.masteryProbability).toBe(0.0);
      expect(res.topicMastery.attempts).toBe(0);
      expect(res.topicMastery.confidence).toBe(0.0);
    });

    it('status helper returns unassessed when attempts are 0', () => {
      expect(determineMasteryStatus(0, 0.85)).toBe('unassessed');
      expect(determineMasteryStatus(0, 0.0)).toBe('unassessed');
    });
  });

  // =========================================================================
  // 2. Correct Response Update
  // =========================================================================
  describe('2. Correct Response Update', () => {
    it('increases mastery probability following Bayes rule for correct observation (obs = 1)', () => {
      const prior = 0.15;
      const params = getDifficultyBKTParameters('medium'); // pG=0.20, pS=0.10, pT=0.10
      const update = calculateBKTUpdate(prior, true, params);

      // Theoretical:
      // P(L|1) = (0.15 * 0.90) / (0.15 * 0.90 + 0.85 * 0.20) = 0.135 / (0.135 + 0.170) = 0.4426
      // P(L_next) = 0.4426 + (1 - 0.4426) * 0.10 = 0.4983
      expect(update.posterior).toBeGreaterThan(prior);
      expect(update.posterior).toBeCloseTo(0.498, 2);
    });
  });

  // =========================================================================
  // 3. Incorrect Response Update
  // =========================================================================
  describe('3. Incorrect Response Update', () => {
    it('decreases mastery probability following Bayes rule for incorrect observation (obs = 0)', () => {
      const prior = 0.60;
      const params = getDifficultyBKTParameters('medium'); // pG=0.20, pS=0.10, pT=0.10
      const update = calculateBKTUpdate(prior, false, params);

      // Theoretical:
      // P(L|0) = (0.60 * 0.10) / (0.60 * 0.10 + 0.40 * 0.80) = 0.06 / (0.06 + 0.32) = 0.1578
      // P(L_next) = 0.1578 + (1 - 0.1578) * 0.10 = 0.242
      expect(update.posterior).toBeLessThan(prior);
      expect(update.posterior).toBeCloseTo(0.242, 2);
    });

    it('correct and incorrect answers produce distinct updates', () => {
      const prior = 0.50;
      const params = getDifficultyBKTParameters('medium');
      const correctRes = calculateBKTUpdate(prior, true, params);
      const incorrectRes = calculateBKTUpdate(prior, false, params);

      expect(correctRes.posterior).toBeGreaterThan(prior);
      expect(incorrectRes.posterior).toBeLessThan(prior);
      expect(correctRes.posterior).not.toEqual(incorrectRes.posterior);
    });
  });

  // =========================================================================
  // 4. Repeated Evidence & Stabilization
  // =========================================================================
  describe('4. Repeated Evidence & Stabilization', () => {
    it('gradually stabilizes estimate toward mastery under consecutive correct answers', () => {
      let currentMastery = 0.15;
      const params = getDifficultyBKTParameters('medium');

      // 5 consecutive correct answers
      for (let i = 0; i < 5; i++) {
        const update = calculateBKTUpdate(currentMastery, true, params);
        expect(update.posterior).toBeGreaterThanOrEqual(currentMastery);
        currentMastery = update.posterior;
      }

      // Mastery should have ascended to proficient / mastered (> 0.85)
      expect(currentMastery).toBeGreaterThanOrEqual(0.85);
      expect(determineMasteryStatus(5, currentMastery)).toBe('mastered');
    });

    it('confidence metric increases monotonically with repeated trials', () => {
      const conf0 = calculateConfidence(0);
      const conf1 = calculateConfidence(1);
      const conf3 = calculateConfidence(3);
      const conf8 = calculateConfidence(8);

      expect(conf0).toBe(0.0);
      expect(conf1).toBeGreaterThan(conf0);
      expect(conf3).toBeGreaterThan(conf1);
      expect(conf8).toBeGreaterThan(conf3);
      expect(conf8).toBeLessThanOrEqual(1.0);
    });
  });

  // =========================================================================
  // 5. Question Difficulty Integration
  // =========================================================================
  describe('5. Question Difficulty Integration', () => {
    it('hard question correct answer provides stronger positive evidence than easy question', () => {
      const prior = 0.30;
      const easyParams = getDifficultyBKTParameters('easy'); // pG=0.25, pS=0.05
      const hardParams = getDifficultyBKTParameters('hard'); // pG=0.10, pS=0.20

      const easyUpdate = calculateBKTUpdate(prior, true, easyParams);
      const hardUpdate = calculateBKTUpdate(prior, true, hardParams);

      // Solving a hard question without guessing yields higher confidence posterior
      expect(hardUpdate.posterior).toBeGreaterThan(easyUpdate.posterior);
    });

    it('failing an easy question penalizes mastery more heavily than failing a hard question', () => {
      const prior = 0.70;
      const easyParams = getDifficultyBKTParameters('easy');
      const hardParams = getDifficultyBKTParameters('hard');

      const easyDrop = calculateBKTUpdate(prior, false, easyParams);
      const hardDrop = calculateBKTUpdate(prior, false, hardParams);

      // Slipping on an easy question causes a steeper drop
      expect(easyDrop.posterior).toBeLessThan(hardDrop.posterior);
    });
  });

  // =========================================================================
  // 6. Topic Isolation
  // =========================================================================
  describe('6. Topic Isolation', () => {
    it('ensures updates to one topic do not influence mastery of another topic', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('topic=Operating%20Systems') || url.includes('topic=Operating Systems')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              topicMastery: {
                userId: 'student_1',
                topic: 'Operating Systems',
                masteryProbability: 0.88,
                attempts: 5,
                status: 'mastered',
              },
            }),
          };
        } else if (url.includes('topic=Thermodynamics')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              topicMastery: {
                userId: 'student_1',
                topic: 'Thermodynamics',
                masteryProbability: 0.0,
                attempts: 0,
                status: 'unassessed',
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const osRes = await getTopicMastery('student_1', 'Operating Systems');
      const thermoRes = await getTopicMastery('student_1', 'Thermodynamics');

      expect(osRes.topicMastery.status).toBe('mastered');
      expect(osRes.topicMastery.masteryProbability).toBe(0.88);

      expect(thermoRes.topicMastery.status).toBe('unassessed');
      expect(thermoRes.topicMastery.masteryProbability).toBe(0.0);
    });
  });

  // =========================================================================
  // 7. Authenticated User Isolation
  // =========================================================================
  describe('7. Authenticated User Isolation', () => {
    it('isolates learner mastery records strictly by student user ID', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('userId=alice')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              mastery: [
                {
                  id: 'lm_1',
                  userId: 'alice',
                  topic: 'Algorithms',
                  masteryProbability: 0.92,
                  attempts: 8,
                  status: 'mastered',
                },
              ],
            }),
          };
        } else if (url.includes('userId=bob')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              mastery: [], // Bob has no activity
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const aliceRes = await getLearnerMastery('alice');
      const bobRes = await getLearnerMastery('bob');

      expect(aliceRes.mastery).toHaveLength(1);
      expect(aliceRes.mastery[0].userId).toBe('alice');

      expect(bobRes.mastery).toHaveLength(0);
    });
  });

  // =========================================================================
  // 8. Diagnostic Assessment Initialization
  // =========================================================================
  describe('8. Diagnostic Assessment Initialization', () => {
    it('initializes mastery probability P(L0) directly from diagnostic test results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          diagnosticInit: {
            topic: 'Computer Networks',
            masteryProbability: 0.75, // 3/4 on diagnostic
            status: 'proficient',
            attempts: 4,
            confidence: 0.67,
          },
        }),
      } as any);

      const res = await initializeDiagnosticState({
        userId: 'student_coldstart',
        topic: 'Computer Networks',
        score: 3,
        totalQuestions: 4,
      });

      expect(res.diagnosticInit.masteryProbability).toBe(0.75);
      expect(res.diagnosticInit.status).toBe('proficient');
      expect(res.diagnosticInit.attempts).toBe(4);
    });
  });

  // =========================================================================
  // 9. No Artificial Mastery for Inactive Users
  // =========================================================================
  describe('9. No Artificial Mastery for Inactive Users', () => {
    it('renders zero/unassessed baseline rather than fabricated percentages', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          mastery: [],
          events: [],
        }),
      } as any);

      render(<LearnerMasteryCard />);

      // Awaits resolution of unassessed card
      await waitFor(() => {
        expect(screen.getByText(/No Knowledge Baseline Recorded/i)).toBeInTheDocument();
      });

      expect(screen.getAllByText(/Unassessed/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/85%/)).not.toBeInTheDocument(); // No fake progress
    });
  });


  // =========================================================================
  // 10. Mastery Categories Classification
  // =========================================================================
  describe('10. Mastery Categories Classification', () => {
    it('maps probabilities accurately across the four required categories', () => {
      // 1. Unassessed
      expect(determineMasteryStatus(0, 0.70)).toBe('unassessed');

      // 2. Developing (< 60%)
      expect(determineMasteryStatus(1, 0.45)).toBe('developing');
      expect(determineMasteryStatus(2, 0.59)).toBe('developing');

      // 3. Proficient (60% - 84%)
      expect(determineMasteryStatus(3, 0.60)).toBe('proficient');
      expect(determineMasteryStatus(4, 0.84)).toBe('proficient');

      // 4. Mastered (>= 85%)
      expect(determineMasteryStatus(5, 0.85)).toBe('mastered');
      expect(determineMasteryStatus(10, 0.98)).toBe('mastered');
    });
  });
});
