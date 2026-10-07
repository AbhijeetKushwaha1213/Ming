import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateDailyPlan } from '@/utils/dailyPlanGenerator';
import { 
  getDailyPlan, 
  saveDailyPlan, 
  toggleDailyPlanTask, 
  getTodayDateString, 
  getLatestDailyPlanForUser 
} from '@/utils/dailyPlanStorage';
import { DailyLearningPlanCard } from '@/components/projects/DailyLearningPlanCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user_123', user_id: 'user_123', email: 'test@example.com' }
  })
}));

vi.mock('@/hooks/useLearnerMastery', () => ({
  useLearnerMastery: () => ({
    masteryList: [
      { topic: 'Operating Systems', subtopic: 'Process Management', masteryProbability: 0.45, status: 'developing' }
    ]
  })
}));

vi.mock('@/hooks/useCourseResources', () => ({
  useCourseResources: () => ({
    resources: [
      { id: 'res_1', title: 'Lecture 3 — Introduction to Agentic AI.pdf', type: 'pdf', file_url: '/files/agents.pdf' }
    ]
  })
}));

vi.mock('@/hooks/useSavedDAGs', () => ({
  useSavedDAGs: () => ({
    savedDAGs: [
      {
        id: 'dag_os_1',
        topic: 'Operating Systems',
        graphData: {
          nodes: [
            { id: 'node_cpu_basics', title: 'CPU Registers', mastery: 0.45, status: 'weak', prerequisites: [] },
            { id: 'node_cpu_sched', title: 'CPU Scheduling', mastery: 0.70, status: 'proficient', prerequisites: ['node_cpu_basics'] }
          ]
        }
      }
    ]
  })
}));

