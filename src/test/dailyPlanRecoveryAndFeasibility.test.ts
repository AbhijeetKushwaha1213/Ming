import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePersonalizedDailyPlan,
  getTodayStudyPlan,
  updatePlanItemStatus,
  computeDeterministicPriorities,
  answerStudyAgentQuery,
} from '../../server/studyAgentService.ts';
import { evaluateAdaptiveRecommendations } from '../../server/adaptiveRecommendationService.ts';
import { saveDAG } from '../../server/dagService.ts';
import {
  prisma,
  ensureStudyPlanSchema,
  ensureLearnerSchema,
  ensureResourceSchema,
  ensureAssessmentSchema,
  ensureDAGSchema,
} from '../../server/prisma.ts';

describe('Daily Planning, Missed-Day Recovery & Exam Feasibility Engine', () => {
  beforeEach(async () => {
    await ensureStudyPlanSchema();
    await ensureLearnerSchema();
    await ensureResourceSchema();
    await ensureAssessmentSchema();
    await ensureDAGSchema();
  });

  // ---------------------------------------------------------------------------
  // 1. Learner with No Assessment History (Cold Start)
  // ---------------------------------------------------------------------------
  describe('1. Cold Start Behavior (No Assessment History)', () => {
    it('schedules diagnostic assessment and treats sparse evidence as uncertainty, not mastery', async () => {
      const coldUserId = `cold_learner_${Date.now()}`;

      // Insert course resource so the agent knows course topic
      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, ?, 'PDF', 'Operating Systems', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_${Date.now()}`,
        coldUserId,
        'Operating Systems Architecture Notes'
      );

      const plan = await generatePersonalizedDailyPlan({
        userId: coldUserId,
        targetMinutes: 60,
      });

      expect(plan.isColdStart).toBe(true);
      expect(plan.items.length).toBeGreaterThan(0);

      // First activity should be diagnostic baseline assessment
      const firstActivity = plan.items[0];
      expect(firstActivity.activityType).toBe('DIAGNOSTIC_ASSESSMENT');
      expect(firstActivity.reason).toContain('No assessment history found');
      expect(firstActivity.reason).toContain('baseline');
      expect(firstActivity.expectedOutcome).toContain('P(L0)');

      // Planned duration should fit target budget
      expect(plan.totalPlannedMinutes).toBeLessThanOrEqual(60);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Weak Topic with an Unmet Prerequisite in DAG
  // ---------------------------------------------------------------------------
  describe('2. Prerequisite Gating for Weak Topics', () => {
    it('gates advanced topics with unmet prerequisites and prioritizes foundational concepts', async () => {
      const prereqUser = `prereq_learner_${Date.now()}`;

      // Save a course DAG with a foundational node and a locked advanced node
      await saveDAG(prereqUser, {
        title: 'Operating Systems Knowledge Map',
        topic: 'Operating Systems',
        nodes: [
          {
            id: 'node_proc_basics',
            title: 'Process Management Basics',
            status: 'weak',
            mastery: 0.35,
            prerequisites: [],
          },
          {
            id: 'node_deadlock_avoid',
            title: 'Bankers Deadlock Avoidance',
            status: 'locked',
            mastery: 0.10,
            prerequisites: ['node_proc_basics'],
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'node_proc_basics',
            target: 'node_deadlock_avoid',
          },
        ],
      });

      // Record developing mastery for foundational concept
      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Operating Systems', 'Process Management Basics', 0.35, 2, 1, 1, 0.40, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `mast_1_${Date.now()}`,
        prereqUser
      );

      // Record weak mastery for locked advanced concept
      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Operating Systems', 'Bankers Deadlock Avoidance', 0.10, 1, 0, 1, 0.20, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `mast_2_${Date.now()}`,
        prereqUser
      );

      const recs = await evaluateAdaptiveRecommendations(prereqUser, { limit: 10 });
      const deadlockRec = recs.recommendations.find((r) =>
        r.concept_name.includes('Bankers Deadlock Avoidance')
      );
      const procBasicsRec = recs.recommendations.find((r) =>
        r.concept_name.includes('Process Management Basics')
      );

      expect(deadlockRec).toBeDefined();
      expect(procBasicsRec).toBeDefined();

      // Advanced topic with unmet prerequisite must be gated with a low priority score (<0.15)
      expect(deadlockRec!.priority_score).toBeLessThanOrEqual(0.15);
      // Foundational prerequisite must have higher priority
      expect(procBasicsRec!.priority_score).toBeGreaterThan(deadlockRec!.priority_score);

      // Explanation should mention the unmet prerequisite
      expect(deadlockRec!.explanation).toContain('prerequisite');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Missed Study Day Followed by Replanning (Controlled Clock)
  // ---------------------------------------------------------------------------
  describe('3. Missed Study Day Recovery', () => {
    it('detects a missed day, reschedules incomplete tasks with explanation, and preserves completed work', async () => {
      const learner = `recovery_learner_${Date.now()}`;

      // Insert course resources
      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, ?, 'PDF', 'Computer Networks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_net_${Date.now()}`,
        learner,
        'TCP/IP Protocol Suite'
      );

      // Insert multiple topics in mastery
      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Computer Networks', 'Subnet Masking', 0.30, 2, 0, 2, 0.50, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `m1_${Date.now()}`,
        learner
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Computer Networks', 'Routing Protocols', 0.40, 2, 0, 2, 0.50, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `m2_${Date.now()}`,
        learner
      );

      // Day 1: Controlled clock on 2026-11-01
      const day1Plan = await generatePersonalizedDailyPlan({
        userId: learner,
        targetMinutes: 60,
        referenceDate: '2026-11-01',
      });

      expect(day1Plan.items.length).toBeGreaterThanOrEqual(2);
      const taskToComplete = day1Plan.items[0];
      const taskToMiss = day1Plan.items[1];

      // Learner completes task 1 on 2026-11-01
      await updatePlanItemStatus(taskToComplete.id, learner, 'completed');

      // Task 2 is left pending. Learner misses Day 2 (2026-11-02) completely.

      // Day 3: Learner returns on 2026-11-03
      const day3Plan = await generatePersonalizedDailyPlan({
        userId: learner,
        targetMinutes: 60,
        referenceDate: '2026-11-03',
      });

      // Verify recovery detection
      expect(day3Plan.isRecoveryPlan).toBe(true);
      expect(day3Plan.missedTasksCount).toBeGreaterThanOrEqual(1);

      // The missed task must be rescheduled into today's plan
      const rescheduledItem = day3Plan.items.find(
        (i) => i.topic === taskToMiss.topic && (i.subtopic === taskToMiss.subtopic || !taskToMiss.subtopic)
      );
      expect(rescheduledItem).toBeDefined();
      expect(rescheduledItem?.reason).toContain('Rescheduled from missed session on 2026-11-01');

      // Historical completed task from Day 1 must remain intact and completed in the database
      const historicalDay1Items: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM study_plan_items WHERE id = ?',
        taskToComplete.id
      );
      expect(historicalDay1Items[0].status).toBe('completed');
      expect(historicalDay1Items[0].completedAt).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Near Exam with Insufficient Available Time (Infeasible Workload)
  // ---------------------------------------------------------------------------
  describe('4. Exam Urgency & Infeasible Workload Detection', () => {
    it('flags an infeasible workload when available daily budget is insufficient before test day', async () => {
      const crammer = `crammer_${Date.now()}`;

      // Insert 4 weak topics in mastery (<0.60 mastery)
      const topics = ['Process Scheduling', 'Virtual Memory', 'Deadlock Recovery', 'File Systems'];
      for (const t of topics) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
           VALUES (?, ?, 'Operating Systems', ?, 0.25, 3, 0, 3, 0.60, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          `m_${t}_${Date.now()}`,
          crammer,
          t
        );
      }

      // Exam is in 2 days, but student budget is only 30 minutes/day
      // Available time: 2 days * 30 min = 60 mins (1.0 hr)
      // Required time for 4 weak topics: 4 * 45 mins = 180 mins (3.0 hrs)
      const plan = await generatePersonalizedDailyPlan({
        userId: crammer,
        targetMinutes: 30,
        examDate: '2026-11-05',
        referenceDate: '2026-11-03',
      });

      expect(plan.isInfeasible).toBe(true);
      expect(plan.paceWarning).toBeDefined();
      expect(plan.paceWarning).toContain('Infeasible Pace Alert');
      expect(plan.paceWarning).toContain('2 day(s) until your exam');
      expect(plan.paceWarning).toContain('insufficient');
      expect(plan.paceWarning).toContain('increasing your daily budget');

      // Despite the warning, today's allocated tasks must still fit within the 30-min budget
      expect(plan.totalPlannedMinutes).toBeLessThanOrEqual(30);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Repeated Replanning Without Duplicate Tasks
  // ---------------------------------------------------------------------------
  describe('5. Repeated Replanning & Idempotency', () => {
    it('preserves completed items today and does not duplicate tasks across repeated replans', async () => {
      const repeatLearner = `repeat_learner_${Date.now()}`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Database Systems', 'SQL Joins', 0.35, 2, 0, 2, 0.40, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `m_rep1_${Date.now()}`,
        repeatLearner
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Database Systems', 'Indexing', 0.40, 2, 0, 2, 0.40, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `m_rep2_${Date.now()}`,
        repeatLearner
      );

      // Initial generation
      const initialPlan = await generatePersonalizedDailyPlan({
        userId: repeatLearner,
        targetMinutes: 60,
        referenceDate: '2026-11-03',
      });

      expect(initialPlan.items.length).toBeGreaterThan(0);
      const firstItem = initialPlan.items[0];

      // Learner completes first task
      await updatePlanItemStatus(firstItem.id, repeatLearner, 'completed');

      // Student decides to replan today with targetMinutes: 90
      const replanned1 = await generatePersonalizedDailyPlan({
        userId: repeatLearner,
        targetMinutes: 90,
        forceRegenerate: true,
        referenceDate: '2026-11-03',
      });

      // Verify completed task is still preserved in the replanned plan
      const completedInReplan = replanned1.items.find((i) => i.topic === firstItem.topic);
      expect(completedInReplan).toBeDefined();
      expect(completedInReplan?.status).toBe('completed');

      // Verify no duplicate concept items
      const keys = replanned1.items.map((i) => `${i.topic}:::${i.subtopic || ''}`);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);

      // Replan a second time
      const replanned2 = await generatePersonalizedDailyPlan({
        userId: repeatLearner,
        targetMinutes: 90,
        forceRegenerate: true,
        referenceDate: '2026-11-03',
      });

      const keys2 = replanned2.items.map((i) => `${i.topic}:::${i.subtopic || ''}`);
      const uniqueKeys2 = new Set(keys2);
      expect(keys2.length).toBe(uniqueKeys2.size);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Completion Persistence After Reload
  // ---------------------------------------------------------------------------
  describe('6. Persistence & Reload Fidelity', () => {
    it('restores plan, completion states, reasons and feasibility alerts accurately after reload', async () => {
      const reloadUser = `reload_user_${Date.now()}`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO learner_mastery (id, userId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, createdAt, updatedAt)
         VALUES (?, ?, 'Algorithms', 'Dynamic Programming', 0.30, 2, 0, 2, 0.40, 'developing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `m_rel_${Date.now()}`,
        reloadUser
      );

      const generated = await generatePersonalizedDailyPlan({
        userId: reloadUser,
        targetMinutes: 45,
        examDate: '2026-11-04',
        referenceDate: '2026-11-03',
      });

      // Complete an item
      await updatePlanItemStatus(generated.items[0].id, reloadUser, 'completed');

      // Simulate a page reload by querying getTodayStudyPlan
      const reloaded = await getTodayStudyPlan(reloadUser, '2026-11-03');

      expect(reloaded).not.toBeNull();
      expect(reloaded!.id).toBe(generated.id);
      expect(reloaded!.targetMinutes).toBe(45);
      expect(reloaded!.items[0].status).toBe('completed');
      expect(reloaded!.items[0].reason).toBe(generated.items[0].reason);
      expect(reloaded!.items[0].estimatedMinutes).toBe(generated.items[0].estimatedMinutes);
      expect(reloaded!.isInfeasible).toBe(generated.isInfeasible);
      expect(reloaded!.paceWarning).toBe(generated.paceWarning);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Multi-Tenant Cross-User Access Protection
  // ---------------------------------------------------------------------------
  describe('7. Tenant Isolation & Access Protection', () => {
    it('prevents user A from modifying or accessing study plan items belonging to user B', async () => {
      const userA = `user_alice_${Date.now()}`;
      const userB = `user_bob_${Date.now()}`;

      const planA = await generatePersonalizedDailyPlan({
        userId: userA,
        targetMinutes: 60,
      });

      const planB = await generatePersonalizedDailyPlan({
        userId: userB,
        targetMinutes: 60,
      });

      const itemA = planA.items[0];

      // User B attempts to mark User A's task as completed
      await expect(
        updatePlanItemStatus(itemA.id, userB, 'completed')
      ).rejects.toThrow('Study plan item not found or unauthorized');

      // Verify item A remained pending in user A's plan
      const refreshedA = await getTodayStudyPlan(userA);
      expect(refreshedA?.items[0].status).toBe('pending');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Conversational Study Agent Explanations
  // ---------------------------------------------------------------------------
  describe('8. Study Agent Conversational Assistance', () => {
    it('answers queries about missed days and exam pace feasibility with verified context', async () => {
      const chatUser = `chat_user_${Date.now()}`;

      // Simulate a recovery plan
      const plan = await generatePersonalizedDailyPlan({
        userId: chatUser,
        targetMinutes: 30,
        examDate: '2026-11-04',
        referenceDate: '2026-11-03',
      });

      const paceResponse = await answerStudyAgentQuery({
        userId: chatUser,
        query: 'Is my pace feasible for the upcoming exam?',
        examDate: '2026-11-04',
      });

      expect(paceResponse.reply).toContain('Exam Pace & Workload Assessment');

      const missedResponse = await answerStudyAgentQuery({
        userId: chatUser,
        query: 'What should I do if I missed yesterday?',
      });

      expect(missedResponse.reply).toBeDefined();
    });
  });
});

