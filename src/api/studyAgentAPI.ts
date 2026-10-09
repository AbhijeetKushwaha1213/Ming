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
  conceptId?: string | null;
  category?: string | null;
  questionId?: string | null;
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

export interface StudyAction {
  id: string;
  planId: string;
  userId: string;
  priority: number;
  priorityScore: number;
  topic: string;
  subtopic: string | null;
  conceptId: string | null;
  category: string;
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

export interface NextStudyActionResponse {
  success: boolean;
  action: StudyAction | null;
  lifecycleState: ActionLifecycleState;
  isColdStart: boolean;
  explanation?: string;
  generatedAt: string;
  error?: string;
}

export interface DeliverStudyActivityResponse {
  success: boolean;
  action: StudyAction;
  questions: any[];
  resource: {
    id: string;
    title: string;
    type: string;
    folder?: string | null;
    storagePath?: string | null;
    coordinate?: string | null;
  } | null;
  lifecycleState: ActionLifecycleState;
  deliveredAt: string;
  error?: string;
}

export interface CompleteStudyActivityResponse {
  success: boolean;
  completedActionId: string;
  completedAt: string;
  nextAction: StudyAction | null;
  lifecycleState: ActionLifecycleState;
  error?: string;
}

export interface SkipStudyActivityResponse {
  success: boolean;
  skippedActionId: string;
  reason: string | null;
  nextAction: StudyAction | null;
  lifecycleState: ActionLifecycleState;
  error?: string;
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
 * Update plan item status (pending, in_progress, completed, skipped, blocked).
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
 * Fetch the next authoritative study action in the learner study loop.
 */
export async function getNextStudyAction(userId?: string): Promise<NextStudyActionResponse> {
  const query = new URLSearchParams();
  if (userId) query.set('userId', userId);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`/api/agent/next-action${qStr}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch next study action (${res.status})`);
  }
  return res.json();
}

/**
 * Deliver content (questions, source coordinates) for a specific study action.
 */
export async function deliverStudyActivity(actionId: string, userId?: string): Promise<DeliverStudyActivityResponse> {
  const query = new URLSearchParams();
  if (userId) query.set('userId', userId);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`/api/agent/activity/${encodeURIComponent(actionId)}${qStr}`);
  if (!res.ok) {
    throw new Error(`Failed to deliver study activity (${res.status})`);
  }
  return res.json();
}

/**
 * Complete a study activity with evidence and advance the study loop.
 */
export async function completeStudyActivity(
  actionId: string,
  evaluationResult?: any,
  userId?: string
): Promise<CompleteStudyActivityResponse> {
  const res = await fetch(`/api/agent/activity/${encodeURIComponent(actionId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evaluationResult, userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to complete study activity (${res.status})`);
  }
  return res.json();
}

/**
 * Skip a study activity and advance to the next recommended action.
 */
export async function skipStudyActivity(
  actionId: string,
  reason?: string,
  userId?: string
): Promise<SkipStudyActivityResponse> {
  const res = await fetch(`/api/agent/activity/${encodeURIComponent(actionId)}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to skip study activity (${res.status})`);
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(`Failed to consult study agent (${res.status})`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
