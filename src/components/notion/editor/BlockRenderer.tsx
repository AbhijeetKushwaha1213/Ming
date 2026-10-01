import React, { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import type { Block } from '@/types/notion';
import { richTextToHTML, htmlToRichText } from './serialization';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getFile, uploadFile } from '@/api/fileAPI';
import { Trash2, Upload, Download, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockRendererProps {
  pageId: string;
  block: Block;
  editable: boolean;
  onUpdate: (updates: Partial<Block>) => void;
  onSlashCommand?: (position: { x: number; y: number }) => void;
}

export function BlockRenderer({ pageId, block, editable, onUpdate, onSlashCommand }: BlockRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render text-based blocks with TipTap editor
  if (
    block.type === 'text' ||
    block.type === 'heading1' ||
    block.type === 'heading2' ||
    block.type === 'heading3' ||
    block.type === 'quote'
  ) {
    return (
      <TextBlockRenderer
        pageId={pageId}
        block={block}
        editable={editable}
        onUpdate={onUpdate}
        onSlashCommand={onSlashCommand}
      />
    );
  }

  // Render list blocks
  if (block.type === 'bulletList' || block.type === 'numberedList') {
    return <ListBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render checkbox block
  if (block.type === 'checkbox') {
    return <CheckboxBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render callout block
  if (block.type === 'callout') {
    return <CalloutBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render code block
  if (block.type === 'code') {
    return <CodeBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render image block
  if (block.type === 'image') {
    return <ImageBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render file block
  if (block.type === 'file') {
    return <FileBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render embed block
  if (block.type === 'embed') {
    return <EmbedBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  // Render divider
  if (block.type === 'divider') {
    return <div className="my-4 border-t border-border" />;
  }

  // Render table of contents
  if (block.type === 'toc') {
    return (
      <div className="my-4 p-4 bg-muted rounded-md">
        <div className="font-semibold mb-2">Table of Contents</div>
        <div className="text-sm text-muted-foreground">TOC will be generated from headings</div>
      </div>
    );
  }

  // Render table block
  if (block.type === 'table') {
    return <TableBlockRenderer pageId={pageId} block={block} editable={editable} onUpdate={onUpdate} />;
  }

  return null;
}

// Text-based block renderer with TipTap
function TextBlockRenderer({ block, editable, onUpdate, onSlashCommand }: BlockRendererProps) {
  const content = 'content' in block ? block.content : { text: '', marks: [] };
  const initialHTML = richTextToHTML(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // We handle headings separately
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
      }),
      Link,
      Underline,
      TextStyle,
      Color,
    ],
    content: initialHTML,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const richText = htmlToRichText(html);
      onUpdate({ content: richText } as Partial<Block>);
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === '/' && onSlashCommand) {
          const { selection } = view.state;
          const coords = view.coordsAtPos(selection.from);
          onSlashCommand({ x: coords.left, y: coords.bottom });
          return true;
        }
        return false;
      },
      attributes: {
        class: 'outline-none focus:outline-none min-h-[2rem] cursor-text',
      },
    },
  });

  const getClassName = () => {
    const base = 'block-content px-3 py-2 min-h-[2rem] cursor-text';
    switch (block.type) {
      case 'heading1':
        return `${base} text-3xl font-bold`;
      case 'heading2':
        return `${base} text-2xl font-bold`;
      case 'heading3':
        return `${base} text-xl font-bold`;
      case 'quote':
        return `${base} border-l-4 border-primary pl-4 italic`;
      default:
        return base;
    }
  };

  // Auto-focus on mount if it's a new empty block
  React.useEffect(() => {
    if (editor && editable && content.text === '') {
      editor.commands.focus();
    }
  }, [editor, editable, content.text]);

  return (
    <div
      className={getClassName()}
      onClick={() => {
        if (editor && editable) {
          editor.commands.focus();
        }
      }}
    >
      {editable && editor && (
        <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            className={cn(
              'px-1.5 py-0.5 rounded border border-transparent hover:bg-accent',
              editor.isActive('bold') && 'bg-accent border-border text-foreground'
            )}
          >
            B
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            className={cn(
              'px-1.5 py-0.5 rounded border border-transparent hover:bg-accent italic',
              editor.isActive('italic') && 'bg-accent border-border text-foreground'
            )}
          >
            I
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleUnderline().run();
            }}
            className={cn(
              'px-1.5 py-0.5 rounded border border-transparent hover:bg-accent underline',
              editor.isActive('underline') && 'bg-accent border-border text-foreground'
            )}
          >
            U
          </button>

          <span className="ml-2 mr-1 text-[10px] uppercase tracking-wide">
            Color
          </span>
          {['#000000', '#ef4444', '#0ea5e9', '#22c55e', '#eab308'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                editor.chain().focus().setColor(color).run();
              }}
              className={cn(
                'w-4 h-4 rounded-full border border-border hover:scale-110 transition-transform',
                editor.isActive('textStyle', { color }) && 'ring-1 ring-offset-1 ring-primary'
              )}
              style={{ backgroundColor: color }}
              aria-label={`Set text color ${color}`}
            />
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().unsetColor().run();
            }}
            className="ml-1 px-1.5 py-0.5 rounded border border-transparent hover:bg-accent"
          >
            Reset
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

// List block renderer
function ListBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'bulletList' && block.type !== 'numberedList') return null;

  const ListTag = block.type === 'bulletList' ? 'ul' : 'ol';
  const listClass = block.type === 'bulletList' ? 'list-disc' : 'list-decimal';
  const items = block.items || [];

  const handleItemChange = (index: number, newText: string) => {
    const newItems = [...items];
    newItems[index] = { text: newText, marks: [] };
    onUpdate({ items: newItems } as Partial<Block>);
  };

  const handleAddItem = () => {
    const newItems = [...items, { text: '', marks: [] }];
    onUpdate({ items: newItems } as Partial<Block>);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length === 1) return; // Keep at least one item
    const newItems = items.filter((_, i) => i !== index);
    onUpdate({ items: newItems } as Partial<Block>);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Add new item after current
      const newItems = [
        ...items.slice(0, index + 1),
        { text: '', marks: [] },
        ...items.slice(index + 1)
      ];
      onUpdate({ items: newItems } as Partial<Block>);
      // Focus next item after a short delay
      setTimeout(() => {
        const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input');
        nextInput?.focus();
      }, 10);
    } else if (e.key === 'Backspace' && items[index].text === '' && items.length > 1) {
      e.preventDefault();
      handleDeleteItem(index);
      // Focus previous item
      if (index > 0) {
        setTimeout(() => {
          const prevInput = e.currentTarget.parentElement?.previousElementSibling?.querySelector('input');
          prevInput?.focus();
        }, 10);
      }
    }
  };

  return (
    <div className="block-content px-3 py-2">
      <ListTag className={`${listClass} list-inside space-y-1`}>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2 group/item">
            {editable ? (
              <>
                <input
                  type="text"
                  value={typeof item === 'string' ? item : item.text}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="flex-1 bg-transparent outline-none focus:bg-accent/20 px-1 py-0.5 rounded transition-colors"
                  placeholder="List item..."
                />
                {items.length > 1 && (
                  <button
                    onClick={() => handleDeleteItem(index)}
                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                    aria-label="Delete item"
                    title="Delete item"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </>
            ) : (
              <span>{typeof item === 'string' ? item : item.text}</span>
            )}
          </li>
        ))}
      </ListTag>
      {editable && (
        <button
          onClick={handleAddItem}
          className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <span>+ Add item</span>
        </button>
      )}
    </div>
  );
}

