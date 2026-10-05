import { PersistedDAGRecord, DAGGraphData, DAGNodeStatus } from '@/types/dag';
import { VERIFIED_CURRICULUM_DAGS } from '@/utils/dagEngine';

const STORAGE_PREFIX = 'studymate_persisted_dags_';

function getLocalStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId || 'default_user'}`;
}

export function createStarterDAG(userId: string): PersistedDAGRecord {
  const osTemplate = VERIFIED_CURRICULUM_DAGS['operating systems'];
  const nodes = (osTemplate?.nodes || []).map((n) => ({
    ...n,
    name: n.name || n.title,
    status: n.level === 0 ? ('proficient' as DAGNodeStatus) : ('available' as DAGNodeStatus),
    mastery: n.level === 0 ? 0.75 : 0.0,
  }));
  const id = `dag_starter_${userId || 'default'}`;
  return {
    id,
    userId: userId || 'default_user',
    title: 'CPU Registers & Kernel Mode Fundamentals',
    courseId: null,
    topic: 'Operating Systems',
    subtopic: 'Process Management',
    sourceMaterialIds: ['res-1'],
    graphDepth: 'Standard',
    learningGoal: 'Concept Mastery',
    graphData: {
      id,
      title: 'CPU Registers & Kernel Mode Fundamentals',
      topic: 'Operating Systems',
      subtopic: 'Process Management',
      depth: 'Standard',
      learningGoal: 'Concept Mastery',
      nodes,
      createdAt: new Date().toISOString(),
    },
    progressStatus: 'active',
    progressPercent: 20,
    currentConceptId: nodes[0]?.id || null,
    nextConceptId: nodes[1]?.id || null,
    totalConcepts: nodes.length,
    masteredConcepts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
  };
}

function getLocalDAGs(userId: string): PersistedDAGRecord[] {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(userId));
    if (!raw) {
      const starter = createStarterDAG(userId);
      saveLocalDAGs(userId, [starter], false);
      return [starter];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const starter = createStarterDAG(userId);
      saveLocalDAGs(userId, [starter], false);
      return [starter];
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to read local DAGs:', err);
    return [];
  }
}

function saveLocalDAGs(userId: string, dags: PersistedDAGRecord[], notify = true) {
  try {
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(dags));
    // Only notify across tabs or components when explicit
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studymate-dag-sync', { detail: { userId, count: dags.length } }));
    }
  } catch (err) {
    console.warn('Failed to save local DAGs:', err);
  }
}

export interface SaveDAGInput {
  id?: string;
  title?: string;
  courseId?: string | null;
  subject?: string;
  topic: string;
  subtopic?: string | null;
  sourceMaterialIds?: string[];
  graphDepth?: 'Basic' | 'Standard' | 'Detailed';
  learningGoal?: 'Exam Preparation' | 'Concept Mastery' | 'Revision' | 'Complete Course Learning';
  graphData: DAGGraphData;
  progressStatus?: 'active' | 'in_progress' | 'completed' | 'archived';
  currentConceptId?: string | null;
  nextConceptId?: string | null;
}

/**
 * Fetch all saved DAGs for the authenticated user.
 * Tries the backend API and falls back / syncs with user-scoped localStorage.
 */
export async function fetchUserDAGs(userId: string): Promise<PersistedDAGRecord[]> {
  const localList = getLocalDAGs(userId);

  try {
    const res = await fetch(`/api/dag/list?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.dags)) {
        // Merge with local list to preserve any offline items, prioritizing server
        const serverDags: PersistedDAGRecord[] = data.dags;
        const serverIds = new Set(serverDags.map((d) => d.id));
        const combined = [...serverDags];

        for (const local of localList) {
          if (!serverIds.has(local.id)) {
            combined.push(local);
          }
        }

        saveLocalDAGs(userId, combined, false);
        return combined;
      }
    }
  } catch (err) {
    console.warn('Backend fetchUserDAGs failed, using offline localStorage:', err);
  }

  return localList;
}

/**
 * Fetch a single saved DAG by ID.
 */
