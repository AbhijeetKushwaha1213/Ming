import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { localStore } from '@/utils/localStore';
import { FlashcardVault } from '@/components/flashcards/FlashcardVault';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Auth
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'test_user',
      user_id: 'test_user',
      email: 'student@example.com',
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

describe('Study Vault Deduplication & Save Redundancy Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
    mockStudyMaterials.length = 0;
    mockFlashcards.length = 0;
  });

  it('updates in place instead of creating duplicate items in localStore when title and type match', () => {
    const item1 = localStore.saveStudyMaterial({
      title: '7 layer of Computer networking',
      type: 'diagrams',
      content: { diagram: 'Layer 1: Physical' },
      topic: 'Computer Networks',
      difficulty: 'medium',
      tags: ['diagrams', 'AI-Generated'],
    });

    const item2 = localStore.saveStudyMaterial({
      title: '7 layer of Computer networking',
      type: 'diagrams',
      content: { diagram: 'Layer 1: Physical, Layer 2: Data Link' },
      topic: 'Computer Networks',
      difficulty: 'medium',
      tags: ['diagrams', 'AI-Generated'],
    });

    const allMaterials = localStore.getStudyMaterials();
    expect(allMaterials.length).toBe(1);
    expect(allMaterials[0].id).toBe(item1.id);
    expect(allMaterials[0].content.diagram).toContain('Data Link');
  });

  it('deduplicates bulk save items in localStore', () => {
    localStore.saveStudyMaterial({
      title: 'Javascript',
      type: 'mindmaps',
      content: { central_topic: 'Javascript' },
      topic: 'Javascript',
      difficulty: 'medium',
      tags: ['mindmaps'],
    });

    localStore.saveMultipleStudyMaterials([
      {
        title: 'Javascript',
        type: 'mindmaps',
        content: { central_topic: 'Javascript ES6' },
        topic: 'Javascript',
        difficulty: 'medium',
        tags: ['mindmaps'],
      },
      {
        title: 'Operating Systems',
        type: 'notes',
        content: { summary: 'OS Kernel overview' },
        topic: 'OS',
        difficulty: 'medium',
        tags: ['notes'],
      }
    ]);

    const allMaterials = localStore.getStudyMaterials();
    expect(allMaterials.length).toBe(2);
    const jsItem = allMaterials.find(m => m.title === 'Javascript');
    expect(jsItem?.content.central_topic).toBe('Javascript ES6');
  });

  it('filters out duplicate cards and suppresses ghost notes in FlashcardVault', () => {
    // Simulate what was previously created:
    // 1) Diagrams card
    // 2) Duplicate diagrams card (e.g. from unsynced local vs remote)
    // 3) Shadow note card ("AI generated diagrams for 7 layer of Computer networking")
    mockStudyMaterials.push(
      {
        id: 'remote-uuid-1',
        title: '7 layer of Computer networking',
        type: 'diagrams',
        difficulty: 'medium',
        topic: 'Computer networking',
        content: { summary: '7 layer diagram' },
        tags: ['diagrams', 'AI-Generated'],
        created_at: '2026-10-04T01:00:00Z',
      },
      {
        id: 'local-mat-duplicate-2',
        title: '7 layer of Computer networking',
        type: 'diagrams',
        difficulty: 'medium',
        topic: 'Computer networking',
        content: { summary: '7 layer diagram' },
        tags: ['diagrams', 'AI-Generated'],
        created_at: '2026-10-04T01:00:00Z',
      },
      {
        id: 'res_shadow_3',
        title: '7 layer of Computer networking',
        type: 'notes',
        difficulty: 'medium',
        topic: 'Computer networking',
        content: { summary: 'AI generated diagrams for 7 layer of Computer networking' },
        tags: ['notes', 'AI-Generated'],
        created_at: '2026-10-04T01:00:00Z',
      }
    );

    renderWithProviders(<FlashcardVault />);

    // Should only render ONE card for "7 layer of Computer networking"
    const headings = screen.getAllByRole('heading', { level: 3 });
    const matchedHeadings = headings.filter(h => h.textContent?.includes('7 layer of Computer'));
    expect(matchedHeadings.length).toBe(1);

    // The ghost notes card should NOT be rendered
    expect(screen.queryByText(/AI generated diagrams for 7 layer/i)).not.toBeInTheDocument();
  });
});
