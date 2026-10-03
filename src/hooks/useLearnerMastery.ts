import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getLearnerMastery,
  getLearnerEvents,
  updateLearnerMastery,
  initializeDiagnosticState,
  LearnerMasteryRecord,
  LearnerEventRecord,
  MasteryStatus,
} from '@/api/learnerAPI';
import { useAuth } from '@/components/auth/AuthProvider';

export interface UseLearnerMasteryResult {
  masteryList: LearnerMasteryRecord[];
  events: LearnerEventRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getSkillMastery: (skillName: string) => LearnerMasteryRecord;
  recordEvidence: (params: {
    topic: string;
    subtopic?: string;
    isCorrect: boolean;
    difficulty?: 'easy' | 'medium' | 'hard';
    sourceId?: string;
    eventType?: string;
    evidenceDetails?: string;
  }) => Promise<any>;
  initializeDiagnostic: (params: {
    topic: string;
    subtopic?: string;
    score: number;
    totalQuestions: number;
    sourceId?: string;
  }) => Promise<any>;
  stats: {
    total: number;
    assessedCount: number;
    avgMastery: number;
    masteredCount: number;
    proficientCount: number;
    developingCount: number;
    unassessedCount: number;
  };
}

export function useLearnerMastery(): UseLearnerMasteryResult {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id || 'default_user';

  const [masteryList, setMasteryList] = useState<LearnerMasteryRecord[]>([]);
  const [events, setEvents] = useState<LearnerEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMastery = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [mRes, eRes] = await Promise.all([
        getLearnerMastery(userId).catch(() => ({ success: false, mastery: [] })),
        getLearnerEvents(userId, 10).catch(() => ({ success: false, events: [] })),
      ]);

      if (mRes.success && Array.isArray(mRes.mastery)) {
        setMasteryList(mRes.mastery);
      }
      if (eRes.success && Array.isArray(eRes.events)) {
        setEvents(eRes.events);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load learner mastery');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMastery();
  }, [fetchMastery]);

  // Reactive listener for real-time BKT updates from anywhere in the app
  useEffect(() => {
    const handleRefresh = () => {
      fetchMastery();
    };
    window.addEventListener('studymate-bkt-refresh', handleRefresh);
    return () => window.removeEventListener('studymate-bkt-refresh', handleRefresh);
  }, [fetchMastery]);

  // Lookup helper matching skill or topic by name (case-insensitive and substring flexible)
  const getSkillMastery = useCallback(
    (skillName: string): LearnerMasteryRecord => {
      if (!skillName) {
        return {
          id: 'unassessed_blank',
          userId,
          courseId: null,
          topic: '',
          subtopic: null,
          masteryProbability: 0.0,
          masteryPercentage: 0,
          attempts: 0,
          correctCount: 0,
          incorrectCount: 0,
          confidence: 0.0,
          status: 'unassessed' as MasteryStatus,
          lastAssessedAt: null,
        };
      }

      const cleanTarget = skillName.trim().toLowerCase();

      // 1. Exact match
      const exact = masteryList.find(
        (m) => m.topic.trim().toLowerCase() === cleanTarget
      );
      if (exact) return exact;

      // 2. Subtopic match or substring match
      const matched = masteryList.find(
        (m) =>
          m.topic.toLowerCase().includes(cleanTarget) ||
          cleanTarget.includes(m.topic.toLowerCase()) ||
          (m.subtopic && m.subtopic.toLowerCase().includes(cleanTarget))
      );
      if (matched) return matched;

      // Cold-start fallback
      return {
        id: `unassessed_${skillName.replace(/\s+/g, '_')}`,
        userId,
        courseId: null,
        topic: skillName,
        subtopic: null,
        masteryProbability: 0.0,
        masteryPercentage: 0,
        attempts: 0,
        correctCount: 0,
        incorrectCount: 0,
        confidence: 0.0,
        status: 'unassessed' as MasteryStatus,
        lastAssessedAt: null,
      };
    },
    [masteryList, userId]
  );

  const recordEvidence = useCallback(
    async (params: {
      topic: string;
      subtopic?: string;
      isCorrect: boolean;
      difficulty?: 'easy' | 'medium' | 'hard';
      sourceId?: string;
      eventType?: string;
      evidenceDetails?: string;
    }) => {
      try {
        const res = await updateLearnerMastery({
          userId,
          topic: params.topic,
          subtopic: params.subtopic,
          isCorrect: params.isCorrect,
          difficulty: params.difficulty || 'medium',
          sourceId: params.sourceId,
          eventType: params.eventType || 'ASSESSMENT_ANSWER',
          evidenceDetails: params.evidenceDetails,
        });

        // Trigger reactive update across UI
        window.dispatchEvent(
          new CustomEvent('studymate-bkt-refresh', {
            detail: { topic: params.topic, subtopic: params.subtopic },
          })
        );
        return res;
      } catch (err) {
        console.error('Failed to record BKT evidence:', err);
        throw err;
      }
    },
    [userId]
  );

  const initializeDiagnostic = useCallback(
    async (params: {
      topic: string;
      subtopic?: string;
      score: number;
      totalQuestions: number;
      sourceId?: string;
    }) => {
      try {
        const res = await initializeDiagnosticState({
          userId,
          topic: params.topic,
          subtopic: params.subtopic,
          score: params.score,
          totalQuestions: params.totalQuestions,
          sourceId: params.sourceId,
        });

        window.dispatchEvent(
          new CustomEvent('studymate-bkt-refresh', {
            detail: { topic: params.topic, subtopic: params.subtopic },
          })
        );
        return res;
      } catch (err) {
        console.error('Failed to initialize diagnostic BKT:', err);
        throw err;
      }
    },
    [userId]
  );

  const stats = useMemo(() => {
    const assessed = masteryList.filter((m) => m.attempts > 0);
    const avgMastery =
      assessed.length > 0
        ? Math.round(
            (assessed.reduce((acc, m) => acc + m.masteryProbability, 0) / assessed.length) * 100
          )
        : 0;

    return {
      total: masteryList.length,
      assessedCount: assessed.length,
      avgMastery,
      masteredCount: masteryList.filter((m) => m.status === 'mastered').length,
      proficientCount: masteryList.filter((m) => m.status === 'proficient').length,
      developingCount: masteryList.filter((m) => m.status === 'developing' && m.attempts > 0).length,
      unassessedCount: masteryList.filter((m) => m.status === 'unassessed' || m.attempts === 0).length,
    };
  }, [masteryList]);

  return {
    masteryList,
    events,
    isLoading,
    error,
    refresh: fetchMastery,
    getSkillMastery,
    recordEvidence,
    initializeDiagnostic,
    stats,
  };
}
