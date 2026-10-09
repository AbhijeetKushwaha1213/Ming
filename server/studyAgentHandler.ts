import type { IncomingMessage } from 'node:http';
import {
  computeDeterministicPriorities,
  generatePersonalizedDailyPlan,
  getTodayStudyPlan,
  updatePlanItemStatus,
  answerStudyAgentQuery,
  getOrComputeNextStudyAction,
  deliverStudyActivity,
  completeStudyActivityWithEvidence,
  skipStudyActivity,
  type PlanItemStatus,
} from './studyAgentService.ts';
import { resolveContextUser } from './authMiddleware.ts';

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

export async function studyAgentHandler(req: SimpleRequest, res: SimpleResponse): Promise<void> {
  const method = req.method || 'GET';
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. GET /api/agent/next-action (Study Loop: Get current or next action)
  if (method === 'GET' && pathname === '/api/agent/next-action') {
    try {
      const userId = await resolveContextUser(req);
      const result = await getOrComputeNextStudyAction(userId);
      res.status(200).json(result);
      return;
    } catch (err: any) {
      console.error('Error getting next study action:', err);
      res.status(500).json({ error: 'Failed to get next study action', details: err.message });
      return;
    }
  }

  // 2. POST /api/agent/activity/:actionId/complete (Study Loop: Complete activity)
  const completeMatch = pathname.match(/^\/api\/agent\/activity\/([^/]+)\/complete$/);
  if (method === 'POST' && completeMatch) {
    try {
      const userId = await resolveContextUser(req);
      const actionId = completeMatch[1];
      const result = await completeStudyActivityWithEvidence(userId, actionId, req.body);
      res.status(200).json(result);
      return;
    } catch (err: any) {
      console.error('Error completing study activity:', err);
      const status = err.message?.includes('unauthorized') || err.message?.includes('not found') ? 404 : 500;
      res.status(status).json({ error: 'Failed to complete study activity', details: err.message });
      return;
    }
  }

  // 3. POST /api/agent/activity/:actionId/skip (Study Loop: Skip activity)
  const skipMatch = pathname.match(/^\/api\/agent\/activity\/([^/]+)\/skip$/);
  if (method === 'POST' && skipMatch) {
    try {
      const userId = await resolveContextUser(req);
      const actionId = skipMatch[1];
      const result = await skipStudyActivity(userId, actionId, req.body?.reason);
      res.status(200).json(result);
      return;
    } catch (err: any) {
      console.error('Error skipping study activity:', err);
      const status = err.message?.includes('unauthorized') || err.message?.includes('not found') ? 404 : 500;
      res.status(status).json({ error: 'Failed to skip study activity', details: err.message });
      return;
    }
  }

  // 4. GET /api/agent/activity/:actionId (Study Loop: Deliver grounded activity)
  if (method === 'GET' && pathname.startsWith('/api/agent/activity/')) {
    try {
      const userId = await resolveContextUser(req);
      const parts = pathname.split('/').filter(Boolean);
      const actionId = parts[parts.length - 1];
      if (!actionId || actionId === 'activity') {
        res.status(400).json({ error: 'actionId is required in URL path' });
        return;
      }
      const result = await deliverStudyActivity(userId, actionId);
      res.status(200).json(result);
      return;
    } catch (err: any) {
      console.error('Error delivering study activity:', err);
      const status = err.message?.includes('unauthorized') || err.message?.includes('not found') ? 404 : 500;
      res.status(status).json({ error: 'Failed to deliver study activity', details: err.message });
      return;
    }
  }

  // 5. GET /api/agent/priorities
  if (method === 'GET' && pathname === '/api/agent/priorities') {
    try {
      const userId = await resolveContextUser(req);
      const examDate = (req.query?.examDate as string) || null;
      const availableMinutes = req.query?.availableMinutes ? Number(req.query.availableMinutes) : undefined;

      const result = await computeDeterministicPriorities({
        userId,
        examDate,
        availableMinutes,
      });

      res.status(200).json({ success: true, ...result });
      return;
    } catch (err: any) {
      console.error('Error computing priorities:', err);
      res.status(500).json({ error: 'Failed to compute study priorities', details: err.message });
      return;
    }
  }

  // 6. GET /api/agent/plan (Get today's active study plan)
  if (method === 'GET' && pathname === '/api/agent/plan') {
    try {
      const userId = await resolveContextUser(req);
      const date = (req.query?.date as string) || undefined;

      const plan = await getTodayStudyPlan(userId, date);
      res.status(200).json({ success: true, plan });
      return;
    } catch (err: any) {
      console.error('Error fetching today study plan:', err);
      res.status(500).json({ error: 'Failed to fetch study plan', details: err.message });
      return;
    }
  }

  // 7. POST /api/agent/plan/generate
  if (method === 'POST' && pathname === '/api/agent/plan/generate') {
    try {
      const body = req.body || {};
      const userId = await resolveContextUser(req);
      const targetMinutes = body.targetMinutes ? Number(body.targetMinutes) : 60;
      const examDate = body.examDate || null;
      const forceRegenerate = Boolean(body.forceRegenerate);

      const plan = await generatePersonalizedDailyPlan({
        userId,
        targetMinutes,
        examDate,
        forceRegenerate,
      });

      res.status(200).json({ success: true, plan });
      return;
    } catch (err: any) {
      console.error('Error generating daily study plan:', err);
      res.status(500).json({ error: 'Failed to generate study plan', details: err.message });
      return;
    }
  }

  // 8. PATCH /api/agent/plan/item/:id or POST /api/agent/plan/item/status
  if (
    (method === 'PATCH' && pathname.startsWith('/api/agent/plan/item/')) ||
    (method === 'POST' && pathname === '/api/agent/plan/item/status')
  ) {
    try {
      const body = req.body || {};
      const userId = await resolveContextUser(req);

      let itemId = body.itemId;
      if (!itemId && pathname.startsWith('/api/agent/plan/item/')) {
        const parts = pathname.split('/').filter(Boolean);
        itemId = parts[parts.length - 1];
      }

      const status = (body.status || 'completed') as PlanItemStatus;

      if (!itemId) {
        res.status(400).json({ error: 'itemId is required' });
        return;
      }

      if (!['pending', 'in_progress', 'completed', 'skipped', 'blocked'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be pending, in_progress, completed, skipped, or blocked.' });
        return;
      }

      const result = await updatePlanItemStatus(itemId, userId, status);
      res.status(200).json({ success: true, ...result });
      return;
    } catch (err: any) {
      console.error('Error updating plan item status:', err);
      res.status(500).json({ error: 'Failed to update plan item status', details: err.message });
      return;
    }
  }

  // 9. POST /api/agent/chat (Conversational Agent Entry Point)
  if (method === 'POST' && pathname === '/api/agent/chat') {
    try {
      const body = req.body || {};
      const userId = await resolveContextUser(req);
      const query = body.query;
      const examDate = body.examDate || null;

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'query is required' });
        return;
      }

      const response = await answerStudyAgentQuery({
        userId,
        query: query.trim(),
        examDate,
      });

      res.status(200).json({ success: true, ...response });
      return;
    } catch (err: any) {
      console.error('Error in study agent chat:', err);
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      res.status(status).json({ error: 'Failed to process study agent question', details: err.message });
      return;
    }
  }

  res.status(404).json({ error: `Study agent endpoint not found: ${method} ${pathname}` });
}
