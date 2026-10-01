import { usePages } from '@/hooks/usePages';
import { useMovePage } from '@/hooks/usePages';
import { PageTreeNode } from './PageTreeNode';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
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
} from '@dnd-kit/sortable';
import { useState } from 'react';

interface PageTreeProps {
  onPageClick?: (page: Page) => void;
  selectedPageId?: string;
}

export function PageTree({ onPageClick, selectedPageId }: PageTreeProps) {
  // Fetch root pages (pages with no parent)
  const { data: rootPages, isLoading, error } = usePages(null);
  const movePageMutation = useMovePage();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
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

    if (!rootPages) return;

    // Find the active and over pages
    const activeIndex = rootPages.findIndex((p) => p.id === active.id);
    const overIndex = rootPages.findIndex((p) => p.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    // Calculate new position
    const newPosition = overIndex;

    // Move the page
    movePageMutation.mutate({
      id: active.id as string,
      newParentId: null, // Keep at root level for now
      position: newPosition,
    });
  };

  const activePage = rootPages?.find((p) => p.id === activeId);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2" role="status" aria-live="polite" aria-label="Loading pages">
        {[...Array(5)].map((_, i) => (
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
      <div className="p-4 text-sm text-destructive" role="alert" aria-live="assertive">
        Failed to load pages. Please try again.
      </div>
    );
  }

  if (!rootPages || rootPages.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
        <p>No pages yet</p>
        <p className="text-xs mt-1">Create your first page to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={rootPages.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <nav className="py-2" role="navigation" aria-label="Page tree">
          {rootPages.map((page) => (
            <PageTreeNode
              key={page.id}
              page={page}
              onPageClick={onPageClick}
              selectedPageId={selectedPageId}
            />
          ))}
        </nav>
      </SortableContext>

      <DragOverlay>
        {activePage && (
          <div className="bg-background border rounded-md shadow-lg p-2 flex items-center gap-2" role="status" aria-live="assertive" aria-label={`Moving page: ${activePage.title}`}>
            <span className="text-sm" aria-hidden="true">
              {activePage.icon || <FileText className="w-3 h-3" />}
            </span>
            <span className="text-sm">{activePage.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
