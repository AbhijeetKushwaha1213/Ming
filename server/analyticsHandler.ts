import { resolveContextUser, checkRateLimit } from './authMiddleware.ts';
import {
  recordProductEvent,
  getUserAnalyticsSummary,
  getUserRecentEvents,
  CANONICAL_ANALYTICS_EVENTS,
} from './analyticsService.ts';

interface SimpleRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | undefined>;
  body?: any;
}

interface SimpleResponse {
  status(code: number): SimpleResponse;
  json(data: any): void;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
}

export async function analyticsHandler(req: SimpleRequest, res: SimpleResponse): Promise<void> {
  const method = req.method || 'GET';
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. Enforce rate limiting
  const rateLimit = checkRateLimit(req, 'general');
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded. Please retry later.',
      retryAfterSec: rateLimit.retryAfterSec,
    });
    return;
  }

  // 2. Public definitions endpoint (does not require authentication)
  if (method === 'GET' && pathname === '/api/analytics/definitions') {
    res.status(200).json({
      success: true,
      canonicalEvents: CANONICAL_ANALYTICS_EVENTS,
      privacyPolicy: 'Zero PII, zero document bodies, zero raw prompts stored.',
    });
    return;
  }

  // 3. Resolve authenticated user identity (fail-closed against anonymous impersonation)
  let userId: string;
  try {
    userId = await resolveContextUser(req, false);
  } catch (authErr: any) {
    res.status(401).json({
      error: 'Unauthorized: Valid authentication token or session is required',
    });
    return;
  }

  // 4. Prevent tenant impersonation through body or query overrides
  if (req.body?.userId && req.body.userId !== userId) {
    res.status(403).json({
      error: 'Forbidden: Cannot submit analytics events on behalf of another user identity',
    });
    return;
  }

  if (req.query?.userId && req.query.userId !== userId) {
    res.status(403).json({
      error: 'Forbidden: Cannot access analytics data for another user identity',
    });
    return;
  }

  // 5. POST /api/analytics/track
  if (method === 'POST' && (pathname === '/api/analytics/track' || pathname === '/api/analytics')) {
    try {
      const { eventType, properties } = req.body || {};

      if (!eventType || typeof eventType !== 'string' || eventType.trim().length === 0) {
        res.status(400).json({ error: 'Valid eventType string is required' });
        return;
      }

      const normalizedType = eventType.trim().toUpperCase();
      if (!CANONICAL_ANALYTICS_EVENTS.includes(normalizedType as any)) {
        res.status(400).json({
          error: `Invalid eventType: "${eventType}". Must be one of canonical events: ${CANONICAL_ANALYTICS_EVENTS.join(', ')}`,
        });
        return;
      }

      if (properties !== undefined && (typeof properties !== 'object' || properties === null || Array.isArray(properties))) {
        res.status(400).json({ error: 'Event properties must be a valid JSON key-value object' });
        return;
      }

      const recorded = await recordProductEvent(userId, normalizedType, properties || {});
      res.status(201).json({ success: true, event: recorded });
      return;
    } catch (err: any) {
      console.error('Analytics track error:', err);
      res.status(500).json({ error: 'Failed to record analytics event' });
      return;
    }
  }

  // 6. GET /api/analytics/summary
  if (method === 'GET' && pathname === '/api/analytics/summary') {
    try {
      const summary = await getUserAnalyticsSummary(userId);
      res.status(200).json({ success: true, summary });
      return;
    } catch (err: any) {
      console.error('Analytics summary error:', err);
      res.status(500).json({ error: 'Failed to fetch analytics summary' });
      return;
    }
  }

  // 7. GET /api/analytics/events
  if (method === 'GET' && pathname === '/api/analytics/events') {
    try {
      const limitRaw = req.query?.limit ? parseInt(req.query.limit, 10) : 50;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
      const events = await getUserRecentEvents(userId, limit);
      res.status(200).json({ success: true, events, count: events.length });
      return;
    } catch (err: any) {
      console.error('Analytics events error:', err);
      res.status(500).json({ error: 'Failed to fetch analytics events' });
      return;
    }
  }

  res.status(404).json({ error: 'Not found' });
}
