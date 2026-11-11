import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import {
  generatePersonalizedDailyPlan,
  getTodayStudyPlan,
  updatePlanItemStatus,
  getLearnerPreferences,
  saveLearnerPreferences,
  isValidIANATimezone,
  getCalendarDateInTimezone,
  computeDeterministicPriorities,
} from '../../server/studyAgentService.ts';
import { studyAgentHandler } from '../../server/studyAgentHandler.ts';
import * as supabaseAuth from '../../server/supabaseAuth.ts';
import { saveDAG } from '../../server/dagService.ts';
import {
  prisma,
  ensureStudyPlanSchema,
  ensureLearnerSchema,
  ensureResourceSchema,
  ensureAssessmentSchema,
  ensureDAGSchema,
  ensureLearnerPreferencesSchema,
} from '../../server/prisma.ts';

// Helper to simulate HTTP requests to studyAgentHandler
function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: any;
}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    query: options.query || {},
    body: options.body,
  };
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
    end(body?: string) {
      if (body && !res.body) {
        try {
          res.body = JSON.parse(body);
        } catch {
          res.body = body;
        }
      }
    },
  };
  return res;
}

describe('Daily Planning Engine Hardening & Production Integrity Suite', () => {
  beforeEach(async () => {
    await ensureStudyPlanSchema();
    await ensureLearnerSchema();
    await ensureResourceSchema();
    await ensureAssessmentSchema();
    await ensureDAGSchema();
    await ensureLearnerPreferencesSchema();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Production Clock Boundary
  // ---------------------------------------------------------------------------
  describe('1. Production Clock Boundary', () => {
    let originalTestSecret: string | undefined;

    beforeAll(() => {
      originalTestSecret = process.env.MING_TEST_SECRET;
      process.env.MING_TEST_SECRET = 'daily_plan_test_secret_key';
    });

    afterAll(() => {
      if (originalTestSecret === undefined) {
        delete process.env.MING_TEST_SECRET;
      } else {
        process.env.MING_TEST_SECRET = originalTestSecret;
      }
    });

    it('rejects unauthenticated bare identity headers on POST /api/agent/plan/generate with 401', async () => {
      const req = createMockRequest({
        method: 'POST',
        url: '/api/agent/plan/generate',
        headers: {
          'x-dev-user-id': `unauth_clock_user_${Date.now()}`,
        },
        body: {
          targetMinutes: 60,
          referenceDate: '2030-01-01',
        },
      });
      const res = createMockResponse();

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(401);
    });

    it('discards client-supplied referenceDate on POST /api/agent/plan/generate for untrusted requests', async () => {
      const untrustedUser = `client_clock_hacker_${Date.now()}`;
      const fakeFutureDate = '2030-01-01';

      vi.spyOn(supabaseAuth, 'verifySupabaseToken').mockResolvedValueOnce({
        id: untrustedUser,
        email: `${untrustedUser}@ming.edu`,
      } as any);

      // Authenticated learner request WITHOUT valid x-ming-test-key attempting to manipulate today's date
      const req = createMockRequest({
        method: 'POST',
        url: '/api/agent/plan/generate',
        headers: {
          authorization: 'Bearer valid_learner_jwt',
          // Note: NO valid x-ming-test-key provided
        },
        body: {
          targetMinutes: 60,
          referenceDate: fakeFutureDate,
        },
      });
      const res = createMockResponse();

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const plan = res.body.plan;
      // In production planning, client referenceDate must be discarded;
      // Today's planDate must match server clock date in Asia/Kolkata
      const expectedServerDate = getCalendarDateInTimezone(new Date(), 'Asia/Kolkata');
      expect(plan.planDate).toBe(expectedServerDate);
      expect(plan.planDate).not.toBe(fakeFutureDate);
    });

    it('honors referenceDate ONLY when authorized test key is provided', async () => {
      const testUser = `authorized_tester_${Date.now()}`;
      const simulatedDate = '2026-11-20';
      const testSecret = process.env.MING_TEST_SECRET!;

      const req = createMockRequest({
        method: 'POST',
        url: '/api/agent/plan/generate',
        headers: {
          'x-ming-test-key': testSecret,
          'x-ming-user-id': testUser,
        },
        body: {
          targetMinutes: 60,
          referenceDate: simulatedDate,
        },
      });
      const res = createMockResponse();

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.plan.planDate).toBe(simulatedDate);
    });

    it('ordinary read requests (GET /api/agent/plan) never unexpectedly generate or rewrite plans', async () => {
      const readOnlyUser = `readonly_student_${Date.now()}`;

      vi.spyOn(supabaseAuth, 'verifySupabaseToken').mockResolvedValueOnce({
        id: readOnlyUser,
        email: `${readOnlyUser}@ming.edu`,
      } as any);

      // Call GET /api/agent/plan when no plan exists
      const req = createMockRequest({
        method: 'GET',
        url: '/api/agent/plan',
        headers: {
          authorization: 'Bearer valid_learner_jwt',
        },
      });
      const res = createMockResponse();

      await studyAgentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBeNull();

      // Verify ZERO records were written to study_plans
      const planCount: any[] = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) as count FROM study_plans WHERE userId = ?',
        readOnlyUser
      );
      expect(Number(planCount[0].count)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Local Dates Around UTC Midnight & Timezone Validation
  // ---------------------------------------------------------------------------
  describe('2. Local Dates Around UTC Midnight & IANA Timezone Validation', () => {
    it('correctly validates IANA timezone identifiers and rejects invalid strings', () => {
      expect(isValidIANATimezone('Asia/Kolkata')).toBe(true);
      expect(isValidIANATimezone('America/New_York')).toBe(true);
      expect(isValidIANATimezone('UTC')).toBe(true);
      expect(isValidIANATimezone('Europe/London')).toBe(true);

      expect(isValidIANATimezone('Invalid/Not_A_Timezone')).toBe(false);
      expect(isValidIANATimezone('')).toBe(false);
      expect(isValidIANATimezone(null as any)).toBe(false);
      expect(isValidIANATimezone(undefined as any)).toBe(false);
    });

    it('handles calendar dates around UTC midnight without accidental UTC conversion skew', () => {
      // Scenario A: 23:30 UTC on Nov 3 is 05:00 AM Nov 4 in Asia/Kolkata (UTC+5:30)
      const lateUtc = new Date('2026-11-03T23:30:00Z');
      const kolkataDate = getCalendarDateInTimezone(lateUtc, 'Asia/Kolkata');
      expect(kolkataDate).toBe('2026-11-04');

      // Scenario B: 00:30 UTC on Nov 4 is 19:30 PM Nov 3 in America/New_York (UTC-5)
      const earlyUtc = new Date('2026-11-04T00:30:00Z');
      const newYorkDate = getCalendarDateInTimezone(earlyUtc, 'America/New_York');
      expect(newYorkDate).toBe('2026-11-03');

      // Scenario C: Fallback to Asia/Kolkata when given an invalid timezone string
      const fallbackDate = getCalendarDateInTimezone(lateUtc, 'Invalid/Timezone');
      expect(fallbackDate).toBe('2026-11-04');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Completed-Duration Accounting & Budget Reduction
  // ---------------------------------------------------------------------------
  describe('3. Budget Accounting, Repeated Replanning & Budget Reduction', () => {
    it('preserves completed items duration on replan and does not repeatedly grant a fresh budget', async () => {
      const budgetUser = `budget_learner_${Date.now()}`;
      const planDate = '2026-11-10';

      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, ?, 'PDF', 'Operating Systems', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_budget_1_${Date.now()}`,
        budgetUser,
        'Process Synchronization'
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, ?, 'PDF', 'Operating Systems', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_budget_2_${Date.now()}`,
        budgetUser,
        'Virtual Memory Paging'
      );

      // 1. Initial plan with target budget = 60 mins
      const plan1 = await generatePersonalizedDailyPlan({
        userId: budgetUser,
        targetMinutes: 60,
        referenceDate: planDate,
      });

      expect(plan1.totalPlannedMinutes).toBeLessThanOrEqual(60);
      expect(plan1.items.length).toBeGreaterThanOrEqual(2);

      // 2. Learner completes the first 20m task
      const firstItem = plan1.items[0];
      await updatePlanItemStatus(firstItem.id, budgetUser, 'completed');

      // 3. Learner requests replanning on the same day with 60m budget
      const replan = await generatePersonalizedDailyPlan({
        userId: budgetUser,
        targetMinutes: 60,
        forceRegenerate: true,
        referenceDate: planDate,
      });

      // Completed item must be preserved
      const completedItems = replan.items.filter((i) => i.status === 'completed');
      expect(completedItems.length).toBe(1);
      expect(completedItems[0].title).toBe(firstItem.title);

      // Remaining budget allocated to new items must not exceed targetMinutes - completedMinutes
      const newItems = replan.items.filter((i) => i.status === 'pending');
      const newItemsDuration = newItems.reduce((acc, i) => acc + i.estimatedMinutes, 0);
      expect(newItemsDuration).toBeLessThanOrEqual(60 - firstItem.estimatedMinutes);

      // Total planned minutes must still respect the daily budget
      expect(replan.totalPlannedMinutes).toBeLessThanOrEqual(60);
    });

    it('when budget is reduced below time already completed, retains completion history and explains why no further work fits', async () => {
      const reduceUser = `reduce_budget_learner_${Date.now()}`;
      const planDate = '2026-11-12';

      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, ?, 'PDF', 'Operating Systems', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_red_1_${Date.now()}`,
        reduceUser,
        'CPU Scheduling'
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
         VALUES (?, ?, ?, 'PDF', 'Operating Systems', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `res_red_2_${Date.now()}`,
        reduceUser,
        'Deadlock Prevention'
      );

      // 1. Initial plan: 60 mins
      const plan = await generatePersonalizedDailyPlan({
        userId: reduceUser,
        targetMinutes: 60,
        referenceDate: planDate,
      });

      // 2. Complete two items totaling at least 40 minutes
      const item1 = plan.items[0];
      const item2 = plan.items[1];
      await updatePlanItemStatus(item1.id, reduceUser, 'completed');
      await updatePlanItemStatus(item2.id, reduceUser, 'completed');

      const completedDuration = item1.estimatedMinutes + item2.estimatedMinutes;
      expect(completedDuration).toBeGreaterThanOrEqual(30);

      // 3. Learner changes daily budget to 30 mins (less than completed duration!)
      const replan = await generatePersonalizedDailyPlan({
        userId: reduceUser,
        targetMinutes: 30,
        forceRegenerate: true,
        referenceDate: planDate,
      });

      // All completed work must be retained
      expect(replan.items.length).toBe(2);
      expect(replan.items.every((i) => i.status === 'completed')).toBe(true);

      // No new tasks should be scheduled
      expect(replan.items.some((i) => i.status === 'pending')).toBe(false);

      // Total planned duration equals completed duration
      expect(replan.totalPlannedMinutes).toBe(completedDuration);

      // Explanation must clearly state that completed work fulfilled the reduced budget
      expect(replan.summary).toContain('fulfills your updated daily budget of 30m');
      expect(replan.summary).toContain('no additional tasks are scheduled for today');
      expect(replan.isInfeasible).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Recovery Integrity Across Multiple Missed Days
  // ---------------------------------------------------------------------------
  describe('4. Multi-Day Missed Recovery & Lineage Tracking', () => {
    it('reschedules missed tasks across multiple missed days without duplicating the same concept', async () => {
      const multiMissUser = `multi_miss_${Date.now()}`;

      // Insert resources for 4 concepts
      const concepts = ['Process Scheduling', 'Virtual Memory', 'Deadlock Detection', 'File Systems'];
      for (const c of concepts) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO resources (id, userId, title, type, folder, createdAt, updatedAt)
           VALUES (?, ?, ?, 'PDF', 'Operating Systems', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          `res_${c}_${Date.now()}`,
          multiMissUser,
          `${c} Chapter Notes`
        );
      }

      // Day 1 (3 days ago): plan had Process Scheduling and Virtual Memory
      const planDay1 = await generatePersonalizedDailyPlan({
        userId: multiMissUser,
        targetMinutes: 45,
        referenceDate: '2026-11-01',
      });
      expect(planDay1.items.length).toBeGreaterThan(0);

      // Day 2 (2 days ago): plan had Process Scheduling and Deadlock Detection (Process Scheduling repeated)
      const planDay2 = await generatePersonalizedDailyPlan({
        userId: multiMissUser,
        targetMinutes: 45,
        referenceDate: '2026-11-02',
      });
      expect(planDay2.items.length).toBeGreaterThan(0);

      // Day 4: Learner returns after missing Day 1, Day 2, and Day 3
      const recoveryPlan = await generatePersonalizedDailyPlan({
        userId: multiMissUser,
        targetMinutes: 60,
        referenceDate: '2026-11-04',
      });

      expect(recoveryPlan.isRecoveryPlan).toBe(true);

      // Verify that no concept/subtopic appears twice in the recovery plan
      const conceptKeys = recoveryPlan.items.map((i) => `${i.topic.toLowerCase()}:::${(i.subtopic || i.title).toLowerCase()}`);
      const uniqueConceptKeys = new Set(conceptKeys);
      expect(conceptKeys.length).toBe(uniqueConceptKeys.size);

      // Verify historical plans were marked archived so they won't be harvested again
      const activePriorPlans: any[] = await prisma.$queryRawUnsafe(
        "SELECT * FROM study_plans WHERE userId = ? AND planDate < '2026-11-04' AND status = 'active'",
        multiMissUser
      );
      expect(activePriorPlans.length).toBe(0);
    });

    it('completion of a carried task prevents later resurrection from older historical plans', async () => {
      const resurrectUser = `resurrect_test_${Date.now()}`;

      // Day 1: Task for "Cache Locality" is planned and missed
      const planDay1 = await generatePersonalizedDailyPlan({
        userId: resurrectUser,
        targetMinutes: 30,
        referenceDate: '2026-11-01',
      });
      const missedItem = planDay1.items[0];

      // Day 2: Carried over into Day 2's recovery plan
      const planDay2 = await generatePersonalizedDailyPlan({
        userId: resurrectUser,
        targetMinutes: 30,
        referenceDate: '2026-11-02',
      });
      expect(planDay2.isRecoveryPlan).toBe(true);

      // Learner COMPLETES the carried task on Day 2!
      const carriedItem = planDay2.items.find(
        (i) => i.topic === missedItem.topic || i.originItemId === missedItem.id
      );
      expect(carriedItem).toBeDefined();
      await updatePlanItemStatus(carriedItem!.id, resurrectUser, 'completed');

      // Day 3: When generating Day 3 plan, "Cache Locality" must NOT be resurrected as missed!
      const planDay3 = await generatePersonalizedDailyPlan({
        userId: resurrectUser,
        targetMinutes: 30,
        referenceDate: '2026-11-03',
      });

      // The completed concept must not appear as a pending or rescheduled item
      const resurrected = planDay3.items.find(
        (i) => (i.topic === missedItem.topic || i.originItemId === missedItem.id) && i.status === 'pending' && i.reason.includes('Rescheduled')
      );
      expect(resurrected).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Concurrency Safety
  // ---------------------------------------------------------------------------
  describe('5. Concurrency Safety & Mutex Locking', () => {
    it('concurrent generation requests resolve to the exact same plan without duplicate active plans or items', async () => {
      const concurrentUser = `concurrent_student_${Date.now()}`;
      const planDate = '2026-11-15';

      // Launch 5 concurrent generation requests simultaneously
      const promises = [
        generatePersonalizedDailyPlan({ userId: concurrentUser, targetMinutes: 60, referenceDate: planDate }),
        generatePersonalizedDailyPlan({ userId: concurrentUser, targetMinutes: 60, referenceDate: planDate }),
        generatePersonalizedDailyPlan({ userId: concurrentUser, targetMinutes: 60, referenceDate: planDate }),
        generatePersonalizedDailyPlan({ userId: concurrentUser, targetMinutes: 60, referenceDate: planDate }),
        generatePersonalizedDailyPlan({ userId: concurrentUser, targetMinutes: 60, referenceDate: planDate }),
      ];

      const results = await Promise.all(promises);

      // All 5 promises must resolve to the identical plan id
      const planId = results[0].id;
      for (const res of results) {
        expect(res.id).toBe(planId);
      }

      // In the database, exactly ONE active plan must exist
      const activePlans: any[] = await prisma.$queryRawUnsafe(
        "SELECT * FROM study_plans WHERE userId = ? AND planDate = ? AND status = 'active'",
        concurrentUser,
        planDate
      );
      expect(activePlans.length).toBe(1);

      // Exactly the items of that single plan must exist
      const items: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM study_plan_items WHERE planId = ?',
        planId
      );
      expect(items.length).toBe(results[0].items.length);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Preference Persistence & Reload Fidelity
  // ---------------------------------------------------------------------------
  describe('6. Saved Preferences (UI -> API -> DB -> Reload)', () => {
    it('saves user preferences and restores them upon reload and subsequent plan generation', async () => {
      const prefUser = `pref_learner_${Date.now()}`;

      // Save custom preferences
      await saveLearnerPreferences(prefUser, {
        targetMinutes: 45,
        examDate: '2026-12-25',
        timezone: 'Asia/Kolkata',
      });

      // Verify retrieval
      const prefs = await getLearnerPreferences(prefUser);
      expect(prefs.targetMinutes).toBe(45);
      expect(prefs.examDate).toBe('2026-12-25');
      expect(prefs.timezone).toBe('Asia/Kolkata');

      // Generate daily plan without passing targetMinutes or examDate
      const plan = await generatePersonalizedDailyPlan({
        userId: prefUser,
        referenceDate: '2026-11-10',
      });

      // Plan should automatically inherit the saved 45m budget
      expect(plan.targetMinutes).toBe(45);
      expect(plan.totalPlannedMinutes).toBeLessThanOrEqual(45);

      // Feasibility explanation should reflect the saved exam date
      expect(plan.feasibilityExplanation).toContain('remaining day(s)');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Prerequisites & Exam Urgency Feasibility Boundaries
  // ---------------------------------------------------------------------------
  describe('7. Prerequisites & Exam Feasibility Boundaries', () => {
    it('exam urgency cannot bypass DAG prerequisites for locked advanced nodes', async () => {
      const examPrereqUser = `exam_prereq_${Date.now()}`;

      await saveDAG(examPrereqUser, {
        title: 'Algorithms Knowledge Map',
        topic: 'Graph Theory',
        nodes: [
          {
            id: 'node_bfs',
            title: 'Breadth First Search',
            status: 'weak',
            mastery: 0.30,
            prerequisites: [],
          },
          {
            id: 'node_dijkstra',
            title: 'Dijkstras Shortest Path',
            status: 'locked',
            mastery: 0.05,
            prerequisites: ['node_bfs'],
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'node_bfs',
            target: 'node_dijkstra',
          },
        ],
      });

      // Even with an imminent exam (2 days away), locked Dijkstra MUST NOT bypass BFS!
      const imminentExam = '2026-11-05';
      const prioritiesResult = await computeDeterministicPriorities({
        userId: examPrereqUser,
        examDate: imminentExam,
        availableMinutes: 60,
      });

      const bfsPriority = prioritiesResult.priorities.find((p) => p.topic.includes('Breadth First Search'));
      const dijkstraPriority = prioritiesResult.priorities.find((p) => p.topic.includes('Dijkstras Shortest Path'));

      expect(bfsPriority).toBeDefined();
      expect(dijkstraPriority).toBeDefined();

      // BFS must have significantly higher overallScore than locked Dijkstra
      expect(bfsPriority!.overallScore).toBeGreaterThan(dijkstraPriority!.overallScore * 2);
    });

    it('carried-over tasks with unmet prerequisites in DAG are deferred', async () => {
      const carriedPrereqUser = `carried_prereq_${Date.now()}`;

      // Create a DAG where Advanced Deadlocks requires Basic Concurrency
      await saveDAG(carriedPrereqUser, {
        title: 'Concurrency Map',
        topic: 'Operating Systems',
        nodes: [
          {
            id: 'node_concurrency_basics',
            title: 'Basic Concurrency',
            status: 'weak',
            mastery: 0.25,
            prerequisites: [],
          },
          {
            id: 'node_advanced_deadlocks',
            title: 'Advanced Deadlocks',
            status: 'locked',
            mastery: 0.05,
            prerequisites: ['node_concurrency_basics'],
          },
        ],
        edges: [
          {
            id: 'e_conc',
            source: 'node_concurrency_basics',
            target: 'node_advanced_deadlocks',
          },
        ],
      });

      // Seed a missed plan from yesterday containing the locked item
      const missedPlanId = `plan_missed_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO study_plans (id, userId, planDate, title, targetMinutes, status, summary, createdAt, updatedAt)
         VALUES (?, ?, '2026-11-01', 'Missed Plan', 60, 'active', 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        missedPlanId,
        carriedPrereqUser
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO study_plan_items (
          id, planId, userId, priority, priorityScore, topic, subtopic, activityType,
          title, description, estimatedMinutes, reason, expectedOutcome, status, conceptId,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, 1, 0.9, 'Advanced Deadlocks', NULL, 'PRACTICE_ASSESSMENT',
          'Practice Advanced Deadlocks', 'desc', 20, 'Old Reason', 'Outcome', 'pending', 'node_advanced_deadlocks',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `item_locked_${Date.now()}`,
        missedPlanId,
        carriedPrereqUser
      );

      // Generate today's plan
      const plan = await generatePersonalizedDailyPlan({
        userId: carriedPrereqUser,
        targetMinutes: 60,
        referenceDate: '2026-11-02',
      });

      // The carried-over task whose prerequisite was unmet must NOT be scheduled!
      const hasLockedCarried = plan.items.some((i) => i.topic === 'Advanced Deadlocks' && i.reason.includes('Rescheduled'));
      expect(hasLockedCarried).toBe(false);
    });

    it('handles exam day (daysUntilExam === 0) with dedicated rapid review focus', async () => {
      const examDayUser = `exam_day_user_${Date.now()}`;
      const today = '2026-11-03';

      const plan = await generatePersonalizedDailyPlan({
        userId: examDayUser,
        targetMinutes: 60,
        examDate: today, // Exam is today!
        referenceDate: today,
      });

      expect(plan.isInfeasible).toBe(false);
      expect(plan.feasibilityExplanation).toContain('Exam is today!');
      expect(plan.feasibilityExplanation).toContain('rapid review');
    });

    it('handles past exam dates (daysUntilExam < 0) with neutral continuous mastery pace', async () => {
      const pastExamUser = `past_exam_user_${Date.now()}`;
      const today = '2026-11-03';
      const pastExamDate = '2026-10-25'; // Past date

      const plan = await generatePersonalizedDailyPlan({
        userId: pastExamUser,
        targetMinutes: 60,
        examDate: pastExamDate,
        referenceDate: today,
      });

      expect(plan.isInfeasible).toBe(false);
      expect(plan.feasibilityExplanation).toContain('passed');
      expect(plan.feasibilityExplanation).toContain('continuous mastery pacing');
    });

    it('handles empty course catalog with clean workspace onboarding guidance', async () => {
      const emptyUser = `empty_catalog_user_${Date.now()}`;

      const plan = await generatePersonalizedDailyPlan({
        userId: emptyUser,
        targetMinutes: 60,
        referenceDate: '2026-11-03',
      });

      expect(plan.items.length).toBeGreaterThan(0);
      const setupItem = plan.items.find((i) => i.title.includes('Upload Course Material'));
      expect(setupItem).toBeDefined();
      expect(setupItem!.reason).toContain('No course resources found in your workspace');
    });

    it('sanitizes invalid daily budgets (<= 0 or NaN) to safe positive defaults', async () => {
      const invalidBudgetUser = `invalid_budget_user_${Date.now()}`;

      const planZero = await generatePersonalizedDailyPlan({
        userId: invalidBudgetUser,
        targetMinutes: 0,
        referenceDate: '2026-11-03',
      });
      expect(planZero.targetMinutes).toBe(60);

      const planNeg = await generatePersonalizedDailyPlan({
        userId: invalidBudgetUser,
        targetMinutes: -45,
        referenceDate: '2026-11-03',
        forceRegenerate: true,
      });
      expect(planNeg.targetMinutes).toBe(60);

      const planNaN = await generatePersonalizedDailyPlan({
        userId: invalidBudgetUser,
        targetMinutes: NaN as any,
        referenceDate: '2026-11-03',
        forceRegenerate: true,
      });
      expect(planNaN.targetMinutes).toBe(60);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Tenant Isolation & Access Protection
  // ---------------------------------------------------------------------------
  describe('8. Cross-User Access Protection', () => {
    it('prevents learner A from modifying or completing study plan items owned by learner B', async () => {
      const userA = `victim_user_${Date.now()}`;
      const userB = `attacker_user_${Date.now()}`;

      const planA = await generatePersonalizedDailyPlan({
        userId: userA,
        targetMinutes: 60,
        referenceDate: '2026-11-03',
      });
      const itemA = planA.items[0];

      // User B attempts to complete User A's item
      await expect(
        updatePlanItemStatus(itemA.id, userB, 'completed')
      ).rejects.toThrow(/unauthorized/i);

      // Verify itemA is still pending in the database
      const dbItem: any[] = await prisma.$queryRawUnsafe(
        'SELECT status FROM study_plan_items WHERE id = ?',
        itemA.id
      );
      expect(dbItem[0].status).toBe('pending');
    });
  });
});
