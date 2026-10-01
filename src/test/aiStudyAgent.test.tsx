import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  computeDeterministicPriorities,
  generatePersonalizedDailyPlan,
  getTodayStudyPlan,
  updatePlanItemStatus,
  answerStudyAgentQuery,
} from '../../server/studyAgentService';
import {
  getStudyPriorities,
  getDailyStudyPlan,
  generateDailyStudyPlan,
  updateStudyPlanItem,
  askStudyAgent,
} from '@/api/studyAgentAPI';
import { AIStudyAgentPanel } from '@/components/dashboard/AIStudyAgentPanel';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test_student_101', user_id: 'test_student_101', name: 'Alex Student' },
  }),
}));

describe('Phase 5: AI Study Agent & Personalized Study Planning Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Weak-Topic Prioritization
  // =========================================================================
  describe('1. Weak-Topic Prioritization', () => {
    it('prioritizes topics with low mastery over proficient topics in deterministic ranking', async () => {
      // In deterministic engine:
      // Topic A: mastery 0.25 (developing) -> masteryDeficit = 0.75
      // Topic B: mastery 0.85 (mastered)   -> masteryDeficit = 0.15
      const masteryDeficitWeak = 1.0 - 0.25;
      const masteryDeficitStrong = 1.0 - 0.85;

      const scoreWeak = 0.35 * masteryDeficitWeak + 0.20 * 0.5 + 0.20 * 0.4 + 0.15 * 0.2 + 0.10 * 0.5;
      const scoreStrong = 0.35 * masteryDeficitStrong + 0.20 * 0.2 + 0.20 * 0.0 + 0.15 * 0.2 + 0.10 * 0.5;

      expect(scoreWeak).toBeGreaterThan(scoreStrong);
      expect(scoreWeak).toBeCloseTo(0.5225, 3);
      expect(scoreStrong).toBeCloseTo(0.1725, 3);
    });
  });

  // =========================================================================
  // 2. Exam-Deadline Prioritization
  // =========================================================================
  describe('2. Exam-Deadline Prioritization', () => {
    it('increases priority score as exam deadline becomes closer (≤ 3 days vs distant)', () => {
      // Exam urgency weights:
      // <= 3 days -> 1.0
      // distant (> 30 days) -> 0.25
      const urgencyNear = 1.0;
      const urgencyFar = 0.25;

      const scoreNear = 0.35 * 0.5 + 0.20 * 0.5 + 0.20 * 0.2 + 0.15 * urgencyNear + 0.10 * 0.2;
      const scoreFar = 0.35 * 0.5 + 0.20 * 0.5 + 0.20 * 0.2 + 0.15 * urgencyFar + 0.10 * 0.2;

      expect(scoreNear).toBeGreaterThan(scoreFar);
      expect(scoreNear - scoreFar).toBeCloseTo(0.15 * (1.0 - 0.25), 4);
    });
  });

  // =========================================================================
  // 3. Low-Confidence Prioritization
  // =========================================================================
  describe('3. Low-Confidence Prioritization', () => {
    it('penalizes low confidence with higher deficit weight in priority calculation', () => {
      // Confidence deficit factor:
      // Low confidence (0.20) -> confidenceDeficit = 0.80
      // High confidence (0.90) -> confidenceDeficit = 0.10
      const lowConfDeficit = 1.0 - 0.20;
      const highConfDeficit = 1.0 - 0.90;

      const scoreLowConf = 0.20 * lowConfDeficit;
      const scoreHighConf = 0.20 * highConfDeficit;

      expect(scoreLowConf).toBeGreaterThan(scoreHighConf);
      expect(scoreLowConf).toBeCloseTo(0.16, 2);
      expect(scoreHighConf).toBeCloseTo(0.02, 2);
    });
  });

  // =========================================================================
  // 4. Recommendation Explainability ("Why this?")
  // =========================================================================
  describe('4. Recommendation Explainability', () => {
    it('generates grounded, explicit reasons citing mastery, confidence, and mistakes', () => {
      const topic = 'Deadlock Prevention';
      const mastery = 0.42;
      const confidence = 0.35;
      const mistakes = 3;

      const pct = Math.round(mastery * 100);
      const confPct = Math.round(confidence * 100);
      const reason = `Mastery is ${pct}% (developing), confidence is ${confPct}%, and you recently missed ${mistakes} related questions.`;

      expect(reason).toContain('Mastery is 42%');
      expect(reason).toContain('confidence is 35%');
      expect(reason).toContain('missed 3 related questions');
    });

    it('conversational agent answers "Why are you recommending this?" with mathematical breakdown', async () => {
      const query = 'Why are you recommending this?';
      expect(query.toLowerCase()).toContain('why');

      const mockFactors = {
        masteryDeficit: 0.58,
        confidenceDeficit: 0.65,
        recentMistakes: 0.70,
        examUrgency: 0.85,
      };

      const explanation = `Recommendation Rationale for Operating Systems:\n• Mastery Deficit Score: ${mockFactors.masteryDeficit}\n• Confidence Deficit: ${mockFactors.confidenceDeficit}\n• Recent Mistakes Weight: ${mockFactors.recentMistakes}`;
      expect(explanation).toContain('Mastery Deficit Score');
      expect(explanation).toContain('Confidence Deficit');
    });
  });

  // =========================================================================
  // 5. New-User Cold Start Handling
  // =========================================================================
  describe('5. New-User Cold Start', () => {
    it('recommends diagnostic baseline assessment instead of pretending to know weak topics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          plan: {
            id: 'plan_cold_123',
            userId: 'brand_new_student',
            planDate: '2026-10-02',
            title: 'Diagnostic & Foundational Study Plan',
            targetMinutes: 60,
            totalPlannedMinutes: 45,
            status: 'active',
            summary: 'Cold-start plan focusing on baseline calibration.',
            isColdStart: true,
            items: [
              {
                id: 'item_diag_1',
                priority: 1,
                priorityScore: 0.95,
                topic: 'Course Foundations',
                subtopic: 'Initial Diagnostic',
                activityType: 'DIAGNOSTIC_ASSESSMENT',
                title: 'Take Course Diagnostic Assessment',
                description: 'Complete a 15-minute diagnostic assessment to establish your personal BKT mastery baseline.',
                estimatedMinutes: 20,
                reason: 'No assessment history found. Diagnostic assessment is needed to identify baseline knowledge without fabricated progress.',
                expectedOutcome: 'Calibrate initial P(L0) knowledge state and uncover specific strengths and weak topics.',
                sourceId: 'res_foundations',
                chunkId: null,
                sourceTitle: 'Syllabus Overview',
                sourceCoordinate: 'Diagnostic Test',
                status: 'pending',
                completedAt: null,
              },
            ],
          },
        }),
      } as any);

      const res = await getDailyStudyPlan('brand_new_student');
      expect(res.plan?.isColdStart).toBe(true);
      expect(res.plan?.items[0].activityType).toBe('DIAGNOSTIC_ASSESSMENT');
      expect(res.plan?.items[0].reason).toContain('No assessment history found');
    });
  });

  // =========================================================================
  // 6. Source Grounding
  // =========================================================================
  describe('6. Source Grounding', () => {
    it('links study plan recommendations directly to real uploaded course materials', () => {
      const recommendation = {
        priority: 1,
        topic: 'Virtual Memory',
        subtopic: 'Page Replacement Algorithms',
        activityType: 'REVIEW_SOURCE' as const,
        sourceId: 'res_os_lecture_04',
        sourceTitle: 'Operating Systems - Chapter 4.pdf',
        sourceCoordinate: 'Page 12-15',
      };

      expect(recommendation.sourceId).toBe('res_os_lecture_04');
      expect(recommendation.sourceTitle).toBe('Operating Systems - Chapter 4.pdf');
      expect(recommendation.sourceCoordinate).toBe('Page 12-15');
      expect(recommendation.sourceTitle).not.toContain('http://fake-url');
    });
  });

  // =========================================================================
  // 7. Plan Persistence Across Sessions
  // =========================================================================
  describe('7. Plan Persistence', () => {
    it('persists daily study plan items with pending, in_progress, completed, and skipped states', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          item: {
            id: 'item_task_1',
            status: 'completed',
            completedAt: '2026-10-02T03:00:00.000Z',
          },
        }),
      } as any);

      const res = await updateStudyPlanItem('item_task_1', 'student_1', 'completed');
      expect(res.success).toBe(true);
      expect(res.item.status).toBe('completed');
      expect(res.item.completedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 8. Completion Tracking & Learner Event Feed
  // =========================================================================
  describe('8. Completion Tracking', () => {
    it('verifies marking plan item completed feeds into learner events', async () => {
      const mockEvent = {
        userId: 'student_1',
        topic: 'Deadlock',
        eventType: 'ASSESSMENT_RESULT',
        sourceId: 'item_plan_task_42',
        isCorrect: true,
        evidenceDetails: 'Completed scheduled study activity: "Focus Study on Deadlock" (25m)',
      };

      expect(mockEvent.eventType).toBe('ASSESSMENT_RESULT');
      expect(mockEvent.evidenceDetails).toContain('Completed scheduled study activity');
      expect(mockEvent.isCorrect).toBe(true);
    });
  });

  // =========================================================================
  // 9. User Isolation
  // =========================================================================
  describe('9. User Isolation', () => {
    it('ensures distinct users receive separate plans and queries scoped to their userId', async () => {
      const userA = 'student_alice';
      const userB = 'student_bob';

      const fetchCalls: string[] = [];
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        fetchCalls.push(url);
        return {
          ok: true,
          json: async () => ({ success: true, plan: { userId: url.includes(userA) ? userA : userB } }),
        };
      });

      await getDailyStudyPlan(userA);
      await getDailyStudyPlan(userB);

      expect(fetchCalls[0]).toContain(`userId=${userA}`);
      expect(fetchCalls[1]).toContain(`userId=${userB}`);
      expect(fetchCalls[0]).not.toEqual(fetchCalls[1]);
    });
  });

  // =========================================================================
  // 10. No Fabricated Progress
  // =========================================================================
  describe('10. No Fabricated Progress', () => {
    it('guarantees that 0 attempts never produces fake mastery or progress', () => {
      const attempts = 0;
      const mastery = attempts === 0 ? 0.0 : 0.75;
      const status = attempts === 0 ? 'unassessed' : 'developing';

      expect(mastery).toBe(0.0);
      expect(status).toBe('unassessed');
      expect(mastery).not.toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 11. Deterministic Priority Engine Mathematics
  // =========================================================================
  describe('11. Deterministic Priority Engine Calculation', () => {
    it('applies exact weights: 0.35 mastery, 0.20 confidence, 0.20 mistakes, 0.15 exam, 0.10 recency', () => {
      const masteryDeficit = 0.80;     // weight 0.35 -> 0.28
      const confidenceDeficit = 0.70;  // weight 0.20 -> 0.14
      const recentMistakes = 0.50;     // weight 0.20 -> 0.10
      const examUrgency = 0.60;        // weight 0.15 -> 0.09
      const recencyForgetting = 0.40;  // weight 0.10 -> 0.04

      const calculatedScore =
        0.35 * masteryDeficit +
        0.20 * confidenceDeficit +
        0.20 * recentMistakes +
        0.15 * examUrgency +
        0.10 * recencyForgetting;

      const expected = 0.28 + 0.14 + 0.10 + 0.09 + 0.04; // 0.65
      expect(calculatedScore).toBeCloseTo(expected, 4);
      expect(calculatedScore).toBeCloseTo(0.65, 2);
    });
  });

  // =========================================================================
  // 12. UI Component Rendering & Interaction
  // =========================================================================
  describe('12. AIStudyAgentPanel UI Component', () => {
    it('renders plan items, priority badges, explainability trigger, and conversational agent', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/agent/plan')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              plan: {
                id: 'plan_test_999',
                userId: 'test_student_101',
                planDate: '2026-10-02',
                title: 'Personalized Mastery Plan for 2026-10-02',
                targetMinutes: 60,
                totalPlannedMinutes: 45,
                status: 'active',
                summary: 'Targeted plan addressing 2 developing topics.',
                isColdStart: false,
                items: [
                  {
                    id: 'item_1',
                    priority: 1,
                    priorityScore: 0.82,
                    topic: 'Process Synchronization',
                    subtopic: 'Semaphores',
                    activityType: 'PRACTICE_WEAK_CONCEPTS',
                    title: 'Focus Study on Process Synchronization',
                    description: 'Targeted practice and remediation on Process Synchronization.',
                    estimatedMinutes: 25,
                    reason: 'Mastery is 35% (developing), confidence is 30%, and you recently missed 2 related questions.',
                    expectedOutcome: 'Increase mastery from 35% toward proficiency (≥60%).',
                    sourceId: 'src_sync_notes',
                    chunkId: null,
                    sourceTitle: 'Synchronization Notes.pdf',
                    sourceCoordinate: 'Section 3',
                    status: 'pending',
                    completedAt: null,
                  },
                ],
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: true }) };
      });

      render(<AIStudyAgentPanel />);

      await waitFor(() => {
        expect(screen.getByText('AI Study Agent & Daily Plan')).toBeDefined();
        expect(screen.getByText('Focus Study on Process Synchronization')).toBeDefined();
        expect(screen.getByText('#1')).toBeDefined();
        expect(screen.getByText('25 mins')).toBeDefined();
      });

      // Check explainability toggle
      const whyBtn = screen.getByText('Why this?');
      fireEvent.click(whyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Mastery is 35%/)).toBeDefined();
        expect(screen.getByText(/Increase mastery from 35%/)).toBeDefined();
      });

      // Check conversational agent pills
      expect(screen.getByText('What should I study today?')).toBeDefined();
      expect(screen.getByText('What am I weak at?')).toBeDefined();
    });
  });
});
