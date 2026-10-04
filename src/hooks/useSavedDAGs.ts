import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { PersistedDAGRecord, DAGGraphData, DAGNodeStatus } from '@/types/dag';
import {
  fetchUserDAGs,
  fetchDAGById,
  saveUserDAG,
  updateUserDAGProgress,
  deleteUserDAG,
} from '@/api/dagStorageAPI';

const ACTIVE_DAG_KEY = 'studymate_active_dag_id';

export function useSavedDAGs() {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id || 'default_user';
  const { toast } = useToast();

  const [savedDAGs, setSavedDAGs] = useState<PersistedDAGRecord[]>([]);
  const [activeDAGId, setActiveDAGIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_DAG_KEY) || null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all user's DAGs
  const refreshDAGs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchUserDAGs(userId);
      setSavedDAGs(list);

      // If no active DAG set or active DAG not in list, select the most recent one
      if (list.length > 0) {
        const storedActive = localStorage.getItem(ACTIVE_DAG_KEY);
        const exists = list.some((d) => d.id === storedActive);
        if (!exists) {
          const defaultId = list[0].id;
          setActiveDAGIdState(defaultId);
          localStorage.setItem(ACTIVE_DAG_KEY, defaultId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load saved DAGs:', err);
      setError(err?.message || 'Failed to load saved DAGs');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshDAGs();

    // Listen for sync events across components
    const handleSync = () => {
      refreshDAGs();
    };
    window.addEventListener('studymate-dag-sync', handleSync);
    return () => {
      window.removeEventListener('studymate-dag-sync', handleSync);
    };
  }, [refreshDAGs]);

  // Active DAG record
  const activeDAG = useMemo(() => {
    if (!activeDAGId) return savedDAGs[0] || null;
    return savedDAGs.find((d) => d.id === activeDAGId) || savedDAGs[0] || null;
  }, [savedDAGs, activeDAGId]);

  // Set active DAG
  const setActiveDAGId = useCallback((id: string) => {
    setActiveDAGIdState(id);
    localStorage.setItem(ACTIVE_DAG_KEY, id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studymate-dag-active-change', { detail: { id } }));
    }
  }, []);

  // Save or update a DAG
  const saveDAG = useCallback(
    async (graphData: DAGGraphData, options?: { customTitle?: string }): Promise<PersistedDAGRecord> => {
      try {
        const record = await saveUserDAG(userId, {
          id: graphData.id,
          title: options?.customTitle || graphData.title,
          topic: graphData.topic,
          subtopic: graphData.subtopic,
          graphDepth: graphData.depth,
          learningGoal: graphData.learningGoal,
          graphData,
        });

        // Set as active
        setActiveDAGId(record.id);

        // Update local list state
        setSavedDAGs((prev) => {
          const idx = prev.findIndex((d) => d.id === record.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = record;
            return next;
          }
          return [record, ...prev];
        });

        toast({
          title: 'Learning DAG saved',
          description: `"${record.title}" is saved and synced with your Learning Path.`,
        });

        return record;
      } catch (err: any) {
        toast({
          title: 'Save Failed',
          description: err?.message || 'Could not save Learning DAG.',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [userId, setActiveDAGId, toast]
  );

  // Open a specific DAG
  const openDAG = useCallback(
    async (dagId: string): Promise<PersistedDAGRecord | null> => {
      try {
        const target = await fetchDAGById(dagId, userId);
        if (target) {
          setActiveDAGId(target.id);
          setSavedDAGs((prev) => {
            const idx = prev.findIndex((d) => d.id === target.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = target;
              return next;
            }
            return [target, ...prev];
          });
          return target;
        }
      } catch (err) {
        console.warn('Failed to open DAG:', err);
      }

      const fallback = savedDAGs.find((d) => d.id === dagId);
      if (fallback) {
        setActiveDAGId(fallback.id);
        return fallback;
      }
      return null;
    },
    [userId, savedDAGs, setActiveDAGId]
  );

  // Update node progress on active or specified DAG
  const updateNodeMastery = useCallback(
    async (dagId: string, nodeId: string, masteryProb: number, status?: DAGNodeStatus) => {
      try {
        const updated = await updateUserDAGProgress(dagId, userId, {
          nodeId,
          mastery: masteryProb,
          status,
        });

        if (updated) {
          setSavedDAGs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        }
      } catch (err) {
        console.error('Failed to update node progress:', err);
      }
    },
    [userId]
  );

  // Delete DAG
  const deleteDAG = useCallback(
    async (dagId: string) => {
      try {
        await deleteUserDAG(dagId, userId);
        setSavedDAGs((prev) => prev.filter((d) => d.id !== dagId));
        if (activeDAGId === dagId) {
          const remaining = savedDAGs.filter((d) => d.id !== dagId);
          const nextId = remaining[0]?.id || null;
          setActiveDAGIdState(nextId);
          if (nextId) localStorage.setItem(ACTIVE_DAG_KEY, nextId);
          else localStorage.removeItem(ACTIVE_DAG_KEY);
        }
        toast({
          title: 'DAG Deleted',
          description: 'Learning path removed from your collection.',
        });
      } catch (err: any) {
        toast({
          title: 'Delete Failed',
          description: err?.message || 'Could not delete DAG.',
          variant: 'destructive',
        });
      }
    },
    [userId, activeDAGId, savedDAGs, toast]
  );

  // Summary computed from the active canonical DAG
  const activeDAGSummary = useMemo(() => {
    if (!activeDAG) return null;

    const nodes = activeDAG.graphData?.nodes || [];
    const current =
      nodes.find((n) => n.id === activeDAG.currentConceptId) ||
      nodes.find((n) => n.status === 'proficient' || n.status === 'weak' || n.status === 'in_progress') ||
      nodes[0];

    const next =
      nodes.find((n) => n.id === activeDAG.nextConceptId) ||
      nodes.find((n) => n.id !== current?.id && (n.prerequisites || []).includes(current?.id || '')) ||
      nodes[1] ||
      null;

    // Prerequisite check for current node
    let unmetPrereqName: string | null = null;
    if (current && current.prerequisites && current.prerequisites.length > 0) {
      for (const pid of current.prerequisites) {
        const pNode = nodes.find((n) => n.id === pid);
        if (pNode && pNode.status !== 'mastered' && pNode.status !== 'proficient') {
          unmetPrereqName = pNode.name || pNode.title;
          break;
        }
      }
    }

    return {
      id: activeDAG.id,
      title: activeDAG.title,
      topic: activeDAG.topic,
      subtopic: activeDAG.subtopic,
      totalConcepts: activeDAG.totalConcepts,
      masteredConcepts: activeDAG.masteredConcepts,
      progressPercent: activeDAG.progressPercent,
      currentConcept: current ? { ...current, name: current.name || current.title } : null,
      nextConcept: next ? { ...next, name: next.name || next.title } : null,
      unmetPrereqName,
      status: activeDAG.progressStatus,
      updatedAt: activeDAG.updatedAt,
    };
  }, [activeDAG]);

  return {
    savedDAGs,
    activeDAG,
    activeDAGId,
    activeDAGSummary,
    isLoading,
    error,
    refreshDAGs,
    saveDAG,
    openDAG,
    setActiveDAGId,
    updateNodeMastery,
    deleteDAG,
  };
}
