import type { IncomingMessage } from 'node:http';
import {
  getAllLearnerMastery,
  getTopicLearnerMastery,
  getLearnerEventHistory,
  updateMasteryFromEvidence,
  initializeDiagnosticMastery,
} from './bktService.ts';
import { resolveContextUser } from './authMiddleware.ts';

interface SimpleRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string>;
  body?: any;
}

interface SimpleResponse {
  status(code: number): SimpleResponse;
  json(data: any): void;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
}

export async function learnerHandler(req: SimpleRequest, res: SimpleResponse): Promise<void> {
  const method = req.method || 'GET';
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  let userId: string;
  try {
    userId = await resolveContextUser(req as any);
  } catch (authErr: any) {
    res.status(401).json({ error: authErr.message || 'Unauthorized' });
    return;
  }

  // 1. GET /api/learner/mastery or /api/learner/mastery/:topic
  if (method === 'GET' && pathname.startsWith('/api/learner/mastery')) {
    try {
      const parts = pathname.split('/').filter(Boolean); // ['api', 'learner', 'mastery', optionalTopic]

      let topic: string | undefined = req.query?.topic;
      if (parts.length >= 4 && parts[3]) {
        topic = decodeURIComponent(parts[3]);
      }

      if (topic) {
        const topicMastery = await getTopicLearnerMastery(userId, topic);
        res.status(200).json({ success: true, topicMastery });
        return;
      }

      const masteryList = await getAllLearnerMastery(userId);
      res.status(200).json({ success: true, mastery: masteryList });
      return;
    } catch (err: any) {
      console.error('Error fetching learner mastery:', err);
      res.status(500).json({ error: 'Failed to fetch learner mastery', details: err.message });
      return;
    }
  }

  // 2. GET /api/learner/events
  if (method === 'GET' && pathname === '/api/learner/events') {
    try {
      const limit = Number(req.query?.limit || 50);
      const events = await getLearnerEventHistory(userId, limit);
      res.status(200).json({ success: true, events });
      return;
    } catch (err: any) {
      console.error('Error fetching learner events:', err);
      res.status(500).json({ error: 'Failed to fetch learner events', details: err.message });
      return;
    }
  }

  // 3. POST /api/learner/update
  if (method === 'POST' && pathname === '/api/learner/update') {
    try {
      const body = req.body || {};
      const {
        topic,
        subtopic,
        isCorrect,
        difficulty = 'medium',
        sourceId,
        eventType = 'ASSESSMENT_ANSWER',
        customParameters,
        evidenceDetails,
      } = body;

      if (!topic) {
        res.status(400).json({ error: 'Topic is required for mastery update' });
        return;
      }
      if (typeof isCorrect !== 'boolean') {
        res.status(400).json({ error: 'isCorrect (boolean) is required for mastery update' });
        return;
      }

      const result = await updateMasteryFromEvidence({
        userId,
        topic,
        subtopic,
        isCorrect,
        difficulty,
        sourceId,
        eventType,
        customParameters,
        evidenceDetails,
      });

      res.status(200).json({ success: true, update: result });
      return;
    } catch (err: any) {
      console.error('Error updating learner mastery:', err);
      res.status(500).json({ error: 'Failed to update learner mastery', details: err.message });
      return;
    }
  }

  // 4. POST /api/learner/diagnostic/init
  if (method === 'POST' && pathname === '/api/learner/diagnostic/init') {
    try {
      const body = req.body || {};
      const {
        topic,
        subtopic,
        score = 0,
        totalQuestions = 1,
        sourceId,
      } = body;

      if (!topic) {
        res.status(400).json({ error: 'Topic is required for diagnostic initialization' });
        return;
      }

      const result = await initializeDiagnosticMastery({
        userId,
        topic,
        subtopic,
        score: Number(score),
        totalQuestions: Number(totalQuestions),
        sourceId,
      });

      res.status(200).json({ success: true, diagnosticInit: result });
      return;
    } catch (err: any) {
      console.error('Error initializing diagnostic mastery:', err);
      res.status(500).json({ error: 'Failed to initialize diagnostic mastery', details: err.message });
      return;
    }
  }

  res.status(404).json({ error: `Learner route not found: ${method} ${pathname}` });
}
