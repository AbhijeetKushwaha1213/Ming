import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportPageToMarkdown,
  exportPageToHTML,
  exportPageToPDF,
} from '../exportAPI';
import type { Page, Block } from '@/types/notion';

// Mock the pageAPI
vi.mock('../pageAPI', () => ({
  getPage: vi.fn(),
  getPageChildren: vi.fn(),
}));

describe('Export API', () => {
  const mockPage: Page = {
    id: 'page-123',
    user_id: 'user-123',
    parent_id: null,
    title: 'Test Page',
    icon: '📝',
    cover_image: null,
    content: [
      {
        id: '1',
        type: 'heading1',
        content: { text: 'Introduction', marks: [] },
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'text',
        content: { text: 'This is a test page.', marks: [] },
        position: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '3',
        type: 'bulletList',
        items: [
          { text: 'Item 1', marks: [] },
          { text: 'Item 2', marks: [] },
        ],
        position: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as Block[],
    position: 0,
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportPageToMarkdown', () => {
    it('exports a page to Markdown format', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      vi.mocked(getPage).mockResolvedValue(mockPage);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToMarkdown('page-123', false);

      expect(result).toContain('# Test Page');
      expect(result).toContain('📝');
      expect(result).toContain('# Introduction');
      expect(result).toContain('This is a test page.');
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('exports page with rich text formatting', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      
      const pageWithFormatting: Page = {
        ...mockPage,
        content: [
          {
            id: '1',
            type: 'text',
            content: {
              text: 'Bold text',
              marks: [{ type: 'bold' }],
            },
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: '2',
            type: 'text',
            content: {
              text: 'Link text',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
            position: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ] as Block[],
      };

      vi.mocked(getPage).mockResolvedValue(pageWithFormatting);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToMarkdown('page-123', false);

      expect(result).toContain('**Bold text**');
      expect(result).toContain('[Link text](https://example.com)');
    });

    it('includes nested pages when requested', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      
      const childPage: Page = {
        ...mockPage,
        id: 'child-123',
        title: 'Child Page',
        parent_id: 'page-123',
      };

      vi.mocked(getPage)
        .mockResolvedValueOnce(mockPage)
        .mockResolvedValueOnce(childPage);
      vi.mocked(getPageChildren)
        .mockResolvedValueOnce([childPage])
        .mockResolvedValueOnce([]);

      const result = await exportPageToMarkdown('page-123', true);

      expect(result).toContain('# Test Page');
      expect(result).toContain('## Nested Pages');
      expect(result).toContain('# Child Page');
    });

    it('exports code blocks correctly', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      
      const pageWithCode: Page = {
        ...mockPage,
        content: [
          {
            id: '1',
            type: 'code',
            content: 'console.log("Hello");',
            language: 'javascript',
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ] as Block[],
      };

      vi.mocked(getPage).mockResolvedValue(pageWithCode);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToMarkdown('page-123', false);

      expect(result).toContain('```javascript');
      expect(result).toContain('console.log("Hello");');
      expect(result).toContain('```');
    });
  });

  describe('exportPageToHTML', () => {
    it('exports a page to HTML format', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      vi.mocked(getPage).mockResolvedValue(mockPage);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToHTML('page-123', false);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<title>Test Page</title>');
      expect(result).toContain('<h1>Test Page</h1>');
      expect(result).toContain('<h1>Introduction</h1>');
      expect(result).toContain('<p>This is a test page.</p>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('</ul>');
    });

    it('includes CSS styling', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      vi.mocked(getPage).mockResolvedValue(mockPage);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToHTML('page-123', false);

      expect(result).toContain('<style>');
      expect(result).toContain('font-family');
      expect(result).toContain('</style>');
    });

    it('exports rich text with HTML tags', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      
      const pageWithFormatting: Page = {
        ...mockPage,
        content: [
          {
            id: '1',
            type: 'text',
            content: {
              text: 'Bold text',
              marks: [{ type: 'bold' }],
            },
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ] as Block[],
      };

      vi.mocked(getPage).mockResolvedValue(pageWithFormatting);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToHTML('page-123', false);

      expect(result).toContain('<strong>Bold text</strong>');
    });

    it('includes nested pages when requested', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      
      const childPage: Page = {
        ...mockPage,
        id: 'child-123',
        title: 'Child Page',
        parent_id: 'page-123',
      };

      vi.mocked(getPage)
        .mockResolvedValueOnce(mockPage)
        .mockResolvedValueOnce(childPage);
      vi.mocked(getPageChildren)
        .mockResolvedValueOnce([childPage])
        .mockResolvedValueOnce([]);

      const result = await exportPageToHTML('page-123', true);

      expect(result).toContain('<h1>Test Page</h1>');
      expect(result).toContain('<h2>Nested Pages</h2>');
      expect(result).toContain('<h1>Child Page</h1>');
    });
  });

  describe('exportPageToPDF', () => {
    it('exports a page to PDF format', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      vi.mocked(getPage).mockResolvedValue(mockPage);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToPDF('page-123', false);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/pdf');
    });

    it('returns a Blob with PDF content', async () => {
      const { getPage, getPageChildren } = await import('../pageAPI');
      vi.mocked(getPage).mockResolvedValue(mockPage);
      vi.mocked(getPageChildren).mockResolvedValue([]);

      const result = await exportPageToPDF('page-123', false);

      expect(result.size).toBeGreaterThan(0);
    });
  });
});
