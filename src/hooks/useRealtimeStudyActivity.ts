import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  StudySessionRecord,
  ActivitySummary,
  fetchUserStudySessions,
  logStudySession,
  computeStudyActivity,
} from '@/api/studyActivityAPI';
import { useToast } from '@/hooks/use-toast';

export type ActivityTimeRange = '7days' | 'week' | '14days' | '30days';

export function useRealtimeStudyActivity(initialRange: ActivityTimeRange = '7days') {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id || 'default_user';
  const { toast } = useToast();

  const [timeRange, setTimeRange] = useState<ActivityTimeRange>(initialRange);
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserStudySessions(userId);
      setSessions(data);
    } catch (err) {
      console.warn('Could not load study sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSessions();

    const handleUpdate = () => {
      loadSessions();
    };

    window.addEventListener('studymate-activity-logged', handleUpdate);
    window.addEventListener('studymate-study-activity-updated', handleUpdate);
    return () => {
      window.removeEventListener('studymate-activity-logged', handleUpdate);
      window.removeEventListener('studymate-study-activity-updated', handleUpdate);
    };
  }, [loadSessions]);

  // Compute activity summary whenever sessions or timeRange change
  const summary: ActivitySummary = useMemo(() => {
    return computeStudyActivity(sessions, timeRange);
  }, [sessions, timeRange]);

  // Log session manually
  const logSession = useCallback(
    async (params: { durationMinutes: number; sessionType?: string; topic?: string }) => {
      try {
        const created = await logStudySession({
          userId,
          durationMinutes: params.durationMinutes,
          sessionType: params.sessionType || 'manual_log',
          topic: params.topic || 'Self Study',
        });
        setSessions(prev => [created, ...prev]);

        toast({
          title: 'Study Session Logged! ⏱️',
          description: `Logged ${params.durationMinutes} mins of ${params.topic || 'study time'}. Keep up the great work!`,
        });
        return created;
      } catch (err: any) {
        toast({
          title: 'Could not log session',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [userId, toast]
  );

  // Background active study time tracker (runs when tab is focused and user is active)
  const activeSecondsRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      // Only track if document is visible
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        activeSecondsRef.current += 10;
        // Every 3 minutes (180s) of active engagement, log 3 active minutes to today's study activity
        if (activeSecondsRef.current >= 180) {
          activeSecondsRef.current = 0;
          logStudySession({
            userId,
            durationMinutes: 3,
            sessionType: 'active_learning',
            topic: 'Active Platform Study',
          });
        }
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      // Flush any remaining active time >= 60 seconds
      if (activeSecondsRef.current >= 60) {
        const minutes = Math.floor(activeSecondsRef.current / 60);
        logStudySession({
          userId,
          durationMinutes: minutes,
          sessionType: 'active_learning',
          topic: 'Active Platform Study',
        });
        activeSecondsRef.current = 0;
      }
    };
  }, [userId]);

  return {
    sessions,
    summary,
    timeRange,
    setTimeRange,
    isLoading,
    logSession,
    refresh: loadSessions,
  };
}
