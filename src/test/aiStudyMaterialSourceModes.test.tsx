import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PremiumAIGenerator } from '@/components/ai/PremiumAIGenerator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ragAPI from '@/api/ragAPI';
import * as resourceAPI from '@/api/resourceAPI';
import * as pageAPI from '@/api/pageAPI';
import * as navigation from '@/utils/navigation';
import * as useAIAssistantModule from '@/hooks/useAIAssistant';

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

// Mock Auth
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'test_student',
      user_id: 'test_student',
      email: 'student@example.com',
      userType: 'college',
      branch: 'Computer Science',
    },
  }),
}));

// Mock Navigation
vi.mock('@/utils/navigation', () => ({
  navigateToTab: vi.fn(),
}));

describe('AI Study Material Generator - Dual Source Modes & Grounded Retrieval', () => {
  const mockResources = [
    {
      id: 'res_os_1',
      userId: 'test_student',
      title: 'Operating Systems Notes.pdf',
      type: 'PDF' as const,
      folder: 'Operating Systems',
      tags: ['OS', 'CS'],
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'res_dbms_2',
      userId: 'test_student',
      title: 'DBMS Unit 1.pdf',
      type: 'PDF' as const,
      folder: 'Database Systems',
      tags: ['DBMS'],
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    },
  ];

  const mockGenerateContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(resourceAPI, 'listResources').mockResolvedValue(mockResources);
    vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([]);
    vi.spyOn(useAIAssistantModule, 'useAIAssistant').mockReturnValue({
      generateContent: mockGenerateContent.mockResolvedValue({
        flashcards: [
          {
            question: 'What is a process control block (PCB)?',
            answer: 'A data structure maintained by the OS for each process containing PID, state, PC, and registers.',
            hint: 'Contains process execution state',
          },
        ],
      }),
      isLoading: false,
      messages: [],
      sendMessage: vi.fn(),
    });

    vi.spyOn(ragAPI, 'searchChunks').mockResolvedValue({
      query: 'Operating Systems CPU Scheduling',
      total_results: 1,
      results: [
        {
          chunk_id: 'chunk_os_1',
          score: 0.92,
          text: 'Process scheduling queues include the ready queue and device queues. Context switching saves the PCB state.',
          topic: 'Operating Systems',
          location: {
            source_type: 'PDF',
            page_number: 14,
          },
        },
      ],
    });
  });

  it('1. Renders "Choose Study Material Source" with Existing Resources and New Material buttons', async () => {
    renderWithProviders(<PremiumAIGenerator />);

    // Select a material type (e.g. Flashcards) to enter the input step
    const flashcardButton = screen.getByText('Flashcards');
    fireEvent.click(flashcardButton);

    await waitFor(() => {
      expect(screen.getByText('Choose Study Material Source')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Existing Resources/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Material/i })).toBeInTheDocument();
    });
  });

  it('2. In Existing Resources mode, displays library materials with title, type, folder, and date metadata', async () => {
    renderWithProviders(<PremiumAIGenerator />);

    fireEvent.click(screen.getByText('Flashcards'));

    await waitFor(() => {
      expect(screen.getAllByText(/Operating Systems Notes\.pdf/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/DBMS Unit 1\.pdf/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/PDF/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/📁 Operating Systems/i)).toBeInTheDocument();
      expect(screen.getByText(/📁 Database Systems/i)).toBeInTheDocument();
    });
  });

  it('3. Can select an individual resource or multiple resources, and provide an optional focused topic', async () => {
    renderWithProviders(<PremiumAIGenerator />);

    fireEvent.click(screen.getByText('Flashcards'));

    await waitFor(() => {
      expect(screen.getAllByText(/Operating Systems Notes\.pdf/i).length).toBeGreaterThan(0);
    });

    // Click on Operating Systems Notes.pdf to toggle/select
    const osCards = screen.getAllByText(/Operating Systems Notes\.pdf/i);
    const osCard = osCards[osCards.length - 1].closest('div');
    if (osCard) fireEvent.click(osCard);

    // Enter an optional topic
    const topicInput = screen.getByPlaceholderText(/e\.g\. CPU Scheduling, Memory Management/i);
    fireEvent.change(topicInput, { target: { value: 'CPU Scheduling' } });
    expect((topicInput as HTMLInputElement).value).toBe('CPU Scheduling');

    // Continue button is enabled
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);

    // Moves to Generation Settings with grounded source summary
    await waitFor(() => {
      expect(screen.getByText('Generation Settings')).toBeInTheDocument();
      expect(screen.getByText(/Grounded in Course Material/i)).toBeInTheDocument();
    });
  });

  it('4. Shows "No resources available" empty state with CTA to navigate to Resources when library is empty', async () => {
    vi.spyOn(resourceAPI, 'listResources').mockResolvedValue([]);
    vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([]);

    renderWithProviders(<PremiumAIGenerator />);
    fireEvent.click(screen.getByText('Flashcards'));

    await waitFor(() => {
      expect(screen.getByText('No resources available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Go to Resources ↗/i })).toBeInTheDocument();
    });

    // Clicking Go to Resources triggers navigateToTab('resources')
    fireEvent.click(screen.getByRole('button', { name: /Go to Resources ↗/i }));
    expect(navigation.navigateToTab).toHaveBeenCalledWith('resources');
  });

  it('5. Allows switching to New Material mode to upload files, paste notes, or enter a topic', async () => {
    renderWithProviders(<PremiumAIGenerator />);
    fireEvent.click(screen.getByText('Flashcards'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Material/i })).toBeInTheDocument();
    });

    // Switch to New Material
    fireEvent.click(screen.getByRole('button', { name: /New Material/i }));

    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Paste Notes')).toBeInTheDocument();
    expect(screen.getByText('Enter Topic')).toBeInTheDocument();
  });

  it('6. Generates grounded study materials from the selected existing resource without re-uploading', async () => {
    renderWithProviders(<PremiumAIGenerator />);
    fireEvent.click(screen.getByText('Flashcards'));

    await waitFor(() => {
      expect(screen.getAllByText(/Operating Systems Notes\.pdf/i).length).toBeGreaterThan(0);
    });

    // Click Continue to Settings
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Generation Settings')).toBeInTheDocument();
    });

    // Click Preview
    fireEvent.click(screen.getByRole('button', { name: /Preview/i }));

    await waitFor(() => {
      expect(screen.getByText('AI Preview')).toBeInTheDocument();
      expect(screen.getByText(/Grounded in Library Materials/i)).toBeInTheDocument();
    });

    // Click Generate
    const generateBtn = screen.getByRole('button', { name: /Generate with AI/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      // searchChunks was called to retrieve indexed chunks for the selected resource
      expect(ragAPI.searchChunks).toHaveBeenCalled();
      // generateContent was called with grounded options
      expect(mockGenerateContent).toHaveBeenCalledWith(
        'flashcards',
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({
          groundedContext: expect.any(String),
          sourceTitle: expect.any(String),
        })
      );
    });
  });
});
