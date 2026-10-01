import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createRichText, 
  createTextBlock, 
  createHeadingBlock, 
  createBulletListBlock,
  createNumberedListBlock,
  createCheckboxBlock,
  TextMarks 
} from '../blockHelpers';
import type { 
  TextBlock, 
  HeadingBlock, 
  BulletListBlock, 
  NumberedListBlock, 
  CheckboxBlock 
} from '@/types/notion';
import * as blockAPI from '../blockAPI';

// Mock the blockAPI module
vi.mock('../blockAPI', () => ({
  createBlock: vi.fn(),
}));

describe('Block Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRichText', () => {
    it('creates a RichText object with text and no marks', () => {
      const richText = createRichText('Hello World');
      
      expect(richText).toEqual({
        text: 'Hello World',
        marks: [],
      });
    });

    it('creates a RichText object with text and marks', () => {
      const marks = [TextMarks.bold(), TextMarks.italic()];
      const richText = createRichText('Formatted text', marks);
      
      expect(richText).toEqual({
        text: 'Formatted text',
        marks,
      });
    });
  });

  describe('TextMarks helpers', () => {
    it('creates bold mark', () => {
      expect(TextMarks.bold()).toEqual({ type: 'bold' });
    });

    it('creates italic mark', () => {
      expect(TextMarks.italic()).toEqual({ type: 'italic' });
    });

    it('creates underline mark', () => {
      expect(TextMarks.underline()).toEqual({ type: 'underline' });
    });

    it('creates strikethrough mark', () => {
      expect(TextMarks.strikethrough()).toEqual({ type: 'strikethrough' });
    });

    it('creates code mark', () => {
      expect(TextMarks.code()).toEqual({ type: 'code' });
    });

    it('creates link mark with href', () => {
      expect(TextMarks.link('https://example.com')).toEqual({
        type: 'link',
        attrs: { href: 'https://example.com' },
      });
    });

    it('creates color mark with color only', () => {
      expect(TextMarks.color('#FF0000')).toEqual({
        type: 'color',
        attrs: { color: '#FF0000', backgroundColor: undefined },
      });
    });

    it('creates color mark with color and background', () => {
      expect(TextMarks.color('#FF0000', '#FFFF00')).toEqual({
        type: 'color',
        attrs: { color: '#FF0000', backgroundColor: '#FFFF00' },
      });
    });
  });

  describe('createTextBlock', () => {
    it('creates a text block with rich text content', async () => {
      const mockBlock: TextBlock = {
        id: 'block-123',
        type: 'text',
        content: { text: 'Test content', marks: [] },
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const richText = createRichText('Test content');
      const result = await createTextBlock('page-123', richText);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'text',
        content: richText,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a text block with position', async () => {
      const mockBlock: TextBlock = {
        id: 'block-123',
        type: 'text',
        content: { text: 'Test content', marks: [] },
        position: 5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const richText = createRichText('Test content');
      const result = await createTextBlock('page-123', richText, 5);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'text',
        content: richText,
        position: 5,
      });
      expect(result).toEqual(mockBlock);
    });
  });

  describe('createHeadingBlock', () => {
    it('creates a heading1 block', async () => {
      const mockBlock: HeadingBlock = {
        id: 'block-123',
        type: 'heading1',
        content: { text: 'Heading 1', marks: [] },
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const richText = createRichText('Heading 1');
      const result = await createHeadingBlock('page-123', 1, richText);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'heading1',
        content: richText,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a heading2 block', async () => {
      const mockBlock: HeadingBlock = {
        id: 'block-123',
        type: 'heading2',
        content: { text: 'Heading 2', marks: [] },
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const richText = createRichText('Heading 2');
      const result = await createHeadingBlock('page-123', 2, richText);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'heading2',
        content: richText,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a heading3 block', async () => {
      const mockBlock: HeadingBlock = {
        id: 'block-123',
        type: 'heading3',
        content: { text: 'Heading 3', marks: [] },
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const richText = createRichText('Heading 3');
      const result = await createHeadingBlock('page-123', 3, richText);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'heading3',
        content: richText,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a heading block with position', async () => {
      const mockBlock: HeadingBlock = {
        id: 'block-123',
        type: 'heading1',
        content: { text: 'Heading', marks: [] },
        position: 3,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const richText = createRichText('Heading');
      const result = await createHeadingBlock('page-123', 1, richText, 3);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'heading1',
        content: richText,
        position: 3,
      });
      expect(result).toEqual(mockBlock);
    });
  });

  describe('createBulletListBlock', () => {
    it('creates a bullet list block with items', async () => {
      const items = [
        createRichText('First item'),
        createRichText('Second item'),
        createRichText('Third item'),
      ];

      const mockBlock: BulletListBlock = {
        id: 'block-123',
        type: 'bulletList',
        items,
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createBulletListBlock('page-123', items);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'bulletList',
        items,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a bullet list block with position', async () => {
      const items = [createRichText('Item')];

      const mockBlock: BulletListBlock = {
        id: 'block-123',
        type: 'bulletList',
        items,
        position: 2,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createBulletListBlock('page-123', items, 2);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'bulletList',
        items,
        position: 2,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a bullet list block with empty items array', async () => {
      const items: any[] = [];

      const mockBlock: BulletListBlock = {
        id: 'block-123',
        type: 'bulletList',
        items,
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createBulletListBlock('page-123', items);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'bulletList',
        items,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });
  });

  describe('createNumberedListBlock', () => {
    it('creates a numbered list block with items', async () => {
      const items = [
        createRichText('First step'),
        createRichText('Second step'),
        createRichText('Third step'),
      ];

      const mockBlock: NumberedListBlock = {
        id: 'block-123',
        type: 'numberedList',
        items,
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createNumberedListBlock('page-123', items);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'numberedList',
        items,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a numbered list block with position', async () => {
      const items = [createRichText('Step 1')];

      const mockBlock: NumberedListBlock = {
        id: 'block-123',
        type: 'numberedList',
        items,
        position: 4,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createNumberedListBlock('page-123', items, 4);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'numberedList',
        items,
        position: 4,
      });
      expect(result).toEqual(mockBlock);
    });
  });

  describe('createCheckboxBlock', () => {
    it('creates an unchecked checkbox block by default', async () => {
      const content = createRichText('Task to complete');

      const mockBlock: CheckboxBlock = {
        id: 'block-123',
        type: 'checkbox',
        content,
        checked: false,
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createCheckboxBlock('page-123', content);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'checkbox',
        content,
        checked: false,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a checked checkbox block', async () => {
      const content = createRichText('Completed task');

      const mockBlock: CheckboxBlock = {
        id: 'block-123',
        type: 'checkbox',
        content,
        checked: true,
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createCheckboxBlock('page-123', content, true);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'checkbox',
        content,
        checked: true,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a checkbox block with position', async () => {
      const content = createRichText('Task');

      const mockBlock: CheckboxBlock = {
        id: 'block-123',
        type: 'checkbox',
        content,
        checked: false,
        position: 7,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createCheckboxBlock('page-123', content, false, 7);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'checkbox',
        content,
        checked: false,
        position: 7,
      });
      expect(result).toEqual(mockBlock);
    });

    it('creates a checkbox block with formatted content', async () => {
      const content = createRichText('Important task', [TextMarks.bold()]);

      const mockBlock: CheckboxBlock = {
        id: 'block-123',
        type: 'checkbox',
        content,
        checked: false,
        position: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(blockAPI.createBlock).mockResolvedValue(mockBlock);

      const result = await createCheckboxBlock('page-123', content);

      expect(blockAPI.createBlock).toHaveBeenCalledWith('page-123', {
        type: 'checkbox',
        content,
        checked: false,
        position: undefined,
      });
      expect(result).toEqual(mockBlock);
    });
  });
});
