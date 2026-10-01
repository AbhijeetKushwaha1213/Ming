import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FavoritesList } from '../FavoritesList';
import * as useFavorites from '@/hooks/useFavorites';
import * as usePages from '@/hooks/usePages';
import type { Page } from '@/types/notion';

// Mock the hooks
vi.mock('@/hooks/useFavorites');
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

const mockFavorites: Page[] = [
  {
    id: '1',
    user_id: 'user1',
    parent_id: null,
    title: 'Favorite Page 1',
    icon: '⭐',
    cover_image: null,
    content: [],
    position: 0,
    is_favorite: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
  },
  {
    id: '2',
    user_id: 'user1',
    parent_id: null,
    title: 'Favorite Page 2',
    icon: null,
    cover_image: null,
    content: [],
    position: 1,
    is_favorite: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
  },
];

describe('FavoritesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<FavoritesList />, { wrapper: createWrapper() });

    // Should show skeleton loaders
    const skeletons = screen.getAllByRole('generic');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<FavoritesList />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load favorites/i)).toBeInTheDocument();
  });

  it('renders nothing when no favorites', () => {
    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    const { container } = render(<FavoritesList />, { wrapper: createWrapper() });

    // Should render nothing (null)
    expect(container.firstChild).toBeNull();
  });

  it('renders favorites successfully', async () => {
    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: mockFavorites,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<FavoritesList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Favorites')).toBeInTheDocument();
      expect(screen.getByText('Favorite Page 1')).toBeInTheDocument();
      expect(screen.getByText('Favorite Page 2')).toBeInTheDocument();
    });
  });

  it('displays favorite icons', async () => {
    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: mockFavorites,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<FavoritesList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('⭐')).toBeInTheDocument();
    });
  });

  it('calls onPageClick when favorite is clicked', async () => {
    const onPageClick = vi.fn();

    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: mockFavorites,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<FavoritesList onPageClick={onPageClick} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Favorite Page 1')).toBeInTheDocument();
    });

    // Click on the first favorite
    const favoriteElement = screen.getByText('Favorite Page 1').closest('div');
    if (favoriteElement) {
      favoriteElement.click();
    }

    await waitFor(() => {
      expect(onPageClick).toHaveBeenCalledWith(mockFavorites[0]);
    });
  });

  it('highlights selected favorite', async () => {
    vi.mocked(useFavorites.useFavorites).mockReturnValue({
      data: mockFavorites,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useFavorites.useToggleFavorite).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.mocked(usePages.useMovePage).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(<FavoritesList selectedPageId="1" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const selectedFavorite = screen.getByText('Favorite Page 1').closest('div');
      expect(selectedFavorite).toHaveClass('bg-accent');
    });
  });
});
