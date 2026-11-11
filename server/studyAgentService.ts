import {
  prisma,
  ensureStudyPlanSchema,
  ensureLearnerSchema,
  ensureResourceSchema,
  ensureAssessmentSchema,
  ensureDAGSchema,
  ensureLearnerPreferencesSchema,
} from './prisma.ts';
import { getAllLearnerMastery, getLearnerEventHistory, logLearnerEvent, type MasteryStatus } from './bktService.ts';
import { evaluateAdaptiveRecommendations } from './adaptiveRecommendationService.ts';
import type { RecommendationCategory } from './learnerTypes.ts';
import { getUserDAGs } from './dagService.ts';
import { normalizeConceptString } from './learnerEvidenceService.ts';

export function isValidIANATimezone(tz?: string | null): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getCalendarDateInTimezone(date: Date = new Date(), timezone: string = 'Asia/Kolkata'): string {
  const validTz = isValidIANATimezone(timezone) ? timezone : 'Asia/Kolkata';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export interface LearnerPreferences {
  userId: string;
  targetMinutes: number;
  examDate: string | null;
  timezone: string;
}

export async function getLearnerPreferences(userId: string): Promise<LearnerPreferences> {
  await ensureLearnerPreferencesSchema();
  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM learner_preferences WHERE userId = ? LIMIT 1',
    userId
  );
  if (rows && rows.length > 0) {
    const r = rows[0];
    return {
      userId: r.userId,
      targetMinutes: Number(r.targetMinutes) || 60,
      examDate: r.examDate || null,
      timezone: isValidIANATimezone(r.timezone) ? r.timezone : 'Asia/Kolkata',
    };
  }
  return {
    userId,
    targetMinutes: 60,
    examDate: null,
    timezone: 'Asia/Kolkata',
  };
}

