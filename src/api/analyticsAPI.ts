/**
 * Client-Side Product Analytics API Client
 * - Connects to /api/analytics
 * - Emits privacy-conscious learner journey events
 * - Never transmits or locally stores full documents, raw prompts, or credentials
 * - Sanitizes all properties client-side BEFORE writing to localStorage offline queue
 * - Scopes offline queues per-user to prevent cross-account event pollution on logout/login
 * - Enforces queue bounds, dead-letter eviction for permanent 4xx rejections, and retry limits
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

export interface QueuedAnalyticsEvent {
  eventId: string;
  eventType: string;
  properties: Record<string, any>;
  timestamp: string;
  retryCount: number;
}

const LOCAL_EVENT_QUEUE_KEY_PREFIX = 'ming_pending_analytics_';
const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_COUNT = 3;

export function getActiveUserId(): string {
  try {
    if (typeof localStorage === 'undefined') return 'default_user';
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const uid = parsed?.user?.id || parsed?.currentSession?.user?.id;
          if (uid) return uid;
        }
      }
    }
  } catch {}
  return 'default_user';
}

function getQueueKey(userId?: string): string {
  const resolved = userId || getActiveUserId();
  return `${LOCAL_EVENT_QUEUE_KEY_PREFIX}${resolved}`;
}

/**
 * Sanitizes event properties client-side before network transmission or local persistence.
 * Prevents credentials, raw document text, prompts, and PII from ever touching localStorage.
 */
export function sanitizeClientProperties(raw: Record<string, any> = {}): Record<string, any> {
  const clean: Record<string, any> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return clean;
  }

  let count = 0;
  for (const [key, val] of Object.entries(raw)) {
    if (count >= 20) break;

    const lowerKey = key.toLowerCase();
    // 1. Strip user identity overrides
    if (lowerKey === 'userid' || lowerKey === 'user_id') {
      continue;
    }

    // 2. Strip credentials, tokens, and secrets
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('auth')
    ) {
      continue;
    }

    // 3. Strip raw document bodies and AI prompts
    if (
      lowerKey.includes('prompt') ||
      lowerKey.includes('documenttext') ||
      lowerKey.includes('rawcontent') ||
      lowerKey.includes('base64') ||
      lowerKey.includes('fulltext')
    ) {
      continue;
    }

    count++;
    if (typeof val === 'string') {
      clean[key] = val.length > 250 ? val.slice(0, 250) + '...[TRUNCATED]' : val;
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    } else if (Array.isArray(val)) {
      // Safe array: only take string/number elements, max 10
      clean[key] = val.slice(0, 10).map((item) => (typeof item === 'string' ? item.slice(0, 50) : item));
    } else if (val && typeof val === 'object') {
      // Shallow object only
      clean[key] = '[Nested Object]';
    }
  }

  return clean;
}

export function getLocalEventQueue(userId?: string): QueuedAnalyticsEvent[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(getQueueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalEventQueue(queue: QueuedAnalyticsEvent[], userId?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const bounded = queue.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(getQueueKey(userId), JSON.stringify(bounded));
  } catch {}
}

/**
 * Clears the offline queue for a specific user (or active user), e.g. on logout or account switch.
 */
export function clearOfflineAnalyticsQueue(userId?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(getQueueKey(userId));
  } catch {}
}

/**
 * Flushes pending offline events for the specified or active user.
 * Discards permanent 4xx failures and increments retryCount on transient network failures.
 */
export async function flushOfflineEventQueue(userId?: string): Promise<number> {
  const currentUserId = userId || getActiveUserId();
  const queue = getLocalEventQueue(currentUserId);
  if (queue.length === 0) return 0;

  const remainingQueue: QueuedAnalyticsEvent[] = [];
  let deliveredCount = 0;

  for (const item of queue) {
    try {
      const res = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: item.eventType,
          properties: item.properties,
        }),
      });

      if (res.ok) {
        deliveredCount++;
        // Successfully delivered: dropped from queue
      } else if (res.status >= 400 && res.status < 500) {
        // Permanent failure (malformed payload, invalid eventType, unauthorized): drop immediately
        console.warn(`[Analytics] Dropping permanently rejected event: ${item.eventType} (${res.status})`);
      } else {
        // Transient server error: increment retry count
        if (item.retryCount + 1 < MAX_RETRY_COUNT) {
          remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    } catch {
      // Network failure
      if (item.retryCount + 1 < MAX_RETRY_COUNT) {
        remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }

  saveLocalEventQueue(remainingQueue, currentUserId);
  return deliveredCount;
}

/**
 * Core event tracking function.
 * Sanitizes payload, transmits to server or enqueues safely into scoped local storage.
 */
export async function trackEvent(
  eventType: string,
  properties: Record<string, any> = {},
  targetUserId?: string,
): Promise<void> {
  const sanitized = sanitizeClientProperties(properties);
  const currentUserId = targetUserId || getActiveUserId();

  const payload = {
    eventType,
    properties: {
      ...sanitized,
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
      if (res.status >= 400 && res.status < 500) {
        // Non-retryable client error
        return;
      }
      throw new Error(`Analytics server responded with ${res.status}`);
    }
  } catch {
    // Non-blocking offline fallback with client-side sanitized properties
    const queue = getLocalEventQueue(currentUserId);
    queue.push({
      eventId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      properties: sanitized,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
    saveLocalEventQueue(queue, currentUserId);
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
    durationMinutes: Math.max(1, Math.min(Math.round(durationMinutes), 480)),
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
    error: metadata.error?.slice(0, 150),
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
