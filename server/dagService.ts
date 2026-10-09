import { prisma, ensureDAGSchema } from './prisma.ts';
import { serverReadCache } from './serverCache.ts';

export interface SaveDAGPayload {
  id?: string;
  title: string;
  courseId?: string | null;
  topic: string;
  subtopic?: string | null;
  sourceMaterialIds?: string[];
  graphDepth?: string;
  learningGoal?: string;
  nodes?: any[];
  edges?: any[];
  masteryStates?: Record<string, number>;
  sourceReferences?: any[];
  progressStatus?: string;
  progressPercent?: number;
  currentConceptId?: string | null;
  nextConceptId?: string | null;
  totalConcepts?: number;
  masteredConcepts?: number;
}

function mapRowToDAG(row: any) {
  let nodes: any[] = [];
  try {
    nodes = JSON.parse(row.nodesJson || '[]');
  } catch {}

  let edges: any[] = [];
  try {
    edges = JSON.parse(row.edgesJson || '[]');
  } catch {}

  let masteryStates: Record<string, number> = {};
  try {
    masteryStates = JSON.parse(row.masteryStatesJson || '{}');
  } catch {}

  let sourceReferences: any[] = [];
  try {
    sourceReferences = JSON.parse(row.sourceReferencesJson || '[]');
  } catch {}

  let sourceMaterialIds: string[] = [];
  try {
    sourceMaterialIds = JSON.parse(row.sourceMaterialIds || '[]');
  } catch {}

  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    courseId: row.courseId || null,
    topic: row.topic,
    subtopic: row.subtopic || null,
    sourceMaterialIds,
    graphDepth: row.graphDepth || 'Standard',
    learningGoal: row.learningGoal || 'Concept Mastery',
    progressStatus: row.progressStatus || 'active',
    progressPercent: Number(row.progressPercent) || 0,
    currentConceptId: row.currentConceptId || null,
    nextConceptId: row.nextConceptId || null,
    totalConcepts: Number(row.totalConcepts) || nodes.length,
    masteredConcepts: Number(row.masteredConcepts) || 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    lastOpenedAt: row.lastOpenedAt ? new Date(row.lastOpenedAt).toISOString() : new Date().toISOString(),
    graphData: {
      id: row.id,
      title: row.title,
      topic: row.topic,
      subtopic: row.subtopic || undefined,
      learningGoal: row.learningGoal || 'Concept Mastery',
      depth: row.graphDepth || 'Standard',
      nodes,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      stats: {
        totalConcepts: nodes.length,
        masteredCount: Number(row.masteredConcepts) || 0,
        proficientCount: nodes.filter((n: any) => n.status === 'proficient').length,
        weakCount: nodes.filter((n: any) => n.status === 'weak' || n.status === 'developing').length,
        lockedCount: nodes.filter((n: any) => n.status === 'locked').length,
      },
    },
    nodes,
    edges,
    masteryStates,
    sourceReferences,
  };
}

export async function getUserDAGs(userId: string) {
  const cached = serverReadCache.get<any[]>(userId, 'dags_list');
  if (cached) return cached;

  await ensureDAGSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM learning_dags WHERE userId = ? ORDER BY updatedAt DESC',
    userId
  );
  const mapped = rows.map(mapRowToDAG);
  serverReadCache.set(userId, 'dags_list', mapped, 60_000);
  return mapped;
}

export async function getDAGById(id: string, userId: string) {
  await ensureDAGSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM learning_dags WHERE id = ? AND userId = ? LIMIT 1',
    id,
    userId
  );
  if (!rows || rows.length === 0) return null;

  // Touch lastOpenedAt
  try {
    await prisma.$executeRawUnsafe(
      'UPDATE learning_dags SET lastOpenedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
      id,
      userId
    );
  } catch {}

  return mapRowToDAG(rows[0]);
}

