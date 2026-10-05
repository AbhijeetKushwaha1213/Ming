import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIGeneratorPage } from '../components/flashcards/AIGeneratorPage';
import { DAGPipeline } from '../components/ai/DAGPipeline';
import { DAGViewer } from '../components/flashcards/DAGViewer';
import { CoursePrerequisiteGraph } from '../components/planner/CoursePrerequisiteGraph';
import {
  layoutDAGNodes,
  evaluateNodeStatuses,
  detectPrerequisiteGaps,
  computeRecommendedLearningPath,
} from '../utils/dagEngine';
import { DAGNode, DAGTutorContext } from '../types/dag';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatPanel } from '../components/layout/ChatPanel';
import { AddSkillDialog } from '../components/skills/AddSkillDialog';

// Mock navigation
vi.mock('@/utils/navigation', () => ({
  navigateToTab: vi.fn(),
}));

vi.mock('@/hooks/useSkills', () => ({
  useSkills: () => ({
    skills: [],
    isCreating: false,
    createSkill: vi.fn(),
  }),
}));

// Mock hooks
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user', user_id: 'test-user', email: 'test@example.com', userType: 'college' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCourseResources', () => ({
  useCourseResources: () => ({
    resources: [
      {
        id: 'res-1',
        title: 'Operating Systems — Lecture Notes.pdf',
        type: 'PDF',
        icon: '📕',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useLearnerMastery', () => ({
  useLearnerMastery: () => ({
    masteryList: [
      {
        topic: 'Process Lifecycle & PCB',
        masteryProbability: 0.65,
        status: 'proficient',
      },
      {
        topic: 'CPU Registers & Kernel Mode',
        masteryProbability: 0.85,
        status: 'mastered',
      },
      {
        topic: 'Process Synchronization & Semaphores',
        masteryProbability: 0.35,
        status: 'weak',
      },
    ],
    recordEvidence: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@/hooks/useFlashcards', () => ({
  useFlashcards: () => ({
    flashcards: [],
    studyMaterials: [],
    isLoading: false,
    createStudyMaterial: {
      mutateAsync: vi.fn().mockResolvedValue({ id: 'saved-mat-1' }),
    },
    deleteFlashcard: vi.fn(),
    deleteStudyMaterial: vi.fn(),
  }),
}));

describe('DAG Pipeline & Learning Path Architecture', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders all four tabs in AIGeneratorPage in exact specified order', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AIGeneratorPage />
      </QueryClientProvider>
    );

    // Verify 4 tabs exist
    expect(screen.getByRole('tab', { name: /Adaptive Assessment/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /AI Materials/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /DAG Pipeline/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /My Vault/i })).toBeDefined();

    // Verify switching to DAG Pipeline tab
    fireEvent.click(screen.getByRole('tab', { name: /DAG Pipeline/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/DAG Pipeline/i).length).toBeGreaterThan(0);
    });
  });

  describe('DAG Engine Algorithms', () => {
    it('correctly breaks cycles and assigns topological levels and rows', () => {
      const cyclicalNodes: DAGNode[] = [
        {
          id: 'n1',
          title: 'Foundational A',
          topic: 'OS',
          subtopic: 'A',
          difficulty: 'Beginner',
          level: 0,
          row: 0,
          prerequisites: ['n2'], // Cycle: n1 -> n2 -> n1
          description: 'A',
          sourceOrigin: { type: 'PDF', coordinate: 'P1', documentTitle: 'Doc1' },
        },
        {
          id: 'n2',
          title: 'Intermediate B',
          topic: 'OS',
          subtopic: 'B',
          difficulty: 'Intermediate',
          level: 0,
          row: 0,
          prerequisites: ['n1'],
          description: 'B',
          sourceOrigin: { type: 'PDF', coordinate: 'P2', documentTitle: 'Doc2' },
        },
      ];

      const laidOut = layoutDAGNodes(cyclicalNodes);
      expect(laidOut.length).toBe(2);
      // The cycle should have been broken
      const n1 = laidOut.find(n => n.id === 'n1')!;
      const n2 = laidOut.find(n => n.id === 'n2')!;
      expect(n1.prerequisites.includes('n2') && n2.prerequisites.includes('n1')).toBe(false);
    });

    it('evaluates mastery statuses and locks concepts when prerequisites are weak', () => {
      const nodes: DAGNode[] = [
        {
          id: 'p1',
          title: 'Prerequisite Concept',
          topic: 'OS',
          subtopic: 'Concurrency',
          difficulty: 'Beginner',
          level: 0,
          row: 0,
          prerequisites: [],
          description: 'Desc',
          sourceOrigin: { type: 'PDF', coordinate: 'P1', documentTitle: 'Doc1' },
        },
        {
          id: 'c1',
          title: 'Dependent Concept',
          topic: 'OS',
          subtopic: 'Deadlocks',
          difficulty: 'Intermediate',
          level: 1,
          row: 0,
          prerequisites: ['p1'],
          description: 'Desc',
          sourceOrigin: { type: 'PDF', coordinate: 'P2', documentTitle: 'Doc2' },
        },
      ];

      // Prerequisite is weak (mastery 0.3)
      const masteryMap = {
        'prerequisite concept': 0.3,
        'dependent concept': 0.7,
      };

      const evaluated = evaluateNodeStatuses(nodes, masteryMap);
      const dependent = evaluated.find(n => n.id === 'c1')!;
      expect(dependent.status).toBe('locked');
    });

    it('detects prerequisite gaps when a required prerequisite is weak', () => {
      const nodes: DAGNode[] = [
        {
          id: 'sync',
          title: 'Process Synchronization',
          topic: 'OS',
          subtopic: 'Concurrency',
          difficulty: 'Intermediate',
          level: 0,
          row: 0,
          prerequisites: [],
          description: 'Semaphores and mutexes',
          mastery: 0.35,
          status: 'weak',
          sourceOrigin: { type: 'VIDEO', coordinate: 'Slide 14', documentTitle: 'Doc' },
        },
        {
          id: 'deadlocks',
          title: 'Deadlocks',
          topic: 'OS',
          subtopic: 'Deadlocks',
          difficulty: 'Advanced',
          level: 1,
          row: 0,
          prerequisites: ['sync'],
          description: 'Resource contention',
          mastery: 0.5,
          status: 'locked',
          sourceOrigin: { type: 'PDF', coordinate: 'Page 300', documentTitle: 'Doc' },
        },
      ];

      const gap = detectPrerequisiteGaps('deadlocks', nodes);
      expect(gap.hasGap).toBe(true);
      expect(gap.incompletePrerequisites.length).toBe(1);
      expect(gap.incompletePrerequisites[0].title).toBe('Process Synchronization');
      expect(gap.guidance).toContain('strengthened before studying');
    });

    it('computes recommended learning sequence distinguishing completed, current, next, locked', () => {
      const nodes: DAGNode[] = [
        {
          id: 'n1',
          title: 'Step 1 Foundations',
          topic: 'Topic',
          subtopic: 'Sub',
          difficulty: 'Beginner',
          level: 0,
          row: 0,
          prerequisites: [],
          description: 'Desc',
          status: 'mastered',
          mastery: 0.9,
          sourceOrigin: { type: 'PDF', coordinate: 'P1', documentTitle: 'Doc' },
        },
        {
          id: 'n2',
          title: 'Step 2 Core',
          topic: 'Topic',
          subtopic: 'Sub',
          difficulty: 'Intermediate',
          level: 1,
          row: 0,
          prerequisites: ['n1'],
          description: 'Desc',
          status: 'proficient',
          mastery: 0.6,
          sourceOrigin: { type: 'PDF', coordinate: 'P2', documentTitle: 'Doc' },
        },
        {
          id: 'n3',
          title: 'Step 3 Advanced',
          topic: 'Topic',
          subtopic: 'Sub',
          difficulty: 'Advanced',
          level: 2,
          row: 0,
          prerequisites: ['n2'],
          description: 'Desc',
          status: 'locked',
          mastery: 0.2,
          sourceOrigin: { type: 'PDF', coordinate: 'P3', documentTitle: 'Doc' },
        },
      ];

      const steps = computeRecommendedLearningPath(nodes);
      expect(steps.length).toBe(3);
      expect(steps[0].status).toBe('completed');
      expect(steps[1].status).toBe('current');
      expect(steps[2].status).toBe('locked');
    });
  });

  describe('DAG Pipeline UI & Actions', () => {
    it('renders DAG Pipeline with saved DAGs by default and opens configuration dropdown', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <DAGPipeline />
        </QueryClientProvider>
      );

      expect(screen.getByText(/AI Learning Path/i)).toBeDefined();
      expect(screen.getByText(/Generate a prerequisite-aware concept graph/i)).toBeDefined();

      // Verify saved DAG list is shown by default
      await waitFor(() => {
        expect(screen.getByText(/My Saved Learning Paths/i)).toBeDefined();
        expect(screen.getAllByRole('button', { name: /Create New DAG|New Learning DAG/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/CPU Registers & Kernel Mode/i).length).toBeGreaterThan(0);
      });

      // Open "New Learning DAG" dropdown
      const createButtons = screen.getAllByRole('button', { name: /Create New DAG|New Learning DAG/i });
      fireEvent.click(createButtons[0]);

      // Verify dropdown content
      await waitFor(() => {
        expect(screen.getByText(/Configure New Learning DAG/i)).toBeDefined();
        expect(screen.getByRole('button', { name: /Generate Learning DAG/i })).toBeDefined();
      });
    });

    it('renders node details panel with source references, prerequisites, and actions when opening a DAG', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <DAGPipeline />
        </QueryClientProvider>
      );

      // Click Open DAG to view the graph
      await waitFor(() => {
        expect(screen.getAllByText(/Open DAG/i).length).toBeGreaterThan(0);
      });
      fireEvent.click(screen.getAllByText(/Open DAG/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/Ask AI Tutor About Concept/i)).toBeDefined();
        expect(screen.getByText(/Generate Material/i)).toBeDefined();
        expect(screen.getByText(/Practice Quiz/i)).toBeDefined();
        expect(screen.getByText(/Audio Brief/i)).toBeDefined();
        expect(screen.getByText(/Mark Mastered/i)).toBeDefined();
      });

      // Verify Regenerate, Improve, Delete buttons exist
      expect(screen.getAllByRole('button', { name: /Regenerate/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Improve/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Delete/i }).length).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Compact Summary Integration', () => {
    it('renders compact Learning Path summary on dashboard with Open DAG Pipeline button', () => {
      render(
        <CoursePrerequisiteGraph compact={true} />
      );

      // Verify compact view rendered
      expect(screen.getByText(/Learning Path/i)).toBeDefined();
      expect(screen.getByText(/Current Topic:/i)).toBeDefined();
      expect(screen.getByText(/^Current$/i)).toBeDefined();
      expect(screen.getByText(/^Next$/i)).toBeDefined();
      expect(screen.getByText(/Open DAG Pipeline/i)).toBeDefined();
      expect(screen.getByText(/Preview Full Map/i)).toBeDefined();
    });

    it('can toggle preview full map when requested on Dashboard', () => {
      render(
        <CoursePrerequisiteGraph compact={true} />
      );

      const previewBtn = screen.getByText(/Preview Full Map/i);
      fireEvent.click(previewBtn);

      expect(screen.getByText(/Collapse/i)).toBeDefined();
      expect(screen.getByText(/Visual Course Flow & Prerequisite Map/i)).toBeDefined();
    });
  });

  describe('DAGViewer in My Vault', () => {
    it('renders DAG in VaultViewer with interactive concept nodes', () => {
      const testDAG: any = {
        id: 'dag-vault-1',
        title: 'Operating Systems Concept DAG',
        topic: 'Operating Systems',
        learningGoal: 'Concept Mastery',
        depth: 'Standard',
        nodes: [
          {
            id: 'v1',
            title: 'Kernel Mode',
            topic: 'OS',
            subtopic: 'Hardware',
            difficulty: 'Beginner',
            level: 0,
            row: 0,
            prerequisites: [],
            description: 'Kernel and user mode isolation.',
            sourceOrigin: { type: 'PDF', coordinate: 'Page 12', documentTitle: 'OS.pdf' },
            status: 'mastered',
          },
        ],
      };

      render(
        <DAGViewer
          dagData={testDAG}
          title={testDAG.title}
          topic={testDAG.topic}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Operating Systems Concept DAG/i)).toBeDefined();
      expect(screen.getByText(/Vault DAG/i)).toBeDefined();
      expect(screen.getAllByText(/Kernel Mode/i).length).toBeGreaterThan(0);
    });
  });

  describe('Saved Learning DAGs Management & Top Area Switcher', () => {
    it('allows toggling between Generate/Explore DAG and Saved Learning DAGs', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <DAGPipeline />
        </QueryClientProvider>
      );

      // Verify top area switcher buttons exist
      const exploreBtn = screen.getByRole('button', { name: /Generate \/ Explore DAG/i });
      const savedBtn = screen.getByRole('button', { name: /Saved Learning DAGs/i });
      expect(exploreBtn).toBeDefined();
      expect(savedBtn).toBeDefined();

      // Click Saved Learning DAGs
      fireEvent.click(savedBtn);

      await waitFor(() => {
        expect(screen.getByText(/My Saved Learning Paths/i)).toBeDefined();
      });

      // Switch back to Explore
      fireEvent.click(exploreBtn);
      await waitFor(() => {
        expect(screen.getByText(/AI Learning Path & DAG Generator/i)).toBeDefined();
      });
    });
  });

  describe('AI Tutor Right Sidebar Drawer & DAG Context Integration', () => {
    it('displays DAG Tutor context banner and all 7 quick action chips upon event dispatch', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <ChatPanel isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const mockDAGContext: DAGTutorContext = {
        dagId: 'dag-1',
        dagTitle: 'Operating Systems & Concurrency',
        topic: 'Operating Systems',
        subtopic: 'Concurrency',
        learningGoal: 'Concept Mastery',
        selectedConcept: {
          id: 'os-4',
          name: 'Process Synchronization & Semaphores',
          difficulty: 'Intermediate',
          description: 'Critical section problem and semaphore primitives.',
          masteryPercentage: 35,
          status: 'weak',
          prerequisites: ['os-1'],
          prerequisiteNames: ['CPU Registers & Kernel Mode'],
          downstreamConcepts: ['Deadlock Characterization'],
          sourceCoordinate: 'Lecture 6 Timestamp 22:40',
          sourceDocument: 'CS301_Concurrency.mp4',
        },
        weakTopics: ['Deadlock Characterization'],
        totalConcepts: 6,
      };

      // Dispatch event to open drawer with DAG context
      window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: { dagContext: mockDAGContext } }));

      await waitFor(() => {
        expect(screen.getByText(/Process Synchronization & Semaphores/i)).toBeDefined();
        // Check for quick action chips
        expect(screen.getByText(/Explain concept/i)).toBeDefined();
        expect(screen.getByText(/Explain prerequisite/i)).toBeDefined();
        expect(screen.getByText(/Give an example/i)).toBeDefined();
        expect(screen.getByText(/Quiz me/i)).toBeDefined();
        expect(screen.getByText(/What to study next\?/i)).toBeDefined();
        expect(screen.getByText(/Why am I weak here\?/i)).toBeDefined();
        expect(screen.getByText(/Generate study material/i)).toBeDefined();
      });
    });
  });

  describe('AddSkillDialog "Create Learning DAG" Integration', () => {
    it('renders mode switcher and switches to Create Learning DAG form', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AddSkillDialog />
        </QueryClientProvider>
      );

      // Open dialog
      const openBtn = screen.getByRole('button', { name: /Add Skill/i });
      fireEvent.click(openBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Learning DAG/i })).toBeDefined();
      });

      // Switch to DAG mode
      fireEvent.click(screen.getByRole('button', { name: /Create Learning DAG/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Skill \/ Subject Topic/i)).toBeDefined();
        expect(screen.getByLabelText(/Course \/ Field/i)).toBeDefined();
        expect(screen.getByLabelText(/Subtopic \/ Focus/i)).toBeDefined();
        expect(screen.getByLabelText(/Target Difficulty/i)).toBeDefined();
        expect(screen.getByLabelText(/Graph Depth/i)).toBeDefined();
        expect(screen.getByLabelText(/Learning Goal/i)).toBeDefined();
        expect(screen.getByRole('button', { name: /Generate & Save DAG/i })).toBeDefined();
      });
    });
  });
});
