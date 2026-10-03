import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { useLearnerMastery } from '@/hooks/useLearnerMastery';
import { CollegeDashboard } from '@/components/dashboard/CollegeDashboard';
import { SkillBKTQuickAssessmentModal } from '@/components/dashboard/SkillBKTQuickAssessmentModal';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'student_123', user_id: 'student_123', name: 'Alex Student' },
  }),
}));

vi.mock('@/hooks/useUserStats', () => ({
  useUserStats: () => ({
    userStats: { studyStreak: 4, hoursStudied: 12, questionsAnswered: 45 },
  }),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [],
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSkills', () => ({
  useSkills: () => ({
    skills: [
      {
        id: 'skill_os',
        user_id: 'student_123',
        skill: 'Operating Systems',
        progress: 50,
        category: JSON.stringify({
          categoryName: 'Computer Science',
          preference: { pace: 'medium', hoursPerDay: 2 },
          syllabus: [
            { id: 'top_1', topic: 'Processes & Threads', completed: true, dayNumber: 1 },
            { id: 'top_2', topic: 'Virtual Memory & Paging', completed: false, dayNumber: 2 },
          ],
          unlockedDays: 0,
        }),
        created_at: new Date().toISOString(),
      },
      {
        id: 'skill_algo',
        user_id: 'student_123',
        skill: 'Algorithms',
        progress: 100,
        category: JSON.stringify({
          categoryName: 'Computer Science',
          preference: { pace: 'fast', hoursPerDay: 3 },
          syllabus: [
            { id: 'top_3', topic: 'Graph Theory', completed: true, dayNumber: 1 },
          ],
          unlockedDays: 0,
        }),
        created_at: new Date().toISOString(),
      },
    ],
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
  }),
  getSkillCategory: (cat: string) => {
    try {
      return JSON.parse(cat).categoryName || 'General';
    } catch {
      return 'General';
    }
  },
  parseSkillDetails: (cat: string) => {
    try {
      const p = JSON.parse(cat);
      return {
        categoryName: p.categoryName || 'General',
        preference: p.preference || { pace: 'medium', hoursPerDay: 2 },
        syllabus: p.syllabus || [],
        unlockedDays: p.unlockedDays || 0,
      };
    } catch {
      return {
        categoryName: 'General',
        preference: { pace: 'medium', hoursPerDay: 2 },
        syllabus: [],
        unlockedDays: 0,
      };
    }
  },
}));

vi.mock('@/components/dashboard/LearnerMasteryCard', () => ({
  LearnerMasteryCard: () => <div data-testid="learner-mastery-card">Mocked Mastery Card</div>,
}));

vi.mock('../planner/CoursePrerequisiteGraph', () => ({
  CoursePrerequisiteGraph: () => <div data-testid="course-prerequisite-graph">Mocked Graph</div>,
}));

