import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordProductEvent,
  getUserAnalyticsSummary,
  getUserRecentEvents,
  CANONICAL_ANALYTICS_EVENTS,
} from '../../server/analyticsService.ts';
import { analyticsHandler } from '../../server/analyticsHandler.ts';
import { prisma, ensureAnalyticsSchema } from '../../server/prisma.ts';
import { validateProductionConfig, maskSecret } from '../../server/configValidator.ts';
import { getLivenessStatus, getReadinessStatus, safeUserId } from '../../server/observability.ts';
import {
  calculateStreakFromSessions,
  logStudySession,
  getLocalStudySessions,
  StudySessionRecord,
} from '../api/studyActivityAPI';
import {
  sanitizeClientProperties,
  getLocalEventQueue,
  saveLocalEventQueue,
  clearOfflineAnalyticsQueue,
} from '../api/analyticsAPI';

function createMockResponse() {
  const res = {
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
    setHeader(k: string, v: string) {
      res.headers[k] = v;
    },
  };
  return res;
}

describe('Phase 9 — Product Readiness, UX, Retention, Analytics & Deployment', () => {
  const userAlpha = 'user_audit_alpha_999';
  const userBeta = 'user_audit_beta_888';

  beforeEach(async () => {
    await ensureAnalyticsSchema();
    // Clean test data for test users
    await prisma.$executeRawUnsafe('DELETE FROM analytics_events WHERE userId IN (?, ?)', userAlpha, userBeta);
  });

  describe('1. Product Analytics & Privacy-Preserving Telemetry', () => {
    it('records all canonical analytics event types successfully', async () => {
      for (const eventType of CANONICAL_ANALYTICS_EVENTS) {
        const record = await recordProductEvent(userAlpha, eventType, {
          testField: 'verified',
        });
        expect(record.id).toMatch(/^evt_/);
        expect(record.userId).toBe(userAlpha);
        expect(record.eventType).toBe(eventType);
        expect(record.eventProperties.testField).toBe('verified');
      }
    });

    it('rejects non-canonical event types in recordProductEvent', async () => {
      await expect(
        recordProductEvent(userAlpha, 'UNAPPROVED_CUSTOM_EVENT', { topic: 'test' }),
      ).rejects.toThrow(/Invalid analytics eventType/);
    });

    it('scrubs sensitive credentials, tokens, and large prompt blobs from properties', async () => {
      const record = await recordProductEvent(userAlpha, 'STUDY_SESSION_STARTED', {
        password: 'super_secret_password',
        apiKey: 'AIzaSySecretApiKey',
        token: 'jwt.token.secret',
        authorization: 'Bearer secret_token',
        prompt: 'Large confidential student prompt that must never be stored',
        documentText: 'Full confidential lecture textbook content',
        sessionType: 'focus_session',
        validMetadata: 'safe_topic',
      });

      expect(record.eventProperties.password).toBe('[REDACTED]');
      expect(record.eventProperties.apiKey).toBe('[REDACTED]');
      expect(record.eventProperties.token).toBe('[REDACTED]');
      expect(record.eventProperties.authorization).toBe('[REDACTED]');

      expect(record.eventProperties.prompt).toBeUndefined();
      expect(record.eventProperties.documentText).toBeUndefined();

      expect(record.eventProperties.sessionType).toBe('focus_session');
      expect(record.eventProperties.validMetadata).toBe('safe_topic');
    });

    it('strips client attempts to inject or override userId in event properties', async () => {
      const record = await recordProductEvent(userAlpha, 'AGENT_TASK_COMPLETED', {
        userId: 'spoofed_user_id',
        user_id: 'spoofed_user_id_2',
        activityType: 'flashcards',
      });

      expect(record.userId).toBe(userAlpha);
      expect(record.eventProperties.userId).toBeUndefined();
      expect(record.eventProperties.user_id).toBeUndefined();
      expect(record.eventProperties.activityType).toBe('flashcards');
    });

    it('truncates excessively long string properties to prevent storage abuse', async () => {
      const giantString = 'A'.repeat(800);
      const record = await recordProductEvent(userAlpha, 'PRACTICE_ATTEMPT_SUBMITTED', {
        topic: giantString,
      });

      expect(record.eventProperties.topic.length).toBeLessThan(600);
      expect(record.eventProperties.topic).toContain('[TRUNCATED]');
    });
  });

  describe('2. Multi-Tenant Isolation & Boundary Enforcement', () => {
    it('strictly isolates analytics summaries between tenants', async () => {
      await recordProductEvent(userAlpha, 'ONBOARDING_COMPLETED', { mode: 'college' });
      await recordProductEvent(userAlpha, 'STUDY_SESSION_COMPLETED', { durationMinutes: 25, topics: ['Operating Systems'] });
      await recordProductEvent(userAlpha, 'REVIEW_SESSION_COMPLETED', { cardsReviewed: 10, correctCount: 9 });

      await recordProductEvent(userBeta, 'STUDY_SESSION_COMPLETED', { durationMinutes: 45, topics: ['Algorithms'] });

      const summaryAlpha = await getUserAnalyticsSummary(userAlpha);
      const summaryBeta = await getUserAnalyticsSummary(userBeta);

      expect(summaryAlpha.totalEvents).toBe(3);
      expect(summaryAlpha.onboardingCompleted).toBe(true);
      expect(summaryAlpha.studySessionsCompleted).toBe(1);
      expect(summaryAlpha.totalStudyMinutes).toBe(25);
      expect(summaryAlpha.reviewSessionsCompleted).toBe(1);

      expect(summaryBeta.totalEvents).toBe(1);
      expect(summaryBeta.onboardingCompleted).toBe(false);
      expect(summaryBeta.studySessionsCompleted).toBe(1);
      expect(summaryBeta.totalStudyMinutes).toBe(45);
      expect(summaryBeta.reviewSessionsCompleted).toBe(0);
    });

    it('prevents cross-tenant event stream leakage in getUserRecentEvents', async () => {
      await recordProductEvent(userAlpha, 'AGENT_TASK_COMPLETED', { actionId: 'act_alpha' });
      await recordProductEvent(userBeta, 'AGENT_TASK_COMPLETED', { actionId: 'act_beta' });

      const eventsAlpha = await getUserRecentEvents(userAlpha, 10);
      const eventsBeta = await getUserRecentEvents(userBeta, 10);

      expect(eventsAlpha.every((e) => e.userId === userAlpha)).toBe(true);
      expect(eventsBeta.every((e) => e.userId === userBeta)).toBe(true);

      const alphaIds = eventsAlpha.map((e) => e.eventProperties.actionId);
      expect(alphaIds).toContain('act_alpha');
      expect(alphaIds).not.toContain('act_beta');
    });

    it('safeUserId hashes raw user identifiers for operational logs', () => {
      const masked = safeUserId('user_confidential_123456');
      expect(masked).toMatch(/^usr_[a-f0-9]{8}$/);
      expect(masked).not.toContain('confidential');
    });
  });

  describe('3. Server Analytics Handler Authorization & Impersonation Prevention', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const req = {
        method: 'POST',
        url: '/api/analytics/track',
        headers: {},
        body: { eventType: 'STUDY_SESSION_STARTED' },
      };
      const res = createMockResponse();

      await analyticsHandler(req, res);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('prevents tenant impersonation when client submits another userId in body (403)', async () => {
      const req = {
        method: 'POST',
        url: '/api/analytics/track',
        headers: {
          'x-dev-user-id': userAlpha,
        },
        body: {
          userId: userBeta, // Attempting to impersonate userBeta!
          eventType: 'STUDY_SESSION_STARTED',
        },
      };
      const res = createMockResponse();

      await analyticsHandler(req, res);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/);
    });

    it('rejects non-canonical event types with 400', async () => {
      const req = {
        method: 'POST',
        url: '/api/analytics/track',
        headers: {
          'x-dev-user-id': userAlpha,
        },
        body: {
          eventType: 'HACKATHON_DEMO_INVALID_EVENT',
        },
      };
      const res = createMockResponse();

      await analyticsHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Invalid eventType/);
    });

    it('rejects malformed array properties with 400', async () => {
      const req = {
        method: 'POST',
        url: '/api/analytics/track',
        headers: {
          'x-dev-user-id': userAlpha,
        },
        body: {
          eventType: 'STUDY_SESSION_STARTED',
          properties: ['invalid_array_payload'],
        },
      };
      const res = createMockResponse();

      await analyticsHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Event properties must be a valid JSON key-value object/);
    });

    it('accepts and records valid authenticated events with 201', async () => {
      const req = {
        method: 'POST',
        url: '/api/analytics/track',
        headers: {
          'x-dev-user-id': userAlpha,
        },
        body: {
          eventType: 'STUDY_SESSION_STARTED',
          properties: { sessionType: 'flashcards', topic: 'Data Structures' },
        },
      };
      const res = createMockResponse();

      await analyticsHandler(req, res);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event.userId).toBe(userAlpha);
    });
  });

  describe('4. Client Offline Queue Privacy & Isolation', () => {
    it('sanitizes sensitive fields client-side BEFORE writing to queue', () => {
      const sanitized = sanitizeClientProperties({
        password: 'student_password',
        token: 'auth_token',
        prompt: 'Prompt content',
        documentText: 'Notes content',
        userId: 'spoofed_user',
        validTopic: 'Calculus',
        rating: 5,
      });

      expect(sanitized.password).toBeUndefined();
      expect(sanitized.token).toBeUndefined();
      expect(sanitized.prompt).toBeUndefined();
      expect(sanitized.documentText).toBeUndefined();
      expect(sanitized.userId).toBeUndefined();
      expect(sanitized.validTopic).toBe('Calculus');
      expect(sanitized.rating).toBe(5);
    });

    it('scopes offline event queue per user ID and prevents cross-user pollution', () => {
      clearOfflineAnalyticsQueue(userAlpha);
      clearOfflineAnalyticsQueue(userBeta);

      saveLocalEventQueue(
        [{ eventId: '1', eventType: 'ONBOARDING_COMPLETED', properties: {}, timestamp: '2026-10-09', retryCount: 0 }],
        userAlpha,
      );

      const queueAlpha = getLocalEventQueue(userAlpha);
      const queueBeta = getLocalEventQueue(userBeta);

      expect(queueAlpha.length).toBe(1);
      expect(queueBeta.length).toBe(0);

      clearOfflineAnalyticsQueue(userAlpha);
      expect(getLocalEventQueue(userAlpha).length).toBe(0);
    });
  });

  describe('5. End-to-End Study Session Integrity & Idempotency', () => {
    it('is strictly idempotent: logging with the same id returns existing record without duplicating', async () => {
      const testSessionId = `test_session_${Date.now()}`;

      const first = await logStudySession({
        id: testSessionId,
        userId: userAlpha,
        durationMinutes: 30,
        sessionType: 'focus_session',
        topic: 'Discrete Mathematics',
      });

      const second = await logStudySession({
        id: testSessionId,
        userId: userAlpha,
        durationMinutes: 30,
        sessionType: 'focus_session',
        topic: 'Discrete Mathematics',
      });

      expect(first.id).toBe(testSessionId);
      expect(second.id).toBe(testSessionId);

      const all = getLocalStudySessions(userAlpha);
      const matching = all.filter((s) => s.id === testSessionId);
      expect(matching.length).toBe(1); // Exactly 1, never duplicated!
    });

    it('bounds session duration to maximum 480 minutes (8 hours) to prevent metric inflation', async () => {
      const session = await logStudySession({
        userId: userAlpha,
        durationMinutes: 999999, // Unreasonable input
        sessionType: 'focus_session',
        topic: 'Algorithms',
      });

      expect(session.duration_minutes).toBe(480);
    });

    it('calculates consecutive streak accurately from real persisted study sessions', () => {
      const today = new Date();
      const format = (d: Date) => d.toISOString().split('T')[0];

      const d0 = new Date(today);
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 1);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 2);

      const consecutiveSessions: StudySessionRecord[] = [
        {
          id: 's0',
          user_id: userAlpha,
          session_type: 'focus_session',
          duration_minutes: 25,
          topics_covered: ['Math'],
          session_date: format(d0),
          created_at: `${format(d0)}T10:00:00Z`,
        },
        {
          id: 's1',
          user_id: userAlpha,
          session_type: 'flashcards',
          duration_minutes: 15,
          topics_covered: ['Physics'],
          session_date: format(d1),
          created_at: `${format(d1)}T10:00:00Z`,
        },
        {
          id: 's2',
          user_id: userAlpha,
          session_type: 'quiz',
          duration_minutes: 20,
          topics_covered: ['Chemistry'],
          session_date: format(d2),
          created_at: `${format(d2)}T10:00:00Z`,
        },
      ];

      const streak = calculateStreakFromSessions(consecutiveSessions);
      expect(streak).toBe(3);
    });

    it('resets streak to 0 when no study activity has occurred within 48 hours', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const format = (d: Date) => d.toISOString().split('T')[0];

      const brokenSessions: StudySessionRecord[] = [
        {
          id: 's_old',
          user_id: userAlpha,
          session_type: 'focus_session',
          duration_minutes: 30,
          topics_covered: ['Math'],
          session_date: format(pastDate),
          created_at: `${format(pastDate)}T10:00:00Z`,
        },
      ];

      const streak = calculateStreakFromSessions(brokenSessions);
      expect(streak).toBe(0);
    });
  });

  describe('6. Deployment Readiness & Diagnostic Health Probes', () => {
    it('returns valid liveness status probe', () => {
      const live = getLivenessStatus();
      expect(live.status).toBe('live');
      expect(typeof live.uptimeSeconds).toBe('number');
      expect(live.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('verifies database readiness check including analytics schema', async () => {
      const ready = await getReadinessStatus();
      expect(ready.statusCode).toBe(200);
      expect(ready.ready).toBe(true);
      expect(ready.checks.api).toBe('ok');
      expect(ready.checks.database).toMatch(/^ok/);
    });

    it('maskSecret safely truncates API keys without revealing raw values', () => {
      expect(maskSecret('AIzaSy1234567890abcdefg')).toBe('AIza...defg');
      expect(maskSecret('short')).toBe('********');
      expect(maskSecret('')).toBe('(not set)');
    });

    it('validates development environment mode cleanly without fatal errors', () => {
      const config = validateProductionConfig();
      expect(config.environment).toBeDefined();
      expect(config.publicConfig.embeddingDimension).toBe(384);
      expect(config.publicConfig.embeddingModel).toBe('all-MiniLM-L6-v2');
    });
  });
});
