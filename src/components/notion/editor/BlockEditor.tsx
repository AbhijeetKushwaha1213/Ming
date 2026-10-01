import React, { useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Block } from '@/types/notion';
import { BlockRenderer } from './BlockRenderer';
import { SlashCommandMenu } from './SlashCommandMenu';
import { BlockHoverMenu } from './BlockHoverMenu';
import { useScreenReaderAnnouncement } from '@/hooks/useScreenReaderAnnouncement';
import './editor.css';

interface BlockEditorProps {
  pageId: string;
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  editable?: boolean;
}

export function BlockEditor({ 
  pageId, 
  blocks, 
  onBlocksChange,
  editable = true 
}: BlockEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = React.useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = React.useState({ x: 0, y: 0 });
  const [slashMenuBlockId, setSlashMenuBlockId] = React.useState<string | null>(null);
  const blockRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const announce = useScreenReaderAnnouncement();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createBlock = useCallback((type: Block['type'], position: number, id?: string): Block => {
    const baseBlock = {
      id: id ?? crypto.randomUUID(),
      type,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (type === 'text' || type.startsWith('heading')) {
      return { ...baseBlock, content: { text: '', marks: [] } } as Block;
    }
    if (type === 'bulletList' || type === 'numberedList') {
      return { ...baseBlock, items: [{ text: '', marks: [] }] } as Block;
    }
    if (type === 'checkbox') {
      return { ...baseBlock, checked: false, content: { text: '', marks: [] } } as Block;
    }
    if (type === 'quote' || type === 'callout') {
      return { ...baseBlock, content: { text: '', marks: [] }, ...(type === 'callout' ? { icon: '💡', backgroundColor: '#f8fafc' } : {}) } as Block;
    }
    if (type === 'code') {
      return { ...baseBlock, language: 'javascript', content: '' } as Block;
    }
    if (type === 'image') {
      return { ...baseBlock, url: '', caption: '', width: 0, height: 0 } as Block;
    }
    if (type === 'file') {
      return { ...baseBlock, file_id: '', filename: '', file_type: '', file_size: 0 } as Block;
    }
    if (type === 'embed') {
      return { ...baseBlock, url: '', caption: '' } as Block;
    }
    if (type === 'table') {
      const firstColumnId = crypto.randomUUID();
      const secondColumnId = crypto.randomUUID();
      return {
        ...baseBlock,
        columns: [
          { id: firstColumnId, name: 'Column 1', type: 'text', width: 240 },
          { id: secondColumnId, name: 'Column 2', type: 'text', width: 240 },
        ],
        rows: [
          { id: crypto.randomUUID(), cells: { [firstColumnId]: '', [secondColumnId]: '' } },
        ],
      } as Block;
    }

    return baseBlock as Block;
  }, []);

  const isBlockEmpty = useCallback((block: Block) => {
    switch (block.type) {
      case 'text':
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'quote':
        return !block.content.text.trim();
      case 'bulletList':
      case 'numberedList':
        return block.items.every((item) => !item.text.trim());
      case 'checkbox':
      case 'callout':
        return !block.content.text.trim();
      case 'code':
        return !block.content.trim();
      case 'image':
        return !block.url.trim() && !block.file_id;
      case 'file':
        return !block.file_id;
      case 'embed':
        return !block.url.trim();
      case 'table':
        return block.rows.every((row) => Object.values(row.cells).every((value) => !String(value ?? '').trim()));
      case 'divider':
      case 'toc':
        return true;
      default:
        return false;
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      const reordered = arrayMove(blocks, oldIndex, newIndex);
      const updatedBlocks = reordered.map((block, index) => ({
        ...block,
        position: index,
        updated_at: new Date().toISOString(),
      }));

      onBlocksChange(updatedBlocks);
      announce(`Block moved from position ${oldIndex + 1} to position ${newIndex + 1}`);
    }
  }, [blocks, onBlocksChange, announce]);

  const handleBlockUpdate = useCallback((blockId: string, updates: Partial<Block>) => {
    const updatedBlocks = blocks.map(block => 
      block.id === blockId ? { ...block, ...updates, updated_at: new Date().toISOString() } : block
    );
    onBlocksChange(updatedBlocks);
    announce('Block updated');
  }, [blocks, onBlocksChange, announce]);

  const handleBlockDelete = useCallback((blockId: string) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    const updatedBlocks = blocks
      .filter(block => block.id !== blockId)
      .map((block, index) => ({ ...block, position: index }));
    onBlocksChange(updatedBlocks);
    announce(`Block ${blockIndex + 1} deleted. ${updatedBlocks.length} blocks remaining.`);
  }, [blocks, onBlocksChange, announce]);

  const handleBlockDuplicate = useCallback((blockId: string) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;

    const originalBlock = blocks[blockIndex];
    const duplicatedBlock: Block = {
      ...originalBlock,
      id: crypto.randomUUID(),
      position: blockIndex + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedBlocks = [
      ...blocks.slice(0, blockIndex + 1),
      duplicatedBlock,
      ...blocks.slice(blockIndex + 1)
    ].map((block, index) => ({ ...block, position: index }));

    onBlocksChange(updatedBlocks);
    announce(`Block duplicated. New block created at position ${blockIndex + 2}.`);
  }, [blocks, onBlocksChange, announce]);

  const handleBlockReorder = useCallback((draggedId: string, targetId: string) => {
    const draggedIndex = blocks.findIndex(b => b.id === draggedId);
    const targetIndex = blocks.findIndex(b => b.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = arrayMove(blocks, draggedIndex, targetIndex);
    const updatedBlocks = reordered.map((block, index) => ({
      ...block,
      position: index,
      updated_at: new Date().toISOString(),
    }));

    onBlocksChange(updatedBlocks);
  }, [blocks, onBlocksChange]);

  const handleInsertBlock = useCallback((type: Block['type'], position?: number) => {
    const insertPosition = position ?? blocks.length;
    const newBlock = createBlock(type, insertPosition);

    const updatedBlocks = [
      ...blocks.slice(0, insertPosition),
      newBlock,
      ...blocks.slice(insertPosition)
    ].map((block, index) => ({ ...block, position: index }));

    onBlocksChange(updatedBlocks);
    setShowSlashMenu(false);
    announce(`${type} block inserted at position ${insertPosition + 1}`);
  }, [blocks, createBlock, onBlocksChange, announce]);

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback((e: KeyboardEvent) => {
    if (!editable || !selectedBlockId) return;

    const currentIndex = blocks.findIndex(b => b.id === selectedBlockId);
    if (currentIndex === -1) return;

    // Arrow Up - Select previous block
    if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      if (currentIndex > 0) {
        const prevBlockId = blocks[currentIndex - 1].id;
        setSelectedBlockId(prevBlockId);
        blockRefs.current.get(prevBlockId)?.focus();
      }
    }

    // Arrow Down - Select next block
    if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      if (currentIndex < blocks.length - 1) {
        const nextBlockId = blocks[currentIndex + 1].id;
        setSelectedBlockId(nextBlockId);
        blockRefs.current.get(nextBlockId)?.focus();
      }
    }

    // Cmd/Ctrl + D - Duplicate block
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      handleBlockDuplicate(selectedBlockId);
    }

    // Cmd/Ctrl + Shift + Backspace - Delete block
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Backspace') {
      e.preventDefault();
      handleBlockDelete(selectedBlockId);
    }

    // Cmd/Ctrl + Shift + Up - Move block up
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        handleBlockReorder(selectedBlockId, blocks[currentIndex - 1].id);
      }
    }

    // Cmd/Ctrl + Shift + Down - Move block down
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < blocks.length - 1) {
        handleBlockReorder(selectedBlockId, blocks[currentIndex + 1].id);
      }
    }
  }, [editable, selectedBlockId, blocks, handleBlockDuplicate, handleBlockDelete, handleBlockReorder]);

  // Register keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => document.removeEventListener('keydown', handleKeyboardNavigation);
  }, [handleKeyboardNavigation]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        className="block-editor relative"
        role="document"
        aria-label="Page content editor"
        onClick={(e) => {
          if (!editable || blocks.length === 0) return;

          // If the user clicks clearly below the last block, focus it if empty, or insert a new text block there
          const lastBlock = blocks[blocks.length - 1];
          const lastEl = blockRefs.current.get(lastBlock.id);

          if (!lastEl) return;

          const rect = lastEl.getBoundingClientRect();

          // If click is below the last block (with a small margin)
          if (e.clientY > rect.bottom + 8) {
            if (isBlockEmpty(lastBlock)) {
              const focusable = lastEl.querySelector('.ProseMirror, input:not([disabled]), textarea:not([disabled])');
              (focusable as HTMLElement)?.focus();
            } else {
              handleInsertBlock('text', blocks.length);
            }
          }
        }}
      >
        {blocks.length === 0 ? (
          <div 
            className="text-center py-12 px-4 animate-in fade-in duration-300 cursor-text" 
            role="button"
            tabIndex={0}
            aria-label="Click to add first block"
            onClick={() => handleInsertBlock('text', 0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleInsertBlock('text', 0);
              }
            }}
          >
            <div className="max-w-md mx-auto">
              <div className="text-muted-foreground mb-4">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-foreground font-medium mb-2">Start writing</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click here to start typing or press{' '}
                <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                  /
                </kbd>{' '}
                to see all block types
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>💡 Try adding headings, lists, images, tables, and more</p>
                <p className="mt-3 font-medium">Keyboard shortcuts:</p>
                <p>• Tab / Shift+Tab - Navigate between blocks</p>
                <p>• Alt+↑/↓ - Select previous/next block</p>
                <p>• Cmd/Ctrl+D - Duplicate block</p>
                <p>• Cmd/Ctrl+Shift+Backspace - Delete block</p>
                <p>• Cmd/Ctrl+Shift+↑/↓ - Move block up/down</p>
                <p className="mt-3 font-medium">Mouse actions:</p>
                <p>• Hover over a block to see the menu (⋯) in the top-right</p>
                <p>• Click the menu to delete or duplicate blocks</p>
                <p>• Drag the grip icon (⋮⋮) to reorder blocks</p>
              </div>
            </div>
          </div>
        ) : (
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1" role="list" aria-label="Content blocks">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  ref={(el) => {
                    if (el) {
                      blockRefs.current.set(block.id, el);
                    } else {
                      blockRefs.current.delete(block.id);
                    }
                  }}
                  className="relative group block-enter hover:bg-accent/30 rounded-md transition-colors duration-150 px-2 py-1"
                  role="article"
                  aria-label={`Block ${index + 1} of ${blocks.length}`}
                  onMouseEnter={() => setSelectedBlockId(block.id)}
                  onMouseLeave={() => setSelectedBlockId(null)}
                >
                  <BlockRenderer
                    pageId={pageId}
                    block={block}
                    editable={editable}
                    onUpdate={(updates) => handleBlockUpdate(block.id, updates)}
                    onSlashCommand={(position) => {
                      setShowSlashMenu(true);
                      setSlashMenuPosition(position);
                      setSlashMenuBlockId(block.id);
                    }}
                  />
                  
                  {editable && (
                    <BlockHoverMenu
                      blockId={block.id}
                      onDelete={() => handleBlockDelete(block.id)}
                      onDuplicate={() => handleBlockDuplicate(block.id)}
                      onReorder={handleBlockReorder}
                    />
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        )}

        {showSlashMenu && (
          <SlashCommandMenu
            position={slashMenuPosition}
            onSelect={(type) => {
              const blockIndex = slashMenuBlockId
                ? blocks.findIndex((b) => b.id === slashMenuBlockId)
                : blocks.length - 1;

              if (blockIndex >= 0) {
                const currentBlock = blocks[blockIndex];
                if (isBlockEmpty(currentBlock)) {
                  const replacementBlock = createBlock(type, blockIndex, currentBlock.id);
                  const updatedBlocks = blocks.map((block, index) =>
                    index === blockIndex
                      ? { ...replacementBlock, position: index }
                      : { ...block, position: index }
                  );
                  onBlocksChange(updatedBlocks);
                  setShowSlashMenu(false);
                  announce(`${type} block created at position ${blockIndex + 1}`);
                  return;
                }
              }

              const insertPosition = blockIndex >= 0 ? blockIndex + 1 : blocks.length;
              handleInsertBlock(type, insertPosition);
            }}
            onClose={() => setShowSlashMenu(false)}
          />
        )}
      </div>
    </DndContext>
  );
}