vi.mock('@/hooks/useFlashcards', () => ({
  useFlashcards: () => ({
    studyMaterials: []
  })
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Daily Learning Plan System', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Plan Generation Engine (generateDailyPlan)', () => {
    it('generates a concrete learning path with objective, sequence, and exact time budget', () => {
      const plan = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_react',
        skillName: 'React Portfolio Website',
        projectType: 'frontend',
        assignedTasks: [{ id: '1', title: 'Design homepage layout', completed: false }],
        targetStudyMinutes: 60,
        preferredCodingPlatform: 'LeetCode'
      });

      expect(plan.skillName).toBe('React Portfolio Website');
      expect(plan.estimatedTotalMinutes).toBe(60);
      expect(plan.objective).toContain('Design homepage layout');
      expect(plan.tasks.length).toBeGreaterThanOrEqual(4);
      
      const sumMinutes = plan.tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
      expect(sumMinutes).toBe(60);
    });

    it('detects weak prerequisites from DAG and prepends a prerequisite review step', () => {
      const plan = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_os',
        skillName: 'Operating Systems',
        projectType: 'theory',
        assignedTasks: [{ id: '1', title: 'CPU Scheduling Algorithms', completed: false }],
        targetStudyMinutes: 60,
        userSavedDAGs: [
          {
            id: 'dag_os_1',
            topic: 'Operating Systems',
            graphData: {
              nodes: [
                { id: 'node_cpu_basics', title: 'CPU Registers', mastery: 0.40, status: 'weak', prerequisites: [] },
                { id: 'node_cpu_sched', title: 'CPU Scheduling', mastery: 0.70, status: 'proficient', prerequisites: ['node_cpu_basics'] }
              ]
            }
          }
        ]
      });

      expect(plan.dagContext?.weakPrerequisites).toContain('CPU Registers');
      const firstTask = plan.tasks[0];
      expect(firstTask.title).toContain('Review Prerequisite: CPU Registers');
      expect(firstTask.prerequisiteNotice).toContain('Prerequisite Detected from Concept DAG');
    });

    it('prioritizes user uploaded resources before searching external resources', () => {
      const plan = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_agentic_ai',
        skillName: 'Agentic AI',
        assignedTasks: [{ id: '1', title: 'Introduction to Agentic AI', completed: false }],
        uploadedResources: [
          { id: 'res_1', title: 'Lecture 3 — Introduction to Agentic AI.pdf', type: 'pdf', file_url: '/files/agents.pdf' }
        ]
      });

      const conceptTask = plan.tasks.find(t => t.type === 'article' || t.type === 'concept' || t.type === 'video');
      expect(conceptTask?.resource?.isInternal).toBe(true);
      expect(conceptTask?.resource?.platform).toBe('Ming Library');
      expect(conceptTask?.resource?.title).toContain('Lecture 3 — Introduction to Agentic AI.pdf');
    });

    it('respects user preferred practice platform (LeetCode vs HackerRank vs Codeforces)', () => {
      const planHackerRank = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_python',
        skillName: 'Python Programming',
        assignedTasks: [{ id: '1', title: 'Data Structures and Algorithms', completed: false }],
        preferredCodingPlatform: 'HackerRank'
      });

      const practiceTask = planHackerRank.tasks.find(t => t.type === 'practice');
      expect(practiceTask?.practiceDetails?.platform).toBe('HackerRank');
      expect(practiceTask?.resource?.platform).toBe('HackerRank');
      expect(practiceTask?.resource?.url).toContain('hackerrank.com');
    });
  });

  describe('Plan Persistence & Storage (dailyPlanStorage)', () => {
    it('persists and retrieves daily plan by date and user', () => {
      const today = getTodayDateString();
      const plan = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_ml',
        skillName: 'Machine Learning',
        assignedTasks: [{ id: '1', title: 'Neural Networks Basics', completed: false }]
      });

      saveDailyPlan(plan);
      const retrieved = getDailyPlan('user_123', 'skill_ml', today);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.skillName).toBe('Machine Learning');
      expect(retrieved?.planDate).toBe(today);
    });

    it('toggles task completion and updates plan status', () => {
      const plan = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_ml',
        skillName: 'Machine Learning',
        assignedTasks: [{ id: '1', title: 'Neural Networks Basics', completed: false }]
      });
      saveDailyPlan(plan);

      const taskId = plan.tasks[0].id;
      const updated = toggleDailyPlanTask('user_123', 'skill_ml', plan.planDate, taskId);
      expect(updated?.tasks[0].completed).toBe(true);
      expect(updated?.status).toBe('in_progress');

      // Latest daily plan retrieval for dashboard
      const latest = getLatestDailyPlanForUser('user_123');
      expect(latest?.id).toBe(plan.id);
      expect(latest?.tasks[0].completed).toBe(true);
    });
  });

  describe('UI Component (DailyLearningPlanCard)', () => {
    it('renders empty state when not generated and generates on button click', async () => {
      renderWithProviders(
        <DailyLearningPlanCard
          userId="user_123"
          skillOrProjectId="skill_web"
          skillName="Web Development"
          assignedTasks={[{ id: '1', title: 'HTML & CSS Basics', completed: false }]}
        />
      );

      expect(screen.getByText("Today's Learning Plan")).toBeDefined();
      expect(screen.getByText("Not Generated")).toBeDefined();
      expect(screen.getByText("No plan generated for today yet")).toBeDefined();

      const generateBtns = screen.getAllByRole('button', { name: /generate today's plan/i });
      expect(generateBtns.length).toBeGreaterThan(0);
      fireEvent.click(generateBtns[0]);

      // Verify generating state transition
      expect(screen.getByText(/generating/i)).toBeDefined();
    });

    it('passes context to AI Tutor when Ask Tutor button is clicked', async () => {
      const mockAskTutor = vi.fn();
      const plan = generateDailyPlan({
        userId: 'user_123',
        skillOrProjectId: 'skill_ai',
        skillName: 'Agentic AI',
        assignedTasks: [{ id: '1', title: 'Introduction to Agentic AI', completed: false }]
      });
      saveDailyPlan(plan);

      renderWithProviders(
        <DailyLearningPlanCard
          userId="user_123"
          skillOrProjectId="skill_ai"
          skillName="Agentic AI"
          assignedTasks={[{ id: '1', title: 'Introduction to Agentic AI', completed: false }]}
          onAskAiTutor={mockAskTutor}
        />
      );

      // Find Ask Tutor buttons
      const askTutorButtons = screen.getAllByRole('button', { name: /ask tutor/i });
      expect(askTutorButtons.length).toBeGreaterThan(0);

      fireEvent.click(askTutorButtons[0]);
      expect(mockAskTutor).toHaveBeenCalledWith(
        expect.objectContaining({
          skill: 'Agentic AI',
          taskTitle: expect.any(String),
        })
      );
    });
  });
});
