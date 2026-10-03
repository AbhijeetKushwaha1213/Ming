import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssessmentAnalyticsModal, AssessmentAttemptGroup } from '@/components/ai/AssessmentAnalyticsModal';
import { LearnerMasteryCard } from '@/components/dashboard/LearnerMasteryCard';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test_user', user_id: 'test_user', name: 'Test Student' },
  }),
}));

vi.mock('@/utils/navigation', () => ({
  navigateToTab: vi.fn(),
}));

describe('Assessment History & Analytics Experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAttempt1 = {
    id: 'att_1',
    userId: 'test_user',
    title: 'Linear Algebra Adaptive Assessment',
    topic: 'Linear Algebra',
    subtopic: 'Matrix Basics',
    difficulty: 'medium',
    score: 2,
    totalQuestions: 5,
    percentage: 40,
    completedAt: '2026-10-01T10:00:00.000Z',
    diagnosticReport: {
      overallScore: '2/5',
      percentage: 40,
      totalQuestions: 5,
      correctCount: 2,
      strongConcepts: ['Matrix Basics'],
      weakConcepts: ['Eigenvalues', 'Vector Spaces'],
      topicPerformance: {
        'Matrix Basics': { total: 2, correct: 2, percentage: 100 },
        'Eigenvalues': { total: 2, correct: 0, percentage: 0 },
        'Vector Spaces': { total: 1, correct: 0, percentage: 0 },
      },
      incorrectAnswers: [
        {
          questionId: 'q_2',
          question: 'What defines an eigenvector?',
          userAnswer: 'Av = v + λ',
          correctAnswer: 'Av = λv',
          explanation: 'Av = λv defines an eigenvector with eigenvalue λ.',
          citationLabel: 'Page 14',
        },
      ],
    },
    questions: [
      {
        question_id: 'q_1',
        question: 'What is matrix identity?',
        correct_answer: 'AI = A',
        explanation: 'Identity matrix preserves vectors.',
      },
      {
        question_id: 'q_2',
        question: 'What defines an eigenvector?',
        correct_answer: 'Av = λv',
        explanation: 'Av = λv defines an eigenvector with eigenvalue λ.',
      },
    ],
    answers: ['AI = A', 'Av = v + λ'],
  };

  const mockAttempt2 = {
    id: 'att_2',
    userId: 'test_user',
    title: 'Linear Algebra Adaptive Assessment',
    topic: 'Linear Algebra',
    subtopic: 'Matrix Basics',
    difficulty: 'medium',
    score: 4,
    totalQuestions: 5,
    percentage: 80,
    completedAt: '2026-10-04T12:00:00.000Z',
    diagnosticReport: {
      overallScore: '4/5',
      percentage: 80,
      totalQuestions: 5,
      correctCount: 4,
      strongConcepts: ['Matrix Basics', 'Eigenvalues'],
      weakConcepts: ['Vector Spaces'],
      topicPerformance: {
        'Matrix Basics': { total: 2, correct: 2, percentage: 100 },
        'Eigenvalues': { total: 2, correct: 2, percentage: 100 },
        'Vector Spaces': { total: 1, correct: 0, percentage: 0 },
      },
      incorrectAnswers: [],
    },
    questions: [
      {
        question_id: 'q_1',
        question: 'What is matrix identity?',
        correct_answer: 'AI = A',
        explanation: 'Identity matrix preserves vectors.',
      },
      {
        question_id: 'q_2',
        question: 'What defines an eigenvector?',
        correct_answer: 'Av = λv',
        explanation: 'Av = λv defines an eigenvector with eigenvalue λ.',
      },
    ],
    answers: ['AI = A', 'Av = λv'],
  };

  const mockGroup: AssessmentAttemptGroup = {
    key: 'linear algebra adaptive assessment:::linear algebra',
    title: 'Linear Algebra Adaptive Assessment',
    topic: 'Linear Algebra',
    subtopic: 'Matrix Basics',
    difficulty: 'medium',
    bestScore: 80,
    latestScore: 80,
    totalQuestions: 5,
    attempts: [mockAttempt2, mockAttempt1],
    latestAttempt: mockAttempt2,
  };

  it('1. Dedicated Analytics Modal displays score, strong concepts, weak concepts, and recommendations', () => {
    const handleRetake = vi.fn();
    render(
      <AssessmentAnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        selectedAttempt={mockAttempt1}
        userId="test_user"
        onRetake={handleRetake}
      />
    );

    // Score & Header
    expect(screen.getByText('Assessment Analytics')).toBeInTheDocument();
    expect(screen.getAllByText(/Linear Algebra Adaptive Assessment/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/40%/).length).toBeGreaterThan(0);

    // Strong & Weak Areas
    expect(screen.getByText(/Strong Areas \(Mastered\)/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Matrix Basics/i)).toBeInTheDocument();

    expect(screen.getByText(/Weak Areas \(Needs Review\)/i)).toBeInTheDocument();
    expect(screen.getByText(/⚠ Eigenvalues/i)).toBeInTheDocument();
    expect(screen.getByText(/⚠ Vector Spaces/i)).toBeInTheDocument();

    // Recommended Next Steps
    expect(screen.getByText(/Recommended Next Steps/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Review/i).length).toBeGreaterThan(0);
  });

  it('2. Multi-attempt comparison displays improvement gain and attempt timeline', () => {
    render(
      <AssessmentAnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        selectedAttempt={mockAttempt2}
        userId="test_user"
        onRetake={vi.fn()}
      />
    );

    // Multi-attempt progression
    expect(screen.getByText(/Attempt Progression & Improvement/i)).toBeInTheDocument();
    expect(screen.getByText(/▲ \+40% Improvement/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Attempt 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Attempt 2/i).length).toBeGreaterThan(0);
  });

  it('3. Question-by-question review shows questions, student answers, and grounding explanations', () => {
    render(
      <AssessmentAnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        selectedAttempt={mockAttempt1}
        userId="test_user"
        onRetake={vi.fn()}
      />
    );

    expect(screen.getByText(/Question-by-Question Detailed Result/i)).toBeInTheDocument();
    expect(screen.getByText(/What defines an eigenvector\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Av = v \+ λ/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Av = λv/i).length).toBeGreaterThan(0);
  });

  it('4. Retake button triggers the retake action with the selected attempt configuration', () => {
    const handleRetake = vi.fn();
    render(
      <AssessmentAnalyticsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        selectedAttempt={mockAttempt2}
        userId="test_user"
        onRetake={handleRetake}
      />
    );

    const retakeButtons = screen.getAllByRole('button', { name: /Retake Assessment/i });
    expect(retakeButtons.length).toBeGreaterThan(0);
    fireEvent.click(retakeButtons[0]);

    expect(handleRetake).toHaveBeenCalledWith(mockAttempt2);
  });

  it('5. Main Dashboard LearnerMasteryCard only shows high-level mastery summary and topic breakdown, not assessment history', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        mastery: [
          {
            id: 'm_1',
            userId: 'test_user',
            topic: 'Linear Algebra',
            subtopic: 'Matrix Basics',
            masteryProbability: 0.85,
            status: 'mastered',
            attempts: 3,
            correctCount: 4,
            totalCount: 5,
            confidence: 0.9,
            lastAssessedAt: '2026-10-04T12:00:00.000Z',
          },
        ],
      }),
    } as any);

    render(<LearnerMasteryCard />);

    await waitFor(() => {
      expect(screen.getByText(/Knowledge Mastery Model \(BKT\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Topic Mastery Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Linear Algebra/i)).toBeInTheDocument();
    });

    // Ensure no assessment history section or audit event log is present on Dashboard
    expect(screen.queryByText(/Recent Assessment History & Diagnostic Reports/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recent BKT Audit Events/i)).not.toBeInTheDocument();
  });
});
