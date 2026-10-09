/**
 * Server-Side Product Analytics & Telemetry Service
 * - Records privacy-conscious product usage events.
 * - Enforces strict tenant isolation (per-user boundary).
 * - Never captures raw document bodies, full prompts, credentials, or PII.
 * - Emits structured JSON logs via observability module.
 */

import crypto from 'node:crypto';
import { prisma, ensureAnalyticsSchema } from './prisma.ts';
import { logStructured, safeUserId, scrubSensitiveData } from './observability.ts';

export const CANONICAL_ANALYTICS_EVENTS = [
  'ONBOARDING_COMPLETED',
  'STUDY_SESSION_STARTED',
  'STUDY_SESSION_COMPLETED',
  'MATERIAL_INGESTION_SUCCEEDED',
  'MATERIAL_INGESTION_FAILED',
  'PRACTICE_ATTEMPT_SUBMITTED',
  'PRACTICE_ATTEMPT_GRADED',
  'REVIEW_SESSION_COMPLETED',
  'AGENT_TASK_COMPLETED',
  'AGENT_TASK_FAILED',
] as const;

export type CanonicalAnalyticsEventType = (typeof CANONICAL_ANALYTICS_EVENTS)[number];

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

/**
 * Validates and records a privacy-conscious product event for the authenticated user.
 */
export async function recordProductEvent(
  userId: string,
  eventType: string,
  properties: Record<string, any> = {},
): Promise<AnalyticsEventRecord> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required to record analytics event');
  }

  const normalizedEventType = eventType.trim().toUpperCase();
  await ensureAnalyticsSchema();

  // Strip any accidental sensitive data, raw text blobs, or long prompts
  const cleanProperties: Record<string, any> = {};
  const scrubbed = scrubSensitiveData(properties);

  for (const [key, val] of Object.entries(scrubbed)) {
    // Exclude large raw contents or prompts to preserve privacy and storage efficiency
    if (
      key.toLowerCase().includes('prompt') ||
      key.toLowerCase().includes('documenttext') ||
      key.toLowerCase().includes('rawcontent') ||
      key.toLowerCase().includes('base64') ||
      key.toLowerCase().includes('fulltext')
    ) {
      continue;
    }

    if (typeof val === 'string' && val.length > 500) {
      cleanProperties[key] = val.slice(0, 500) + '...[TRUNCATED]';
    } else {
      cleanProperties[key] = val;
    }
  }

  const eventId = `evt_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const propertiesJson = JSON.stringify(cleanProperties);

  await prisma.$executeRawUnsafe(
    `INSERT INTO analytics_events (id, userId, eventType, eventPropertiesJson, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    eventId,
    userId,
    normalizedEventType,
    propertiesJson,
    timestamp,
  );

  // Structured operational log
  logStructured('info', `Analytics event: ${normalizedEventType}`, {
    userId: safeUserId(userId),
    route: '/api/analytics/track',
    method: 'POST',
    durationMs: 0,
    eventType: normalizedEventType,
    properties: cleanProperties,
  });

  return {
    id: eventId,
    userId,
    eventType: normalizedEventType,
    eventProperties: cleanProperties,
    timestamp,
  };
}

/**
 * Computes an aggregated product telemetry summary for the authenticated user.
 * Strictly scoped to userId for tenant isolation.
 */
export async function getUserAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required to fetch analytics summary');
  }

  await ensureAnalyticsSchema();

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT eventType, eventPropertiesJson FROM analytics_events WHERE userId = ?`,
    userId,
  )) as Array<{ eventType: string; eventPropertiesJson: string | null }>;

  const eventCountsByType: Record<string, number> = {};
  let totalStudyMinutes = 0;
  let studySessionsCompleted = 0;
  let ingestionsSucceeded = 0;
  let ingestionsFailed = 0;
  let practiceAttemptsGraded = 0;
  let reviewSessionsCompleted = 0;
  let agentTasksCompleted = 0;
  let onboardingCompleted = false;

  for (const row of rows) {
    const type = row.eventType;
    eventCountsByType[type] = (eventCountsByType[type] || 0) + 1;

    let props: Record<string, any> = {};
    if (row.eventPropertiesJson) {
      try {
        props = JSON.parse(row.eventPropertiesJson);
      } catch {}
    }

    if (type === 'ONBOARDING_COMPLETED') {
      onboardingCompleted = true;
    } else if (type === 'STUDY_SESSION_COMPLETED') {
      studySessionsCompleted++;
      if (typeof props.durationMinutes === 'number' && props.durationMinutes > 0) {
        totalStudyMinutes += props.durationMinutes;
      }
    } else if (type === 'MATERIAL_INGESTION_SUCCEEDED') {
      ingestionsSucceeded++;
    } else if (type === 'MATERIAL_INGESTION_FAILED') {
      ingestionsFailed++;
    } else if (type === 'PRACTICE_ATTEMPT_GRADED') {
      practiceAttemptsGraded++;
    } else if (type === 'REVIEW_SESSION_COMPLETED') {
      reviewSessionsCompleted++;
    } else if (type === 'AGENT_TASK_COMPLETED') {
      agentTasksCompleted++;
    }
  }

  return {
    userId,
    totalEvents: rows.length,
    studySessionsCompleted,
    totalStudyMinutes,
    ingestionsSucceeded,
    ingestionsFailed,
    practiceAttemptsGraded,
    reviewSessionsCompleted,
    agentTasksCompleted,
    onboardingCompleted,
    eventCountsByType,
  };
}

/**
 * Retrieves recent analytics events for the authenticated user with limit.
 * Strictly scoped to userId for tenant isolation.
 */
export async function getUserRecentEvents(userId: string, limit = 50): Promise<AnalyticsEventRecord[]> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required to fetch analytics events');
  }

  await ensureAnalyticsSchema();
  const boundedLimit = Math.max(1, Math.min(limit, 200));

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, userId, eventType, eventPropertiesJson, timestamp
     FROM analytics_events
     WHERE userId = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    userId,
    boundedLimit,
  )) as Array<{
    id: string;
    userId: string;
    eventType: string;
    eventPropertiesJson: string | null;
    timestamp: string;
  }>;

  return rows.map((r) => {
    let props: Record<string, any> = {};
    if (r.eventPropertiesJson) {
      try {
        props = JSON.parse(r.eventPropertiesJson);
      } catch {}
    }
    return {
      id: r.id,
      userId: r.userId,
      eventType: r.eventType,
      eventProperties: props,
      timestamp: r.timestamp,
    };
  });
}
