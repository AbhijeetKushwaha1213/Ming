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
    masteryDeficit: number;
    confidenceDeficit: number;
    recentMistakes: number;
    examUrgency: number;
    recencyForgetting: number;
  };
  details: {
    attempts: number;
    currentMastery: number;
    status: string;
    confidence: number;
    recentIncorrectCount: number;
    daysSinceLastAssessed: number | null;
    daysUntilExam: number | null;
  };
}

export interface StudyPlanItem {
  id: string;
  priority: number;
  priorityScore: number;
  topic: string;
  subtopic: string | null;
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
  status: PlanItemStatus;
  completedAt: string | null;
}

export interface DailyStudyPlan {
  id: string;
  userId: string;
  planDate: string;
  title: string;
  targetMinutes: number;
  totalPlannedMinutes: number;
  status: string;
  summary: string;
  isColdStart: boolean;
  items: StudyPlanItem[];
}

export interface StudyPrioritiesResponse {
  success: boolean;
  priorities: PriorityScoreBreakdown[];
  isColdStart: boolean;
  weakTopics: PriorityScoreBreakdown[];
}

export interface StudyAgentChatResponse {
  success: boolean;
  reply: string;
  recommendedTopic?: string;
  suggestedAction?: string;
  evidenceUsed: {
    masteryStats: any[];
    topWeakTopic: string | null;
    isColdStart: boolean;
  };
}

/**
 * Fetch deterministic study priorities computed before any generation.
 */
export async function getStudyPriorities(params: {
  userId: string;
  examDate?: string | null;
  availableMinutes?: number;
}): Promise<StudyPrioritiesResponse> {
  const query = new URLSearchParams();
  query.set('userId', params.userId);
  if (params.examDate) query.set('examDate', params.examDate);
  if (params.availableMinutes) query.set('availableMinutes', String(params.availableMinutes));

  const res = await fetch(`/api/agent/priorities?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch study priorities (${res.status})`);
  }
  return res.json();
}

/**
 * Fetch today's persistent active study plan.
 */
export async function getDailyStudyPlan(
  userId: string,
  date?: string
): Promise<{ success: boolean; plan: DailyStudyPlan | null }> {
  const query = new URLSearchParams();
  query.set('userId', userId);
  if (date) query.set('date', date);

  const res = await fetch(`/api/agent/plan?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load daily study plan (${res.status})`);
  }
  return res.json();
}

/**
 * Generate a personalized daily study plan grounded in actual learner state and uploaded resources.
 */
export async function generateDailyStudyPlan(params: {
  userId: string;
  targetMinutes?: number;
  examDate?: string | null;
  forceRegenerate?: boolean;
}): Promise<{ success: boolean; plan: DailyStudyPlan }> {
  const res = await fetch('/api/agent/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate study plan (${res.status})`);
  }
  return res.json();
}

/**
 * Update plan item status (pending, in_progress, completed, skipped).
 * Completed items are automatically logged to the learner events history.
 */
export async function updateStudyPlanItem(
  itemId: string,
  userId: string,
  status: PlanItemStatus
): Promise<{ success: boolean; item: StudyPlanItem }> {
  const res = await fetch('/api/agent/plan/item/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, userId, status }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update study plan item (${res.status})`);
  }
  return res.json();
}

/**
 * Ask the conversational study agent using actual learner state and grounded course evidence.
 */
export async function askStudyAgent(params: {
  userId: string;
  query: string;
  examDate?: string | null;
}): Promise<StudyAgentChatResponse> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to consult study agent (${res.status})`);
  }
  return res.json();
}
