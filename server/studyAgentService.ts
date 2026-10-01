import { prisma, ensureStudyPlanSchema, ensureLearnerSchema, ensureResourceSchema } from './prisma.ts';
import { getAllLearnerMastery, getLearnerEventHistory, logLearnerEvent, type MasteryStatus } from './bktService.ts';

export type ActivityType =
  | 'REVIEW_SOURCE'
  | 'PRACTICE_ASSESSMENT'
  | 'REVISE_FLASHCARDS'
  | 'PRACTICE_WEAK_CONCEPTS'
  | 'ASK_TUTOR'
  | 'DIAGNOSTIC_ASSESSMENT'
  | 'COMPLETE_UNFINISHED_TASK';

export type PlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

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

  // 3. Fetch available uploaded resources for topic coverage
  const resources: any[] = await prisma.$queryRawUnsafe(
    "SELECT * FROM resources WHERE userId = ? OR userId = 'default_user' ORDER BY createdAt DESC",
    userId
  );

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

    // Weighted Deterministic Multi-Factor Priority Score
    const overallScore =
      0.35 * masteryDeficit +
      0.20 * confidenceDeficit +
      0.20 * recentMistakes +
      0.15 * examUrgency +
      0.10 * recencyForgetting;

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
export async function generatePersonalizedDailyPlan(params: {
  userId: string;
  targetMinutes?: number;
  examDate?: string | null;
  forceRegenerate?: boolean;
}): Promise<DailyStudyPlanResult> {
  await ensureStudyPlanSchema();
  await ensureResourceSchema();

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

  // Compute deterministic priorities
  const { priorities, isColdStart, weakTopics } = await computeDeterministicPriorities({
    userId,
    examDate: params.examDate,
    availableMinutes: targetMinutes,
  });

  // Query real uploaded course materials to ground recommendations
  const resources: any[] = await prisma.$queryRawUnsafe(
    "SELECT * FROM resources WHERE userId = ? OR userId = 'default_user' ORDER BY createdAt DESC LIMIT 10",
    userId
  );

  const recommendedItems: StudyPlanRecommendation[] = [];
  let remainingTime = targetMinutes;
  let priorityRank = 1;

  // Case A: Cold-Start User (No prior assessment evidence)
  if (isColdStart) {
    // Recommend Diagnostic Knowledge Check
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
    });
    remainingTime -= Math.min(20, remainingTime);

    // Recommend reading uploaded course material
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
      });
      remainingTime -= Math.min(25, remainingTime);
    }
  } else {
    // Case B: Assessed User with BKT Evidence
    // Allocate activities across top prioritized topics
    for (const p of priorities) {
      if (remainingTime < 15) break;

      const matchingResource = resources.find((r) =>
        r.title?.toLowerCase().includes(p.topic.toLowerCase()) ||
        r.folder?.toLowerCase().includes(p.topic.toLowerCase())
      ) || resources[0];

      const pct = Math.round(p.details.currentMastery * 100);
      const confPct = Math.round(p.details.confidence * 100);

      // Rule 1: High deficit and recent mistakes -> Targeted Review & Practice
      if (p.details.recentIncorrectCount > 0 || p.details.currentMastery < 0.60) {
        // Activity 1: Practice Weak Concepts / Targeted Assessment
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
        });
        remainingTime -= estTime;
      }

      // Rule 2: Low confidence or nearing exam -> Flashcard / Adaptive Assessment
      if (remainingTime >= 15 && (p.details.confidence < 0.65 || (p.details.daysUntilExam && p.details.daysUntilExam <= 7))) {
        const estTime = Math.min(20, remainingTime);
        recommendedItems.push({
          priority: priorityRank++,
          priorityScore: p.overallScore * 0.9,
          topic: p.topic,
          subtopic: p.subtopic,
          activityType: 'PRACTICE_ASSESSMENT',
          title: `Adaptive Knowledge Check: ${p.topic}`,
          description: `Take a 5-question adaptive quiz to strengthen knowledge retrieval.`,
          estimatedMinutes: estTime,
          reason: p.details.daysUntilExam
            ? `Exam is in ${p.details.daysUntilExam} days; active retrieval practice solidifies memory retention.`
            : `Confidence level is ${confPct}%; practice is needed to collect evidence and stabilize BKT mastery.`,
          expectedOutcome: `Elevate confidence metric and reinforce knowledge retention under test conditions.`,
          sourceId: matchingResource?.id || null,
          chunkId: null,
          sourceTitle: matchingResource?.title || `${p.topic} Notes`,
          sourceCoordinate: 'Quiz Engine',
        });
        remainingTime -= estTime;
      }
    }

    // Rule 3: If student still has remaining study time, recommend Asking Tutor or Revision
    if (remainingTime >= 15 && weakTopics.length > 0) {
      const weak = weakTopics[0];
      recommendedItems.push({
        priority: priorityRank++,
        priorityScore: 0.70,
        topic: weak.topic,
        subtopic: weak.subtopic,
        activityType: 'ASK_TUTOR',
        title: `Clarify Misconceptions with AI Tutor: ${weak.topic}`,
        description: `Ask grounded tutor to explain confusing nuances regarding ${weak.topic}.`,
        estimatedMinutes: remainingTime,
        reason: `Your lowest mastery topic is ${weak.topic} (${Math.round(weak.details.currentMastery * 100)}%). Direct tutor dialogue resolves conceptual blockers.`,
        expectedOutcome: `Clarify key principles with grounded citations before next evaluation.`,
        sourceId: null,
        chunkId: null,
        sourceTitle: 'Source-Grounded AI Tutor',
        sourceCoordinate: 'Chat Panel',
      });
      remainingTime = 0;
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
    : `Targeted plan addressing ${weakTopics.length} developing topics, timed for ${totalPlannedMinutes} minutes total.`;

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
    await prisma.$executeRawUnsafe(
      `INSERT INTO study_plan_items (id, planId, userId, priority, priorityScore, topic, subtopic, activityType, title, description, estimatedMinutes, reason, expectedOutcome, sourceId, chunkId, sourceTitle, sourceCoordinate, status, completedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
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
      new Date().toISOString(),
      new Date().toISOString()
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
 * 4. Update Study Plan Item Status (pending, in_progress, completed, skipped)
 * Feeds completion back into auditable learner events!
 */
export async function updatePlanItemStatus(
  itemId: string,
  userId: string,
  newStatus: PlanItemStatus
): Promise<{ success: boolean; item: any }> {
  await ensureStudyPlanSchema();
  await ensureLearnerSchema();

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
  const completedAt = newStatus === 'completed' ? now : null;

  await prisma.$executeRawUnsafe(
    'UPDATE study_plan_items SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
    newStatus,
    completedAt,
    now,
    itemId
  );

  // Feed completion into learner events log
  if (newStatus === 'completed') {
    await logLearnerEvent({
      userId,
      topic: item.topic,
      subtopic: item.subtopic,
      eventType: 'ASSESSMENT_RESULT',
      sourceId: itemId,
      priorMastery: 0.5,
      posteriorMastery: 0.5,
      isCorrect: true,
      difficulty: 'plan_task',
      parameters: { pL0: 0.15, pT: 0.1, pG: 0.2, pS: 0.1 },
      evidenceDetails: `Completed scheduled study activity: "${item.title}" (${item.estimatedMinutes}m)`,
    });
  }

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
    return {
      reply: `📊 Based on your verified assessment history, your primary area for improvement is **${topWeak.topic}** (Mastery: **${pct}% - ${topWeak.details.status}** with ${confPct}% confidence). You recently missed ${topWeak.details.recentIncorrectCount} question(s) in this topic. I recommend focusing your next 25-minute session here.`,
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