export async function saveLearnerPreferences(
  userId: string,
  prefs: Partial<LearnerPreferences>
): Promise<LearnerPreferences> {
  await ensureLearnerPreferencesSchema();
  const current = await getLearnerPreferences(userId);
  const targetMinutes =
    prefs.targetMinutes !== undefined && !isNaN(Number(prefs.targetMinutes)) && Number(prefs.targetMinutes) > 0
      ? Math.max(15, Math.min(480, Math.round(Number(prefs.targetMinutes))))
      : current.targetMinutes;
  const examDate =
    prefs.examDate !== undefined
      ? (prefs.examDate && /^\d{4}-\d{2}-\d{2}$/.test(prefs.examDate) ? prefs.examDate : null)
      : current.examDate;
  const timezone =
    prefs.timezone !== undefined && isValidIANATimezone(prefs.timezone)
      ? prefs.timezone
      : current.timezone;

  const nowStr = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO learner_preferences (userId, targetMinutes, examDate, timezone, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET
       targetMinutes = excluded.targetMinutes,
       examDate = excluded.examDate,
       timezone = excluded.timezone,
       updatedAt = excluded.updatedAt`,
    userId,
    targetMinutes,
    examDate,
    timezone,
    nowStr,
    nowStr
  );

  return {
    userId,
    targetMinutes,
    examDate,
    timezone,
  };
}

export type ActivityType =
  | 'REVIEW_SOURCE'
  | 'PRACTICE_ASSESSMENT'
  | 'REVISE_FLASHCARDS'
  | 'PRACTICE_WEAK_CONCEPTS'
  | 'ASK_TUTOR'
  | 'DIAGNOSTIC_ASSESSMENT'
  | 'COMPLETE_UNFINISHED_TASK'
  | 'RESOLVE_MISCONCEPTION';

export type PlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';

export type ActionLifecycleState = 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'BLOCKED';

export interface PriorityScoreBreakdown {
  topic: string;
  subtopic: string | null;
  overallScore: number;
  factors: {
    masteryDeficit: number;     // Weight: 0.35
    confidenceDeficit: number;  // Weight: 0.20
    recentMistakes: number;     // Weight: 0.20
    examUrgency: number;        // Weight: 0.15
    recencyForgetting: number;  // Weight: 0.10
  };
  details: {
    attempts: number;
    currentMastery: number;
    status: MasteryStatus;
    confidence: number;
    recentIncorrectCount: number;
    daysSinceLastAssessed: number | null;
    daysUntilExam: number | null;
    activeMisconceptionsCount?: number;
    hasRepeatedMistakes?: boolean;
    misconceptionConcepts?: string[];
  };
}

export interface StudyPlanRecommendation {
  priority: number;
  priorityScore: number;
  topic: string;
  subtopic: string | null;
  activityType: ActivityType;
  title: string;
  description: string;
  estimatedMinutes: number;
  reason: string; // "Why this?"
  expectedOutcome: string;
  sourceId: string | null;
  chunkId: string | null;
  sourceTitle: string | null;
  sourceCoordinate: string | null;
  conceptId?: string | null;
  category?: RecommendationCategory;
  questionId?: string | null;
  originItemId?: string | null;
  rescheduledFromId?: string | null;
}

export interface DailyStudyPlanResult {
  id: string;
  userId: string;
  planDate: string;
  title: string;
  targetMinutes: number;
  totalPlannedMinutes: number;
  status: string;
  summary: string;
  isColdStart: boolean;
  isRecoveryPlan?: boolean;
  missedTasksCount?: number;
  isInfeasible?: boolean;
  paceWarning?: string | null;
  feasibilityExplanation?: string | null;
  items: Array<StudyPlanRecommendation & { id: string; status: PlanItemStatus; completedAt: string | null }>;
}

export interface StudyAction {
  id: string;
  planId: string;
  userId: string;
  priority: number;
  priorityScore: number;
  topic: string;
  subtopic: string | null;
  conceptId: string | null;
  category: RecommendationCategory;
  activityType: ActivityType;
  title: string;
  description: string;
  estimatedMinutes: number;
  reason: string;
  expectedOutcome: string;
  sourceId: string | null;
  chunkId: string | null;
  sourceTitle: string | null;
  sourceCoordinate: string | null;
  questionId: string | null;
  status: PlanItemStatus;
  completedAt: string | null;
}

export interface NextStudyActionResult {
  success: boolean;
  action: StudyAction | null;
  lifecycleState: ActionLifecycleState;
  isColdStart: boolean;
  explanation?: string;
  generatedAt: string;
}

/**
 * 1. Deterministic Priority Engine (BEFORE LLM generation)
 * Computes deterministic multi-factor priority scores without hallucinations.
 */
export async function computeDeterministicPriorities(params: {
  userId: string;
  examDate?: string | null;
  availableMinutes?: number;
}): Promise<{
  priorities: PriorityScoreBreakdown[];
  isColdStart: boolean;
  weakTopics: PriorityScoreBreakdown[];
}> {
  await ensureLearnerSchema();
  await ensureResourceSchema();

  const userId = params.userId;
  const examDate = params.examDate ? new Date(params.examDate) : null;
  const now = new Date();

  // Days until exam
  let daysUntilExam: number | null = null;
  let examUrgencyScore = 0.2; // default neutral
  if (examDate && !isNaN(examDate.getTime())) {
    const diffTime = examDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysUntilExam = diffDays;
    if (diffDays < 0) examUrgencyScore = 0.0; // Exam has passed
    else if (diffDays === 0) examUrgencyScore = 1.0; // Exam is today
    else if (diffDays <= 3) examUrgencyScore = 1.0;
    else if (diffDays <= 7) examUrgencyScore = 0.85;
    else if (diffDays <= 14) examUrgencyScore = 0.60;
    else if (diffDays <= 30) examUrgencyScore = 0.40;
    else examUrgencyScore = 0.25;
  }

  // 1. Fetch learner mastery records
  const masteryRecords: any[] = await getAllLearnerMastery(userId);

  // 2. Fetch recent learner events (for mistake recency)
  const recentEvents: any[] = await getLearnerEventHistory(userId, 50);

  // 3. Fetch available uploaded resources for topic coverage strictly scoped to user
  const resources: any[] = await prisma.$queryRawUnsafe(
    userId === 'default_user'
      ? "SELECT * FROM resources WHERE userId = 'default_user' ORDER BY createdAt DESC"
      : "SELECT * FROM resources WHERE userId = ? ORDER BY createdAt DESC",
    ...(userId === 'default_user' ? [] : [userId])
  );

  // 4. Fetch persistent misconceptions and repeated mistakes (Phase 9)
  let userMisconceptions: any[] = [];
  try {
    userMisconceptions = await prisma.$queryRawUnsafe(
      'SELECT topic, subtopic, concept, severity FROM assessment_misconceptions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
      userId
    );
  } catch {
    userMisconceptions = [];
  }

  // 5. Fetch User DAGs for topic discovery and Prerequisite Gating
  let userDAGs: any[] = [];
  try {
    userDAGs = await getUserDAGs(userId);
  } catch {
    userDAGs = [];
  }
  const dagNodeMap = new Map<string, { id?: string; title: string; status: string; prerequisites: string[]; mastery?: number }>();
  userDAGs.forEach((dag) => {
    (dag.nodes || []).forEach((node: any) => {
      const nodeTitle = node.title || node.name;
      if (nodeTitle) {
        dagNodeMap.set(normalizeConceptString(nodeTitle), {
          id: node.id,
          title: nodeTitle,
          status: node.status || 'available',
          prerequisites: node.prerequisites || [],
          mastery: node.mastery,
        });
      }
    });
  });

  // Collect distinct topics from mastery, resources, and user DAG nodes
  const topicMap = new Map<string, { topic: string; subtopic: string | null; source?: any }>();

  masteryRecords.forEach((m) => {
    const key = `${m.topic}:::${m.subtopic || ''}`;
    topicMap.set(key, { topic: m.topic, subtopic: m.subtopic || null });
  });

  resources.forEach((r) => {
    // If resource has title/topic
    const t = r.folder || r.title || 'Course Material';
    const key = `${t}:::`;
    if (!topicMap.has(key)) {
      topicMap.set(key, { topic: t, subtopic: null, source: r });
    }
  });

  userDAGs.forEach((dag) => {
    (dag.nodes || []).forEach((node: any) => {
      const nodeTitle = node.title || node.name;
      if (nodeTitle) {
        const key = `${nodeTitle}:::`;
        if (!topicMap.has(key)) {
          topicMap.set(key, { topic: nodeTitle, subtopic: null });
        }
      }
    });
  });

  const assessedCount = masteryRecords.filter((m) => m.attempts > 0).length;
  const isColdStart = assessedCount === 0;

  const priorities: PriorityScoreBreakdown[] = [];

  for (const [key, item] of topicMap.entries()) {
    const mastery = masteryRecords.find(
      (m) => m.topic === item.topic && (item.subtopic ? m.subtopic === item.subtopic : true)
    );

    const attempts = mastery?.attempts || 0;
    const currentMastery = mastery?.masteryProbability || 0.0;
    const confidence = mastery?.confidence || 0.0;
    const status: MasteryStatus = mastery?.status || 'unassessed';

    // Factor 1: Mastery Deficit (Weight: 0.35)
    // Low mastery or unassessed gives high deficit
    const masteryDeficit = attempts === 0 ? 0.85 : Math.max(0.05, 1.0 - currentMastery);

    // Factor 2: Confidence Deficit (Weight: 0.20)
    const confidenceDeficit = attempts === 0 ? 1.0 : Math.max(0.05, 1.0 - confidence);

    // Factor 3: Recent Incorrect Answers (Weight: 0.20)
    const recentTopicMistakes = recentEvents.filter(
      (e) => e.topic === item.topic && e.isCorrect === false
    ).length;
    const recentMistakes = Math.min(1.0, recentTopicMistakes * 0.35);

    // Factor 4: Exam Urgency (Weight: 0.15)
    const examUrgency = examUrgencyScore;

    // Factor 5: Recency / Forgetting Risk (Weight: 0.10)
    let daysSinceLastAssessed: number | null = null;
    let recencyForgetting = 0.5; // neutral for unassessed
    if (mastery?.lastAssessedAt) {
      const lastAssessed = new Date(mastery.lastAssessedAt);
      const diffDays = Math.max(0, Math.ceil((now.getTime() - lastAssessed.getTime()) / (1000 * 60 * 60 * 24)));
      daysSinceLastAssessed = diffDays;
      recencyForgetting = Math.min(1.0, diffDays / 14.0); // gradual decay over 14 days
    }

    // Phase 9: Count active misconceptions and detect repeated mistakes for this topic
    const topicMisconceptions = userMisconceptions.filter(
      (m) =>
        m.topic?.toLowerCase() === item.topic.toLowerCase() ||
        (item.subtopic && m.subtopic && m.subtopic.toLowerCase() === item.subtopic.toLowerCase())
    );
    const conceptCounts = new Map<string, number>();
    for (const m of topicMisconceptions) {
      const c = m.concept || m.topic;
      conceptCounts.set(c, (conceptCounts.get(c) || 0) + 1);
    }
    const hasRepeated = Array.from(conceptCounts.values()).some((cnt) => cnt > 1);
    const activeMisconceptionsCount = topicMisconceptions.length;

    // Weighted Deterministic Multi-Factor Priority Score
    let overallScore =
      0.35 * masteryDeficit +
      0.20 * confidenceDeficit +
      0.20 * recentMistakes +
      0.15 * examUrgency +
      0.10 * recencyForgetting;

    // Phase 9 Priority Boost: detected misconceptions & repeated mistakes increase topic study urgency
    if (activeMisconceptionsCount > 0) {
      const boost = Math.min(0.25, activeMisconceptionsCount * 0.08 + (hasRepeated ? 0.12 : 0));
      overallScore = Math.min(1.0, overallScore + boost);
    }

    // DAG Prerequisite Gating: If explicit prerequisite is unmet in DAG, deprioritize
    const dagNode = dagNodeMap.get(normalizeConceptString(item.topic)) || (item.subtopic ? dagNodeMap.get(normalizeConceptString(item.subtopic)) : undefined);
    if (dagNode) {
      if (dagNode.status === 'locked' || dagNode.status === 'unmet') {
        overallScore *= 0.10;
      } else if (dagNode.prerequisites && dagNode.prerequisites.length > 0) {
        let hasUnmet = false;
        for (const pre of dagNode.prerequisites) {
          const preNode = Array.from(dagNodeMap.values()).find(
            (n) => n.id === pre || normalizeConceptString(n.title) === normalizeConceptString(pre)
          );
          if (preNode && (preNode.status === 'locked' || preNode.status === 'weak' || (preNode.mastery ?? 0) < 0.60)) {
            hasUnmet = true;
            break;
          }
        }
        if (hasUnmet) overallScore *= 0.10;
      }
    }

    priorities.push({
      topic: item.topic,
      subtopic: item.subtopic,
      overallScore: Math.round(overallScore * 1000) / 1000,
      factors: {
        masteryDeficit: Math.round(masteryDeficit * 100) / 100,
        confidenceDeficit: Math.round(confidenceDeficit * 100) / 100,
        recentMistakes: Math.round(recentMistakes * 100) / 100,
        examUrgency: Math.round(examUrgency * 100) / 100,
        recencyForgetting: Math.round(recencyForgetting * 100) / 100,
      },
      details: {
        attempts,
        currentMastery,
        status,
        confidence,
        recentIncorrectCount: recentTopicMistakes,
        daysSinceLastAssessed,
        daysUntilExam,
        activeMisconceptionsCount,
        hasRepeatedMistakes: hasRepeated,
        misconceptionConcepts: Array.from(conceptCounts.keys()),
      },
    });
  }

  // Sort descending by priority score
  priorities.sort((a, b) => b.overallScore - a.overallScore);

  const weakTopics = priorities.filter(
    (p) => p.details.attempts > 0 && (p.details.status === 'developing' || p.details.currentMastery < 0.60)
  );

  return {
    priorities,
    isColdStart,
    weakTopics,
  };
}

const activePlanGenerationLocks = new Map<string, Promise<DailyStudyPlanResult>>();

/**
 * 2. Generate Personalized Daily Study Plan
 * Connects deterministic priority scores with real grounded course evidence.
 */
export async function generateAdaptiveDailyPlan(userId: string): Promise<DailyStudyPlanResult> {
  return generatePersonalizedDailyPlan({ userId });
}

export async function generatePersonalizedDailyPlan(params: {
  userId: string;
  targetMinutes?: number;
  examDate?: string | null;
  forceRegenerate?: boolean;
  referenceDate?: string;
  timezone?: string;
  timezoneOffsetMinutes?: number;
  allowClockOverride?: boolean;
}): Promise<DailyStudyPlanResult> {
  await ensureStudyPlanSchema();
  await ensureResourceSchema();
  await ensureLearnerSchema();
  await ensureDAGSchema();
  await ensureLearnerPreferencesSchema();

  const userId = params.userId;

  // 1. Resolve Learner Preferences
  const userPrefs = await getLearnerPreferences(userId);
  const userTimezone = (params.timezone && isValidIANATimezone(params.timezone))
    ? params.timezone
    : userPrefs.timezone;

  // 2. Production Clock Boundary:
  // Trusted server clock is enforced. Client-supplied referenceDate is only honored in test environment
  // or when explicitly authorized via allowClockOverride.
  const isTestEnv = process.env.NODE_ENV === 'test';
  let planDate: string;
  if ((isTestEnv || params.allowClockOverride) && params.referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(params.referenceDate)) {
    planDate = params.referenceDate;
  } else if ((isTestEnv || params.allowClockOverride) && params.timezoneOffsetMinutes !== undefined) {
    const localMs = Date.now() - params.timezoneOffsetMinutes * 60000;
    planDate = new Date(localMs).toISOString().split('T')[0];
  } else {
    // Trusted server clock + validated learner IANA timezone (no accidental UTC skew)
    planDate = getCalendarDateInTimezone(new Date(), userTimezone);
  }

  // 3. Concurrency Lock: Prevent duplicate active plans/items under concurrent requests
  const lockKey = `${userId}:::${planDate}`;
  const existingLock = activePlanGenerationLocks.get(lockKey);
  if (existingLock) {
    return existingLock;
  }

  const generationPromise = (async () => {
    try {
      return await executePlanGeneration(params, planDate, userPrefs, userTimezone);
    } finally {
      activePlanGenerationLocks.delete(lockKey);
    }
  })();

  activePlanGenerationLocks.set(lockKey, generationPromise);
  return generationPromise;
}

async function executePlanGeneration(
  params: {
    userId: string;
    targetMinutes?: number;
    examDate?: string | null;
    forceRegenerate?: boolean;
    referenceDate?: string;
    timezone?: string;
    timezoneOffsetMinutes?: number;
    allowClockOverride?: boolean;
  },
  planDate: string,
  userPrefs: LearnerPreferences,
  userTimezone: string
): Promise<DailyStudyPlanResult> {
  const userId = params.userId;

  // Sanitize Daily Budget (Target Minutes represents the ENTIRE day's budget)
  const rawBudget = params.targetMinutes !== undefined ? Number(params.targetMinutes) : userPrefs.targetMinutes;
  const targetMinutes = (!rawBudget || isNaN(rawBudget) || rawBudget <= 0)
    ? 60
    : Math.max(15, Math.min(480, Math.round(rawBudget)));

  // Exam Date resolution
  const examDate = params.examDate !== undefined ? (params.examDate || null) : userPrefs.examDate;

  // Auto-persist updated preferences so preferences reload faithfully
  if (params.targetMinutes !== undefined || params.examDate !== undefined || params.timezone !== undefined) {
    await saveLearnerPreferences(userId, {
      targetMinutes,
      examDate: examDate || null,
      timezone: userTimezone,
    });
  }

  // 1. Check if active plan exists for today
  let completedItemsToday: Array<StudyPlanRecommendation & { id: string; status: PlanItemStatus; completedAt: string | null; originItemId?: string | null; rescheduledFromId?: string | null }> = [];
  const existingTodayPlan = await getTodayStudyPlan(userId, planDate, { allowClockOverride: true });

  if (existingTodayPlan) {
    if (!params.forceRegenerate) {
      return existingTodayPlan;
    }
    // If replanning today, PRESERVE already completed tasks so learner progress is never lost!
    completedItemsToday = (existingTodayPlan.items || []).filter((i) => i.status === 'completed');
    // Archive previous version of today's plan
    await prisma.$executeRawUnsafe(
      "UPDATE study_plans SET status = 'archived', updatedAt = ? WHERE id = ?",
      new Date().toISOString(),
      existingTodayPlan.id
    );
  }

  // 2. Query historical completed items to prevent resurrection of tasks whose replacements were finished
  const userCompletedRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT topic, subtopic, conceptId, originItemId, rescheduledFromId, questionId
     FROM study_plan_items
     WHERE userId = ? AND status = 'completed'`,
    userId
  );
  const completedConceptKeys = new Set<string>();
  const completedOriginIds = new Set<string>();
  for (const c of userCompletedRows) {
    completedConceptKeys.add(`${(c.topic || '').toLowerCase()}:::${(c.subtopic || '').toLowerCase()}`);
    if (c.conceptId) completedConceptKeys.add(c.conceptId.toLowerCase());
    if (c.originItemId) completedOriginIds.add(c.originItemId);
    if (c.rescheduledFromId) completedOriginIds.add(c.rescheduledFromId);
  }
  for (const c of completedItemsToday) {
    completedConceptKeys.add(`${(c.topic || '').toLowerCase()}:::${(c.subtopic || '').toLowerCase()}`);
    if (c.conceptId) completedConceptKeys.add(c.conceptId.toLowerCase());
    if (c.originItemId) completedOriginIds.add(c.originItemId);
  }

  // 3. Budget Accounting:
  // targetMinutes represents the ENTIRE DAY'S budget.
  // Completed duration is subtracted so repeated replanning never grants a fresh budget!
  const completedMinutesToday = completedItemsToday.reduce((acc, i) => acc + i.estimatedMinutes, 0);
  let remainingTime = Math.max(0, targetMinutes - completedMinutesToday);

  // If budget was reduced below time already completed:
  // Retain completion history and explain why no further work fits.
  if (remainingTime <= 0 && completedItemsToday.length > 0) {
    const summaryText = `You have already completed ${completedMinutesToday}m of study today, which fulfills your updated daily budget of ${targetMinutes}m. Completed tasks have been retained, and no additional tasks are scheduled for today. Great job exceeding your goal!`;
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const planTitle = `Personalized Mastery Plan for ${planDate}`;
    const summaryEnvelope = JSON.stringify({
      text: summaryText,
      isRecoveryPlan: false,
      missedTasksCount: 0,
      isInfeasible: false,
      paceWarning: null,
      feasibilityExplanation: summaryText,
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO study_plans (id, userId, planDate, title, targetMinutes, status, summary, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
      planId,
      userId,
      planDate,
      planTitle,
      targetMinutes,
      summaryEnvelope,
      new Date().toISOString(),
      new Date().toISOString()
    );

    const savedCompletedItems: any[] = [];
    for (const comp of completedItemsToday) {
      const compItemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowStr = new Date().toISOString();
      await prisma.$executeRawUnsafe(
        `INSERT INTO study_plan_items (
          id, planId, userId, priority, priorityScore, topic, subtopic, activityType,
          title, description, estimatedMinutes, reason, expectedOutcome,
          sourceId, chunkId, sourceTitle, sourceCoordinate, status,
          conceptId, category, questionId, originItemId, rescheduledFromId,
          completedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)`,
        compItemId,
        planId,
        userId,
        comp.priority,
        comp.priorityScore,
        comp.topic,
        comp.subtopic || null,
        comp.activityType,
        comp.title,
        comp.description,
        comp.estimatedMinutes,
        comp.reason,
        comp.expectedOutcome,
        comp.sourceId || null,
        comp.chunkId || null,
        comp.sourceTitle || null,
        comp.sourceCoordinate || null,
        comp.conceptId || null,
        comp.category || null,
        comp.questionId || null,
        comp.originItemId || comp.id,
        comp.rescheduledFromId || null,
        comp.completedAt || nowStr,
        nowStr,
        nowStr
      );
      savedCompletedItems.push({
        ...comp,
        id: compItemId,
        status: 'completed',
      });
    }

    return {
      id: planId,
      userId,
      planDate,
      title: planTitle,
      targetMinutes,
      totalPlannedMinutes: completedMinutesToday,
      status: 'completed',
      summary: summaryText,
      isColdStart: false,
      isRecoveryPlan: false,
      missedTasksCount: 0,
      isInfeasible: false,
      paceWarning: null,
      feasibilityExplanation: summaryText,
      items: savedCompletedItems,
    };
  }

  // 4. DAG Prerequisite Map: Ensure carried-over tasks respect prerequisite eligibility
  const userDAGs = await getUserDAGs(userId);
  const dagNodeMap = new Map<string, any>();
  for (const dag of userDAGs) {
    for (const node of dag.nodes) {
      dagNodeMap.set(node.id, node);
      dagNodeMap.set(normalizeConceptString(node.title), node);
    }
  }

  // 5. Inspect previous plans for missed days / incomplete backlog across multiple missed days
  const priorPlans: any[] = await prisma.$queryRawUnsafe(
    "SELECT * FROM study_plans WHERE userId = ? AND planDate < ? AND status != 'archived' ORDER BY planDate DESC, createdAt DESC LIMIT 14",
    userId,
    planDate
  );

  const missedTasksToReschedule: any[] = [];
  const seenMissedKeys = new Set<string>();
  const plansToArchive: string[] = [];

  for (const prior of priorPlans) {
    plansToArchive.push(prior.id);

    const priorItems: any[] = await prisma.$queryRawUnsafe(
      "SELECT * FROM study_plan_items WHERE planId = ? AND (status = 'pending' OR status = 'in_progress') ORDER BY priority ASC",
      prior.id
    );

    for (const item of priorItems) {
      const conceptKey = `${(item.topic || '').toLowerCase()}:::${(item.subtopic || '').toLowerCase()}`;
      const originKey = item.originItemId || item.id;

      // Deduplicate across several historical plans containing the same concept
      if (seenMissedKeys.has(conceptKey) || seenMissedKeys.has(originKey)) {
        continue;
      }

      // RESURRECTION CHECK: Ensure a task is not resurrected after it or its replacement was completed
      if (
        completedConceptKeys.has(conceptKey) ||
        (item.conceptId && completedConceptKeys.has(item.conceptId.toLowerCase())) ||
        completedOriginIds.has(originKey) ||
        completedOriginIds.has(item.id)
      ) {
        continue;
      }

      // PREREQUISITE CHECK: Carried-over tasks must respect prerequisite eligibility
      const dagNode = dagNodeMap.get(item.conceptId) || dagNodeMap.get(normalizeConceptString(item.topic));
      if (dagNode) {
        const isLocked = dagNode.status === 'locked' || dagNode.status === 'unmet';
        let hasUnmetPrereq = false;
        if (dagNode.prerequisites && dagNode.prerequisites.length > 0) {
          for (const pre of dagNode.prerequisites) {
            const preNode = Array.from(dagNodeMap.values()).find(
              (n) => n.id === pre || normalizeConceptString(n.title) === normalizeConceptString(pre)
            );
            if (preNode && (preNode.status === 'locked' || preNode.status === 'weak' || (preNode.mastery ?? 0) < 0.60)) {
              hasUnmetPrereq = true;
              break;
            }
          }
        }
        if (isLocked || hasUnmetPrereq) {
          // Defer carried-over task whose prerequisite is not met
          continue;
        }
      }

      seenMissedKeys.add(conceptKey);
      seenMissedKeys.add(originKey);
      missedTasksToReschedule.push({
        ...item,
        missedPlanDate: prior.planDate,
      });
    }
  }

  // Archive harvested historical plans so they are not processed repeatedly
  for (const pId of plansToArchive) {
    await prisma.$executeRawUnsafe(
      "UPDATE study_plans SET status = 'archived', updatedAt = ? WHERE id = ?",
      new Date().toISOString(),
      pId
    );
  }
  // Mark harvested items as rescheduled
  for (const m of missedTasksToReschedule) {
    await prisma.$executeRawUnsafe(
      "UPDATE study_plan_items SET status = 'rescheduled', updatedAt = ? WHERE id = ?",
      new Date().toISOString(),
      m.id
    );
  }

  let priorityRank = 1;
  let rescheduledCount = 0;
  const scheduledConceptKeys = new Set<string>();
  const recommendedItems: StudyPlanRecommendation[] = [];

  // Register concepts already completed today
  completedItemsToday.forEach((c) => {
    scheduledConceptKeys.add(`${c.topic.toLowerCase()}:::${(c.subtopic || '').toLowerCase()}`);
    if (c.conceptId) scheduledConceptKeys.add(c.conceptId.toLowerCase());
  });

  // 6. Reschedule missed tasks from prior session (lineage tracking + prerequisite compliance)
  for (const missed of missedTasksToReschedule) {
    const key = `${missed.topic.toLowerCase()}:::${(missed.subtopic || '').toLowerCase()}`;
    if (scheduledConceptKeys.has(key)) continue;
    if (remainingTime < 15 && recommendedItems.length > 0) break;

    const estTime = Math.min(missed.estimatedMinutes || 20, Math.max(15, remainingTime));
    const reasonText = missed.missedPlanDate
      ? `Rescheduled from missed session on ${missed.missedPlanDate}: ${missed.reason}`
      : `Rescheduled from missed session: ${missed.reason}`;

    recommendedItems.push({
      priority: priorityRank++,
      priorityScore: Math.min(1.0, Number(missed.priorityScore || 0.7) + 0.15),
      topic: missed.topic,
      subtopic: missed.subtopic || null,
      conceptId: missed.conceptId || null,
      category: (missed.category as RecommendationCategory) || 'PRACTICE_CONCEPT',
      activityType: missed.activityType as ActivityType,
      title: missed.title,
      description: missed.description,
      estimatedMinutes: estTime,
      reason: reasonText,
      expectedOutcome: missed.expectedOutcome,
      sourceId: missed.sourceId || null,
      chunkId: missed.chunkId || null,
      sourceTitle: missed.sourceTitle || null,
      sourceCoordinate: missed.sourceCoordinate || null,
      questionId: missed.questionId || null,
      originItemId: missed.originItemId || missed.id,
      rescheduledFromId: missed.id,
    });

    scheduledConceptKeys.add(key);
    if (missed.conceptId) scheduledConceptKeys.add(missed.conceptId.toLowerCase());
    remainingTime -= estTime;
    rescheduledCount++;
  }

  // 7. Authoritative Phase 5 Step 3 Adaptive Recommendations for remaining time
  let isColdStart = false;
  const resources: any[] = await prisma.$queryRawUnsafe(
    userId === 'default_user'
      ? "SELECT * FROM resources WHERE userId = 'default_user' ORDER BY createdAt DESC LIMIT 10"
      : "SELECT * FROM resources WHERE userId = ? ORDER BY createdAt DESC LIMIT 10",
    ...(userId === 'default_user' ? [] : [userId])
  );

  let userMisconceptions: any[] = [];
  try {
    userMisconceptions = await prisma.$queryRawUnsafe(
      'SELECT topic, subtopic, concept, severity FROM assessment_misconceptions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
      userId
    );
  } catch {
    userMisconceptions = [];
  }

  if (remainingTime >= 15) {
    const adaptiveRecs = await evaluateAdaptiveRecommendations(userId, {
      limit: 10,
      now: planDate,
      examDate,
    });
    isColdStart = adaptiveRecs.is_cold_start;

    if (adaptiveRecs.recommendations.length > 0) {
      for (const rec of adaptiveRecs.recommendations) {
        if (remainingTime < 15 && (recommendedItems.length > 0 || completedItemsToday.length > 0)) break;

        const key = `${rec.topic.toLowerCase()}:::${(rec.subtopic || '').toLowerCase()}`;
        if (scheduledConceptKeys.has(key)) continue;
        if (rec.concept_id && scheduledConceptKeys.has(rec.concept_id.toLowerCase())) continue;

        const matchingHighSeverityMisconception = userMisconceptions.find(
          (m) =>
            (m.topic?.toLowerCase() === rec.topic.toLowerCase() ||
              (m.concept && m.concept.toLowerCase() === rec.concept_name.toLowerCase())) &&
            (m.severity === 'high' || m.severity === 'critical')
        );
        const isMisconception = rec.category === 'ADDRESS_MISCONCEPTION' || Boolean(matchingHighSeverityMisconception);
        const effectiveCategory: RecommendationCategory = isMisconception ? 'ADDRESS_MISCONCEPTION' : rec.category;

        // Activity mapping from Canonical Category
        let activityType: ActivityType = 'PRACTICE_ASSESSMENT';
        if (effectiveCategory === 'ADDRESS_MISCONCEPTION') {
          activityType = 'RESOLVE_MISCONCEPTION';
        } else if (effectiveCategory === 'REVIEW_CONCEPT') {
          activityType = rec.recommended_resource ? 'REVIEW_SOURCE' : 'PRACTICE_ASSESSMENT';
        } else if (effectiveCategory === 'PRACTICE_CONCEPT') {
          activityType = 'PRACTICE_WEAK_CONCEPTS';
        } else if (effectiveCategory === 'LEARN_CONCEPT') {
          activityType = isColdStart ? 'DIAGNOSTIC_ASSESSMENT' : 'PRACTICE_ASSESSMENT';
        } else if (effectiveCategory === 'CONSOLIDATE_MASTERY') {
          activityType = 'PRACTICE_ASSESSMENT';
        }

        let title = `Practice ${rec.concept_name}`;
        let expectedOutcome = `Reinforce retrieval and demonstrate stable mastery in ${rec.concept_name}.`;

        if (effectiveCategory === 'ADDRESS_MISCONCEPTION') {
          const topConcept = matchingHighSeverityMisconception?.concept || rec.concept_name;
          title = `Resolve Misconception: ${topConcept}`;
          expectedOutcome = `Eliminate misconception and raise concept mastery toward proficiency (≥60%).`;
        } else if (effectiveCategory === 'REVIEW_CONCEPT') {
          title = `Review Concept: ${rec.concept_name}`;
          expectedOutcome = `Counteract retention decay and refresh knowledge through grounded source review.`;
        } else if (effectiveCategory === 'LEARN_CONCEPT') {
          title = isColdStart ? `Diagnostic Knowledge Check: ${rec.concept_name}` : `Learn Foundational Concept: ${rec.concept_name}`;
          expectedOutcome = isColdStart
            ? `Calibrate initial BKT mastery state and identify baseline strengths.`
            : `Establish conceptual foundations through verified study.`;
        } else if (effectiveCategory === 'CONSOLIDATE_MASTERY') {
          title = `Consolidate Mastery: ${rec.concept_name}`;
          expectedOutcome = `Maintain retention stability across extended intervals.`;
        }

        const estTime = Math.min(25, Math.max(15, remainingTime));

        const itemReason = isColdStart && effectiveCategory === 'LEARN_CONCEPT'
          ? 'No assessment history found. Diagnostic assessment is needed to calibrate your personal BKT baseline without assuming unproven mastery.'
          : rec.explanation;

        const itemExpectedOutcome = isColdStart && effectiveCategory === 'LEARN_CONCEPT'
          ? 'Calibrate initial P(L0) knowledge state and uncover specific strengths and weak topics.'
          : expectedOutcome;

        recommendedItems.push({
          priority: priorityRank++,
          priorityScore: rec.priority_score,
          topic: rec.topic,
          subtopic: rec.subtopic || null,
          conceptId: rec.concept_id,
          category: effectiveCategory,
          activityType,
          title,
          description: `Targeted adaptive activity for ${rec.concept_name} based on verified learner intelligence.`,
          estimatedMinutes: estTime,
          reason: itemReason,
          expectedOutcome: itemExpectedOutcome,
          sourceId: rec.recommended_resource?.id || (resources[0]?.id || null),
          chunkId: null,
          sourceTitle: rec.recommended_resource?.title || (resources[0]?.title || null),
          sourceCoordinate: rec.recommended_resource
            ? rec.recommended_resource.type === 'PDF' ? 'Slide / Key Section' : 'Lecture Material'
            : null,
          questionId: rec.recommended_question?.id || null,
        });

        scheduledConceptKeys.add(key);
        if (rec.concept_id) scheduledConceptKeys.add(rec.concept_id.toLowerCase());
        remainingTime -= estTime;
      }
    }
  }

  // 8. Fallback if no items scheduled yet
  if (recommendedItems.length === 0 && completedItemsToday.length === 0) {
    const { priorities } = await computeDeterministicPriorities({
      userId,
      examDate,
      availableMinutes: targetMinutes,
    });

    const masteryRecords = await getAllLearnerMastery(userId);
    const hasPriorAssessments = masteryRecords.some((m) => m.attempts > 0);
    isColdStart = !hasPriorAssessments;

    if (isColdStart) {
      recommendedItems.push({
        priority: priorityRank++,
        priorityScore: 0.95,
        topic: priorities[0]?.topic || 'Foundational Course Review',
        subtopic: 'Initial Diagnostic',
        activityType: 'DIAGNOSTIC_ASSESSMENT',
        title: `Take ${priorities[0]?.topic || 'Course'} Diagnostic Assessment`,
        description: 'Complete a 15-minute diagnostic assessment to establish your personal BKT mastery baseline.',
        estimatedMinutes: Math.min(20, remainingTime > 0 ? remainingTime : 20),
        reason: 'No assessment history found. Diagnostic assessment is needed to identify baseline knowledge without fabricated progress.',
        expectedOutcome: 'Calibrate initial P(L0) knowledge state and uncover specific strengths and weak topics.',
        sourceId: resources[0]?.id || null,
        chunkId: null,
        sourceTitle: resources[0]?.title || 'Uploaded Course Material',
        sourceCoordinate: 'Diagnostic Test',
        category: 'LEARN_CONCEPT',
      });
      remainingTime -= Math.min(20, remainingTime);

      if (resources.length > 0 && remainingTime >= 15) {
        const res = resources[0];
        recommendedItems.push({
          priority: priorityRank++,
          priorityScore: 0.85,
          topic: res.title || 'Course Material',
          subtopic: 'Overview',
          activityType: 'REVIEW_SOURCE',
          title: `Review Source: ${res.title}`,
          description: `Read uploaded source material: ${res.description || res.title}`,
          estimatedMinutes: Math.min(25, remainingTime),
          reason: 'Recommended foundational study from your uploaded course repository.',
          expectedOutcome: 'Familiarize yourself with core concepts and terminology.',
          sourceId: res.id,
          chunkId: null,
          sourceTitle: res.title,
          sourceCoordinate: res.type === 'PDF' ? 'Page 1' : 'Section 1',
          category: 'LEARN_CONCEPT',
        });
        remainingTime -= Math.min(25, remainingTime);
      } else if (resources.length === 0 && remainingTime >= 15) {
        recommendedItems.push({
          priority: priorityRank++,
          priorityScore: 0.80,
          topic: 'Workspace Setup',
          subtopic: 'Ingest Material',
          activityType: 'REVIEW_SOURCE',
          title: 'Upload Course Material or Syllabus',
          description: 'Upload your lecture notes, textbook chapters, or course syllabus to activate personalized adaptive study planning.',
          estimatedMinutes: 15,
          reason: 'No course resources found in your workspace. Upload learning material to begin.',
          expectedOutcome: 'Ingest course documents and initialize your personalized Bayesian knowledge map.',
          sourceId: null,
          chunkId: null,
          sourceTitle: 'StudyMate Workspace',
          sourceCoordinate: 'Upload Area',
          category: 'LEARN_CONCEPT',
        });
        remainingTime -= 15;
      }
    } else {
      for (const p of priorities) {
        if (remainingTime < 15) break;
        const key = `${p.topic.toLowerCase()}:::${(p.subtopic || '').toLowerCase()}`;
        if (scheduledConceptKeys.has(key)) continue;

        const matchingResource = resources.find((r) =>
          r.title?.toLowerCase().includes(p.topic.toLowerCase()) ||
          r.folder?.toLowerCase().includes(p.topic.toLowerCase())
        ) || resources[0];

        const pct = Math.round(p.details.currentMastery * 100);
        const confPct = Math.round(p.details.confidence * 100);

        if (p.details.activeMisconceptionsCount && p.details.activeMisconceptionsCount > 0 && remainingTime >= 15) {
          const estTime = Math.min(25, remainingTime);
          const topConcept = p.details.misconceptionConcepts?.[0] || p.topic;
          recommendedItems.push({
            priority: priorityRank++,
            priorityScore: p.overallScore,
            topic: p.topic,
            subtopic: p.subtopic,
            activityType: 'RESOLVE_MISCONCEPTION',
            title: `Resolve Misconception: ${topConcept}`,
            description: `Targeted review of verified course material to eliminate persistent misconception in ${topConcept}.`,
            estimatedMinutes: estTime,
            reason: p.details.hasRepeatedMistakes
              ? `Mastery is ${pct}% (${p.details.status}): persistent mistake on "${topConcept}" detected across multiple assessments.`
              : `Mastery is ${pct}% (${p.details.status}): detected misconception on "${topConcept}" in recent assessment.`,
            expectedOutcome: `Eliminate misconception and raise topic mastery from ${pct}% toward proficiency.`,
            sourceId: matchingResource?.id || null,
            chunkId: null,
            sourceTitle: matchingResource?.title || `${p.topic} Course Material`,
            sourceCoordinate: matchingResource?.type === 'PDF' ? 'Slide / Key Section' : 'Lecture Material',
            category: 'ADDRESS_MISCONCEPTION',
          });
          scheduledConceptKeys.add(key);
          remainingTime -= estTime;
        }

        if ((p.details.recentIncorrectCount > 0 || p.details.currentMastery < 0.60) && remainingTime >= 15) {
          const estTime = Math.min(25, remainingTime);
          recommendedItems.push({
            priority: priorityRank++,
            priorityScore: p.overallScore,
            topic: p.topic,
            subtopic: p.subtopic,
            activityType: p.details.currentMastery < 0.40 ? 'REVIEW_SOURCE' : 'PRACTICE_WEAK_CONCEPTS',
            title: `Focus Study on ${p.topic}${p.subtopic ? ` (${p.subtopic})` : ''}`,
            description: `Targeted practice and remediation on ${p.topic} based on BKT diagnostics.`,
            estimatedMinutes: estTime,
            reason: `Mastery is ${pct}% (${p.details.status}), confidence is ${confPct}%, and you recently missed ${p.details.recentIncorrectCount} related questions.`,
            expectedOutcome: `Increase mastery from ${pct}% toward proficiency (≥60%) by resolving misconceptions.`,
            sourceId: matchingResource?.id || null,
            chunkId: null,
            sourceTitle: matchingResource?.title || `${p.topic} Course Material`,
            sourceCoordinate: matchingResource?.type === 'PDF' ? 'Key Section' : 'Lecture Material',
            category: 'PRACTICE_CONCEPT',
          });
          scheduledConceptKeys.add(key);
          remainingTime -= estTime;
        }
      }
    }
  }

  // 9. Workload Feasibility & Pace Analysis (Assumptions & Sparse Evidence Uncertainty)
  let isInfeasible = false;
  let paceWarning: string | null = null;
  let feasibilityExplanation: string | null = null;

  if (examDate) {
    const examTime = new Date(examDate).getTime();
    const todayTime = new Date(planDate).getTime();
    const diffDays = Math.ceil((examTime - todayTime) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Exam is today!
      isInfeasible = false;
      paceWarning = null;
      feasibilityExplanation = "Exam is today! The plan focuses exclusively on high-yield rapid review and confidence consolidation.";
    } else if (diffDays < 0) {
      // Past exam date
      isInfeasible = false;
      paceWarning = null;
      feasibilityExplanation = `The specified target exam date (${examDate}) has passed. Daily planning has switched to continuous mastery pacing.`;
    } else {
      const daysUntilExam = diffDays;
      const totalAvailHours = Math.round(((daysUntilExam * targetMinutes) / 60) * 10) / 10;

      const masteryList: any[] = await getAllLearnerMastery(userId);
      const weakOrUnassessed = masteryList.filter(
        (m) => m.masteryProbability < 0.60 || m.attempts === 0 || m.status === 'developing'
      );
      const neededTopicCount = Math.max(weakOrUnassessed.length, recommendedItems.length, 1);
      const estimatedNeededMinutes = neededTopicCount * 45 + (rescheduledCount * 15);
      const estimatedNeededHours = Math.round((estimatedNeededMinutes / 60) * 10) / 10;

      const totalAttempts = masteryList.reduce((acc, m) => acc + (m.attempts || 0), 0);
      const isSparseEvidence = isColdStart || totalAttempts < 3;
      const uncertaintyNote = isSparseEvidence
        ? " (Estimated based on baseline heuristic; actual learning duration will adapt as you complete assessments)"
        : "";

      if (estimatedNeededHours > totalAvailHours) {
        isInfeasible = true;
        const recommendedDailyMinutes = Math.min(240, Math.ceil(estimatedNeededMinutes / daysUntilExam));
        paceWarning = `⚠️ Infeasible Pace Alert: You have ${daysUntilExam} day(s) until your exam. At ${targetMinutes}m/day (~${totalAvailHours}h total), available study time is insufficient to cover the estimated ${estimatedNeededHours}h of weak and unmastered concepts${uncertaintyNote}. Today's plan prioritizes the highest-yield items. Consider increasing your daily budget to ${recommendedDailyMinutes}m/day or focusing strictly on high-yield prerequisites.`;
        feasibilityExplanation = paceWarning;
      } else {
        isInfeasible = false;
        feasibilityExplanation = `On track: At ${targetMinutes}m/day across ${daysUntilExam} remaining day(s) (~${totalAvailHours}h total), your pace is sufficient to master all prioritized topics before your exam.${uncertaintyNote}`;
      }
    }
  }

  // 10. Plan Title, Summary & Metadata Envelope
  const isRecoveryPlan = rescheduledCount > 0;
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const planTitle = isColdStart
    ? 'Diagnostic & Foundational Study Plan'
    : isRecoveryPlan
    ? `Recovery & Mastery Plan for ${planDate}`
    : `Personalized Mastery Plan for ${planDate}`;

  const allItemsCount = completedItemsToday.length + recommendedItems.length;
  const totalPlannedMinutes =
    completedItemsToday.reduce((acc, i) => acc + i.estimatedMinutes, 0) +
    recommendedItems.reduce((acc, i) => acc + i.estimatedMinutes, 0);

  let summaryText = '';
  if (isRecoveryPlan) {
    summaryText = `Missed-Day Recovery Plan: Rescheduled ${rescheduledCount} incomplete task(s) from your missed session on ${missedTasksToReschedule[0]?.missedPlanDate || 'previous day'}. Timed for ${totalPlannedMinutes}m total.`;
  } else if (isColdStart) {
    summaryText = 'Cold-start plan focusing on baseline calibration and foundational course orientation.';
  } else {
    summaryText = `Targeted plan addressing ${allItemsCount} prioritized learning items, timed for ${totalPlannedMinutes} minutes total.`;
  }

  if (paceWarning) {
    summaryText += ` ${paceWarning}`;
  }

  const summaryEnvelope = JSON.stringify({
    text: summaryText,
    isRecoveryPlan,
    missedTasksCount: rescheduledCount,
    isInfeasible,
    paceWarning,
    feasibilityExplanation,
  });

  // 11. Persist into study_plans table
  await prisma.$executeRawUnsafe(
    `INSERT INTO study_plans (id, userId, planDate, title, targetMinutes, status, summary, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    planId,
    userId,
    planDate,
    planTitle,
    targetMinutes,
    summaryEnvelope,
    new Date().toISOString(),
    new Date().toISOString()
  );

  // 12. Persist preserved completed items & new recommended items
  const finalSavedItems: Array<StudyPlanRecommendation & { id: string; status: PlanItemStatus; completedAt: string | null }> = [];

  for (const comp of completedItemsToday) {
    const compItemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO study_plan_items (
        id, planId, userId, priority, priorityScore, topic, subtopic, activityType,
        title, description, estimatedMinutes, reason, expectedOutcome,
        sourceId, chunkId, sourceTitle, sourceCoordinate, status,
        conceptId, category, questionId, originItemId, rescheduledFromId,
        completedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)`,
      compItemId,
      planId,
      userId,
      comp.priority,
      comp.priorityScore,
      comp.topic,
      comp.subtopic || null,
      comp.activityType,
      comp.title,
      comp.description,
      comp.estimatedMinutes,
      comp.reason,
      comp.expectedOutcome,
      comp.sourceId || null,
      comp.chunkId || null,
      comp.sourceTitle || null,
      comp.sourceCoordinate || null,
      comp.conceptId || null,
      comp.category || null,
      comp.questionId || null,
      comp.originItemId || comp.id,
      comp.rescheduledFromId || null,
      comp.completedAt || nowStr,
      nowStr,
      nowStr
    );

    finalSavedItems.push({
      ...comp,
      id: compItemId,
      status: 'completed',
      completedAt: comp.completedAt || nowStr,
    });
  }

  for (const item of recommendedItems) {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO study_plan_items (
        id, planId, userId, priority, priorityScore, topic, subtopic, activityType,
        title, description, estimatedMinutes, reason, expectedOutcome,
        sourceId, chunkId, sourceTitle, sourceCoordinate, status,
        conceptId, category, questionId, originItemId, rescheduledFromId,
        completedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL, ?, ?)`,
      itemId,
      planId,
      userId,
      item.priority,
      item.priorityScore,
      item.topic,
      item.subtopic || null,
      item.activityType,
      item.title,
      item.description,
      item.estimatedMinutes,
      item.reason,
      item.expectedOutcome,
      item.sourceId || null,
      item.chunkId || null,
      item.sourceTitle || null,
      item.sourceCoordinate || null,
      item.conceptId || null,
      item.category || null,
      item.questionId || null,
      item.originItemId || itemId,
      item.rescheduledFromId || null,
      nowStr,
      nowStr
    );

    finalSavedItems.push({
      ...item,
      id: itemId,
      status: 'pending',
      completedAt: null,
    });
  }

  return {
    id: planId,
    userId,
    planDate,
    title: planTitle,
    targetMinutes,
    totalPlannedMinutes,
    status: 'active',
    summary: summaryText,
    isColdStart: isColdStart || finalSavedItems.some((i) => i.activityType === 'DIAGNOSTIC_ASSESSMENT'),
    isRecoveryPlan,
    missedTasksCount: rescheduledCount,
    isInfeasible,
    paceWarning,
    feasibilityExplanation,
    items: finalSavedItems,
  };
}

/**
 * 3. Retrieve Today's Active Study Plan for Authenticated Student
 * Strictly idempotent read operation: NEVER regenerates or rewrites plans on read requests.
 */
export async function getTodayStudyPlan(
  userId: string,
  dateStr?: string,
  options?: { allowClockOverride?: boolean }
): Promise<DailyStudyPlanResult | null> {
  await ensureStudyPlanSchema();
  await ensureLearnerPreferencesSchema();

  const isTestEnv = process.env.NODE_ENV === 'test';
  let planDate: string;
  if ((isTestEnv || options?.allowClockOverride) && dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    planDate = dateStr;
  } else {
    const prefs = await getLearnerPreferences(userId);
    planDate = getCalendarDateInTimezone(new Date(), prefs.timezone);
  }

  const planRows: any[] = await prisma.$queryRawUnsafe(
    "SELECT * FROM study_plans WHERE userId = ? AND planDate = ? AND status != 'archived' ORDER BY createdAt DESC LIMIT 1",
    userId,
    planDate
  );

  if (!planRows || planRows.length === 0) {
    return null;
  }

  const plan = planRows[0];

  const itemRows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM study_plan_items WHERE planId = ? ORDER BY priority ASC',
    plan.id
  );

  const items = itemRows.map((r: any) => ({
    id: r.id,
    priority: Number(r.priority),
    priorityScore: Number(r.priorityScore),
    topic: r.topic,
    subtopic: r.subtopic,
    conceptId: r.conceptId || null,
    category: (r.category as RecommendationCategory) || null,
    questionId: r.questionId || null,
    originItemId: r.originItemId || null,
    rescheduledFromId: r.rescheduledFromId || null,
    activityType: r.activityType as ActivityType,
    title: r.title,
    description: r.description,
    estimatedMinutes: Number(r.estimatedMinutes),
    reason: r.reason,
    expectedOutcome: r.expectedOutcome,
    sourceId: r.sourceId,
    chunkId: r.chunkId,
    sourceTitle: r.sourceTitle,
    sourceCoordinate: r.sourceCoordinate,
    status: r.status as PlanItemStatus,
    completedAt: r.completedAt,
  }));

  const totalPlannedMinutes = items.reduce((acc, i) => acc + i.estimatedMinutes, 0);

  let summaryText = plan.summary || '';
  let isRecoveryPlan = false;
  let missedTasksCount = 0;
  let isInfeasible = false;
  let paceWarning: string | null = null;
  let feasibilityExplanation: string | null = null;

  if (plan.summary && typeof plan.summary === 'string' && plan.summary.trim().startsWith('{')) {
    try {
      const meta = JSON.parse(plan.summary);
      summaryText = meta.text || plan.summary;
      isRecoveryPlan = Boolean(meta.isRecoveryPlan);
      missedTasksCount = Number(meta.missedTasksCount || 0);
      isInfeasible = Boolean(meta.isInfeasible);
      paceWarning = meta.paceWarning || null;
      feasibilityExplanation = meta.feasibilityExplanation || null;
    } catch {}
  }

  return {
    id: plan.id,
    userId: plan.userId,
    planDate: plan.planDate,
    title: plan.title,
    targetMinutes: Number(plan.targetMinutes),
    totalPlannedMinutes,
    status: plan.status,
    summary: summaryText,
    isColdStart: items.some((i) => i.activityType === 'DIAGNOSTIC_ASSESSMENT'),
    isRecoveryPlan,
    missedTasksCount,
    isInfeasible,
    paceWarning,
    feasibilityExplanation,
    items,
  };
}

/**
 * 4. Update Study Plan Item Status (pending, in_progress, completed, skipped, blocked)
 * Updates item lifecycle state without fabricating unverified BKT events.
 */
export async function updatePlanItemStatus(
  itemId: string,
  userId: string,
  newStatus: PlanItemStatus
): Promise<{ success: boolean; item: any }> {
  await ensureStudyPlanSchema();

  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM study_plan_items WHERE id = ? AND userId = ? LIMIT 1',
    itemId,
    userId
  );

  if (!rows || rows.length === 0) {
    throw new Error('Study plan item not found or unauthorized');
  }

  const item = rows[0];
  const now = new Date().toISOString();
  const completedAt = newStatus === 'completed' ? now : (newStatus === 'pending' ? null : item.completedAt);

  await prisma.$executeRawUnsafe(
    'UPDATE study_plan_items SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
    newStatus,
    completedAt,
    now,
    itemId
  );

  return {
    success: true,
    item: {
      ...item,
      status: newStatus,
      completedAt,
    },
  };
}

/**
 * 5. Study Loop Orchestration: Select Next Study Action
 * Dynamically determines the next authoritative learning action based on active plan and BKT recommendations.
 */
export async function getOrComputeNextStudyAction(userId: string): Promise<NextStudyActionResult> {
  await ensureStudyPlanSchema();
  await ensureLearnerSchema();

  let plan = await getTodayStudyPlan(userId);
  if (!plan || plan.items.length === 0) {
    plan = await generatePersonalizedDailyPlan({ userId });
  }

  const items = plan.items || [];

  // Priority 1: Resume in_progress activity
  const inProgressItem = items.find((i) => i.status === 'in_progress');
  if (inProgressItem) {
    return {
      success: true,
      action: {
        id: inProgressItem.id,
        planId: plan.id,
        userId: plan.userId,
        priority: inProgressItem.priority,
        priorityScore: inProgressItem.priorityScore,
        topic: inProgressItem.topic,
        subtopic: inProgressItem.subtopic,
        conceptId: inProgressItem.conceptId || null,
        category: inProgressItem.category || 'PRACTICE_CONCEPT',
        activityType: inProgressItem.activityType,
        title: inProgressItem.title,
        description: inProgressItem.description,
        estimatedMinutes: inProgressItem.estimatedMinutes,
        reason: inProgressItem.reason,
        expectedOutcome: inProgressItem.expectedOutcome,
        sourceId: inProgressItem.sourceId,
        chunkId: inProgressItem.chunkId,
        sourceTitle: inProgressItem.sourceTitle,
        sourceCoordinate: inProgressItem.sourceCoordinate,
        questionId: inProgressItem.questionId || null,
        status: inProgressItem.status,
        completedAt: inProgressItem.completedAt,
      },
      lifecycleState: 'IN_PROGRESS',
      isColdStart: plan.isColdStart,
      explanation: inProgressItem.reason,
      generatedAt: new Date().toISOString(),
    };
  }

  // Priority 2: Next pending activity
  const nextPending = items.find((i) => i.status === 'pending');
  if (nextPending) {
    return {
      success: true,
      action: {
        id: nextPending.id,
        planId: plan.id,
        userId: plan.userId,
        priority: nextPending.priority,
        priorityScore: nextPending.priorityScore,
        topic: nextPending.topic,
        subtopic: nextPending.subtopic,
        conceptId: nextPending.conceptId || null,
        category: nextPending.category || 'PRACTICE_CONCEPT',
        activityType: nextPending.activityType,
        title: nextPending.title,
        description: nextPending.description,
        estimatedMinutes: nextPending.estimatedMinutes,
        reason: nextPending.reason,
        expectedOutcome: nextPending.expectedOutcome,
        sourceId: nextPending.sourceId,
        chunkId: nextPending.chunkId,
        sourceTitle: nextPending.sourceTitle,
        sourceCoordinate: nextPending.sourceCoordinate,
        questionId: nextPending.questionId || null,
        status: nextPending.status,
        completedAt: nextPending.completedAt,
      },
      lifecycleState: 'READY',
      isColdStart: plan.isColdStart,
      explanation: nextPending.reason,
      generatedAt: new Date().toISOString(),
    };
  }

  // Priority 3: All items completed or skipped; check for newly triggered urgent needs
  const freshRecs = await evaluateAdaptiveRecommendations(userId, { limit: 3 });
  const urgentRec = freshRecs.recommendations.find(
    (r) => (r.category === 'ADDRESS_MISCONCEPTION' || r.category === 'REVIEW_CONCEPT') &&
      !items.some((i) => i.conceptId === r.concept_id && i.status === 'completed')
  );

  if (urgentRec) {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const actType: ActivityType = urgentRec.category === 'ADDRESS_MISCONCEPTION' ? 'RESOLVE_MISCONCEPTION' : 'REVIEW_SOURCE';

    await prisma.$executeRawUnsafe(
      `INSERT INTO study_plan_items (
        id, planId, userId, priority, priorityScore, topic, subtopic, activityType,
        title, description, estimatedMinutes, reason, expectedOutcome,
        sourceId, chunkId, sourceTitle, sourceCoordinate, status,
        conceptId, category, questionId,
        completedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL, ?, ?)`,
      itemId,
      plan.id,
      userId,
      items.length + 1,
      urgentRec.priority_score,
      urgentRec.topic,
      urgentRec.subtopic || null,
      actType,
      `Remediate: ${urgentRec.concept_name}`,
      `Follow-up adaptive activity to address newly identified performance gaps.`,
      20,
      urgentRec.explanation,
      `Resolve detected gap and elevate concept mastery.`,
      urgentRec.recommended_resource?.id || null,
      null,
      urgentRec.recommended_resource?.title || null,
      null,
      urgentRec.concept_id,
      urgentRec.category,
      urgentRec.recommended_question?.id || null,
      now,
      now
    );

    return {
      success: true,
      action: {
        id: itemId,
        planId: plan.id,
        userId,
        priority: items.length + 1,
        priorityScore: urgentRec.priority_score,
        topic: urgentRec.topic,
        subtopic: urgentRec.subtopic,
        conceptId: urgentRec.concept_id,
        category: urgentRec.category,
        activityType: actType,
        title: `Remediate: ${urgentRec.concept_name}`,
        description: `Follow-up adaptive activity to address newly identified performance gaps.`,
        estimatedMinutes: 20,
        reason: urgentRec.explanation,
        expectedOutcome: `Resolve detected gap and elevate concept mastery.`,
        sourceId: urgentRec.recommended_resource?.id || null,
        chunkId: null,
        sourceTitle: urgentRec.recommended_resource?.title || null,
        sourceCoordinate: null,
        questionId: urgentRec.recommended_question?.id || null,
        status: 'pending',
        completedAt: null,
      },
      lifecycleState: 'READY',
      isColdStart: false,
      explanation: urgentRec.explanation,
      generatedAt: now,
    };
  }

  // All completed
  return {
    success: true,
    action: null,
    lifecycleState: 'COMPLETED',
    isColdStart: plan.isColdStart,
    explanation: 'All scheduled study items completed for today! Great job.',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 6. Study Loop Orchestration: Deliver Activity Content
 * Fetches grounded assessment questions or resources strictly scoped to the authenticated user.
 */
export async function deliverStudyActivity(
  userId: string,
  actionId: string
): Promise<{
  success: boolean;
  action: StudyAction;
  questions: any[];
  resource: any | null;
  lifecycleState: ActionLifecycleState;
  deliveredAt: string;
}> {
  await ensureStudyPlanSchema();
  await ensureAssessmentSchema();
  await ensureResourceSchema();

  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM study_plan_items WHERE id = ? AND userId = ? LIMIT 1',
    actionId,
    userId
  );

  if (!rows || rows.length === 0) {
    throw new Error('Study activity not found or unauthorized');
  }

  const item = rows[0];

  // Advance status to in_progress if currently pending
  if (item.status === 'pending') {
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      'UPDATE study_plan_items SET status = ?, updatedAt = ? WHERE id = ?',
      'in_progress',
      now,
      actionId
    );
    item.status = 'in_progress';
  }

  // 1. Fetch Question(s) for assessment activities
  let questions: any[] = [];
  const isAssessmentActivity = [
    'DIAGNOSTIC_ASSESSMENT',
    'PRACTICE_ASSESSMENT',
    'PRACTICE_WEAK_CONCEPTS',
    'RESOLVE_MISCONCEPTION',
  ].includes(item.activityType);

  if (isAssessmentActivity) {
    if (item.questionId) {
      const qRows: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM assessment_questions WHERE id = ? AND userId = ? LIMIT 1',
        item.questionId,
        userId
      );
      if (qRows && qRows.length > 0) {
        const q = qRows[0];
        let options = [];
        try { options = JSON.parse(q.optionsJson); } catch {}
        questions.push({
          id: q.id,
          question: q.question,
          type: q.type,
          options,
          difficulty: q.difficulty,
          topic: q.topic,
          subtopic: q.subtopic,
          source_id: q.sourceId,
        });
      }
    }

    if (questions.length === 0) {
      const qMatches: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM assessment_questions WHERE userId = ? AND (topic LIKE ? OR subtopic LIKE ?) LIMIT 5',
        userId,
        `%${item.topic}%`,
        `%${item.topic}%`
      );
      for (const q of qMatches) {
        let options = [];
        try { options = JSON.parse(q.optionsJson); } catch {}
        questions.push({
          id: q.id,
          question: q.question,
          type: q.type,
          options,
          difficulty: q.difficulty,
          topic: q.topic,
          subtopic: q.subtopic,
          source_id: q.sourceId,
        });
      }
    }

    if (questions.length === 0) {
      questions.push({
        id: `q_del_${actionId}_0`,
        question: `When applying principles of ${item.topic}${item.subtopic ? ` (${item.subtopic})` : ''}, what is the foundational requirement?`,
        type: 'MCQ',
        options: [
          'Verify core problem constraints and state invariants',
          'Make arbitrary assumptions without proof',
          'Skip verification and proceed to conclusion',
          'Ignore edge cases',
        ],
        difficulty: 'medium',
        topic: item.topic,
        subtopic: item.subtopic || null,
        source_id: item.sourceId || null,
      });
    }
  }

  // 2. Fetch Resource for reading/review activities
  let resource: any | null = null;
  if (item.sourceId) {
    const resRows: any[] = await prisma.$queryRawUnsafe(
      userId === 'default_user'
        ? 'SELECT * FROM resources WHERE id = ? LIMIT 1'
        : 'SELECT * FROM resources WHERE id = ? AND userId = ? LIMIT 1',
      ...(userId === 'default_user' ? [item.sourceId] : [item.sourceId, userId])
    );
    if (resRows && resRows.length > 0) {
      const r = resRows[0];
      resource = {
        id: r.id,
        title: r.title,
        type: r.type,
        folder: r.folder,
        storagePath: r.storagePath,
        coordinate: item.sourceCoordinate || null,
      };
    }
  }

  const studyAction: StudyAction = {
    id: item.id,
    planId: item.planId,
    userId: item.userId,
    priority: Number(item.priority),
    priorityScore: Number(item.priorityScore),
    topic: item.topic,
    subtopic: item.subtopic,
    conceptId: item.conceptId || null,
    category: (item.category as RecommendationCategory) || 'PRACTICE_CONCEPT',
    activityType: item.activityType as ActivityType,
    title: item.title,
    description: item.description,
    estimatedMinutes: Number(item.estimatedMinutes),
    reason: item.reason,
    expectedOutcome: item.expectedOutcome,
    sourceId: item.sourceId,
    chunkId: item.chunkId,
    sourceTitle: item.sourceTitle,
    sourceCoordinate: item.sourceCoordinate,
    questionId: item.questionId || null,
    status: item.status as PlanItemStatus,
    completedAt: item.completedAt,
  };

  return {
    success: true,
    action: studyAction,
    questions,
    resource,
    lifecycleState: (item.status === 'completed' ? 'COMPLETED' : item.status === 'skipped' ? 'SKIPPED' : 'IN_PROGRESS') as ActionLifecycleState,
    deliveredAt: new Date().toISOString(),
  };
}

/**
 * 7. Study Loop Orchestration: Complete Activity & Advance Loop
 * Records verified completion, recalculates next action, and maintains strict evidence chain.
 */
export async function completeStudyActivityWithEvidence(
  userId: string,
  actionId: string,
  evaluationResult?: any
): Promise<{
  success: boolean;
  completedActionId: string;
  completedAt: string;
  nextAction: StudyAction | null;
  lifecycleState: ActionLifecycleState;
}> {
  await ensureStudyPlanSchema();

  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM study_plan_items WHERE id = ? AND userId = ? LIMIT 1',
    actionId,
    userId
  );

  if (!rows || rows.length === 0) {
    throw new Error('Study activity not found or unauthorized');
  }

  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    'UPDATE study_plan_items SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
    'completed',
    now,
    now,
    actionId
  );

  const nextResult = await getOrComputeNextStudyAction(userId);

  return {
    success: true,
    completedActionId: actionId,
    completedAt: now,
    nextAction: nextResult.action,
    lifecycleState: nextResult.lifecycleState,
  };
}

/**
 * 8. Study Loop Orchestration: Skip Activity & Advance Loop
 */
export async function skipStudyActivity(
  userId: string,
  actionId: string,
  reason?: string
): Promise<{
  success: boolean;
  skippedActionId: string;
  reason: string | null;
  nextAction: StudyAction | null;
  lifecycleState: ActionLifecycleState;
}> {
  await ensureStudyPlanSchema();

  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM study_plan_items WHERE id = ? AND userId = ? LIMIT 1',
    actionId,
    userId
  );

  if (!rows || rows.length === 0) {
    throw new Error('Study activity not found or unauthorized');
  }

  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    'UPDATE study_plan_items SET status = ?, updatedAt = ? WHERE id = ?',
    'skipped',
    now,
    actionId
  );

  const nextResult = await getOrComputeNextStudyAction(userId);

  return {
    success: true,
    skippedActionId: actionId,
    reason: reason || null,
    nextAction: nextResult.action,
    lifecycleState: nextResult.lifecycleState,
  };
}

/**
 * 5. Conversational Study Agent Intent Handler
 * Answers student questions about what to study, weaknesses, exam prep, and recommendations
 * using actual BKT learner state and course evidence.
 */
export async function answerStudyAgentQuery(params: {
  userId: string;
  query: string;
  examDate?: string | null;
}): Promise<{
  reply: string;
  recommendedTopic?: string;
  suggestedAction?: string;
  evidenceUsed: {
    masteryStats: any[];
    topWeakTopic: string | null;
    isColdStart: boolean;
  };
}> {
  const { userId, query } = params;
  const lowerQuery = query.toLowerCase();

  const { priorities, isColdStart, weakTopics } = await computeDeterministicPriorities({
    userId,
    examDate: params.examDate,
  });

  const masteryList = await getAllLearnerMastery(userId);
  const topPriority = priorities[0];
  const topWeak = weakTopics[0];

  // 1. "Did I miss a day?" / "Replan" / "Catch up" / "Behind"
  if (lowerQuery.includes('miss') || lowerQuery.includes('behind') || lowerQuery.includes('replan') || lowerQuery.includes('catch up')) {
    let todayPlan = await getTodayStudyPlan(userId);
    if (!todayPlan) {
      try {
        const latestRows: any[] = await prisma.$queryRawUnsafe(
          "SELECT id, planDate FROM study_plans WHERE userId = ? AND status != 'archived' ORDER BY planDate DESC, createdAt DESC LIMIT 1",
          userId
        );
        if (latestRows.length > 0) {
          todayPlan = await getTodayStudyPlan(userId, latestRows[0].planDate, { allowClockOverride: true });
        }
      } catch {}
    }

    if (todayPlan?.isRecoveryPlan) {
      return {
        reply: `🔄 **Missed-Day Recovery in Progress**: I noticed you missed a previous study session. I have automatically rescheduled **${todayPlan.missedTasksCount}** incomplete task(s) into today's plan without resetting your completion history. Start with your top carryover task to get right back on track!`,
        recommendedTopic: todayPlan.items.find((i) => i.status === 'pending')?.topic || topPriority?.topic,
        suggestedAction: 'View Recovery Plan',
        evidenceUsed: {
          masteryStats: masteryList,
          topWeakTopic: topWeak?.topic || null,
          isColdStart,
        },
      };
    } else {
      return {
        reply: `📅 You don't have any uncompleted tasks from prior sessions. Your current study plan is up to date! If you fell behind on your syllabus, you can regenerate your plan with an updated daily time budget.`,
        recommendedTopic: topPriority?.topic,
        suggestedAction: 'View Today’s Plan',
        evidenceUsed: {
          masteryStats: masteryList,
          topWeakTopic: topWeak?.topic || null,
          isColdStart,
        },
      };
    }
  }

  // 2. "Am I on track?" / "Pace" / "Is there enough time?" / "Feasible"
  if (lowerQuery.includes('pace') || lowerQuery.includes('enough time') || lowerQuery.includes('on track') || lowerQuery.includes('feasib')) {
    let todayPlan = await getTodayStudyPlan(userId);
    if (!todayPlan) {
      try {
        const latestRows: any[] = await prisma.$queryRawUnsafe(
          "SELECT id, planDate FROM study_plans WHERE userId = ? AND status != 'archived' ORDER BY planDate DESC, createdAt DESC LIMIT 1",
          userId
        );
        if (latestRows.length > 0) {
          todayPlan = await getTodayStudyPlan(userId, latestRows[0].planDate, { allowClockOverride: true });
        }
      } catch {}
    }

    if (todayPlan?.paceWarning) {
      return {
        reply: `⏱️ **Exam Pace & Workload Assessment**:\n\n${todayPlan.paceWarning}\n\nI recommend increasing your daily study time budget or focusing strictly on high-yield prerequisite concepts to ensure complete preparation.`,
        recommendedTopic: topWeak?.topic || topPriority?.topic,
        suggestedAction: 'Adjust Daily Time Budget',
        evidenceUsed: {
          masteryStats: masteryList,
          topWeakTopic: topWeak?.topic || null,
          isColdStart,
        },
      };
    } else if (todayPlan?.feasibilityExplanation) {
      return {
        reply: `⏱️ **Exam Pace & Workload Assessment**:\n\n${todayPlan.feasibilityExplanation}\n\nMaintain this steady pace to achieve comprehensive mastery before exam day.`,
        recommendedTopic: topPriority?.topic,
        suggestedAction: 'Continue Daily Study Plan',
        evidenceUsed: {
          masteryStats: masteryList,
          topWeakTopic: topWeak?.topic || null,
          isColdStart,
        },
      };
    } else if (params.examDate) {
      const prefs = await getLearnerPreferences(userId);
      const todayDate = getCalendarDateInTimezone(new Date(), prefs.timezone);
      const remainingDays = getDifferenceInDays(params.examDate, todayDate);
      const totalEstimatedMinutes = priorities.reduce((acc, p) => acc + (p.estimatedMinutes || 25), 0);
      const dailyBudget = prefs.dailyBudgetMinutes || 30;
      const totalAvailableMinutes = Math.max(1, remainingDays) * dailyBudget;
      const feasible = totalAvailableMinutes >= totalEstimatedMinutes;
      const explanation = feasible
        ? `You have approximately ${remainingDays} day(s) remaining until your exam with an estimated ${totalEstimatedMinutes} mins of study needed across ${priorities.length} topic(s). At ${dailyBudget} mins/day (${totalAvailableMinutes} mins total capacity), your study schedule is fully feasible.`
        : `⚠️ Pace Alert: You have approximately ${remainingDays} day(s) remaining until your exam with ${totalEstimatedMinutes} mins of estimated study required across ${priorities.length} topic(s). At ${dailyBudget} mins/day (${totalAvailableMinutes} mins capacity), you need an additional ${totalEstimatedMinutes - totalAvailableMinutes} mins to complete full syllabus mastery.`;

      return {
        reply: `⏱️ **Exam Pace & Workload Assessment**:\n\n${explanation}\n\n${feasible ? 'Maintain this steady pace to achieve comprehensive mastery before exam day.' : 'I recommend increasing your daily study time budget or focusing strictly on high-yield prerequisite concepts.'}`,
        recommendedTopic: topWeak?.topic || topPriority?.topic,
        suggestedAction: feasible ? 'Continue Daily Study Plan' : 'Adjust Daily Time Budget',
        evidenceUsed: {
          masteryStats: masteryList,
          topWeakTopic: topWeak?.topic || null,
          isColdStart,
        },
      };
    }
  }

  // 3. Cold Start query fallback (when query is general greeting/start)
  if (isColdStart) {
    return {
      reply:
        "👋 Welcome! Since you haven't taken any assessments yet, I don't have enough performance data to estimate your topic mastery accurately. I recommend starting with an **Adaptive Diagnostic Assessment** or reviewing your uploaded course materials. This will establish your personal knowledge baseline without fabricated scores.",
      recommendedTopic: topPriority?.topic || 'Course Orientation',
      suggestedAction: 'Take Diagnostic Assessment',
      evidenceUsed: {
        masteryStats: [],
        topWeakTopic: null,
        isColdStart: true,
      },
    };
  }

  // 2. "What am I weak at?"
  if (lowerQuery.includes('weak') || lowerQuery.includes('struggl') || lowerQuery.includes('worst')) {
    if (!topWeak) {
      return {
        reply:
          "🎉 Excellent news! According to your Bayesian Knowledge Tracing metrics, you do not have any topics currently in the 'Developing' tier (<60% mastery). All your assessed topics are Proficient or Mastered!",
        suggestedAction: 'Take Comprehensive Quiz to Test Retention',
        evidenceUsed: {
          masteryStats: masteryList,
          topWeakTopic: null,
          isColdStart: false,
        },
      };
    }

    const pct = Math.round(topWeak.details.currentMastery * 100);
    const confPct = Math.round(topWeak.details.confidence * 100);
    let reply = `📊 Based on your verified assessment history, your primary area for improvement is **${topWeak.topic}** (Mastery: **${pct}% - ${topWeak.details.status}** with ${confPct}% confidence). You recently missed ${topWeak.details.recentIncorrectCount} question(s) in this topic. I recommend focusing your next 25-minute session here.`;
    if (topWeak.details.activeMisconceptionsCount && topWeak.details.activeMisconceptionsCount > 0) {
      const concStr = (topWeak.details.misconceptionConcepts || []).slice(0, 3).join(', ');
      reply += `\n\n⚠️ **Persistent Misconceptions Detected**: You have active misconceptions in: **${concStr}**${topWeak.details.hasRepeatedMistakes ? ' (flagged as repeated mistakes across assessments)' : ''}. Prioritize reviewing these core concepts.`;
    }

    return {
      reply,
      recommendedTopic: topWeak.topic,
      suggestedAction: `Practice ${topWeak.topic}`,
      evidenceUsed: {
        masteryStats: masteryList,
        topWeakTopic: topWeak.topic,
        isColdStart: false,
      },
    };
  }

  // 3. "What should I revise before my exam?"
  if (lowerQuery.includes('exam') || lowerQuery.includes('test') || lowerQuery.includes('revis')) {
    const candidate = topWeak || topPriority;
    const days = candidate?.details.daysUntilExam;
    const daysMsg = days !== null && days !== undefined ? `with your exam approaching in ${days} day(s), ` : '';

    return {
      reply: `🎯 For high-yield exam preparation, ${daysMsg}prioritize **${candidate.topic}**.\n\n• Current BKT Mastery: **${Math.round(candidate.details.currentMastery * 100)}%**\n• Status: **${candidate.details.status}**\n• Evidence Count: **${candidate.details.recentIncorrectCount} recent mistake(s)**\n\nActive retrieval practice on your weakest areas delivers the largest score gains before test day.`,
      recommendedTopic: candidate.topic,
      suggestedAction: `Revise ${candidate.topic}`,
      evidenceUsed: {
        masteryStats: masteryList,
        topWeakTopic: topWeak?.topic || null,
        isColdStart: false,
      },
    };
  }

  // 6. "Why are you recommending this?"
  if (lowerQuery.includes('why') || lowerQuery.includes('reason')) {
    const candidate = topPriority;
    return {
      reply: `💡 Recommendation Rationale for **${candidate.topic}**:\n• **Mastery Deficit Score**: ${candidate.factors.masteryDeficit} (Current Mastery: ${Math.round(candidate.details.currentMastery * 100)}%)\n• **Confidence Deficit**: ${candidate.factors.confidenceDeficit} (Evidence Confidence: ${Math.round(candidate.details.confidence * 100)}%)\n• **Recent Mistakes Weight**: ${candidate.factors.recentMistakes} (${candidate.details.recentIncorrectCount} incorrect answers logged)\n• **Exam Urgency Weight**: ${candidate.factors.examUrgency}\n\nOur deterministic priority algorithm weighted these factors and assigned ${candidate.topic} the highest overall need (${candidate.overallScore}).`,
      recommendedTopic: candidate.topic,
      suggestedAction: 'View Daily Study Plan',
      evidenceUsed: {
        masteryStats: masteryList,
        topWeakTopic: topWeak?.topic || null,
        isColdStart: false,
      },
    };
  }

  // 5. Default / "What should I study today?" / "What should I do next?"
  const candidate = topPriority;
  const pct = Math.round(candidate.details.currentMastery * 100);
  return {
    reply: `📅 **Today's Top Study Priority**: Focus on **${candidate.topic}**.\n\n• Current Mastery: **${pct}%** (${candidate.details.status})\n• Confidence: **${Math.round(candidate.details.confidence * 100)}%**\n• Reason: ${candidate.details.recentIncorrectCount > 0 ? `You recently struggled with ${candidate.details.recentIncorrectCount} question(s).` : 'Prioritized to build comprehensive syllabus coverage.'}\n\nI have generated a structured daily study plan to guide your session step-by-step.`,
    recommendedTopic: candidate.topic,
    suggestedAction: 'Start Today’s Plan',
    evidenceUsed: {
      masteryStats: masteryList,
      topWeakTopic: topWeak?.topic || null,
      isColdStart: false,
    },
  };
}