// Checkbox block renderer
function CheckboxBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'checkbox') return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ 
      content: { text: e.target.value, marks: [] } 
    } as Partial<Block>);
  };

  return (
    <div className="block-content px-3 py-2 flex items-start gap-2">
      <Checkbox
        checked={block.checked}
        onCheckedChange={(checked) => {
          console.log('Checkbox changed:', checked);
          onUpdate({ checked: checked as boolean });
        }}
        disabled={!editable}
        className="mt-1"
      />
      {editable ? (
        <input
          type="text"
          value={block.content.text}
          onChange={handleTextChange}
          autoFocus={block.content.text === ''}
          className={`flex-1 bg-transparent outline-none focus:bg-accent/20 px-1 py-0.5 rounded transition-colors ${
            block.checked ? 'line-through text-muted-foreground' : ''
          }`}
          placeholder="To-do item..."
        />
      ) : (
        <span className={block.checked ? 'line-through text-muted-foreground' : ''}>
          {block.content.text}
        </span>
      )}
    </div>
  );
}

// Callout block renderer
function CalloutBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'callout') return null;

  return (
    <div
      className="block-content px-3 py-2 rounded-md flex items-start gap-2"
      style={{ backgroundColor: block.backgroundColor || '#f0f0f0' }}
    >
      {editable ? (
        <>
          <Input
            value={block.icon || '💡'}
            onChange={(e) => onUpdate({ icon: e.target.value })}
            className="w-16 bg-white/80"
          />
          <Input
            value={block.content.text}
            onChange={(e) => onUpdate({ content: { text: e.target.value, marks: [] } } as Partial<Block>)}
            className="flex-1 bg-white/80"
            placeholder="Callout text..."
            autoFocus={block.content.text === ''}
          />
        </>
      ) : (
        <>
          <span className="text-xl">{block.icon || '💡'}</span>
          <span>{block.content.text}</span>
        </>
      )}
    </div>
  );
}

