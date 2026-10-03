import React, { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import type { Block } from '@/types/notion';
import { richTextToHTML, htmlToRichText, inlineMarkdownToHTML } from './serialization';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getFile, uploadFile } from '@/api/fileAPI';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Upload,
  Download,
  Plus,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  Loader2,
  FileCode,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BlockRendererProps {
  pageId: string;
  block: Block;
  editable: boolean;
  onUpdate: (updates: Partial<Block>) => void;
  onSlashCommand?: (position: { x: number; y: number }) => void;
  onInsertAfter?: (type?: Block['type']) => void;
  onDeleteBlock?: () => void;
}

export function BlockRenderer({
  pageId,
  block,
  editable,
  onUpdate,
  onSlashCommand,
  onInsertAfter,
  onDeleteBlock,
}: BlockRendererProps) {
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
    return (
      <ListBlockRenderer
        pageId={pageId}
        block={block}
        editable={editable}
        onUpdate={onUpdate}
        onInsertAfter={onInsertAfter}
        onDeleteBlock={onDeleteBlock}
      />
    );
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

  // Keep TipTap synchronized if content changes externally (e.g. agent actions or page updates)
  React.useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    const targetHTML = richTextToHTML(content);
    if (currentHTML !== targetHTML && !editor.isFocused) {
      editor.commands.setContent(targetHTML, false);
    }
  }, [editor, content.text, JSON.stringify(content.marks)]);

  return (
    <div
      className={getClassName()}
      onClick={() => {
        if (editor && editable) {
          editor.commands.focus();
        }
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

// List item renderer with multi-line wrapping, auto-resizing, and inline markdown formatting
interface ListItemRendererProps {
  text: string;
  index: number;
  isNumbered: boolean;
  editable: boolean;
  totalItems: number;
  onChange: (newText: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onDelete: () => void;
}

function ListItemRenderer({
  text,
  index,
  isNumbered,
  editable,
  totalItems,
  onChange,
  onKeyDown,
  onDelete,
}: ListItemRendererProps) {
  const [isEditing, setIsEditing] = useState(editable && text === '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(24, textareaRef.current.scrollHeight)}px`;
    }
  };

  React.useEffect(() => {
    if (isEditing) {
      adjustHeight();
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <li className="flex items-start gap-2.5 group/item py-1">
      {/* Marker */}
      {isNumbered ? (
        <span className="text-sm font-semibold text-muted-foreground select-none shrink-0 min-w-[1.25rem] mt-0.5 text-right">
          {index + 1}.
        </span>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0 mt-2" />
      )}

      {/* Item Content */}
      <div className="flex-1 min-w-0 flex items-start gap-2">
        {editable && isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            onChange={(e) => {
              onChange(e.target.value);
              adjustHeight();
            }}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            placeholder="List item... (Press Enter on empty line to exit)"
            className="w-full bg-transparent outline-none focus:bg-accent/15 px-1.5 py-0.5 rounded transition-colors resize-none overflow-hidden leading-relaxed text-sm break-words border-0"
          />
        ) : (
          <div
            onClick={() => {
              if (editable) setIsEditing(true);
            }}
            className={cn(
              "w-full px-1.5 py-0.5 rounded transition-colors break-words whitespace-pre-wrap leading-relaxed text-sm text-foreground/90",
              editable ? "cursor-text hover:bg-accent/10" : ""
            )}
            dangerouslySetInnerHTML={{
              __html: inlineMarkdownToHTML(text) || (editable ? '<span class="text-muted-foreground/50 italic text-xs">Empty item (click to edit)...</span>' : ''),
            }}
          />
        )}

        {editable && totalItems > 1 && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all shrink-0 mt-0.5 text-muted-foreground hover:text-destructive"
            aria-label="Delete item"
            title="Delete item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

// List block renderer
interface ListBlockRendererProps extends Omit<BlockRendererProps, 'onSlashCommand'> {}

function ListBlockRenderer({ block, editable, onUpdate, onInsertAfter, onDeleteBlock }: ListBlockRendererProps) {
  if (block.type !== 'bulletList' && block.type !== 'numberedList') return null;

  const isNumbered = block.type === 'numberedList';
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
    if (items.length === 1) {
      if (onDeleteBlock) {
        onDeleteBlock();
      } else {
        onUpdate({ type: 'text', content: { text: '', marks: [] } } as any);
      }
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    onUpdate({ items: newItems } as Partial<Block>);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLElement>) => {
    const currentText = (typeof items[index] === 'string' ? items[index] : items[index]?.text || '').trim();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // If current item is empty, BREAK OUT of list into a new text block
      if (currentText === '') {
        if (items.length > 1) {
          const newItems = items.filter((_, i) => i !== index);
          onUpdate({ items: newItems } as Partial<Block>);
        } else {
          // If this was the only bullet, convert current block to text
          onUpdate({
            type: 'text',
            content: { text: '', marks: [] }
          } as any);
        }
        if (onInsertAfter) {
          onInsertAfter('text');
        }
        return;
      }

      // Add new item after current
      const newItems = [
        ...items.slice(0, index + 1),
        { text: '', marks: [] },
        ...items.slice(index + 1)
      ];
      onUpdate({ items: newItems } as Partial<Block>);
    } else if (e.key === 'Backspace' && currentText === '') {
      e.preventDefault();
      if (items.length > 1) {
        handleDeleteItem(index);
      } else {
        // If it's the only bullet and it's empty, convert to regular text block
        onUpdate({
          type: 'text',
          content: { text: '', marks: [] }
        } as any);
      }
    }
  };

  return (
    <div className="block-content px-3 py-1 group/list">
      <ul className="space-y-0.5 list-none">
        {items.map((item, index) => {
          const text = typeof item === 'string' ? item : item.text;
          return (
            <ListItemRenderer
              key={index}
              text={text}
              index={index}
              isNumbered={isNumbered}
              editable={editable}
              totalItems={items.length}
              onChange={(newText) => handleItemChange(index, newText)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onDelete={() => handleDeleteItem(index)}
            />
          );
        })}
      </ul>

      {editable && (
        <div className="mt-1 flex flex-wrap items-center gap-2 pt-1 border-t border-border/20 opacity-0 group-hover/list:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddItem}
            className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add item
          </Button>
          <span className="text-muted-foreground/30 text-xs">|</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onInsertAfter?.('text')}
            className="text-xs h-6 px-2 text-primary hover:text-primary/80 hover:bg-primary/10"
          >
            <Plus className="w-3 h-3 mr-1" />
            Break out (New Block)
          </Button>
          <span className="text-[10px] text-muted-foreground/50 ml-auto hidden sm:inline">
            Press Enter on empty line to exit list
          </span>
        </div>
      )}
    </div>
  );
}

// Checkbox block renderer
function CheckboxBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'checkbox') return null;
  const [isEditing, setIsEditing] = useState(editable && block.content.text === '');
  const text = block.content?.text || '';

  const handleTextChange = (newText: string) => {
    onUpdate({ 
      content: { text: newText, marks: [] } 
    } as Partial<Block>);
  };

  return (
    <div className="block-content px-3 py-1.5 flex items-start gap-2.5 group/todo">
      <Checkbox
        checked={block.checked}
        onCheckedChange={(checked) => {
          onUpdate({ checked: checked as boolean });
        }}
        disabled={!editable}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        {editable && isEditing ? (
          <input
            type="text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className={`w-full bg-transparent outline-none focus:bg-accent/20 px-1 py-0.5 rounded transition-colors text-sm break-words ${
              block.checked ? 'line-through text-muted-foreground' : ''
            }`}
            placeholder="To-do item..."
          />
        ) : (
          <div
            onClick={() => {
              if (editable) setIsEditing(true);
            }}
            className={cn(
              "px-1 py-0.5 rounded transition-colors break-words leading-relaxed text-sm text-foreground/90",
              block.checked ? "line-through text-muted-foreground" : "",
              editable ? "cursor-text hover:bg-accent/10" : ""
            )}
            dangerouslySetInnerHTML={{
              __html: inlineMarkdownToHTML(text) || (editable ? '<span class="text-muted-foreground/50 italic text-xs">To-do item...</span>' : ''),
            }}
          />
        )}
      </div>
    </div>
  );
}

// Callout block renderer
function CalloutBlockRenderer({ block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'callout') return null;
  const [isEditing, setIsEditing] = useState(editable && block.content.text === '');
  const text = block.content?.text || '';

  return (
    <div
      className="block-content px-4 py-3 rounded-xl flex items-start gap-3 border border-border/50 shadow-2xs my-1"
      style={{ backgroundColor: block.backgroundColor || 'hsl(var(--muted) / 0.45)' }}
    >
      <span className="text-xl shrink-0 mt-0.5 select-none">{block.icon || '💡'}</span>
      <div className="flex-1 min-w-0">
        {editable && isEditing ? (
          <Textarea
            value={text}
            onChange={(e) => onUpdate({ content: { text: e.target.value, marks: [] } } as Partial<Block>)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="w-full bg-background/80 text-sm leading-relaxed min-h-[4rem] resize-none"
            placeholder="Callout text..."
          />
        ) : (
          <div
            onClick={() => {
              if (editable) setIsEditing(true);
            }}
            className={cn(
              "text-sm leading-relaxed text-foreground/90 break-words whitespace-pre-wrap",
              editable ? "cursor-text hover:opacity-90" : ""
            )}
            dangerouslySetInnerHTML={{
              __html: inlineMarkdownToHTML(text) || (editable ? '<span class="text-muted-foreground/50 italic text-xs">Callout text...</span>' : ''),
            }}
          />
        )}
      </div>
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

    // Read locally via data URL immediately so image is saved and visible right away
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      onUpdate({
        url: dataUrl,
        caption: block.caption || file.name,
      } as Partial<Block>);
    };
    reader.readAsDataURL(file);

    try {
      const metadata = await uploadFile(file, pageId);
      if (metadata?.id) {
        onUpdate({
          file_id: metadata.id,
          caption: block.caption || metadata.filename,
        } as Partial<Block>);
      }
    } catch (error) {
      console.warn('Remote file upload fallback to local storage:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="block-content my-2 space-y-3">
      {previewUrl ? (
        <div className="space-y-1">
          <img
            src={previewUrl}
            alt={block.caption || 'Uploaded image'}
            className="max-w-full h-auto rounded-md border shadow-xs max-h-[500px] object-contain"
            style={{ width: block.width || undefined, height: block.height || undefined }}
          />
          {block.caption && (
            <div className="text-xs text-muted-foreground text-center">{block.caption}</div>
          )}
        </div>
      ) : (
        editable && (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground flex flex-col items-center justify-center gap-1.5 text-center">
            <Upload className="w-5 h-5 text-muted-foreground/60" />
            <span>Upload an image from your computer or paste an image URL below.</span>
          </div>
        )
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
              <span className="cursor-pointer">
                <Upload className="mr-2 h-3.5 w-3.5" />
                {isUploading ? 'Uploading...' : 'Upload Image'}
              </span>
            </Button>
          </label>
          <Input
            value={block.url || ''}
            onChange={(e) => onUpdate({ url: e.target.value, file_id: undefined } as Partial<Block>)}
            placeholder="Or paste image URL"
            className="min-w-56 flex-1 h-8 text-xs"
          />
          <Input
            value={block.caption || ''}
            onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)}
            placeholder="Caption"
            className="min-w-40 flex-1 h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

// File block renderer with integrated viewer & preview
function FileBlockRenderer({ pageId, block, editable, onUpdate }: Omit<BlockRendererProps, 'onSlashCommand'>) {
  if (block.type !== 'file') return null;

  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);

  // Convert base64 data URLs to clean Blob URLs for native browser PDF and file viewing
  const toBlobUrl = useCallback((dataOrHttpUrl: string): string => {
    if (!dataOrHttpUrl || !dataOrHttpUrl.startsWith('data:')) {
      return dataOrHttpUrl;
    }
    try {
      const parts = dataOrHttpUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to convert data URL to blob:', e);
      return dataOrHttpUrl;
    }
  }, []);

  React.useEffect(() => {
    let createdUrl: string | null = null;

    const resolveFile = async () => {
      if (block.url) {
        const url = toBlobUrl(block.url);
        if (url.startsWith('blob:')) {
          createdUrl = url;
        }
        setResolvedUrl(url);

        if (block.file_type?.includes('text') || /\.(txt|md|json|js|ts|py|csv)$/i.test(block.filename || '')) {
          try {
            const resp = await fetch(url);
            const text = await resp.text();
            setTextContent(text);
          } catch (e) {
            console.warn('Could not read text content:', e);
          }
        }
        return;
      }

      if (block.file_id) {
        setIsLoadingPreview(true);
        try {
          const blob = await getFile(block.file_id);
          const url = URL.createObjectURL(blob);
          createdUrl = url;
          setResolvedUrl(url);

          if (block.file_type?.includes('text') || /\.(txt|md|json|js|ts|py|csv)$/i.test(block.filename || '')) {
            const text = await blob.text();
            setTextContent(text);
          }
        } catch (err) {
          console.warn('Could not load file blob:', err);
        } finally {
          setIsLoadingPreview(false);
        }
      } else {
        setResolvedUrl('');
        setTextContent(null);
      }
    };

    void resolveFile();

    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [block.url, block.file_id, block.filename, block.file_type, toBlobUrl]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'File';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filename = (block.filename || '').toLowerCase();
  const fileType = (block.file_type || '').toLowerCase();
  const isPdf = fileType.includes('pdf') || filename.endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
  const isText = fileType.includes('text') || /\.(txt|md|json|js|ts|py|html|css|csv)$/i.test(filename);

  const handleUpload = async (file?: File | null) => {
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      onUpdate({
        url: dataUrl,
        filename: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
      } as Partial<Block>);

      try {
        const metadata = await uploadFile(file, pageId);
        if (metadata?.id) {
          onUpdate({
            url: dataUrl,
            file_id: metadata.id,
            filename: metadata.filename,
            file_type: metadata.file_type,
            file_size: metadata.file_size,
          } as Partial<Block>);
        }
      } catch (error) {
        console.warn('Remote file upload fallback to local storage:', error);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async () => {
    const targetUrl = resolvedUrl || block.url;
    if (targetUrl) {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = block.filename || 'download';
      link.click();
      return;
    }
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

  const hasFile = Boolean(block.file_id || block.filename || block.url);

  const getFileIcon = () => {
    if (isPdf) {
      return (
        <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (isImage) {
      return (
        <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    if (isText) {
      return (
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <FileCode className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Download className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="block-content my-3 space-y-3">
      {/* File Card Header */}
      <div className="p-3.5 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/80 shadow-2xs hover:border-border/80 transition-colors">
        {hasFile ? (
          <>
            <div
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none group"
              onClick={() => setShowPreview(!showPreview)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowPreview(!showPreview);
                }
              }}
              title={showPreview ? "Click to collapse preview" : "Click to view file"}
            >
              {getFileIcon()}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {block.filename || 'Attached File'}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="truncate">{block.file_type || (isPdf ? 'application/pdf' : 'Document')}</span>
                  <span>•</span>
                  <span>{formatFileSize(block.file_size)}</span>
                  {isPdf && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-rose-500/30 text-rose-600 dark:text-rose-400">
                      PDF
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                type="button"
                variant={showPreview ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs h-8 px-2.5 gap-1.5 font-medium"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPreview ? 'Hide Preview' : 'View File'}</span>
              </Button>

              {resolvedUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(resolvedUrl, '_blank')}
                  className="text-xs h-8 px-2.5 gap-1.5"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDownload()}
                className="text-xs h-8 px-2.5 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </Button>

              {editable && (
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => void handleUpload(e.target.files?.[0])}
                  />
                  <Button type="button" variant="ghost" size="sm" disabled={isUploading} asChild>
                    <span className="cursor-pointer text-xs h-8 px-2 gap-1 text-muted-foreground hover:text-foreground">
                      <Upload className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">{isUploading ? 'Uploading...' : 'Replace'}</span>
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>Upload a file attachment (PDF, slides, documents, etc.)</span>
            </div>
            {editable && (
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files?.[0])}
                />
                <Button type="button" variant="outline" size="sm" disabled={isUploading} asChild>
                  <span className="cursor-pointer text-xs h-8 px-3 gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading...' : 'Choose File to Upload'}</span>
                  </span>
                </Button>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Embedded File Viewer & Reader Panel */}
      {hasFile && showPreview && (
        <div className="mt-2">
          {isLoadingPreview ? (
            <div className="flex items-center justify-center p-12 bg-muted/20 rounded-2xl border border-border gap-2.5 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Loading document preview...</span>
            </div>
          ) : resolvedUrl ? (
            isPdf ? (
              <div
                className={cn(
                  "w-full rounded-2xl overflow-hidden border border-border shadow-xs bg-muted/10 transition-all",
                  isFullscreen
                    ? "fixed inset-0 z-50 h-screen w-screen rounded-none bg-background/95 p-4 flex flex-col"
                    : "relative"
                )}
              >
                {/* PDF Viewer Header Toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground min-w-0">
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate max-w-xs sm:max-w-md">{block.filename}</span>
                    <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 dark:text-rose-400 shrink-0">
                      PDF Document
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(resolvedUrl, '_blank')}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      title="Open in new browser tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">New Tab</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                    </Button>
                  </div>
                </div>

                {/* Native PDF Reader Iframe / Object */}
                <div className={cn("w-full bg-slate-900/5 dark:bg-slate-900/40 relative", isFullscreen ? "flex-1" : "h-[700px]")}>
                  <object
                    data={resolvedUrl}
                    type="application/pdf"
                    className="w-full h-full border-0"
                  >
                    <iframe
                      src={resolvedUrl}
                      className="w-full h-full border-0"
                      title={block.filename || 'PDF Document'}
                    />
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 h-full">
                      <FileText className="w-12 h-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Unable to render PDF directly in this frame.</p>
                      <Button onClick={() => window.open(resolvedUrl, '_blank')} size="sm">
                        <ExternalLink className="w-4 h-4 mr-1.5" /> Open PDF in New Tab
                      </Button>
                    </div>
                  </object>
                </div>
              </div>
            ) : isImage ? (
              <div className="w-full rounded-2xl overflow-hidden border border-border p-4 bg-muted/10 flex justify-center">
                <img
                  src={resolvedUrl}
                  alt={block.filename || 'Attached image'}
                  className="max-h-[550px] w-auto rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity shadow-sm"
                  onClick={() => window.open(resolvedUrl, '_blank')}
                />
              </div>
            ) : isText && textContent !== null ? (
              <div className="w-full rounded-2xl overflow-hidden border border-border bg-muted/20">
                <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{block.filename}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => navigator.clipboard.writeText(textContent)}
                  >
                    Copy Text
                  </Button>
                </div>
                <pre className="p-4 text-xs font-mono max-h-[450px] overflow-auto whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
                  {textContent}
                </pre>
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Document is attached and ready to view.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(resolvedUrl, '_blank')}
                  className="h-8 text-xs gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Document
                </Button>
              </div>
            )
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
              <p>Preview not generated yet for this file.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleDownload()} className="text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download to View
              </Button>
            </div>
          )}
        </div>
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
