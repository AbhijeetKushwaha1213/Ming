import { prisma, ensureStudyPlanSchema, ensureLearnerSchema, ensureResourceSchema, ensureAssessmentSchema } from './prisma.ts';
import { getAllLearnerMastery, getLearnerEventHistory, logLearnerEvent, type MasteryStatus } from './bktService.ts';
import { evaluateAdaptiveRecommendations } from './adaptiveRecommendationService.ts';
import type { RecommendationCategory } from './learnerTypes.ts';

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
    daysUntilExam = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    if (daysUntilExam <= 3) examUrgencyScore = 1.0;
    else if (daysUntilExam <= 7) examUrgencyScore = 0.85;
    else if (daysUntilExam <= 14) examUrgencyScore = 0.60;
    else if (daysUntilExam <= 30) examUrgencyScore = 0.40;
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

  // Collect distinct topics from mastery and resources
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
}): Promise<DailyStudyPlanResult> {
  await ensureStudyPlanSchema();
  await ensureResourceSchema();
  await ensureLearnerSchema();

  const userId = params.userId;
  const targetMinutes = params.targetMinutes || 60;
  const planDate = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  // Check if active plan exists for today
  if (!params.forceRegenerate) {
    const existingPlan = await getTodayStudyPlan(userId, planDate);
    if (existingPlan) {
      return existingPlan;
    }
  }

  // Authoritative Phase 5 Step 3 Adaptive Recommendations
  const adaptiveRecs = await evaluateAdaptiveRecommendations(userId, { limit: 10 });
  const isColdStart = adaptiveRecs.is_cold_start;

  // Query real uploaded course materials to ground recommendations strictly scoped to user
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

  const recommendedItems: StudyPlanRecommendation[] = [];
  let remainingTime = targetMinutes;
  let priorityRank = 1;

  if (adaptiveRecs.recommendations.length > 0) {
    for (const rec of adaptiveRecs.recommendations) {
      if (remainingTime < 15 && recommendedItems.length > 0) break;

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
        reason: rec.explanation,
        expectedOutcome,
        sourceId: rec.recommended_resource?.id || (resources[0]?.id || null),
        chunkId: null,
        sourceTitle: rec.recommended_resource?.title || (resources[0]?.title || null),
        sourceCoordinate: rec.recommended_resource
          ? rec.recommended_resource.type === 'PDF' ? 'Slide / Key Section' : 'Lecture Material'
          : null,
        questionId: rec.recommended_question?.id || null,
      });

      remainingTime -= estTime;
    }
  }

  // Fallback if no concept recommendations generated (e.g. catalog/DAG empty)
  if (recommendedItems.length === 0) {
    const { priorities, weakTopics } = await computeDeterministicPriorities({
      userId,
      examDate: params.examDate,
      availableMinutes: targetMinutes,
    });

    if (isColdStart) {
      recommendedItems.push({
        priority: priorityRank++,
        priorityScore: 0.95,
        topic: priorities[0]?.topic || 'Foundational Course Review',
        subtopic: 'Initial Diagnostic',
        activityType: 'DIAGNOSTIC_ASSESSMENT',
        title: `Take ${priorities[0]?.topic || 'Course'} Diagnostic Assessment`,
        description: 'Complete a 15-minute diagnostic assessment to establish your personal BKT mastery baseline.',
        estimatedMinutes: Math.min(20, remainingTime),
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
      }
    } else {
      for (const p of priorities) {
        if (remainingTime < 15) break;

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
          remainingTime -= estTime;
        }

        if (p.details.recentIncorrectCount > 0 || p.details.currentMastery < 0.60) {
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
          remainingTime -= estTime;
        }
      }
    }
  }

  // Persist plan into study_plans and study_plan_items
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const planTitle = isColdStart
    ? 'Diagnostic & Foundational Study Plan'
    : `Personalized Mastery Plan for ${planDate}`;
  const totalPlannedMinutes = recommendedItems.reduce((acc, i) => acc + i.estimatedMinutes, 0);

  const planSummary = isColdStart
    ? 'Cold-start plan focusing on baseline calibration and foundational course orientation.'
    : `Targeted plan addressing ${recommendedItems.length} prioritized learning items, timed for ${totalPlannedMinutes} minutes total.`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO study_plans (id, userId, planDate, title, targetMinutes, status, summary, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    planId,
    userId,
    planDate,
    planTitle,
    targetMinutes,
    planSummary,
    new Date().toISOString(),
    new Date().toISOString()
  );

  const savedItems = [];

  for (const item of recommendedItems) {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO study_plan_items (
        id, planId, userId, priority, priorityScore, topic, subtopic, activityType,
        title, description, estimatedMinutes, reason, expectedOutcome,
        sourceId, chunkId, sourceTitle, sourceCoordinate, status,
        conceptId, category, questionId,
        completedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL, ?, ?)`,
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
      now,
      now
    );

    savedItems.push({
      ...item,
      id: itemId,
      status: 'pending' as PlanItemStatus,
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
    summary: planSummary,
    isColdStart,
    items: savedItems,
  };
}

/**
 * 3. Retrieve Today's Active Study Plan for Authenticated Student
 */
export async function getTodayStudyPlan(userId: string, dateStr?: string): Promise<DailyStudyPlanResult | null> {
  await ensureStudyPlanSchema();
  const planDate = dateStr || new Date().toISOString().split('T')[0];

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

  return {
    id: plan.id,
    userId: plan.userId,
    planDate: plan.planDate,
    title: plan.title,
    targetMinutes: Number(plan.targetMinutes),
    totalPlannedMinutes,
    status: plan.status,
    summary: plan.summary || '',
    isColdStart: items.some((i) => i.activityType === 'DIAGNOSTIC_ASSESSMENT'),
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

  // 1. Cold Start query
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

  // 4. "Why are you recommending this?"
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
