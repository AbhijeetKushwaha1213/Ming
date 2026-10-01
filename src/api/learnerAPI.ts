export type MasteryStatus = 'unassessed' | 'developing' | 'proficient' | 'mastered';

export interface BKTParameters {
  pL0: number;
  pT: number;
  pG: number;
  pS: number;
}

export interface LearnerMasteryRecord {
  id: string;
  userId: string;
  courseId: string | null;
  topic: string;
  subtopic: string | null;
  masteryProbability: number;
  masteryPercentage: number;
  attempts: number;
  correctCount: number;
  incorrectCount: number;
  confidence: number;
  status: MasteryStatus;
  lastAssessedAt: string | null;
  subtopics?: Array<{
    subtopic: string;
    masteryProbability: number;
    status: MasteryStatus;
    attempts: number;
  }>;
}

export interface LearnerEventRecord {
  id: string;
  userId: string;
  topic: string;
  subtopic: string | null;
  eventType: string;
  sourceId: string | null;
  priorMastery: number;
  posteriorMastery: number;
  isCorrect: boolean | null;
  difficulty: string | null;
  parameters: BKTParameters | null;
  evidenceDetails: string | null;
  timestamp: string;
}

/**
 * Fetch all mastery records for an authenticated student.
 */
export async function getLearnerMastery(userId: string): Promise<{ success: boolean; mastery: LearnerMasteryRecord[] }> {
  const res = await fetch(`/api/learner/mastery?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load learner mastery (${res.status})`);
  }
  return res.json();
}

/**
 * Fetch specific topic mastery for an authenticated student.
 */
export async function getTopicMastery(
  userId: string,
  topic: string
): Promise<{ success: boolean; topicMastery: LearnerMasteryRecord }> {
  const res = await fetch(`/api/learner/mastery?userId=${encodeURIComponent(userId)}&topic=${encodeURIComponent(topic)}`);
  if (!res.ok) {
    throw new Error(`Failed to load topic mastery (${res.status})`);
  }
  return res.json();
}

/**
 * Fetch auditable learner event history.
 */
export async function getLearnerEvents(
  userId: string,
  limit: number = 30
): Promise<{ success: boolean; events: LearnerEventRecord[] }> {
  const res = await fetch(`/api/learner/events?userId=${encodeURIComponent(userId)}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load learner events (${res.status})`);
  }
  return res.json();
}

/**
 * Update learner mastery from single evidence or assessment.
 */
export async function updateLearnerMastery(params: {
  userId: string;
  topic: string;
  subtopic?: string;
  isCorrect: boolean;
  difficulty?: string;
  sourceId?: string;
  eventType?: string;
  evidenceDetails?: string;
}): Promise<any> {
  const res = await fetch('/api/learner/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to update learner mastery (${res.status})`);
  }
  return res.json();
}

/**
 * Initialize cold-start diagnostic mastery.
 */
export async function initializeDiagnosticState(params: {
  userId: string;
  topic: string;
  subtopic?: string;
  score: number;
  totalQuestions: number;
  sourceId?: string;
}): Promise<any> {
  const res = await fetch('/api/learner/diagnostic/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to initialize diagnostic mastery (${res.status})`);
  }
  return res.json();
}
