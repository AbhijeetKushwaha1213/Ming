import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeStudyActivity,
  getLocalStudySessions,
  saveLocalStudySessions,
  logStudySession,
  fetchUserStudySessions,
  StudySessionRecord,
} from '@/api/studyActivityAPI';

describe('Real-time Study Activity Tracking & Aggregation', () => {
  const mockUserId = 'user_test_realtime';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('computes 0 hours cleanly for brand new users without mock peaks', () => {
    const summary = computeStudyActivity([], '7days');

    expect(summary.totalHours).toBe(0);
    expect(summary.activeDays).toBe(0);
    expect(summary.dailyAverageHours).toBe(0);
    expect(summary.currentStreak).toBe(0);
    expect(summary.days).toHaveLength(7);

    // Every day should report 0 hours and 0 minutes
    summary.days.forEach((day) => {
      expect(day.hours).toBe(0);
      expect(day.minutes).toBe(0);
    });

    // Dynamic scale has a sensible minimum (at least 2h)
    expect(summary.maxScale).toBeGreaterThanOrEqual(2);
    expect(summary.yAxisLabels).toContain(0);
  });

  it('accurately aggregates sessions into the corresponding day buckets', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const mockSessions: StudySessionRecord[] = [
      {
        id: 's1',
        user_id: mockUserId,
        session_type: 'self_study',
        duration_minutes: 60, // 1.0 hr
        topics_covered: ['Data Structures'],
        session_date: todayStr,
        created_at: new Date().toISOString(),
      },
      {
        id: 's2',
        user_id: mockUserId,
        session_type: 'quiz',
        duration_minutes: 30, // 0.5 hr
        topics_covered: ['Algorithms'],
        session_date: todayStr,
        created_at: new Date().toISOString(),
      },
      {
        id: 's3',
        user_id: mockUserId,
        session_type: 'reading',
        duration_minutes: 90, // 1.5 hr
        topics_covered: ['OS'],
        session_date: yesterdayStr,
        created_at: new Date().toISOString(),
      },
    ];

    const summary = computeStudyActivity(mockSessions, '7days');

    // Total = 1.0 + 0.5 + 1.5 = 3.0 hours
    expect(summary.totalHours).toBe(3);
    expect(summary.totalMinutes).toBe(180);
    expect(summary.activeDays).toBe(2);

    // Today's bucket should have 1.5 hours
    const todayBucket = summary.days.find((d) => d.dateString === todayStr);
    expect(todayBucket).toBeDefined();
    expect(todayBucket?.hours).toBe(1.5);
    expect(todayBucket?.minutes).toBe(90);
    expect(todayBucket?.isToday).toBe(true);

    // Yesterday's bucket should have 1.5 hours
    const yesterdayBucket = summary.days.find((d) => d.dateString === yesterdayStr);
    expect(yesterdayBucket).toBeDefined();
    expect(yesterdayBucket?.hours).toBe(1.5);

    // Daily average over active study days = 3.0 / 2 = 1.5h
    expect(summary.dailyAverageHours).toBe(1.5);
    // Streak: today & yesterday = 2 consecutive active days
    expect(summary.currentStreak).toBe(2);
  });

  it('supports different time ranges (7days, week, 14days, 30days)', () => {
    const summary7 = computeStudyActivity([], '7days');
    expect(summary7.days).toHaveLength(7);

    const summary14 = computeStudyActivity([], '14days');
    expect(summary14.days).toHaveLength(14);

    const summary30 = computeStudyActivity([], '30days');
    expect(summary30.days).toHaveLength(30);

    const summaryWeek = computeStudyActivity([], 'week');
    expect(summaryWeek.days).toHaveLength(7);
  });

  it('logs session to storage and dispatches real-time events', async () => {
    let eventDispatched = false;
    const listener = () => {
      eventDispatched = true;
    };
    window.addEventListener('studymate-activity-logged', listener);

    const logged = await logStudySession({
      userId: mockUserId,
      durationMinutes: 45,
      sessionType: 'flashcards',
      topicsCovered: ['Computer Networks'],
    });

    expect(logged.duration_minutes).toBe(45);
    expect(logged.user_id).toBe(mockUserId);
    expect(logged.session_type).toBe('flashcards');

    // Verify localStorage persistence
    const local = getLocalStudySessions(mockUserId);
    expect(local).toHaveLength(1);
    expect(local[0].duration_minutes).toBe(45);

    // Verify event dispatched
    expect(eventDispatched).toBe(true);

    window.removeEventListener('studymate-activity-logged', listener);
  });
});
