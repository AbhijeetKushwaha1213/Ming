import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useMovePage } from '@/hooks/usePages';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, FileText, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Page } from '@/types/notion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

interface FavoritesListProps {
  onPageClick?: (page: Page) => void;
  selectedPageId?: string;
}

interface FavoriteItemProps {
  page: Page;
  onPageClick?: (page: Page) => void;
  selectedPageId?: string;
  onToggleFavorite: (pageId: string) => void;
}

function FavoriteItem({
  page,
  onPageClick,
  selectedPageId,
  onToggleFavorite,
}: FavoriteItemProps) {
  const isSelected = selectedPageId === page.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    data: {
      type: 'favorite',
      page,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    onPageClick?.(page);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(page.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-accent transition-colors group',
        isSelected && 'bg-accent',
        isDragging && 'opacity-50',
      )}
      onClick={handleClick}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-4 h-4 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/10 rounded transition-opacity cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>

      {/* Page icon */}
      <span className="flex items-center justify-center w-4 h-4 text-sm">
        {page.icon || <FileText className="w-3 h-3 text-muted-foreground" />}
      </span>

      {/* Page title */}
      <span className="flex-1 text-sm truncate">{page.title}</span>

      {/* Favorite toggle */}
      <button
        onClick={handleToggleFavorite}
        className="flex items-center justify-center w-4 h-4 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/10 rounded transition-opacity"
        aria-label="Remove from favorites"
      >
        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
      </button>
    </div>
  );
}

export function FavoritesList({ onPageClick, selectedPageId }: FavoritesListProps) {
  const { data: favorites, isLoading, error } = useFavorites();
  const movePageMutation = useMovePage();
  const toggleFavoriteMutation = useToggleFavorite();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    if (!favorites) return;

    // Find the active and over pages
    const activeIndex = favorites.findIndex((p) => p.id === active.id);
    const overIndex = favorites.findIndex((p) => p.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Calculate new position
    const newPosition = overIndex;

    // Move the page (update position for favorites ordering)
    movePageMutation.mutate({
      id: active.id as string,
      newParentId: favorites[activeIndex].parent_id,
      position: newPosition,
    });
  };

  const handleToggleFavorite = (pageId: string) => {
    toggleFavoriteMutation.mutate(pageId);
  };

  const activePage = favorites?.find((p) => p.id === activeId);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 text-xs text-destructive">
        Failed to load favorites
      </div>
    );
  }

  if (!favorites || favorites.length === 0) {
    return null; // Don't show section if no favorites
  }

  return (
    <div className="mb-4">
      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
        <Star className="w-3 h-3" />
        Favorites
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={favorites.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0.5">
            {favorites.map((page) => (
              <FavoriteItem
                key={page.id}
                page={page}
                onPageClick={onPageClick}
                selectedPageId={selectedPageId}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activePage && (
            <div className="bg-background border rounded-md shadow-lg p-2 flex items-center gap-2">
              <span className="text-sm">
                {activePage.icon || <FileText className="w-3 h-3" />}
              </span>
              <span className="text-sm">{activePage.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