export async function fetchDAGById(id: string, userId: string): Promise<PersistedDAGRecord | null> {
  try {
    const res = await fetch(`/api/dag/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dag) {
        return data.dag;
      }
    }
  } catch (err) {
    console.warn('Backend fetchDAGById failed, checking localStorage:', err);
  }

  const localList = getLocalDAGs(userId);
  return localList.find((d) => d.id === id) || null;
}

/**
 * Persist a DAG (create or update).
 * Completely bypasses My Vault and stores into dedicated DAG persistence.
 */
export async function saveUserDAG(userId: string, input: SaveDAGInput): Promise<PersistedDAGRecord> {
  const nodes = input.graphData?.nodes || [];
  const totalConcepts = nodes.length;
  const masteredConcepts = nodes.filter((n) => n.status === 'mastered').length;
  const progressPercent = totalConcepts > 0 ? Math.round((masteredConcepts / totalConcepts) * 100) : 0;

  const currentConceptId =
    input.currentConceptId ||
    nodes.find((n) => n.status === 'proficient' || n.status === 'weak' || n.status === 'available' || n.status === 'in_progress')?.id ||
    nodes[0]?.id ||
    null;

  const nextConceptId =
    input.nextConceptId ||
    nodes.find((n) => n.id !== currentConceptId && (n.prerequisites || []).includes(currentConceptId || ''))?.id ||
    nodes[1]?.id ||
    null;

  const id = input.id || input.graphData?.id || `dag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const title = (input.title || input.graphData?.title || `${input.topic} Learning Path`).trim();

  const record: PersistedDAGRecord = {
    id,
    userId,
    title,
    courseId: input.courseId || null,
    subject: input.subject || input.graphData?.subject || undefined,
    topic: input.topic,
    subtopic: input.subtopic || null,
    sourceMaterialIds: input.sourceMaterialIds || (input.graphData?.sourceId ? [input.graphData.sourceId] : []),
    graphDepth: input.graphDepth || input.graphData?.depth || 'Standard',
    learningGoal: input.learningGoal || input.graphData?.learningGoal || 'Concept Mastery',
    graphData: {
      ...input.graphData,
      id,
      title,
    },
    progressStatus: input.progressStatus || 'active',
    progressPercent,
    currentConceptId,
    nextConceptId,
    totalConcepts,
    masteredConcepts,
    createdAt: input.graphData?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
  };

  // 1. Immediately update user-scoped localStorage
  const localList = getLocalDAGs(userId);
  const existingIdx = localList.findIndex((d) => d.id === id);
  if (existingIdx >= 0) {
    localList[existingIdx] = record;
  } else {
    localList.unshift(record);
  }
  saveLocalDAGs(userId, localList);

  // 2. Persist to backend API if available
  try {
    const res = await fetch('/api/dag/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...record,
        userId,
        nodes,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dag) {
        return data.dag;
      }
    }
  } catch (err) {
    console.warn('Backend saveUserDAG call failed, saved locally:', err);
  }

  return record;
}

/**
 * Update progress on a concept within a saved DAG.
 */
export async function updateUserDAGProgress(
  dagId: string,
  userId: string,
  params: {
    nodeId: string;
    mastery?: number;
    status?: DAGNodeStatus;
  }
): Promise<PersistedDAGRecord | null> {
  const localList = getLocalDAGs(userId);
  const target = localList.find((d) => d.id === dagId);

  if (target) {
    target.graphData.nodes = target.graphData.nodes.map((node) => {
      if (node.id === params.nodeId) {
        return {
          ...node,
          mastery: params.mastery !== undefined ? params.mastery : node.mastery,
          status: params.status || (params.mastery && params.mastery >= 0.8 ? 'mastered' : node.status),
        };
      }
      return node;
    });

    // Recompute statuses
    const nodeMap = new Map<string, any>();
    target.graphData.nodes.forEach((n) => nodeMap.set(n.id, n));

    target.graphData.nodes.forEach((node) => {
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

    target.totalConcepts = target.graphData.nodes.length;
    target.masteredConcepts = target.graphData.nodes.filter((n) => n.status === 'mastered').length;
    target.progressPercent = Math.round((target.masteredConcepts / target.totalConcepts) * 100);

    const current = target.graphData.nodes.find(
      (n) => n.status === 'proficient' || n.status === 'weak' || n.status === 'available' || n.status === 'in_progress'
    ) || target.graphData.nodes[0];

    const next = target.graphData.nodes.find(
      (n) => n.id !== current?.id && (n.prerequisites || []).includes(current?.id || '')
    ) || target.graphData.nodes[1] || null;

    target.currentConceptId = current?.id || null;
    target.nextConceptId = next?.id || null;
    target.updatedAt = new Date().toISOString();
    target.lastOpenedAt = new Date().toISOString();

    saveLocalDAGs(userId, localList);
  }

  try {
    const res = await fetch(`/api/dag/${encodeURIComponent(dagId)}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, userId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dag) {
        return data.dag;
      }
    }
  } catch (err) {
    console.warn('Backend updateUserDAGProgress call failed, saved locally:', err);
  }

  return target || null;
}

/**
 * Delete a saved DAG.
 */
export async function deleteUserDAG(dagId: string, userId: string): Promise<boolean> {
  const localList = getLocalDAGs(userId).filter((d) => d.id !== dagId);
  saveLocalDAGs(userId, localList);

  try {
    await fetch(`/api/dag/${encodeURIComponent(dagId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Backend deleteUserDAG call failed:', err);
  }

  return true;
}
