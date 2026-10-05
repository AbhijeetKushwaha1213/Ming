import { DailyLearningPlan, DailyPlanTask } from '@/types/dailyPlan';

const PLAN_STORAGE_PREFIX = 'studymate_daily_plan';
const PLANS_INDEX_PREFIX = 'studymate_daily_plans_index';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPlanKey(userId: string, skillId: string, date: string): string {
  const cleanUser = (userId || 'default_user').trim().toLowerCase();
  const cleanSkill = (skillId || 'general_skill').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${PLAN_STORAGE_PREFIX}_${cleanUser}_${cleanSkill}_${date}`;
}

function getIndexKey(userId: string): string {
  const cleanUser = (userId || 'default_user').trim().toLowerCase();
  return `${PLANS_INDEX_PREFIX}_${cleanUser}`;
}

export function getDailyPlan(userId: string, skillId: string, planDate?: string): DailyLearningPlan | null {
  try {
    const date = planDate || getTodayDateString();
    const key = getPlanKey(userId, skillId, date);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DailyLearningPlan;
  } catch (err) {
    console.error('Failed to read daily plan from storage:', err);
    return null;
  }
}

export function saveDailyPlan(plan: DailyLearningPlan): DailyLearningPlan {
  try {
    const key = getPlanKey(plan.userId, plan.skillOrProjectId, plan.planDate);
    const updatedPlan: DailyLearningPlan = {
      ...plan,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(updatedPlan));

    // Update index of plans for user
    const indexKey = getIndexKey(plan.userId);
    let index: string[] = [];
    try {
      const rawIndex = localStorage.getItem(indexKey);
      if (rawIndex) index = JSON.parse(rawIndex);
    } catch {}

    if (!index.includes(key)) {
      index.unshift(key);
      localStorage.setItem(indexKey, JSON.stringify(index.slice(0, 50)));
    }

    // Dispatch global event so dashboard or other tabs react in real-time
    window.dispatchEvent(new CustomEvent('studymate-daily-plan-updated', {
      detail: { plan: updatedPlan }
    }));

    return updatedPlan;
  } catch (err) {
    console.error('Failed to save daily plan to storage:', err);
    return plan;
  }
}

export function toggleDailyPlanTask(
  userId: string,
  skillId: string,
  planDate: string,
  taskId: string
): DailyLearningPlan | null {
  const plan = getDailyPlan(userId, skillId, planDate);
  if (!plan) return null;

  const updatedTasks = plan.tasks.map(t => {
    if (t.id === taskId) {
      const nextCompleted = !t.completed;
      return {
        ...t,
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date().toISOString() : undefined
      };
    }
    return t;
  });

  const total = updatedTasks.length;
  const completedCount = updatedTasks.filter(t => t.completed).length;

  let newStatus: DailyLearningPlan['status'] = plan.status;
  if (completedCount === total && total > 0) {
    newStatus = 'completed';
  } else if (completedCount > 0) {
    newStatus = 'in_progress';
  } else {
    newStatus = 'generated';
  }

  const updatedPlan: DailyLearningPlan = {
    ...plan,
    tasks: updatedTasks,
    status: newStatus,
    updatedAt: new Date().toISOString()
  };

  return saveDailyPlan(updatedPlan);
}

export function deleteDailyPlan(userId: string, skillId: string, planDate: string): void {
  try {
    const key = getPlanKey(userId, skillId, planDate);
    localStorage.removeItem(key);

    const indexKey = getIndexKey(userId);
    const rawIndex = localStorage.getItem(indexKey);
    if (rawIndex) {
      const index: string[] = JSON.parse(rawIndex);
      const filtered = index.filter(k => k !== key);
      localStorage.setItem(indexKey, JSON.stringify(filtered));
    }

    window.dispatchEvent(new CustomEvent('studymate-daily-plan-deleted', {
      detail: { userId, skillId, planDate }
    }));
  } catch (err) {
    console.error('Failed to delete daily plan:', err);
  }
}

export function getLatestDailyPlanForUser(userId: string): DailyLearningPlan | null {
  try {
    const today = getTodayDateString();
    const indexKey = getIndexKey(userId);
    const rawIndex = localStorage.getItem(indexKey);
    if (!rawIndex) return null;

    const index: string[] = JSON.parse(rawIndex);
    
    // First find any plan created for today
    for (const key of index) {
      if (key.endsWith(today)) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as DailyLearningPlan;
      }
    }

    // Fallback: most recently updated plan
    if (index.length > 0) {
      const raw = localStorage.getItem(index[0]);
      if (raw) return JSON.parse(raw) as DailyLearningPlan;
    }
    return null;
  } catch (err) {
    console.error('Failed to get latest daily plan:', err);
    return null;
  }
}
