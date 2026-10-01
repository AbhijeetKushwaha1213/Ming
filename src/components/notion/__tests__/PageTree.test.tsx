import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageTree } from '../PageTree';
import * as usePages from '@/hooks/usePages';
import type { Page } from '@/types/notion';

// Mock the hooks
vi.mock('@/hooks/usePages');

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockPages: Page[] = [
  {
    id: '1',
    user_id: 'user1',
    parent_id: null,
    title: 'Test Page 1',
    icon: '📄',
    cover_image: null,
    content: [],
    position: 0,
    is_favorite: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
  },
  {
    id: '2',
    user_id: 'user1',
    parent_id: null,
    title: 'Test Page 2',
    icon: null,
    cover_image: null,
    content: [],
    position: 1,
    is_favorite: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
  },
];

describe('PageTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    vi.mocked(usePages.usePages).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<PageTree />, { wrapper: createWrapper() });

    // Should show skeleton loaders
    const skeletons = screen.getAllByRole('generic');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    vi.mocked(usePages.usePages).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<PageTree />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load pages/i)).toBeInTheDocument();
  });

  it('renders empty state when no pages', () => {
    vi.mocked(usePages.usePages).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<PageTree />, { wrapper: createWrapper() });

    expect(screen.getByText(/No pages yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your first page to get started/i)).toBeInTheDocument();
  });

  it('renders pages successfully', async () => {
    vi.mocked(usePages.usePages).mockReturnValue({
      data: mockPages,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<PageTree />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Page 1')).toBeInTheDocument();
      expect(screen.getByText('Test Page 2')).toBeInTheDocument();
    });
  });

  it('displays page icons', async () => {
    vi.mocked(usePages.usePages).mockReturnValue({
      data: mockPages,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<PageTree />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('📄')).toBeInTheDocument();
    });
  });

  it('calls onPageClick when page is clicked', async () => {
    const onPageClick = vi.fn();

    vi.mocked(usePages.usePages).mockReturnValue({
      data: mockPages,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    const { container } = render(<PageTree onPageClick={onPageClick} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Test Page 1')).toBeInTheDocument();
    });

    // Click on the first page
    const pageElement = screen.getByText('Test Page 1').closest('div');
    if (pageElement) {
      pageElement.click();
    }

    await waitFor(() => {
      expect(onPageClick).toHaveBeenCalledWith(mockPages[0]);
    });
  });

  it('highlights selected page', async () => {
    vi.mocked(usePages.usePages).mockReturnValue({
      data: mockPages,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    const { container } = render(<PageTree selectedPageId="1" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const selectedPage = screen.getByText('Test Page 1').closest('div');
      expect(selectedPage).toHaveClass('bg-accent');
    });
  });
});