describe('Learning Progress Bayesian Knowledge Tracing (BKT) Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Hook: Cold-Start lookup
  it('useLearnerMastery returns cold-start unassessed record for an uncalibrated skill', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/learner/mastery')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            mastery: [],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, events: [] }) };
    });

    const { result } = renderHook(() => useLearnerMastery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const record = result.current.getSkillMastery('Distributed Systems');
    expect(record.status).toBe('unassessed');
    expect(record.attempts).toBe(0);
    expect(record.masteryProbability).toBe(0.0);
    expect(record.confidence).toBe(0.0);
  });

  // 2. Hook: Matches skill with existing BKT mastery record
  it('useLearnerMastery accurately matches skill name to its BKT mastery record', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/learner/mastery')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            mastery: [
              {
                id: 'm_os',
                userId: 'student_123',
                topic: 'Operating Systems',
                subtopic: null,
                masteryProbability: 0.88,
                masteryPercentage: 88,
                attempts: 6,
                correctCount: 5,
                incorrectCount: 1,
                confidence: 0.75,
                status: 'mastered',
                lastAssessedAt: new Date().toISOString(),
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, events: [] }) };
    });

    const { result } = renderHook(() => useLearnerMastery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const record = result.current.getSkillMastery('operating systems');
    expect(record.status).toBe('mastered');
    expect(record.masteryProbability).toBe(0.88);
    expect(record.masteryPercentage).toBe(88);
    expect(record.attempts).toBe(6);
  });

  // 3. UI: CollegeDashboard displays BKT indicators in Learning Progress
  it('renders BKT Mastery indicators and Test Mastery (BKT) buttons in Learning Progress', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/learner/mastery')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            mastery: [
              {
                id: 'm_os',
                userId: 'student_123',
                topic: 'Operating Systems',
                subtopic: null,
                masteryProbability: 0.74,
                masteryPercentage: 74,
                attempts: 4,
                correctCount: 3,
                incorrectCount: 1,
                confidence: 0.67,
                status: 'proficient',
                lastAssessedAt: new Date().toISOString(),
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, events: [] }) };
    });

    render(<CollegeDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Learning Progress')).toBeInTheDocument();
      expect(screen.getByText(/BKT Mastery Model Active/i)).toBeInTheDocument();
    });

    // Check that skill name is displayed
    expect(screen.getAllByText('Operating Systems').length).toBeGreaterThan(0);

    // Check that BKT Mastery status is shown for Operating Systems
    expect(screen.getByText(/BKT: 74% Proficient/i)).toBeInTheDocument();

    // Check that Test Mastery (BKT) button is present
    const testMasteryBtns = screen.getAllByText(/Test Mastery \(BKT\)/i);
    expect(testMasteryBtns.length).toBeGreaterThan(0);
  });

  // 4. Modal: Quick BKT Assessment updates probability on question answer
  it('SkillBKTQuickAssessmentModal updates Bayesian probability upon answering question', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const handleMasteryUpdated = vi.fn();
    const handleClose = vi.fn();

    render(
      <SkillBKTQuickAssessmentModal
        isOpen={true}
        onClose={handleClose}
        skillName="Operating Systems"
        categoryName="Computer Science"
        currentMastery={{
          id: 'm_test',
          userId: 'student_123',
          courseId: null,
          topic: 'Operating Systems',
          subtopic: null,
          masteryProbability: 0.20,
          masteryPercentage: 20,
          attempts: 1,
          correctCount: 0,
          incorrectCount: 1,
          confidence: 0.33,
          status: 'developing',
          lastAssessedAt: null,
        }}
        onMasteryUpdated={handleMasteryUpdated}
      />
    );

    // Initial Bayesian probability should be rendered
    expect(screen.getByText(/P\(L\) = 20%/i)).toBeInTheDocument();

    // Click first option (correct option in question 1)
    const option1 = screen.getByText(/Strict enforcement of core architectural invariants and verification checks/i);
    fireEvent.click(option1);

    // Click "Check & Update BKT"
    const checkBtn = screen.getByText(/Check & Update BKT/i);
    fireEvent.click(checkBtn);

    // Expect Bayesian update transition
    await waitFor(() => {
      expect(screen.getByText(/Bayesian Update Applied:/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Question/i)).toBeInTheDocument();
    });
  });

  // 5. Reactive Event: window event updates Learning Progress BKT data
  it('refreshes BKT mastery when studymate-bkt-refresh event is fired', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/learner/mastery')) {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            success: true,
            mastery: [
              {
                id: 'm_1',
                userId: 'student_123',
                topic: 'Operating Systems',
                masteryProbability: callCount === 1 ? 0.40 : 0.85,
                masteryPercentage: callCount === 1 ? 40 : 85,
                attempts: callCount,
                correctCount: callCount - 1,
                incorrectCount: 0,
                confidence: 0.5,
                status: callCount === 1 ? 'developing' : 'mastered',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, events: [] }) };
    });

    const { result } = renderHook(() => useLearnerMastery());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getSkillMastery('Operating Systems').masteryPercentage).toBe(40);

    // Fire the custom event
    act(() => {
      window.dispatchEvent(new CustomEvent('studymate-bkt-refresh'));
    });

    await waitFor(() => {
      expect(result.current.getSkillMastery('Operating Systems').masteryPercentage).toBe(85);
      expect(result.current.getSkillMastery('Operating Systems').status).toBe('mastered');
    });
  });
});
