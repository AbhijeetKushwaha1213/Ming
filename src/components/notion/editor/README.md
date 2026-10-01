# BlockEditor Component

A Notion-like block-based editor for creating rich content pages.

## Features

- **Block-based editing**: Text, headings, lists, tables, images, files, and more
- **Rich text formatting**: Bold, italic, underline, strikethrough, code, links, colors
- **Slash commands**: Type `/` to insert any block type
- **Drag and drop**: Reorder blocks by dragging
- **Block actions**: Hover menu with delete, duplicate, and drag handle
- **Keyboard navigation**: Full keyboard support for accessibility

## Usage

```tsx
import { BlockEditor } from '@/components/notion/editor';
import { useState } from 'react';
import type { Block } from '@/types/notion';

function MyPage() {
  const [blocks, setBlocks] = useState<Block[]>([
    {
      id: '1',
      type: 'text',
      content: { text: 'Hello world!', marks: [] },
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  return (
    <BlockEditor
      pageId="my-page-id"
      blocks={blocks}
      onBlocksChange={setBlocks}
      editable={true}
    />
  );
}
```

## Props

### BlockEditor

- `pageId` (string): The ID of the page being edited
- `blocks` (Block[]): Array of blocks to render
- `onBlocksChange` (blocks: Block[]) => void: Callback when blocks are updated
- `editable` (boolean, optional): Whether the editor is editable (default: true)

## Block Types

The editor supports the following block types:

- `text` - Plain text paragraph
- `heading1`, `heading2`, `heading3` - Headings
- `bulletList`, `numberedList` - Lists
- `checkbox` - To-do items
- `quote` - Blockquotes
- `callout` - Callout boxes with icons
- `code` - Code blocks
- `image` - Images
- `file` - File attachments
- `embed` - Embedded content (YouTube, etc.)
- `divider` - Horizontal dividers
- `table` - Tables with columns and rows
- `toc` - Table of contents

## Keyboard Shortcuts

- `/` - Open slash command menu
- `↑` `↓` - Navigate slash command menu
- `Enter` - Select command from menu
- `Esc` - Close slash command menu
- `Cmd/Ctrl + B` - Bold
- `Cmd/Ctrl + I` - Italic
- `Cmd/Ctrl + U` - Underline

## Customization

The editor uses Tailwind CSS classes and can be customized via the `editor.css` file.

## Architecture

- **BlockEditor**: Main container component with drag-and-drop context
- **BlockRenderer**: Renders individual blocks based on their type
- **SlashCommandMenu**: Popup menu for inserting blocks
- **BlockHoverMenu**: Hover menu with block actions
- **serialization.ts**: Utilities for converting between blocks and HTML

## Integration with API

The BlockEditor works with the block API functions:

```tsx
import { createBlock, updateBlock, deleteBlock, reorderBlocks } from '@/api/blockAPI';

// The editor handles local state, but you can sync with the API:
const handleBlocksChange = async (newBlocks: Block[]) => {
  setBlocks(newBlocks);
  // Optionally sync with backend
  await updatePage(pageId, { content: newBlocks });
};
```
