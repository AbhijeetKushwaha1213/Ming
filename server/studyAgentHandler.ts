import type { IncomingMessage } from 'node:http';
import {
  computeDeterministicPriorities,
  generatePersonalizedDailyPlan,
  getTodayStudyPlan,
  updatePlanItemStatus,
  answerStudyAgentQuery,
  type PlanItemStatus,
} from './studyAgentService.ts';
import { verifySupabaseToken } from './supabaseAuth.ts';

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

async function resolveUserId(req: SimpleRequest, fallbackBodyUserId?: string): Promise<string> {
  const authHeader = req.headers?.authorization as string | undefined;
  if (authHeader) {
    try {
      const user = await verifySupabaseToken(authHeader);
      return user.id;
    } catch {
      // Fallback if token is expired or testing
    }
  }
  return (req.query?.userId as string) || fallbackBodyUserId || 'default_user';
}

export async function studyAgentHandler(req: SimpleRequest, res: SimpleResponse): Promise<void> {
  const method = req.method || 'GET';
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. GET /api/agent/priorities
  if (method === 'GET' && pathname === '/api/agent/priorities') {
    try {
      const userId = await resolveUserId(req);
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

  // 2. GET /api/agent/plan (Get today's active study plan)
  if (method === 'GET' && pathname === '/api/agent/plan') {
    try {
      const userId = await resolveUserId(req);
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

  // 3. POST /api/agent/plan/generate
  if (method === 'POST' && pathname === '/api/agent/plan/generate') {
    try {
      const body = req.body || {};
      const userId = await resolveUserId(req, body.userId);
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

  // 4. PATCH /api/agent/plan/item/:id or POST /api/agent/plan/item/status
  if (
    (method === 'PATCH' && pathname.startsWith('/api/agent/plan/item/')) ||
    (method === 'POST' && pathname === '/api/agent/plan/item/status')
  ) {
    try {
      const body = req.body || {};
      const userId = await resolveUserId(req, body.userId);

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

      if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be pending, in_progress, completed, or skipped.' });
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

  // 5. POST /api/agent/chat (Conversational Agent Entry Point)
  if (method === 'POST' && pathname === '/api/agent/chat') {
    try {
      const body = req.body || {};
      const userId = await resolveUserId(req, body.userId);
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
      res.status(500).json({ error: 'Failed to process study agent question', details: err.message });
      return;
    }
  }

  res.status(404).json({ error: `Study agent endpoint not found: ${method} ${pathname}` });
}
