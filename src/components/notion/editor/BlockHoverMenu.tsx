import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy } from 'lucide-react';

interface BlockHoverMenuProps {
  blockId: string;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (draggedId: string, targetId: string) => void;
}

export function BlockHoverMenu({ 
  blockId, 
  onDelete, 
  onDuplicate,
  onReorder 
}: BlockHoverMenuProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });

  const handleDelete = () => {
    console.log('Delete clicked for block:', blockId);
    onDelete();
  };

  const handleDuplicate = () => {
    console.log('Duplicate clicked for block:', blockId);
    onDuplicate();
  };

  return (
    <div
      className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-50"
      role="toolbar"
      aria-label="Block actions"
    >
      {/* Drag Handle */}
      <button
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        className="p-1.5 hover:bg-accent rounded cursor-grab active:cursor-grabbing transition-colors duration-150 bg-background border border-border shadow-md touch-none"
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Duplicate Button */}
      <button
        type="button"
        onClick={handleDuplicate}
        className="p-1.5 hover:bg-accent rounded transition-colors duration-150 bg-background border border-border shadow-md"
        aria-label="Duplicate block"
        title="Duplicate"
      >
        <Copy className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Delete Button */}
      <button
        type="button"
        onClick={handleDelete}
        className="p-1.5 hover:bg-destructive/10 rounded transition-colors duration-150 bg-background border border-border shadow-md"
        aria-label="Delete block"
        title="Delete"
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </button>
    </div>
  );
}
