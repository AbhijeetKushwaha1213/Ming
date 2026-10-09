/**
 * Canonical Phase 6 Test Suite
 * AI Study Agent & Adaptive Study Loop
 * 
 * Comprehensive tests covering:
 * 1. Next Action Selection & Cold-Start Behavior
 * 2. Activity Delivery & Grounded Content Scoping
 * 3. Activity Completion & Loop Advancement
 * 4. Zero-Trust Assessment Grading Integration & Evidence Chain
 * 5. Activity Skipping & Non-Destructive Progression
 * 6. Lifecycle Transitions (READY -> IN_PROGRESS -> COMPLETED / SKIPPED)
 * 7. Multi-Tenant Security & Data Isolation
 * 8. HTTP Handler Endpoints (GET next-action, GET activity, POST complete, POST skip)
 * 9. Regression Verification across Phases 4 & 5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePersonalizedDailyPlan,
  getTodayStudyPlan,
  updatePlanItemStatus,
  getOrComputeNextStudyAction,
  deliverStudyActivity,
  completeStudyActivityWithEvidence,
  skipStudyActivity,
  type PlanItemStatus,
} from '../../server/studyAgentService.ts';
import { studyAgentHandler } from '../../server/studyAgentHandler.ts';
import { evaluateAdaptiveRecommendations } from '../../server/adaptiveRecommendationService.ts';
import { processAssessmentIntelligence } from '../../server/assessmentIntelligenceService.ts';
import {
  recordLearnerEvidence,
  getTopicMasteryState,
} from '../../server/learnerEvidenceService.ts';
import {
  prisma,
  ensureStudyPlanSchema,
  ensureLearnerSchema,
  ensureResourceSchema,
  ensureAssessmentSchema,
} from '../../server/prisma.ts';

// Helper for Mock Express Request/Response
function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3001/api/agent/next-action',
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
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(data?: string) {
      if (data) this.body = data;
    },
  };

  return { req, res };
}

describe('Canonical Phase 6: AI Study Agent & Adaptive Study Loop', () => {
  const testUser = `agent_loop_user_${Date.now()}`;
  const otherUser = `agent_loop_other_${Date.now()}`;

  beforeEach(async () => {
    await ensureStudyPlanSchema();
    await ensureLearnerSchema();
    await ensureResourceSchema();
    await ensureAssessmentSchema();
  });

  // =========================================================================
  // 1. Next Action Selection & Cold-Start Behavior
  // =========================================================================
  describe('1. Next Action Selection & Cold-Start Behavior', () => {
    it('selects diagnostic assessment as next action for cold-start user', async () => {
      const coldUser = `cold_user_${Date.now()}`;
      const nextResult = await getOrComputeNextStudyAction(coldUser);

      expect(nextResult.success).toBe(true);
      expect(nextResult.isColdStart).toBe(true);
      expect(nextResult.action).not.toBeNull();
      expect(nextResult.lifecycleState).toBe('READY');
      expect(nextResult.action?.activityType).toBe('DIAGNOSTIC_ASSESSMENT');
      expect(nextResult.action?.priority).toBe(1);
      expect(nextResult.action?.category).toBe('LEARN_CONCEPT');
    });

    it('generates a persistent daily plan on first request if none exists', async () => {
      const u = `plan_gen_user_${Date.now()}`;
      const nextResult = await getOrComputeNextStudyAction(u);

      expect(nextResult.success).toBe(true);
      expect(nextResult.action?.planId).toBeDefined();

      const todayPlan = await getTodayStudyPlan(u);
      expect(todayPlan).not.toBeNull();
      expect(todayPlan?.id).toBe(nextResult.action?.planId);
      expect(todayPlan?.items.length).toBeGreaterThan(0);
    });

    it('reuses existing active daily plan instead of regenerating when re-requested', async () => {
      const u = `reuse_plan_user_${Date.now()}`;
      const firstResult = await getOrComputeNextStudyAction(u);
      const secondResult = await getOrComputeNextStudyAction(u);

      expect(firstResult.action?.planId).toBe(secondResult.action?.planId);
      expect(firstResult.action?.id).toBe(secondResult.action?.id);
    });

    it('prioritizes misconception remediation when learner has active misconception', async () => {
      const u = `misc_action_user_${Date.now()}`;
      // Ingest misconception evidence via two authoritative assessment submissions
      // establishing a verified recurring misconception
      await processAssessmentIntelligence({
        userId: u,
        title: 'Recursion Assessment 1',
        topic: 'Computer Science',
        subtopic: 'Algorithms',
        difficulty: 'medium',
        questions: [
          {
            id: `q_rec_1_${Date.now()}`,
            question: 'What happens if a recursive function lacks a base case?',
            type: 'MCQ',
            options: ['Infinite recursion / Stack overflow', 'Runs faster', 'Terminates immediately', 'Returns null'],
            correct_answer: '0',
            explanation: 'Without a base case, recursion continues indefinitely.',
            topic: 'Computer Science',
            subtopic: 'Algorithms',
          },
        ],
        answers: ['1'], // Incorrect answer triggering misconception
        attemptId: `att_misc_1_${Date.now()}`,
      });

      await processAssessmentIntelligence({
        userId: u,
        title: 'Recursion Assessment 2',
        topic: 'Computer Science',
        subtopic: 'Algorithms',
        difficulty: 'medium',
        questions: [
          {
            id: `q_rec_2_${Date.now()}`,
            question: 'What happens when recursion has no termination condition?',
            type: 'MCQ',
            options: ['Infinite recursion / Stack overflow', 'Compiles cleanly', 'Immediate exit', 'Optimizes memory'],
            correct_answer: '0',
            explanation: 'Infinite recursion without a base case causes stack overflow.',
            topic: 'Computer Science',
            subtopic: 'Algorithms',
          },
        ],
        answers: ['1'], // Second occurrence triggers recurring misconception
        attemptId: `att_misc_2_${Date.now()}`,
      });

      const plan = await generatePersonalizedDailyPlan({ userId: u, forceRegenerate: true });
      const topItem = plan.items[0];

      expect(topItem.category).toBe('ADDRESS_MISCONCEPTION');
      expect(topItem.activityType).toBe('RESOLVE_MISCONCEPTION');
      expect(topItem.reason).toContain('misconception');

      const nextAction = await getOrComputeNextStudyAction(u);
      expect(nextAction.action?.category).toBe('ADDRESS_MISCONCEPTION');
      expect(nextAction.action?.activityType).toBe('RESOLVE_MISCONCEPTION');
    });

    it('prioritizes weak developing concepts for assessed learners', async () => {
      const u = `weak_concept_user_${Date.now()}`;
      // Submit multiple assessments establishing developing mastery (attempts >= 2, mastery < 0.60)
      await processAssessmentIntelligence({
        userId: u,
        title: 'Binary Search Quiz 1',
        topic: 'Data Structures',
        subtopic: 'Binary Search',
        difficulty: 'medium',
        questions: [
          {
            id: `q_bs_1_${Date.now()}`,
            question: 'What is runtime of binary search?',
            type: 'MCQ',
            options: ['O(1)', 'O(log N)', 'O(N)', 'O(N^2)'],
            correct_answer: '1',
            explanation: 'Binary search is O(log N).',
            topic: 'Data Structures',
            subtopic: 'Binary Search',
          },
        ],
        answers: ['2'], // Wrong answer
        attemptId: `att_bs_1_${Date.now()}`,
      });

      await processAssessmentIntelligence({
        userId: u,
        title: 'Binary Search Quiz 2',
        topic: 'Data Structures',
        subtopic: 'Binary Search',
        difficulty: 'medium',
        questions: [
          {
            id: `q_bs_2_${Date.now()}`,
            question: 'Does binary search require sorted data?',
            type: 'MCQ',
            options: ['Yes', 'No', 'Sometimes', 'Never'],
            correct_answer: '0',
            explanation: 'Binary search requires sorted array.',
            topic: 'Data Structures',
            subtopic: 'Binary Search',
          },
        ],
        answers: ['0'], // Correct answer (attempts = 2, latentMastery < 0.60 -> PRACTICE_CONCEPT)
        attemptId: `att_bs_2_${Date.now()}`,
      });

      const nextAction = await getOrComputeNextStudyAction(u);
      expect(nextAction.action).not.toBeNull();
      expect(nextAction.action?.category).toBe('PRACTICE_CONCEPT');
      expect(nextAction.action?.activityType).toBe('PRACTICE_WEAK_CONCEPTS');
    });
  });

  // =========================================================================
  // 2. Activity Delivery & Grounded Content Scoping
  // =========================================================================
  describe('2. Activity Delivery & Grounded Content Scoping', () => {
    it('delivers activity and transitions status from pending to in_progress', async () => {
      const u = `deliver_test_user_${Date.now()}`;
      const nextResult = await getOrComputeNextStudyAction(u);
      const actionId = nextResult.action!.id;

      expect(nextResult.action?.status).toBe('pending');

      const delivered = await deliverStudyActivity(u, actionId);
      expect(delivered.success).toBe(true);
      expect(delivered.action.id).toBe(actionId);
      expect(delivered.action.status).toBe('in_progress');
      expect(delivered.lifecycleState).toBe('IN_PROGRESS');

      // Verify DB status is now in_progress
      const checkResult = await getOrComputeNextStudyAction(u);
      expect(checkResult.action?.id).toBe(actionId);
      expect(checkResult.action?.status).toBe('in_progress');
      expect(checkResult.lifecycleState).toBe('IN_PROGRESS');
    });

    it('delivers questions strictly scoped to assessment activities', async () => {
      const u = `deliv_q_user_${Date.now()}`;
      const nextResult = await getOrComputeNextStudyAction(u);
      const delivered = await deliverStudyActivity(u, nextResult.action!.id);

      expect(delivered.questions).toBeDefined();
      expect(delivered.questions.length).toBeGreaterThan(0);
      expect(delivered.questions[0].question).toBeDefined();
      expect(delivered.questions[0].options).toBeDefined();
    });

    it('delivers grounded resource details when sourceId is attached', async () => {
      const u = `deliv_res_user_${Date.now()}`;
      const resId = `res_${Date.now()}`;

      // Insert authentic user resource
      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, storagePath, createdAt, updatedAt)
         VALUES (?, ?, 'Dynamic Programming Fundamentals', 'PDF', 'Algorithms', '/docs/dp.pdf', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        resId,
        u
      );

      const plan = await generatePersonalizedDailyPlan({ userId: u, forceRegenerate: true });
      const resourceItem = plan.items.find((i) => i.activityType === 'REVIEW_SOURCE');

      if (resourceItem) {
        const delivered = await deliverStudyActivity(u, resourceItem.id);
        expect(delivered.resource).not.toBeNull();
        expect(delivered.resource?.title).toBe('Dynamic Programming Fundamentals');
        expect(delivered.resource?.type).toBe('PDF');
      }
    });

    it('rejects delivering a non-existent activity ID', async () => {
      const u = `reject_user_${Date.now()}`;
      await expect(deliverStudyActivity(u, 'non_existent_item_id')).rejects.toThrow(
        /Study activity not found or unauthorized/
      );
    });

    it('rejects delivering an activity belonging to another tenant', async () => {
      const userA = `user_a_${Date.now()}`;
      const userB = `user_b_${Date.now()}`;

      const resA = await getOrComputeNextStudyAction(userA);
      const actionAId = resA.action!.id;

      // User B tries to deliver User A's activity
      await expect(deliverStudyActivity(userB, actionAId)).rejects.toThrow(
        /Study activity not found or unauthorized/
      );
    });
  });

  // =========================================================================
  // 3. Activity Completion & Loop Advancement
  // =========================================================================
  describe('3. Activity Completion & Loop Advancement', () => {
    it('completes activity and advances to the next pending action', async () => {
      const u = `adv_loop_user_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const firstActionId = initResult.action!.id;

      const completeResult = await completeStudyActivityWithEvidence(u, firstActionId);
      expect(completeResult.success).toBe(true);
      expect(completeResult.completedActionId).toBe(firstActionId);

      // Verify the next action is different from the completed one
      if (completeResult.nextAction) {
        expect(completeResult.nextAction.id).not.toBe(firstActionId);
        expect(completeResult.nextAction.status).toBe('pending');
      }
    });

    it('sets status to completed and completedAt timestamp in the database', async () => {
      const u = `timestamp_user_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const actionId = initResult.action!.id;

      await completeStudyActivityWithEvidence(u, actionId);

      const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM study_plan_items WHERE id = ?',
        actionId
      );
      expect(rows[0].status).toBe('completed');
      expect(rows[0].completedAt).not.toBeNull();
    });

    it('transitions lifecycle to COMPLETED when all items in plan are completed', async () => {
      const u = `all_done_user_${Date.now()}`;
      const plan = await generatePersonalizedDailyPlan({ userId: u, targetMinutes: 30, forceRegenerate: true });

      // Complete all items in plan
      for (const item of plan.items) {
        await completeStudyActivityWithEvidence(u, item.id);
      }

      const finalAction = await getOrComputeNextStudyAction(u);
      expect(finalAction.action).toBeNull();
      expect(finalAction.lifecycleState).toBe('COMPLETED');
    });

    it('never logs fake BKT mastery events upon plan item status updates', async () => {
      const u = `no_fake_events_user_${Date.now()}`;
      const plan = await generatePersonalizedDailyPlan({ userId: u, forceRegenerate: true });
      const item = plan.items[0];

      // Update item status using updatePlanItemStatus
      await updatePlanItemStatus(item.id, u, 'completed');

      // Verify that NO fake ASSESSMENT_RESULT event with 0.5 was added
      const events: any[] = await prisma.$queryRawUnsafe(
        "SELECT * FROM learner_events WHERE userId = ? AND sourceId = ?",
        u,
        item.id
      );
      expect(events.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. Zero-Trust Assessment Grading Integration & Evidence Chain
  // =========================================================================
  describe('4. Zero-Trust Assessment Grading Integration & Evidence Chain', () => {
    it('authoritatively updates BKT mastery through Phase 4 grading submission', async () => {
      const u = `phase4_integ_user_${Date.now()}`;
      const questions = [
        {
          id: `q_integ_1_${Date.now()}`,
          question: 'What is the base case in recursion?',
          type: 'MCQ',
          options: ['Termination condition', 'Loop increment', 'Memory allocation', 'Compiler optimization'],
          correct_answer: '0',
          explanation: 'Base cases stop recursive function execution.',
          topic: 'Data Structures',
          subtopic: 'Recursion',
        },
      ];
      const answers = ['0']; // Correct answer

      // Submit assessment through canonical Phase 4 grading pipeline
      const { results, diagnosticReport } = await processAssessmentIntelligence({
        userId: u,
        title: 'Recursion Check',
        topic: 'Data Structures',
        subtopic: 'Recursion',
        difficulty: 'medium',
        questions,
        answers,
        attemptId: `att_eval_${Date.now()}`,
      });

      expect(results.length).toBe(1);
      expect(results[0].classification).toBe('correct');
      expect(diagnosticReport.percentage).toBe(100);

      // Verify evidence was stored into learner_events table
      const evidenceRows: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM learner_events WHERE userId = ?',
        u
      );
      expect(evidenceRows.length).toBeGreaterThan(0);
      expect(evidenceRows[0].isCorrect).toBeTruthy();

      // Verify topic mastery increased from prior
      const mastery = await getTopicMasteryState(u, 'Data Structures', 'Recursion');
      expect(mastery.mastery_estimate).toBeGreaterThan(0.20);
      expect(mastery.evidence_count).toBe(1);
    });

    it('dynamically adapts study loop after authoritative assessment grading', async () => {
      const u = `dynamic_adapt_user_${Date.now()}`;

      // Submit 2 assessments triggering developing mastery & recent errors
      await processAssessmentIntelligence({
        userId: u,
        title: 'Asymptotic Complexity 1',
        topic: 'Algorithms',
        subtopic: 'Big-O',
        difficulty: 'medium',
        questions: [
          {
            id: `q_bigo_1_${Date.now()}`,
            question: 'What is the time complexity of merge sort?',
            type: 'MCQ',
            options: ['O(1)', 'O(log N)', 'O(N log N)', 'O(N^2)'],
            correct_answer: '2',
            explanation: 'Merge sort runs in O(N log N) in all cases.',
            topic: 'Algorithms',
            subtopic: 'Big-O',
          },
        ],
        answers: ['3'], // Wrong answer
        attemptId: `att_bigo_1_${Date.now()}`,
      });

      await processAssessmentIntelligence({
        userId: u,
        title: 'Asymptotic Complexity 2',
        topic: 'Algorithms',
        subtopic: 'Big-O',
        difficulty: 'medium',
        questions: [
          {
            id: `q_bigo_2_${Date.now()}`,
            question: 'What is the worst case complexity of quicksort?',
            type: 'MCQ',
            options: ['O(N^2)', 'O(N log N)', 'O(log N)', 'O(1)'],
            correct_answer: '0',
            explanation: 'Quicksort worst case is O(N^2).',
            topic: 'Algorithms',
            subtopic: 'Big-O',
          },
        ],
        answers: ['1'], // Wrong answer
        attemptId: `att_bigo_2_${Date.now()}`,
      });

      // Query next action in study loop
      const nextAction = await getOrComputeNextStudyAction(u);
      expect(nextAction.action).not.toBeNull();
      expect(nextAction.action?.topic).toBe('Algorithms');
      expect(nextAction.action?.category).toMatch(/ADDRESS_MISCONCEPTION|PRACTICE_CONCEPT/);
    });
  });

  // =========================================================================
  // 5. Activity Skipping & Non-Destructive Progression
  // =========================================================================
  describe('5. Activity Skipping & Non-Destructive Progression', () => {
    it('skips activity without penalizing BKT mastery', async () => {
      const u = `skip_test_user_${Date.now()}`;
      // Ingest initial positive evidence via authoritative assessment submission
      await processAssessmentIntelligence({
        userId: u,
        title: 'Graph Theory Check',
        topic: 'Graph Theory',
        subtopic: 'Traversal',
        difficulty: 'medium',
        questions: [
          {
            id: `q_gt_${Date.now()}`,
            question: 'Is BFS used for shortest path on unweighted graphs?',
            type: 'MCQ',
            options: ['Yes', 'No'],
            correct_answer: '0',
            explanation: 'BFS explores layer by layer.',
            topic: 'Graph Theory',
            subtopic: 'Traversal',
          },
        ],
        answers: ['0'], // Correct answer
        attemptId: `att_gt_${Date.now()}`,
      });

      const masteryBefore = await getTopicMasteryState(u, 'Graph Theory', 'Traversal');
      const initAction = await getOrComputeNextStudyAction(u);
      const actionId = initAction.action!.id;

      // Skip the activity
      const skipResult = await skipStudyActivity(u, actionId, 'Too easy for me');
      expect(skipResult.success).toBe(true);
      expect(skipResult.skippedActionId).toBe(actionId);
      expect(skipResult.reason).toBe('Too easy for me');

      // Mastery must remain untouched
      const masteryAfter = await getTopicMasteryState(u, 'Graph Theory', 'Traversal');
      expect(masteryAfter.mastery).toBe(masteryBefore.mastery);
      expect(masteryAfter.attempts).toBe(masteryBefore.attempts);

      // Verify DB status is 'skipped'
      const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT status FROM study_plan_items WHERE id = ?',
        actionId
      );
      expect(rows[0].status).toBe('skipped');
    });
  });

  // =========================================================================
  // 6. Lifecycle Transitions & State Invariants
  // =========================================================================
  describe('6. Lifecycle Transitions & State Invariants', () => {
    it('resumes in_progress activity if learner re-requests next action', async () => {
      const u = `resume_test_user_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const actionId = initResult.action!.id;

      // Start the activity
      await deliverStudyActivity(u, actionId);

      // Query next action again
      const reResult = await getOrComputeNextStudyAction(u);
      expect(reResult.action?.id).toBe(actionId);
      expect(reResult.lifecycleState).toBe('IN_PROGRESS');
      expect(reResult.action?.status).toBe('in_progress');
    });

    it('supports blocked status in plan item updates', async () => {
      const u = `blocked_test_user_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const actionId = initResult.action!.id;

      const updated = await updatePlanItemStatus(actionId, u, 'blocked');
      expect(updated.success).toBe(true);
      expect(updated.item.status).toBe('blocked');
    });
  });

  // =========================================================================
  // 7. Multi-Tenant Security & Zero-Trust Isolation
  // =========================================================================
  describe('7. Multi-Tenant Security & Zero-Trust Isolation', () => {
    it('isolates daily study plans between distinct users', async () => {
      const user1 = `sec_user1_${Date.now()}`;
      const user2 = `sec_user2_${Date.now()}`;

      const plan1 = await generatePersonalizedDailyPlan({ userId: user1 });
      const plan2 = await generatePersonalizedDailyPlan({ userId: user2 });

      expect(plan1.id).not.toBe(plan2.id);

      const retrieved1 = await getTodayStudyPlan(user1);
      const retrieved2 = await getTodayStudyPlan(user2);

      expect(retrieved1?.userId).toBe(user1);
      expect(retrieved2?.userId).toBe(user2);
    });

    it('forbids tenant A from completing tenant B study activities', async () => {
      const userA = `sec_a_${Date.now()}`;
      const userB = `sec_b_${Date.now()}`;

      const actA = await getOrComputeNextStudyAction(userA);
      const actionAId = actA.action!.id;

      await expect(completeStudyActivityWithEvidence(userB, actionAId)).rejects.toThrow(
        /Study activity not found or unauthorized/
      );
    });

    it('forbids tenant A from skipping tenant B study activities', async () => {
      const userA = `sec_a2_${Date.now()}`;
      const userB = `sec_b2_${Date.now()}`;

      const actA = await getOrComputeNextStudyAction(userA);
      const actionAId = actA.action!.id;

      await expect(skipStudyActivity(userB, actionAId)).rejects.toThrow(
        /Study activity not found or unauthorized/
      );
    });
  });

  // =========================================================================
  // 8. HTTP Handler Integration
  // =========================================================================
  describe('8. HTTP Handler Integration', () => {
    it('GET /api/agent/next-action returns 200 with next study action', async () => {
      const u = `http_next_${Date.now()}`;
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/agent/next-action',
        headers: { 'x-dev-user-id': u },
      });

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBeDefined();
      expect(res.body.lifecycleState).toBeDefined();
    });

    it('GET /api/agent/activity/:actionId returns 200 and delivers content', async () => {
      const u = `http_deliv_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const actionId = initResult.action!.id;

      const { req, res } = createMockReqRes({
        method: 'GET',
        url: `http://localhost:3001/api/agent/activity/${actionId}`,
        headers: { 'x-dev-user-id': u },
      });

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action.id).toBe(actionId);
      expect(res.body.action.status).toBe('in_progress');
      expect(res.body.questions).toBeDefined();
    });

    it('POST /api/agent/activity/:actionId/complete returns 200 and advances loop', async () => {
      const u = `http_complete_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const actionId = initResult.action!.id;

      const { req, res } = createMockReqRes({
        method: 'POST',
        url: `http://localhost:3001/api/agent/activity/${actionId}/complete`,
        headers: { 'x-dev-user-id': u },
        body: { score: 100 },
      });

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.completedActionId).toBe(actionId);
      expect(res.body.lifecycleState).toBeDefined();
    });

    it('POST /api/agent/activity/:actionId/skip returns 200 and advances loop', async () => {
      const u = `http_skip_${Date.now()}`;
      const initResult = await getOrComputeNextStudyAction(u);
      const actionId = initResult.action!.id;

      const { req, res } = createMockReqRes({
        method: 'POST',
        url: `http://localhost:3001/api/agent/activity/${actionId}/skip`,
        headers: { 'x-dev-user-id': u },
        body: { reason: 'Skipped for now' },
      });

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.skippedActionId).toBe(actionId);
      expect(res.body.reason).toBe('Skipped for now');
    });

    it('returns 404 for non-existent activity delivery', async () => {
      const u = `http_not_found_${Date.now()}`;
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/agent/activity/bogus_action_id_123',
        headers: { 'x-dev-user-id': u },
      });

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('Failed to deliver study activity');
    });
  });

  // =========================================================================
  // 9. Regression Verification across Phases 4 & 5
  // =========================================================================
  describe('9. Regression Verification across Phases 4 & 5', () => {
    it('preserves Phase 4 numerical question deterministic grading', async () => {
      const u = `regr_num_${Date.now()}`;
      const q = [
        {
          id: `q_calc_${Date.now()}`,
          question: 'Calculate 15 * 4',
          type: 'NUMERICAL',
          correct_answer: '60',
          acceptable_range: { min: 59.9, max: 60.1 },
          topic: 'Mathematics',
          subtopic: 'Arithmetic',
        },
      ];

      const { results } = await processAssessmentIntelligence({
        userId: u,
        title: 'Math Test',
        topic: 'Mathematics',
        subtopic: 'Arithmetic',
        difficulty: 'easy',
        questions: q,
        answers: ['60.0'],
        attemptId: `att_num_${Date.now()}`,
      });

      expect(results[0].classification).toBe('correct');
      expect(results[0].credit).toBe(1.0);
    });

    it('preserves Phase 5 Step 3 adaptive recommendation contracts', async () => {
      const u = `regr_rec_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, 'Calculus 101', 'PDF', 'Mathematics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_math_${Date.now()}`,
        u
      );
      const recs = await evaluateAdaptiveRecommendations(u);

      expect(recs.success).toBe(true);
      expect(recs.is_cold_start).toBe(true);
      expect(recs.recommendations.length).toBeGreaterThan(0);
      expect(recs.recommendations[0].priority_score).toBeGreaterThanOrEqual(0.0);
      expect(recs.recommendations[0].priority_score).toBeLessThanOrEqual(1.0);
    });
  });
});