// Code block renderer
function CodeBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'code') return null;

  return (
    <div className="block-content my-2">
      {editable && (
        <Input
          value={block.language || 'javascript'}
          onChange={(e) => onUpdate({ language: e.target.value })}
          className="mb-2 w-40"
          placeholder="Language"
        />
      )}
      <pre className="bg-muted p-4 rounded-md overflow-x-auto">
        {editable ? (
          <Textarea
            value={block.content}
            onChange={(e) => onUpdate({ content: e.target.value } as Partial<Block>)}
            className="min-h-32 font-mono bg-transparent border-0 p-0 focus-visible:ring-0"
            placeholder="Write code..."
            autoFocus={block.content === ''}
          />
        ) : (
          <code className={`language-${block.language || 'text'}`}>{block.content}</code>
        )}
      </pre>
    </div>
  );
}

// Image block renderer
function ImageBlockRenderer({ pageId, block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'image') return null;

  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(block.url);

  React.useEffect(() => {
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      if (block.url) {
        setPreviewUrl(block.url);
        return;
      }

      if (block.file_id) {
        try {
          const blob = await getFile(block.file_id);
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        } catch (error) {
          console.error('Failed to load image preview:', error);
        }
      } else {
        setPreviewUrl('');
      }
    };

    void loadPreview();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [block.file_id, block.url]);

  const handleUpload = async (file?: File | null) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const metadata = await uploadFile(file, pageId);
      onUpdate({
        file_id: metadata.id,
        url: '',
        caption: block.caption || metadata.filename,
      } as Partial<Block>);
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="block-content my-2 space-y-3">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={block.caption}
          className="max-w-full h-auto rounded-md border"
          style={{ width: block.width || undefined, height: block.height || undefined }}
        />
      ) : (
        editable && (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Upload an image or paste an image URL.
          </div>
        )
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" disabled={isUploading} asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload image'}
              </span>
            </Button>
          </label>
          <Input
            value={block.url}
            onChange={(e) => onUpdate({ url: e.target.value, file_id: undefined } as Partial<Block>)}
            placeholder="Or paste image URL"
            className="min-w-64 flex-1"
          />
          <Input
            value={block.caption}
            onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)}
            placeholder="Caption"
            className="min-w-48 flex-1"
          />
        </div>
      )}

      {!editable && block.caption && (
        <div className="text-sm text-muted-foreground text-center mt-2">{block.caption}</div>
      )}
    </div>
  );
}