export async function saveDAG(userId: string, data: SaveDAGPayload) {
  await ensureDAGSchema();

  const id = data.id || `dag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const title = (data.title || `${data.topic} Learning Path`).trim();
  const courseId = data.courseId || null;
  const topic = (data.topic || 'General').trim();
  const subtopic = data.subtopic ? data.subtopic.trim() : null;
  const sourceMaterialIds = JSON.stringify(data.sourceMaterialIds || []);
  const graphDepth = data.graphDepth || 'Standard';
  const learningGoal = data.learningGoal || 'Concept Mastery';
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const nodesJson = JSON.stringify(nodes);
  const edgesJson = JSON.stringify(data.edges || []);
  const masteryStatesJson = JSON.stringify(data.masteryStates || {});
  const sourceReferencesJson = JSON.stringify(data.sourceReferences || []);
  const progressStatus = data.progressStatus || 'active';

  // Compute stats from nodes
  const totalConcepts = nodes.length;
  const masteredConcepts = nodes.filter((n: any) => n.status === 'mastered').length;
  const progressPercent = totalConcepts > 0 
    ? Math.round((masteredConcepts / totalConcepts) * 100)
    : (Number(data.progressPercent) || 0);

  const currentConceptId = data.currentConceptId || (nodes[0]?.id ?? null);
  const nextConceptId = data.nextConceptId || (nodes[1]?.id ?? null);

  // Check if exists
  const existing = await prisma.$queryRawUnsafe<any[]>(
    'SELECT id FROM learning_dags WHERE id = ? AND userId = ? LIMIT 1',
    id,
    userId
  );

  if (existing && existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE learning_dags SET
        title = ?,
        courseId = ?,
        topic = ?,
        subtopic = ?,
        sourceMaterialIds = ?,
        graphDepth = ?,
        learningGoal = ?,
        nodesJson = ?,
        edgesJson = ?,
        masteryStatesJson = ?,
        sourceReferencesJson = ?,
        progressStatus = ?,
        progressPercent = ?,
        currentConceptId = ?,
        nextConceptId = ?,
        totalConcepts = ?,
        masteredConcepts = ?,
        updatedAt = CURRENT_TIMESTAMP,
        lastOpenedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND userId = ?`,
      title,
      courseId,
      topic,
      subtopic,
      sourceMaterialIds,
      graphDepth,
      learningGoal,
      nodesJson,
      edgesJson,
      masteryStatesJson,
      sourceReferencesJson,
      progressStatus,
      progressPercent,
      currentConceptId,
      nextConceptId,
      totalConcepts,
      masteredConcepts,
      id,
      userId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO learning_dags (
        id, userId, title, courseId, topic, subtopic, sourceMaterialIds,
        graphDepth, learningGoal, nodesJson, edgesJson, masteryStatesJson,
        sourceReferencesJson, progressStatus, progressPercent, currentConceptId,
        nextConceptId, totalConcepts, masteredConcepts, createdAt, updatedAt, lastOpenedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      id,
      userId,
      title,
      courseId,
      topic,
      subtopic,
      sourceMaterialIds,
      graphDepth,
      learningGoal,
      nodesJson,
      edgesJson,
      masteryStatesJson,
      sourceReferencesJson,
      progressStatus,
      progressPercent,
      currentConceptId,
      nextConceptId,
      totalConcepts,
      masteredConcepts
    );
  }

  serverReadCache.invalidateUser(userId);
  return getDAGById(id, userId);
}

export async function updateDAGProgress(
  id: string,
  userId: string,
  params: {
    nodeId: string;
    mastery?: number;
    status?: string;
  }
) {
  await ensureDAGSchema();
  const record = await getDAGById(id, userId);
  if (!record) throw new Error('DAG not found');

  const nodes = record.nodes.map((node: any) => {
    if (node.id === params.nodeId) {
      return {
        ...node,
        mastery: params.mastery !== undefined ? params.mastery : node.mastery,
        status: params.status || (params.mastery && params.mastery >= 0.8 ? 'mastered' : node.status),
      };
    }
    return node;
  });

  // Re-evaluate downstream lock states
  const nodeMap = new Map<string, any>();
  nodes.forEach((n: any) => nodeMap.set(n.id, n));

  nodes.forEach((node: any) => {
    if (node.status !== 'mastered') {
      let allPrereqsMet = true;
      for (const pid of node.prerequisites || []) {
        const p = nodeMap.get(pid);
        if (p && p.status !== 'mastered' && p.status !== 'proficient') {
          allPrereqsMet = false;
          break;
        }
      }
      if (!allPrereqsMet && (node.prerequisites || []).length > 0) {
        node.status = 'locked';
      } else if (node.status === 'locked' && allPrereqsMet) {
        node.status = 'available';
      }
    }
  });

  const totalConcepts = nodes.length;
  const masteredConcepts = nodes.filter((n: any) => n.status === 'mastered').length;
  const progressPercent = Math.round((masteredConcepts / totalConcepts) * 100);

  // Compute next current and next concept
  const current = nodes.find((n: any) => n.status === 'proficient' || n.status === 'weak' || n.status === 'available') || nodes[0];
  const next = nodes.find((n: any) => n.id !== current?.id && (n.prerequisites || []).includes(current?.id)) || nodes[1] || null;

  return saveDAG(userId, {
    ...record,
    nodes,
    masteredConcepts,
    progressPercent,
    currentConceptId: current?.id || null,
    nextConceptId: next?.id || null,
  });
}

export async function deleteDAG(id: string, userId: string) {
  await ensureDAGSchema();
  await prisma.$executeRawUnsafe(
    'DELETE FROM learning_dags WHERE id = ? AND userId = ?',
    id,
    userId
  );
  serverReadCache.invalidateUser(userId);
  return true;
}
