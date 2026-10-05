import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { localStore } from '@/utils/localStore';
import { FlashcardVault, getItemSubject } from '@/components/flashcards/FlashcardVault';
import { PRESET_SUBJECTS } from '@/components/ai/PremiumAIGenerator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Auth
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'test_user',
      user_id: 'test_user',
      email: 'student@example.com',
      branch: 'Computer Science',
    },
  }),
}));

const mockStudyMaterials: any[] = [];
const mockFlashcards: any[] = [];

vi.mock('@/hooks/useFlashcards', () => ({
  useFlashcards: () => ({
    flashcards: mockFlashcards,
    studyMaterials: mockStudyMaterials,
    isLoading: false,
    deleteFlashcard: vi.fn(),
    deleteStudyMaterial: vi.fn(),
  }),
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

describe('Study Vault Subject Sorting, Filtering, and Generation Options', () => {
  beforeEach(() => {
    localStorage.clear();
    mockStudyMaterials.length = 0;
    mockFlashcards.length = 0;
  });

  it('exports preset subjects with comprehensive academic disciplines', () => {
    expect(PRESET_SUBJECTS).toContain('Operating Systems');
    expect(PRESET_SUBJECTS).toContain('Computer Networks');
    expect(PRESET_SUBJECTS).toContain('Programming');
    expect(PRESET_SUBJECTS).toContain('Machine Learning & AI');
    expect(PRESET_SUBJECTS).toContain('Graphic Design');
    expect(PRESET_SUBJECTS).toContain('Mathematics');
  });

  it('accurately resolves and normalizes subject for legacy and new vault items via getItemSubject', () => {
    // 1. Explicit subject
    expect(getItemSubject({ subject: 'Physics' })).toBe('Physics');

    // 2. Inferred from topic
    expect(getItemSubject({ topic: 'cpu scheduling' })).toBe('Operating Systems');
    expect(getItemSubject({ topic: '7 layer of Computer networking' })).toBe('Computer Networks');
    expect(getItemSubject({ topic: 'Javascript' })).toBe('Programming');
    expect(getItemSubject({ topic: 'graphic design' })).toBe('Graphic Design');
    expect(getItemSubject({ topic: 'Machine Learning' })).toBe('Machine Learning & AI');

    // 3. Inferred from title or tags
    expect(getItemSubject({ title: 'Binary Search Tree Balancing', tags: ['dsa'] })).toBe('Data Structures & Algorithms');
    expect(getItemSubject({ title: 'SQL Joins and Normal Forms' })).toBe('Database Management');
  });

  it('persists subject directly in localStore when creating study materials', () => {
    const saved = localStore.saveStudyMaterial({
      title: 'Virtual Memory and Paging',
      type: 'notes',
      subject: 'Operating Systems',
      topic: 'Virtual Memory',
      difficulty: 'hard',
      tags: ['notes', 'Operating Systems', 'AI-Generated'],
      content: { summary: 'Virtual Memory notes' }
    });

    expect(saved.subject).toBe('Operating Systems');
    const fromStore = localStore.getStudyMaterials().find(m => m.id === saved.id);
    expect(fromStore?.subject).toBe('Operating Systems');
  });

  it('renders Subject badges on vault cards and shows filter controls', () => {
    mockStudyMaterials.push(
      {
        id: 'mat-1',
        title: 'CPU Scheduling Algorithms',
        type: 'mindmaps',
        topic: 'cpu scheduling',
        subject: 'Operating Systems',
        difficulty: 'medium',
        tags: ['mindmaps', 'AI-Generated'],
        created_at: new Date('2026-10-05').toISOString(),
      },
      {
        id: 'mat-2',
        title: '7 Layer OSI Model',
        type: 'diagrams',
        topic: '7 layer of Computer networking',
        subject: 'Computer Networks',
        difficulty: 'medium',
        tags: ['diagrams', 'AI-Generated'],
        created_at: new Date('2026-10-04').toISOString(),
      }
    );

    renderWithProviders(<FlashcardVault />);

    // Verify Subject badges are visible on each card
    expect(screen.getByText('📘 Operating Systems')).toBeDefined();
    expect(screen.getByText('📘 Computer Networks')).toBeDefined();

    // Verify Titles and Topics
    expect(screen.getByText('CPU Scheduling Algorithms')).toBeDefined();
    expect(screen.getByText('7 Layer OSI Model')).toBeDefined();
  });
});
