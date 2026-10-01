// Core types for Notion-like Resource Manager

// ============================================================================
// Block Types
// ============================================================================

export type BlockType = 
  | 'text'
  | 'heading1' | 'heading2' | 'heading3'
  | 'bulletList' | 'numberedList' | 'checkbox'
  | 'quote' | 'callout' | 'code'
  | 'image' | 'file' | 'embed'
  | 'divider' | 'toc'
  | 'table';

// Rich text formatting
export interface TextMark {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link' | 'color';
  attrs?: {
    href?: string;
    color?: string;
    backgroundColor?: string;
  };
}

export interface RichText {
  text: string;
  marks: TextMark[];
}

// Base block interface
export interface BaseBlock {
  id: string;
  type: BlockType;
  position: number;
  created_at: string;
  updated_at: string;
}

// Specific block implementations
export interface TextBlock extends BaseBlock {
  type: 'text';
  content: RichText;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading1' | 'heading2' | 'heading3';
  content: RichText;
}

export interface BulletListBlock extends BaseBlock {
  type: 'bulletList';
  items: RichText[];
}

export interface NumberedListBlock extends BaseBlock {
  type: 'numberedList';
  items: RichText[];
}

export interface CheckboxBlock extends BaseBlock {
  type: 'checkbox';
  checked: boolean;
  content: RichText;
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  content: RichText;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  content: RichText;
  icon?: string;
  backgroundColor?: string;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  content: string;
  language?: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  caption: string;
  width: number;
  height: number;
  file_id?: string;
}

export interface FileBlock extends BaseBlock {
  type: 'file';
  file_id: string;
  filename: string;
  file_type: string;
  file_size: number;
}

export interface EmbedBlock extends BaseBlock {
  type: 'embed';
  url: string;
  caption?: string;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface TocBlock extends BaseBlock {
  type: 'toc';
}

// Table structures
export interface TableColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiSelect' | 'checkbox';
  width: number;
  options?: string[];
}

export interface TableRow {
  id: string;
  cells: Record<string, any>;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  columns: TableColumn[];
  rows: TableRow[];
}

// Union type for all blocks
export type Block = 
  | TextBlock
  | HeadingBlock
  | BulletListBlock
  | NumberedListBlock
  | CheckboxBlock
  | QuoteBlock
  | CalloutBlock
  | CodeBlock
  | ImageBlock
  | FileBlock
  | EmbedBlock
  | DividerBlock
  | TocBlock
  | TableBlock;

// ============================================================================
// Page Types
// ============================================================================

export interface Page {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_image: string | null;
  content: Block[];
  position: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================================================
// API Input/Output Types
// ============================================================================

export interface CreatePageInput {
  title: string;
  parent_id?: string | null;
  icon?: string | null;
  cover_image?: string | null;
  content?: Block[];
  position?: number;
}

export interface UpdatePageInput {
  title?: string;
  icon?: string | null;
  cover_image?: string | null;
  content?: Block[];
  position?: number;
  is_favorite?: boolean;
}

export interface CreateBlockInput {
  type: BlockType;
  content?: any;
  position?: number;
  [key: string]: any;
}

export interface UpdateBlockInput {
  content?: any;
  position?: number;
  [key: string]: any;
}

// ============================================================================
// File Types
// ============================================================================

export interface FileMetadata {
  id: string;
  page_id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

// ============================================================================
// Share Types
// ============================================================================

export interface PageShare {
  id: string;
  page_id: string;
  shared_by: string;
  shared_with: string | null;
  permission: 'view' | 'edit';
  share_link: string;
  created_at: string;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  page: Page;
  snippet: string;
  rank: number;
}

// ============================================================================
// Template Types
// ============================================================================

export interface Template {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  content: Block[];
  is_system: boolean;
  created_at: string;
}