// File block renderer
function FileBlockRenderer({ pageId, block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'file') return null;

  const [isUploading, setIsUploading] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async (file?: File | null) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const metadata = await uploadFile(file, pageId);
      onUpdate({
        file_id: metadata.id,
        filename: metadata.filename,
        file_type: metadata.file_type,
        file_size: metadata.file_size,
      } as Partial<Block>);
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!block.file_id) return;

    try {
      const blob = await getFile(block.file_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = block.filename || 'download';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  return (
    <div className="block-content px-3 py-3 border border-border rounded-md flex flex-col gap-3">
      {block.file_id ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="font-medium">{block.filename}</div>
            <div className="text-sm text-muted-foreground">
              {block.file_type || 'Unknown type'} • {formatFileSize(block.file_size)}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void handleDownload()}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Upload a file attachment.</div>
      )}

      {editable && (
        <label className="inline-flex">
          <input
            type="file"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" disabled={isUploading} asChild>
            <span>
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Choose file'}
            </span>
          </Button>
        </label>
      )}
    </div>
  );
}

// Embed block renderer
function EmbedBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'embed') return null;

  return (
    <div className="block-content my-2 space-y-3">
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Input
            value={block.url}
            onChange={(e) => onUpdate({ url: e.target.value } as Partial<Block>)}
            placeholder="Paste embed URL"
            className="min-w-72 flex-1"
          />
          <Input
            value={block.caption || ''}
            onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)}
            placeholder="Caption"
            className="min-w-48 flex-1"
          />
        </div>
      )}
      {block.url ? (
        <div className="aspect-video rounded-md overflow-hidden bg-muted">
          <iframe
            src={block.url}
            className="w-full h-full"
            allowFullScreen
            title={block.caption || 'Embedded content'}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Paste a YouTube or embed URL.
        </div>
      )}
      {block.caption && (
        <div className="text-sm text-muted-foreground text-center mt-2">{block.caption}</div>
      )}
    </div>
  );
}

// Table block renderer
function TableBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'table') return null;

  const handleColumnNameChange = (columnId: string, name: string) => {
    onUpdate({
      columns: block.columns.map((column) => (column.id === columnId ? { ...column, name } : column)),
    } as Partial<Block>);
  };

  const handleCellChange = (rowId: string, columnId: string, value: string) => {
    onUpdate({
      rows: block.rows.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [columnId]: value } }
          : row
      ),
    } as Partial<Block>);
  };

  const handleAddRow = () => {
    onUpdate({
      rows: [
        ...block.rows,
        {
          id: crypto.randomUUID(),
          cells: Object.fromEntries(block.columns.map((column) => [column.id, ''])),
        },
      ],
    } as Partial<Block>);
  };

  const handleAddColumn = () => {
    const columnId = crypto.randomUUID();
    onUpdate({
      columns: [
        ...block.columns,
        { id: columnId, name: `Column ${block.columns.length + 1}`, type: 'text', width: 240 },
      ],
      rows: block.rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [columnId]: '' },
      })),
    } as Partial<Block>);
  };

  return (
    <div className="block-content my-2 overflow-x-auto space-y-3">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {block.columns.map((column) => (
              <th
                key={column.id}
                className="border border-border p-2 bg-muted font-semibold text-left"
                style={{ width: column.width }}
              >
                {editable ? (
                  <Input
                    value={column.name}
                    onChange={(e) => handleColumnNameChange(column.id, e.target.value)}
                    className="border-0 bg-transparent p-0 font-semibold focus-visible:ring-0"
                  />
                ) : (
                  column.name
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.id}>
              {block.columns.map((column) => (
                <td key={column.id} className="border border-border p-2">
                  {editable ? (
                    <Input
                      value={row.cells[column.id] || ''}
                      onChange={(e) => handleCellChange(row.id, column.id, e.target.value)}
                      className="border-0 bg-transparent p-0 focus-visible:ring-0"
                    />
                  ) : (
                    row.cells[column.id] || ''
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleAddRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add row
          </Button>
          <Button type="button" variant="outline" onClick={handleAddColumn}>
            <Plus className="mr-2 h-4 w-4" />
            Add column
          </Button>
        </div>
      )}
    </div>
  );
}
