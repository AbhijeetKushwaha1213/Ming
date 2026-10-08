import type { RouteRequest, RouteResponse } from './types.ts';
import {
  getUserDAGs,
  getDAGById,
  saveDAG,
  updateDAGProgress,
  deleteDAG,
} from './dagService.ts';
import { resolveContextUser } from './authMiddleware.ts';

export async function dagHandler(req: RouteRequest, res: RouteResponse) {
  const method = req.method?.toUpperCase();
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    const userId = await resolveContextUser(req);

    // 1. List user DAGs: GET /api/dag/list
    if (method === 'GET' && pathname === '/api/dag/list') {
      const dags = await getUserDAGs(userId);
      res.status(200).json({ success: true, dags });
      return;
    }

    // 2. Save DAG: POST /api/dag/save
    if (method === 'POST' && pathname === '/api/dag/save') {
      if (!req.body?.topic && !req.body?.title) {
        res.status(400).json({ error: 'Topic or title is required' });
        return;
      }
      const saved = await saveDAG(userId, req.body);
      res.status(200).json({ success: true, dag: saved });
      return;
    }

    // 3. Update Progress: POST /api/dag/:id/progress
    if (method === 'POST' && pathname.includes('/progress')) {
      const segments = pathname.split('/').filter(Boolean);
      const id = segments[2];
      if (!id) {
        res.status(400).json({ error: 'DAG ID is required' });
        return;
      }
      const updated = await updateDAGProgress(id, userId, req.body);
      res.status(200).json({ success: true, dag: updated });
      return;
    }

    // 4. Get DAG By ID: GET /api/dag/:id
    if (method === 'GET' && pathname.startsWith('/api/dag/')) {
      const segments = pathname.split('/').filter(Boolean);
      const id = segments[2];
      if (!id || id === 'list') {
        res.status(400).json({ error: 'DAG ID is required' });
        return;
      }
      const dag = await getDAGById(id, userId);
      if (!dag) {
        res.status(404).json({ error: 'DAG not found' });
        return;
      }
      res.status(200).json({ success: true, dag });
      return;
    }

    // 5. Delete DAG: DELETE /api/dag/:id
    if (method === 'DELETE' && pathname.startsWith('/api/dag/')) {
      const segments = pathname.split('/').filter(Boolean);
      const id = segments[2];
      if (!id) {
        res.status(400).json({ error: 'DAG ID is required' });
        return;
      }
      await deleteDAG(id, userId);
      res.status(200).json({ success: true, message: 'DAG deleted' });
      return;
    }

    res.status(404).json({ error: 'Not found' });
  } catch (err: any) {
    console.error('DAG Handler Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
