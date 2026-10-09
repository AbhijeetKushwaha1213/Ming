/**
 * Client-Side Product Analytics API Client
 * - Connects to /api/analytics
 * - Emits privacy-conscious learner journey events
 * - Never transmits full documents, raw prompts, or credentials
 * - Provides non-blocking execution with offline fallback
 */

export interface AnalyticsEventRecord {
  id: string;
  userId: string;
  eventType: string;
  eventProperties: Record<string, any>;
  timestamp: string;
}

export interface AnalyticsSummary {
  userId: string;
  totalEvents: number;
  studySessionsCompleted: number;
  totalStudyMinutes: number;
  ingestionsSucceeded: number;
  ingestionsFailed: number;
  practiceAttemptsGraded: number;
  reviewSessionsCompleted: number;
  agentTasksCompleted: number;
  onboardingCompleted: boolean;
  eventCountsByType: Record<string, number>;
}

const LOCAL_EVENT_QUEUE_KEY = 'ming_pending_analytics_events';

function getLocalEventQueue(): Array<{ eventType: string; properties: Record<string, any>; timestamp: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_EVENT_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEventQueue(queue: Array<{ eventType: string; properties: Record<string, any>; timestamp: string }>) {
  try {
    localStorage.setItem(LOCAL_EVENT_QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch {}
}

/**
 * Core event tracking function.
 * Transmits event to server or enqueues locally if offline.
 */
export async function trackEvent(eventType: string, properties: Record<string, any> = {}): Promise<void> {
  const payload = {
    eventType,
    properties: {
      ...properties,
      clientTimestamp: new Date().toISOString(),
    },
  };

  try {
    const res = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Analytics server responded with ${res.status}`);
    }
  } catch (err) {
    // Non-blocking offline fallback
    const queue = getLocalEventQueue();
    queue.push({
      eventType,
      properties,
      timestamp: new Date().toISOString(),
    });
    saveLocalEventQueue(queue);
  }
}

export async function trackOnboardingCompleted(details: {
  learningMode: string;
  subjectsCount: number;
  academicDetails?: Record<string, any>;
}): Promise<void> {
  await trackEvent('ONBOARDING_COMPLETED', {
    learningMode: details.learningMode,
    subjectsCount: details.subjectsCount,
    degree: details.academicDetails?.degree,
    examType: details.academicDetails?.examType,
    targetYear: details.academicDetails?.targetYear,
  });
}

export async function trackStudySessionStarted(sessionType: string, topic?: string): Promise<void> {
  await trackEvent('STUDY_SESSION_STARTED', {
    sessionType,
    topic: topic || 'General',
  });
}

export async function trackStudySessionCompleted(
  sessionType: string,
  durationMinutes: number,
  topics: string[] = [],
): Promise<void> {
  await trackEvent('STUDY_SESSION_COMPLETED', {
    sessionType,
    durationMinutes: Math.max(1, durationMinutes),
    topicsCovered: topics,
  });
}

export async function trackMaterialIngestion(
  status: 'succeeded' | 'failed',
  metadata: {
    sourceType: string;
    title?: string;
    chunkCount?: number;
    durationMs?: number;
    error?: string;
  },
): Promise<void> {
  const eventType = status === 'succeeded' ? 'MATERIAL_INGESTION_SUCCEEDED' : 'MATERIAL_INGESTION_FAILED';
  await trackEvent(eventType, {
    sourceType: metadata.sourceType,
    title: metadata.title?.slice(0, 80),
    chunkCount: metadata.chunkCount || 0,
    durationMs: metadata.durationMs,
    error: metadata.error?.slice(0, 200),
  });
}

export async function trackPracticeAttempt(
  stage: 'submitted' | 'graded',
  metadata: {
    topic: string;
    subtopic?: string | null;
    totalQuestions: number;
    difficulty?: string;
    score?: number;
    percentage?: number;
    misconceptionCount?: number;
  },
): Promise<void> {
  const eventType = stage === 'submitted' ? 'PRACTICE_ATTEMPT_SUBMITTED' : 'PRACTICE_ATTEMPT_GRADED';
  await trackEvent(eventType, {
    topic: metadata.topic,
    subtopic: metadata.subtopic || undefined,
    totalQuestions: metadata.totalQuestions,
    difficulty: metadata.difficulty,
    score: metadata.score,
    percentage: metadata.percentage,
    misconceptionCount: metadata.misconceptionCount || 0,
  });
}

export async function trackReviewSessionCompleted(metadata: {
  topic: string;
  cardsReviewed: number;
  correctCount: number;
  accuracyPercentage: number;
}): Promise<void> {
  await trackEvent('REVIEW_SESSION_COMPLETED', {
    topic: metadata.topic,
    cardsReviewed: metadata.cardsReviewed,
    correctCount: metadata.correctCount,
    accuracyPercentage: Math.round(metadata.accuracyPercentage),
  });
}

export async function trackAgentTask(
  stage: 'completed' | 'failed',
  metadata: {
    actionId?: string;
    activityType: string;
    topic: string;
    reason?: string;
  },
): Promise<void> {
  const eventType = stage === 'completed' ? 'AGENT_TASK_COMPLETED' : 'AGENT_TASK_FAILED';
  await trackEvent(eventType, {
    actionId: metadata.actionId,
    activityType: metadata.activityType,
    topic: metadata.topic,
    reason: metadata.reason?.slice(0, 150),
  });
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  try {
    const res = await fetch('/api/analytics/summary');
    if (!res.ok) return null;
    const data = await res.json();
    return data.summary || null;
  } catch {
    return null;
  }
}

export async function fetchRecentAnalyticsEvents(limit = 50): Promise<AnalyticsEventRecord[]> {
  try {
    const res = await fetch(`/api/analytics/events?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}
