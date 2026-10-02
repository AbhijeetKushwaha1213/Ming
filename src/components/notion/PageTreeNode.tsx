import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Page } from '@/types/notion';
import { usePages } from '@/hooks/usePages';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PageActionMenu } from './PageActionMenu';

interface PageTreeNodeProps {
  page: Page;
  level?: number;
  onPageClick?: (page: Page) => void;
  selectedPageId?: string;
  isDraggable?: boolean;
}

export function PageTreeNode({
  page,
  level = 0,
  onPageClick,
  selectedPageId,
  isDraggable = true,
}: PageTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch children when expanded
  const { data: children, isLoading } = usePages(page.id, { enabled: isExpanded });
  
  const hasChildren = Boolean(children && children.length > 0);
  const isSelected = selectedPageId === page.id;

  // Auto-expand if a page is moved into this folder
  useEffect(() => {
    const handlePageMoved = (e: any) => {
      if (e?.detail?.targetParentId && e.detail.targetParentId === page.id) {
        setIsExpanded(true);
      }
    };
    window.addEventListener('studymate-page-moved', handlePageMoved);
    return () => window.removeEventListener('studymate-page-moved', handlePageMoved);
  }, [page.id]);

  // Setup drag and drop
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
      type: 'page',
      page,
    },
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleClick = () => {
    setIsExpanded(true);
    onPageClick?.(page);
  };

  return (
    <div className="select-none" ref={setNodeRef} style={style}>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer hover:bg-accent transition-all duration-150 group',
          isSelected && 'bg-accent',
          isDragging && 'opacity-50 scale-95',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Drag handle */}
        {isDraggable && (
          <button
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-4 h-4 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/10 rounded transition-all duration-150 cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        {/* Expand/collapse button */}
        <button
          onClick={handleToggle}
          className="flex items-center justify-center w-4 h-4 hover:bg-accent-foreground/10 rounded transition-all duration-150"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground transition-transform duration-200" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform duration-200" />
          )}
        </button>

        {/* Page icon */}
        <span className="flex items-center justify-center w-4 h-4 text-sm transition-transform duration-150 group-hover:scale-110">
          {page.icon || <FileText className="w-3 h-3 text-muted-foreground" />}
        </span>

        {/* Page title */}
        <span className="flex-1 text-sm truncate">
          {page.title}
        </span>

        {/* Action Menu (3 dots - Notion style) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center shrink-0">
          <PageActionMenu page={page} />
        </div>
      </div>

      {/* Render children when expanded */}
      {isExpanded && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          {isLoading ? (
            <div
              className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground/60">Loading...</span>
            </div>
          ) : hasChildren && children ? (
            children
              .filter((child) => child.id !== page.id)
              .map((child) => (
                <PageTreeNode
                  key={child.id}
                  page={child}
                  level={level + 1}
                  onPageClick={onPageClick}
                  selectedPageId={selectedPageId}
                  isDraggable={isDraggable}
                />
              ))
          ) : (
            <div
              className="py-1 text-[11px] text-muted-foreground/50 select-none italic"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              No pages inside
            </div>
          )}
        </div>
      )}
    </div>
  );
}
