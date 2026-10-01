import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseMarkdownToBlocks, importMarkdownAsPage } from '../importAPI';
import type { Block } from '@/types/notion';

// Mock the pageAPI
vi.mock('../pageAPI', () => ({
  createPage: vi.fn(),
}));

describe('Import API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMarkdownToBlocks', () => {
    it('parses headings correctly', () => {
      const markdown = `# Heading 1
## Heading 2
### Heading 3`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('heading1');
      expect(blocks[0].content.text).toBe('Heading 1');
      expect(blocks[1].type).toBe('heading2');
      expect(blocks[1].content.text).toBe('Heading 2');
      expect(blocks[2].type).toBe('heading3');
      expect(blocks[2].content.text).toBe('Heading 3');
    });

    it('parses text blocks', () => {
      const markdown = 'This is a simple text block.';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('text');
      expect(blocks[0].content.text).toBe('This is a simple text block.');
    });

    it('parses bold text', () => {
      const markdown = '**Bold text**';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('text');
      expect(blocks[0].content.text).toBe('Bold text');
      expect(blocks[0].content.marks).toContainEqual({ type: 'bold' });
    });

    it('parses italic text', () => {
      const markdown = '*Italic text*';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content.text).toBe('Italic text');
      expect(blocks[0].content.marks).toContainEqual({ type: 'italic' });
    });

    it('parses strikethrough text', () => {
      const markdown = '~~Strikethrough text~~';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content.text).toBe('Strikethrough text');
      expect(blocks[0].content.marks).toContainEqual({ type: 'strikethrough' });
    });

    it('parses inline code', () => {
      const markdown = '`inline code`';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content.text).toBe('inline code');
      expect(blocks[0].content.marks).toContainEqual({ type: 'code' });
    });

    it('parses links', () => {
      const markdown = '[Link text](https://example.com)';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content.text).toBe('Link text');
      expect(blocks[0].content.marks).toContainEqual({
        type: 'link',
        attrs: { href: 'https://example.com' },
      });
    });

    it('parses bullet lists', () => {
      const markdown = `- Item 1
- Item 2
- Item 3`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('bulletList');
      expect(blocks[0].items).toHaveLength(3);
      expect(blocks[0].items[0].text).toBe('Item 1');
      expect(blocks[0].items[1].text).toBe('Item 2');
      expect(blocks[0].items[2].text).toBe('Item 3');
    });

    it('parses numbered lists', () => {
      const markdown = `1. First item
2. Second item
3. Third item`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('numberedList');
      expect(blocks[0].items).toHaveLength(3);
      expect(blocks[0].items[0].text).toBe('First item');
      expect(blocks[0].items[1].text).toBe('Second item');
      expect(blocks[0].items[2].text).toBe('Third item');
    });

    it('parses checkboxes', () => {
      const markdown = `- [ ] Unchecked item
- [x] Checked item`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('checkbox');
      expect(blocks[0].checked).toBe(false);
      expect(blocks[0].content.text).toBe('Unchecked item');
      expect(blocks[1].type).toBe('checkbox');
      expect(blocks[1].checked).toBe(true);
      expect(blocks[1].content.text).toBe('Checked item');
    });

    it('parses quotes', () => {
      const markdown = '> This is a quote';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('quote');
      expect(blocks[0].content.text).toBe('This is a quote');
    });

    it('parses code blocks', () => {
      const markdown = `\`\`\`javascript
console.log("Hello");
\`\`\``;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].content).toBe('console.log("Hello");');
      expect(blocks[0].language).toBe('javascript');
    });

    it('parses dividers', () => {
      const markdown = '---';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('divider');
    });

    it('parses images', () => {
      const markdown = '![Alt text](https://example.com/image.jpg)';

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('image');
      expect(blocks[0].url).toBe('https://example.com/image.jpg');
      expect(blocks[0].caption).toBe('Alt text');
    });

    it('parses tables', () => {
      const markdown = `| Name | Age |
| --- | --- |
| John | 30 |
| Jane | 25 |`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('table');
      expect(blocks[0].columns).toHaveLength(2);
      expect(blocks[0].columns[0].name).toBe('Name');
      expect(blocks[0].columns[1].name).toBe('Age');
      expect(blocks[0].rows).toHaveLength(2);
    });

    it('handles mixed content', () => {
      const markdown = `# Title

This is a paragraph.

- List item 1
- List item 2

**Bold text**`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].type).toBe('heading1');
      expect(blocks[1].type).toBe('text');
      expect(blocks[2].type).toBe('bulletList');
      expect(blocks[3].type).toBe('text');
    });

    it('skips empty lines', () => {
      const markdown = `# Heading


Text with empty lines above`;

      const blocks = parseMarkdownToBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('heading1');
      expect(blocks[1].type).toBe('text');
    });
  });

  describe('importMarkdownAsPage', () => {
    it('creates a page from Markdown content', async () => {
      const { createPage } = await import('../pageAPI');
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const markdown = `# Test Page

This is test content.`;

      const result = await importMarkdownAsPage(markdown);

      expect(createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Page',
          content: expect.any(Array),
        })
      );
      expect(result).toEqual(mockPage);
    });

    it('uses first heading as title if not provided', async () => {
      const { createPage } = await import('../pageAPI');
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'My Heading',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const markdown = `# My Heading

Content here.`;

      await importMarkdownAsPage(markdown);

      expect(createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Heading',
        })
      );
    });

    it('uses provided title over first heading', async () => {
      const { createPage } = await import('../pageAPI');
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'Custom Title',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const markdown = `# Heading in Content

Content here.`;

      await importMarkdownAsPage(markdown, 'Custom Title');

      expect(createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
        })
      );
    });

    it('uses default title if no heading and no title provided', async () => {
      const { createPage } = await import('../pageAPI');
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'Imported Page',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const markdown = 'Just some text without a heading.';

      await importMarkdownAsPage(markdown);

      expect(createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Imported Page',
        })
      );
    });

    it('sets parent_id when provided', async () => {
      const { createPage } = await import('../pageAPI');
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: 'parent-123',
        title: 'Test Page',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const markdown = 'Test content';

      await importMarkdownAsPage(markdown, 'Test Page', 'parent-123');

      expect(createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_id: 'parent-123',
        })
      );
    });

    it('removes first heading from content when used as title', async () => {
      const { createPage } = await import('../pageAPI');
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'My Title',
        icon: null,
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const markdown = `# My Title

This is content.`;

      await importMarkdownAsPage(markdown);

      const callArgs = vi.mocked(createPage).mock.calls[0][0];
      expect(callArgs.content).toHaveLength(1);
      expect(callArgs.content[0].type).toBe('text');
    });
  });
});
