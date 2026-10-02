import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { 
  GripVertical, 
  Trash2, 
  Copy, 
  Plus, 
  Type, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  MessageSquare,
  Bold, 
  Italic, 
  Underline,
  Check,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Block, BlockType } from '@/types/notion';

interface BlockHoverMenuProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder?: (draggedId: string, targetId: string) => void;
  onInsertBelow?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function BlockHoverMenu({ 
  block,
  onUpdate,
  onDelete, 
  onDuplicate,
  onReorder,
  onInsertBelow
}: BlockHoverMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id: block.id });

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDelete = () => {
    onDelete();
    setIsOpen(false);
  };

  const handleDuplicate = () => {
    onDuplicate();
    setIsOpen(false);
  };

  // Extract marks from block
  const marks = ('content' in block && typeof block.content !== 'string' ? block.content?.marks : []) || [];
  const colorMark = marks.find((m: any) => m.type === 'color');
  const currentColor = colorMark?.attrs?.color || null;
  const isBold = marks.some((m: any) => m.type === 'bold');
  const isItalic = marks.some((m: any) => m.type === 'italic');
  const isUnderline = marks.some((m: any) => m.type === 'underline');

  const handleSetColor = (color: string | null) => {
    if ('content' in block) {
      const text = typeof block.content === 'string' ? block.content : block.content?.text || '';
      const currentMarks = (typeof block.content !== 'string' ? block.content?.marks : []) || [];
      const withoutColor = currentMarks.filter((m: any) => m.type !== 'color');
      const newMarks = color ? [...withoutColor, { type: 'color', attrs: { color } }] : withoutColor;
      onUpdate({
        content: { text, marks: newMarks as any }
      } as any);
    } else if ('items' in block && Array.isArray(block.items)) {
      const newItems = block.items.map((it: any) => {
        const text = typeof it === 'string' ? it : it?.text || '';
        const m = (typeof it !== 'string' ? it?.marks : []) || [];
        const withoutColor = m.filter((x: any) => x.type !== 'color');
        return { text, marks: color ? [...withoutColor, { type: 'color', attrs: { color } }] : withoutColor };
      });
      onUpdate({ items: newItems } as any);
    }
  };

  const handleToggleMark = (markType: 'bold' | 'italic' | 'underline') => {
    if ('content' in block) {
      const text = typeof block.content === 'string' ? block.content : block.content?.text || '';
      const currentMarks = (typeof block.content !== 'string' ? block.content?.marks : []) || [];
      const has = currentMarks.some((m: any) => m.type === markType);
      const newMarks = has ? currentMarks.filter((m: any) => m.type !== markType) : [...currentMarks, { type: markType }];
      onUpdate({
        content: { text, marks: newMarks as any }
      } as any);
    } else if ('items' in block && Array.isArray(block.items)) {
      const newItems = block.items.map((it: any) => {
        const text = typeof it === 'string' ? it : it?.text || '';
        const m = (typeof it !== 'string' ? it?.marks : []) || [];
        const has = m.some((x: any) => x.type === markType);
        return { text, marks: has ? m.filter((x: any) => x.type !== markType) : [...m, { type: markType }] };
      });
      onUpdate({ items: newItems } as any);
    }
  };

  const handleConvertType = (newType: BlockType) => {
    let text = '';
    if ('content' in block) {
      text = typeof block.content === 'string' ? block.content : block.content?.text || '';
    } else if ('items' in block && Array.isArray(block.items)) {
      text = block.items.map((it: any) => typeof it === 'string' ? it : it.text || '').join('\n');
    }

    const currentMarks = ('content' in block && typeof block.content !== 'string' ? block.content?.marks : []) || [];

    if (newType === 'text' || newType.startsWith('heading') || newType === 'quote') {
      onUpdate({
        type: newType,
        content: { text: text.split('\n')[0] || text, marks: currentMarks }
      } as any);
    } else if (newType === 'bulletList' || newType === 'numberedList') {
      const lines = text ? text.split('\n').filter(Boolean) : [''];
      onUpdate({
        type: newType,
        items: lines.map(line => ({ text: line, marks: currentMarks }))
      } as any);
    } else if (newType === 'checkbox') {
      onUpdate({
        type: newType,
        checked: false,
        content: { text: text.split('\n')[0] || text, marks: currentMarks }
      } as any);
    } else if (newType === 'code') {
      onUpdate({
        type: newType,
        language: 'javascript',
        content: text
      } as any);
    } else if (newType === 'callout') {
      onUpdate({
        type: newType,
        icon: '💡',
        content: { text, marks: currentMarks }
      } as any);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute right-2 top-2 flex items-center gap-1 transition-opacity duration-200 z-30',
        isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
      )}
      role="toolbar"
      aria-label="Block actions"
    >
      {/* Six-dot Box (Drag handle + Click for Options Menu) */}
      <button
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          'p-1.5 rounded cursor-grab active:cursor-grabbing transition-colors duration-150 border shadow-sm touch-none flex items-center justify-center',
          isOpen 
            ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30' 
            : 'bg-background hover:bg-accent border-border text-muted-foreground hover:text-foreground'
        )}
        aria-label="Block options and drag"
        title="Click for block styles & colors, or drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Add Block Below Button */}
      {onInsertBelow && (
        <button
          type="button"
          onClick={onInsertBelow}
          className="p-1.5 hover:bg-primary hover:text-primary-foreground rounded transition-colors duration-150 bg-background hover:bg-accent border border-border shadow-sm text-muted-foreground hover:text-foreground"
          aria-label="Add block below"
          title="Add block below"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {/* Duplicate Button */}
      <button
        type="button"
        onClick={handleDuplicate}
        className="p-1.5 hover:bg-accent rounded transition-colors duration-150 bg-background border border-border shadow-sm text-muted-foreground hover:text-foreground"
        aria-label="Duplicate block"
        title="Duplicate block"
      >
        <Copy className="w-4 h-4" />
      </button>

      {/* Delete Button */}
      <button
        type="button"
        onClick={handleDelete}
        className="p-1.5 hover:bg-destructive/10 rounded transition-colors duration-150 bg-background border border-border shadow-sm text-muted-foreground hover:text-destructive"
        aria-label="Delete block"
        title="Delete block"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Notion-Style Popover Menu triggered by Six-Dot Box */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1.5 w-64 bg-popover/98 backdrop-blur-md border border-border/80 rounded-xl shadow-2xl z-50 p-2.5 text-popover-foreground animate-in fade-in zoom-in-95 duration-150 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" /> Block Options
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
              {block.type}
            </span>
          </div>

          {/* Color Picker Dots */}
          <div className="mb-2.5">
            <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Text Color</span>
              {currentColor && (
                <button
                  type="button"
                  onClick={() => handleSetColor(null)}
                  className="text-[10px] text-primary hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { name: 'Default', value: null, bg: 'bg-foreground' },
                { name: 'Red', value: '#ef4444', bg: 'bg-red-500' },
                { name: 'Blue', value: '#0ea5e9', bg: 'bg-sky-500' },
                { name: 'Green', value: '#22c55e', bg: 'bg-emerald-500' },
                { name: 'Yellow', value: '#eab308', bg: 'bg-amber-500' },
                { name: 'Purple', value: '#a855f7', bg: 'bg-purple-500' },
                { name: 'Orange', value: '#f97316', bg: 'bg-orange-500' },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleSetColor(c.value)}
                  className={cn(
                    'w-5 h-5 rounded-full border border-border/60 transition-transform flex items-center justify-center hover:scale-110 active:scale-95',
                    c.bg,
                    currentColor === c.value && 'ring-2 ring-primary ring-offset-2 ring-offset-popover'
                  )}
                  title={c.name}
                >
                  {currentColor === c.value && <Check className="w-3 h-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Text Style Formatting (B, I, U) */}
          <div className="mb-2.5 pt-2 border-t border-border/40">
            <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
              Style
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => handleToggleMark('bold')}
                className={cn(
                  'py-1 px-2 rounded-md text-xs font-bold border transition-colors flex items-center justify-center gap-1',
                  isBold
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-border/50 text-foreground'
                )}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" /> Bold
              </button>
              <button
                type="button"
                onClick={() => handleToggleMark('italic')}
                className={cn(
                  'py-1 px-2 rounded-md text-xs italic border transition-colors flex items-center justify-center gap-1',
                  isItalic
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-border/50 text-foreground'
                )}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" /> Italic
              </button>
              <button
                type="button"
                onClick={() => handleToggleMark('underline')}
                className={cn(
                  'py-1 px-2 rounded-md text-xs underline border transition-colors flex items-center justify-center gap-1',
                  isUnderline
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-border/50 text-foreground'
                )}
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" /> Underline
              </button>
            </div>
          </div>

          {/* Turn into section */}
          <div className="pt-2 border-t border-border/40 mb-2">
            <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
              Turn into
            </div>
            <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
              {[
                { type: 'text', label: 'Paragraph Text', icon: Type },
                { type: 'heading1', label: 'Heading 1', icon: Heading1 },
                { type: 'heading2', label: 'Heading 2', icon: Heading2 },
                { type: 'heading3', label: 'Heading 3', icon: Heading3 },
                { type: 'bulletList', label: 'Bulleted List', icon: List },
                { type: 'numberedList', label: 'Numbered List', icon: ListOrdered },
                { type: 'checkbox', label: 'To-do List', icon: CheckSquare },
                { type: 'quote', label: 'Quote', icon: Quote },
                { type: 'callout', label: 'Callout', icon: MessageSquare },
                { type: 'code', label: 'Code Block', icon: Code },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleConvertType(item.type as BlockType)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent text-left transition-colors',
                    block.type === item.type 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-foreground'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  {block.type === item.type && <Check className="w-3 h-3 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions Footer */}
          <div className="pt-2 border-t border-border/40 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border border-border/40"
            >
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors border border-destructive/20"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
