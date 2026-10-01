import type { 
  TextBlock, 
  HeadingBlock, 
  BulletListBlock, 
  NumberedListBlock, 
  CheckboxBlock, 
  RichText, 
  TextMark 
} from '@/types/notion';
import { createBlock } from './blockAPI';

/**
 * Block Helper Functions
 * Utilities for creating specific block types with proper structure
 */

/**
 * Create a RichText object from plain text
 * @param text - The text content
 * @param marks - Optional formatting marks
 */
export function createRichText(text: string, marks: TextMark[] = []): RichText {
  return {
    text,
    marks,
  };
}

/**
 * Create a text block with rich text content
 * @param pageId - The ID of the page to add the block to
 * @param content - The rich text content
 * @param position - Optional position in the page
 */
export async function createTextBlock(
  pageId: string,
  content: RichText,
  position?: number
): Promise<TextBlock> {
  const block = await createBlock(pageId, {
    type: 'text',
    content,
    position,
  });

  return block as TextBlock;
}

/**
 * Create a heading block with rich text content
 * @param pageId - The ID of the page to add the block to
 * @param level - The heading level (1, 2, or 3)
 * @param content - The rich text content
 * @param position - Optional position in the page
 */
export async function createHeadingBlock(
  pageId: string,
  level: 1 | 2 | 3,
  content: RichText,
  position?: number
): Promise<HeadingBlock> {
  const headingType = `heading${level}` as 'heading1' | 'heading2' | 'heading3';
  
  const block = await createBlock(pageId, {
    type: headingType,
    content,
    position,
  });

  return block as HeadingBlock;
}

/**
 * Helper to create common text marks
 */
export const TextMarks = {
  bold: (): TextMark => ({ type: 'bold' }),
  italic: (): TextMark => ({ type: 'italic' }),
  underline: (): TextMark => ({ type: 'underline' }),
  strikethrough: (): TextMark => ({ type: 'strikethrough' }),
  code: (): TextMark => ({ type: 'code' }),
  link: (href: string): TextMark => ({ type: 'link', attrs: { href } }),
  color: (color: string, backgroundColor?: string): TextMark => ({
    type: 'color',
    attrs: { color, backgroundColor },
  }),
};

/**
 * Create a bullet list block with items
 * @param pageId - The ID of the page to add the block to
 * @param items - Array of rich text items for the list
 * @param position - Optional position in the page
 */
export async function createBulletListBlock(
  pageId: string,
  items: RichText[],
  position?: number
): Promise<BulletListBlock> {
  const block = await createBlock(pageId, {
    type: 'bulletList',
    items,
    position,
  });

  return block as BulletListBlock;
}

/**
 * Create a numbered list block with items
 * @param pageId - The ID of the page to add the block to
 * @param items - Array of rich text items for the list
 * @param position - Optional position in the page
 */
export async function createNumberedListBlock(
  pageId: string,
  items: RichText[],
  position?: number
): Promise<NumberedListBlock> {
  const block = await createBlock(pageId, {
    type: 'numberedList',
    items,
    position,
  });

  return block as NumberedListBlock;
}

/**
 * Create a checkbox block with content
 * @param pageId - The ID of the page to add the block to
 * @param content - The rich text content for the checkbox
 * @param checked - Whether the checkbox is checked (default: false)
 * @param position - Optional position in the page
 */
export async function createCheckboxBlock(
  pageId: string,
  content: RichText,
  checked: boolean = false,
  position?: number
): Promise<CheckboxBlock> {
  const block = await createBlock(pageId, {
    type: 'checkbox',
    content,
    checked,
    position,
  });

  return block as CheckboxBlock;
}
