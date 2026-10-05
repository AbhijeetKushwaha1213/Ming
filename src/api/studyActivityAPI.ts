import { supabase } from '@/integrations/supabase/client';

export interface StudySessionRecord {
  id: string;
  user_id: string;
  session_type: string;
  duration_minutes: number;
  topics_covered: string[];
  flashcards_reviewed?: number;
  correct_answers?: number;
  session_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface DailyActivityItem {
  day: string; // 'Mon', 'Tue', etc.
  dateString: string; // 'YYYY-MM-DD'
  formattedDate: string; // 'Oct 5'
  hours: number;
  minutes: number;
  isToday: boolean;
  sessionsCount: number;
}

export interface ActivitySummary {
  days: DailyActivityItem[];
  maxScale: number;
  yAxisLabels: number[];
  totalHours: number;
  totalMinutes: number;
  activeDays: number;
  dailyAverageHours: number;
  currentStreak: number;
}

const STORAGE_KEY_PREFIX = 'studymate_study_sessions_';

function getLocalSessionsKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId || 'default_user'}`;
}

/**
 * Get local study sessions from localStorage
 */
export function getLocalStudySessions(userId: string): StudySessionRecord[] {
  try {
    const raw = localStorage.getItem(getLocalSessionsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse local study sessions:', err);
    return [];
  }
}

/**
 * Save study sessions to localStorage
 */
export function saveLocalStudySessions(userId: string, sessions: StudySessionRecord[]) {
  try {
    localStorage.setItem(getLocalSessionsKey(userId), JSON.stringify(sessions));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studymate-study-activity-updated', { detail: { count: sessions.length } }));
    }
  } catch (err) {
    console.warn('Failed to save local study sessions:', err);
  }
}

/**
 * Fetch all study sessions for user (combining Supabase + localStorage)
 */
export async function fetchUserStudySessions(userId: string): Promise<StudySessionRecord[]> {
  const localList = getLocalStudySessions(userId);

  if (!userId || userId === 'default_user' || userId === 'local-dev-user-id') {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false });

    if (!error && Array.isArray(data)) {
      const serverSessions = data as StudySessionRecord[];
      // Merge unique
      const serverIds = new Set(serverSessions.map(s => s.id));
      const combined = [...serverSessions];
      for (const loc of localList) {
        if (!serverIds.has(loc.id)) {
          combined.push(loc);
        }
      }
      saveLocalStudySessions(userId, combined);
      return combined;
    }
  } catch (err) {
    console.warn('Supabase fetch study_sessions failed, using local:', err);
  }

  return localList;
}

/**
 * Log a new study session in real time
 */
export async function logStudySession(params: {
  userId: string;
  durationMinutes: number;
  sessionType?: string;
  topic?: string;
  flashcardsReviewed?: number;
  correctAnswers?: number;
}): Promise<StudySessionRecord> {
  const {
    userId = 'default_user',
    durationMinutes = 15,
    sessionType = 'active_learning',
    topic,
    flashcardsReviewed = 0,
    correctAnswers = 0,
  } = params;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newSession: StudySessionRecord = {
    id: newId,
    user_id: userId,
    session_type: sessionType,
    duration_minutes: Math.max(1, Math.round(durationMinutes)),
    topics_covered: topic ? [topic] : ['General Study'],
    flashcards_reviewed: flashcardsReviewed,
    correct_answers: correctAnswers,
    session_date: today,
    created_at: new Date().toISOString(),
  };

  // 1. Save to local storage
  const currentLocal = getLocalStudySessions(userId);
  const updatedLocal = [newSession, ...currentLocal];
  saveLocalStudySessions(userId, updatedLocal);

  // 2. Push to Supabase if authenticated
  if (userId && userId !== 'default_user' && userId !== 'local-dev-user-id') {
    try {
      if (supabase && typeof supabase.from === 'function') {
        const sessionTable = supabase.from('study_sessions');
        if (sessionTable && typeof sessionTable.insert === 'function') {
          await sessionTable.insert([{
            id: newSession.id,
            user_id: userId,
            session_type: newSession.session_type,
            duration_minutes: newSession.duration_minutes,
            topics_covered: newSession.topics_covered,
            flashcards_reviewed: newSession.flashcards_reviewed,
            correct_answers: newSession.correct_answers,
            session_date: newSession.session_date,
          }]);
        }

        // Increment user total study hours
        const addedHours = +(durationMinutes / 60).toFixed(2);
        const profileTable = supabase.from('user_profiles');
        if (profileTable && typeof profileTable.select === 'function') {
          const profileQuery = profileTable.select('total_study_hours, study_streak');
          if (profileQuery && typeof profileQuery.eq === 'function') {
            const eqQuery = profileQuery.eq('user_id', userId);
            if (eqQuery && typeof eqQuery.single === 'function') {
              const { data: profile } = await eqQuery.single();
              if (profile && typeof profileTable.update === 'function') {
                const nextHours = +((profile.total_study_hours || 0) + addedHours).toFixed(1);
                await profileTable
                  .update({
                    total_study_hours: nextHours,
                  })
                  .eq('user_id', userId);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not sync study session to Supabase:', err);
    }
  }

  // 3. Dispatch global sync event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studymate-activity-logged', { detail: newSession }));
  }

  return newSession;
}

/**
 * Calculate consecutive streak from session records
 */
export function calculateStreakFromSessions(sessions: StudySessionRecord[]): number {
  if (!sessions || sessions.length === 0) return 0;

  const datesWithStudy = new Set<string>();
  sessions.forEach(s => {
    if (s.duration_minutes > 0) {
      const dateStr = s.session_date || (s.created_at ? s.created_at.split('T')[0] : '');
      if (dateStr) datesWithStudy.add(dateStr);
    }
  });

  const today = new Date();
  let streak = 0;
  let checkDate = new Date(today);

  // If today has no study yet, check starting from yesterday
  const todayStr = checkDate.toISOString().split('T')[0];
  if (!datesWithStudy.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = checkDate.toISOString().split('T')[0];
    if (datesWithStudy.has(dStr)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Compute real-time study activity summary for the specified date range
 */
export function computeStudyActivity(
  sessions: StudySessionRecord[],
  range: '7days' | 'week' | '14days' | '30days' = '7days'
): ActivitySummary {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const dateBuckets: { dateStr: string; dayLabel: string; dateObj: Date }[] = [];

  if (range === 'week') {
    // Current week: Monday to Sunday
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const str = d.toISOString().split('T')[0];
      dateBuckets.push({
        dateStr: str,
        dayLabel: dayNames[d.getDay()],
        dateObj: d,
      });
    }
  } else {
    // Default '7days' (or 14 / 30): Past N days up to today
    const numDays = range === '14days' ? 14 : range === '30days' ? 30 : 7;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dateBuckets.push({
        dateStr: str,
        dayLabel: dayNames[d.getDay()],
        dateObj: d,
      });
    }
  }

  // Aggregate sessions by date
  const minutesByDate: Record<string, number> = {};
  const countByDate: Record<string, number> = {};

  (sessions || []).forEach(session => {
    const dStr = session.session_date || (session.created_at ? session.created_at.split('T')[0] : '');
    if (dStr) {
      minutesByDate[dStr] = (minutesByDate[dStr] || 0) + (session.duration_minutes || 0);
      countByDate[dStr] = (countByDate[dStr] || 0) + 1;
    }
  });

  const days: DailyActivityItem[] = dateBuckets.map(b => {
    const totalMins = minutesByDate[b.dateStr] || 0;
    const hours = +(totalMins / 60).toFixed(1);
    const month = b.dateObj.toLocaleString('en-US', { month: 'short' });
    const dateNum = b.dateObj.getDate();

    return {
      day: b.dayLabel,
      dateString: b.dateStr,
      formattedDate: `${month} ${dateNum}`,
      hours,
      minutes: totalMins,
      isToday: b.dateStr === todayStr,
      sessionsCount: countByDate[b.dateStr] || 0,
    };
  });

  const totalMinutes = days.reduce((acc, d) => acc + d.minutes, 0);
  const totalHours = +(totalMinutes / 60).toFixed(1);
  const activeDays = days.filter(d => d.minutes > 0).length;
  const dailyAverageHours = activeDays > 0 ? +(totalHours / activeDays).toFixed(1) : 0;
  const currentStreak = calculateStreakFromSessions(sessions);

  // Dynamic Y-axis scale based on maximum daily hours
  const maxDayHours = Math.max(0, ...days.map(d => d.hours));
  let maxScale = 8;
  if (maxDayHours <= 2) {
    maxScale = 2;
  } else if (maxDayHours <= 4) {
    maxScale = 4;
  } else if (maxDayHours <= 6) {
    maxScale = 6;
  } else if (maxDayHours <= 8) {
    maxScale = 8;
  } else {
    maxScale = Math.ceil(maxDayHours / 2) * 2;
  }

  const yAxisLabels = [
    maxScale,
    +(maxScale * 0.75).toFixed(1),
    +(maxScale * 0.5).toFixed(1),
    +(maxScale * 0.25).toFixed(1),
    0,
  ];

  return {
    days,
    maxScale,
    yAxisLabels,
    totalHours,
    totalMinutes,
    activeDays,
    dailyAverageHours,
    currentStreak,
  };
}
