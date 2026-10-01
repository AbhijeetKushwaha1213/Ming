import React, { useState, useEffect, useRef } from 'react';
import { 
  Type, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare,
  Quote,
  MessageSquare,
  Code,
  Image,
  FileText,
  Link2,
  Minus,
  Table,
  ListTree
} from 'lucide-react';
import type { BlockType } from '@/types/notion';

interface SlashCommand {
  id: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords: string[];
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Plain text paragraph',
    icon: <Type className="w-4 h-4" />,
    keywords: ['text', 'paragraph', 'p'],
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className="w-4 h-4" />,
    keywords: ['heading', 'h1', 'title'],
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="w-4 h-4" />,
    keywords: ['heading', 'h2', 'subtitle'],
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="w-4 h-4" />,
    keywords: ['heading', 'h3'],
  },
  {
    id: 'bulletList',
    label: 'Bulleted List',
    description: 'Create a bulleted list',
    icon: <List className="w-4 h-4" />,
    keywords: ['bullet', 'list', 'ul'],
  },
  {
    id: 'numberedList',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: <ListOrdered className="w-4 h-4" />,
    keywords: ['number', 'list', 'ol', 'ordered'],
  },
  {
    id: 'checkbox',
    label: 'Checkbox',
    description: 'Create a to-do item',
    icon: <CheckSquare className="w-4 h-4" />,
    keywords: ['checkbox', 'todo', 'task', 'check'],
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Create a quote block',
    icon: <Quote className="w-4 h-4" />,
    keywords: ['quote', 'blockquote', 'citation'],
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Create a callout box',
    icon: <MessageSquare className="w-4 h-4" />,
    keywords: ['callout', 'note', 'info', 'alert'],
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Create a code block',
    icon: <Code className="w-4 h-4" />,
    keywords: ['code', 'snippet', 'pre'],
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload or embed an image',
    icon: <Image className="w-4 h-4" />,
    keywords: ['image', 'img', 'picture', 'photo'],
  },
  {
    id: 'file',
    label: 'File',
    description: 'Upload a file',
    icon: <FileText className="w-4 h-4" />,
    keywords: ['file', 'attachment', 'upload'],
  },
  {
    id: 'embed',
    label: 'Embed',
    description: 'Embed external content',
    icon: <Link2 className="w-4 h-4" />,
    keywords: ['embed', 'iframe', 'video', 'youtube'],
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Add a horizontal divider',
    icon: <Minus className="w-4 h-4" />,
    keywords: ['divider', 'separator', 'hr', 'line'],
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Create a table',
    icon: <Table className="w-4 h-4" />,
    keywords: ['table', 'grid', 'spreadsheet'],
  },
  {
    id: 'toc',
    label: 'Table of Contents',
    description: 'Generate table of contents',
    icon: <ListTree className="w-4 h-4" />,
    keywords: ['toc', 'contents', 'index'],
  },
];

interface SlashCommandMenuProps {
  position: { x: number; y: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ position, onSelect, onClose }: SlashCommandMenuProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands based on search query
  const filteredCommands = searchQuery
    ? SLASH_COMMANDS.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.keywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : SLASH_COMMANDS;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-80 bg-popover border border-border rounded-md shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="dialog"
      aria-label="Insert block menu"
      aria-modal="true"
      style={{
        top: position.y + 4,
        left: position.x,
      }}
    >
      <div className="p-2 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for a block type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-transparent outline-none transition-all duration-150"
          aria-label="Search block types"
          aria-controls="block-type-list"
        />
      </div>

      <div className="max-h-96 overflow-y-auto" id="block-type-list" role="listbox" aria-label="Available block types">
        {filteredCommands.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center animate-in fade-in duration-200" role="status">
            No blocks found
          </div>
        ) : (
          <div className="py-1">
            {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                onClick={() => onSelect(command.id)}
                role="option"
                aria-selected={index === selectedIndex}
                className={`w-full px-3 py-2 flex items-start gap-3 hover:bg-accent transition-all duration-150 ${
                  index === selectedIndex ? 'bg-accent' : ''
                }`}
              >
                <div className="mt-0.5 text-muted-foreground transition-transform duration-150 hover:scale-110" aria-hidden="true">{command.icon}</div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{command.label}</div>
                  <div className="text-xs text-muted-foreground">{command.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border bg-muted/50" role="status" aria-live="polite">
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
