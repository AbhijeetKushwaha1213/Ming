import { supabase } from '@/integrations/supabase/client';
import { getPage, updatePage } from './pageAPI';
import type { Block, CreateBlockInput, UpdateBlockInput } from '@/types/notion';
import { v4 as uuidv4 } from 'uuid';

/**
 * Block API - CRUD operations for blocks within pages
 * Blocks are stored in the page.content JSONB array
 */

/**
 * Create a new block in a page
 */
export async function createBlock(
  pageId: string,
  blockInput: CreateBlockInput
): Promise<Block> {
  // Get the current page
  const page = await getPage(pageId);

  // Generate a unique ID for the block
  const blockId = uuidv4();
  const now = new Date().toISOString();

  // Determine position (default to end of content array)
  const position = blockInput.position ?? page.content.length;

  // Create the base block
  const newBlock: Block = {
    id: blockId,
    type: blockInput.type,
    position,
    created_at: now,
    updated_at: now,
    ...blockInput,
  } as Block;

  // Insert the block at the specified position
  const updatedContent = [...page.content];
  updatedContent.splice(position, 0, newBlock);

  // Update positions for all blocks
  const reindexedContent = updatedContent.map((block, index) => ({
    ...block,
    position: index,
  }));

  // Update the page with the new content
  await updatePage(pageId, { content: reindexedContent });

  return newBlock;
}

/**
 * Update an existing block in a page
 */
export async function updateBlock(
  pageId: string,
  blockId: string,
  blockUpdate: UpdateBlockInput
): Promise<Block> {
  // Get the current page
  const page = await getPage(pageId);

  // Find the block to update
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  // Update the block
  const updatedBlock: Block = {
    ...page.content[blockIndex],
    ...blockUpdate,
    updated_at: new Date().toISOString(),
  };

  // Create updated content array
  const updatedContent = [...page.content];
  updatedContent[blockIndex] = updatedBlock;

  // Update the page with the new content
  await updatePage(pageId, { content: updatedContent });

  return updatedBlock;
}

/**
 * Delete a block from a page
 */
export async function deleteBlock(
  pageId: string,
  blockId: string
): Promise<void> {
  // Get the current page
  const page = await getPage(pageId);

  // Find the block to delete
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  // Remove the block
  const updatedContent = page.content.filter(block => block.id !== blockId);

  // Update positions for remaining blocks
  const reindexedContent = updatedContent.map((block, index) => ({
    ...block,
    position: index,
  }));

  // Update the page with the new content
  await updatePage(pageId, { content: reindexedContent });
}

/**
 * Reorder blocks in a page
 * @param pageId - The ID of the page
 * @param blockIds - Array of block IDs in the desired order
 */
export async function reorderBlocks(
  pageId: string,
  blockIds: string[]
): Promise<void> {
  // Get the current page
  const page = await getPage(pageId);

  // Validate that all block IDs exist
  const existingBlockIds = new Set(page.content.map(block => block.id));
  for (const blockId of blockIds) {
    if (!existingBlockIds.has(blockId)) {
      throw new Error(`Block with ID ${blockId} not found`);
    }
  }

  // Validate that all blocks are included
  if (blockIds.length !== page.content.length) {
    throw new Error('All blocks must be included in the reorder operation');
  }

  // Create a map of blocks by ID for quick lookup
  const blockMap = new Map(page.content.map(block => [block.id, block]));

  // Reorder blocks according to the provided IDs
  const reorderedContent = blockIds.map((blockId, index) => {
    const block = blockMap.get(blockId)!;
    return {
      ...block,
      position: index,
      updated_at: new Date().toISOString(),
    };
  });

  // Update the page with the reordered content
  await updatePage(pageId, { content: reorderedContent });
}

/**
 * Duplicate a block in a page
 * Creates a copy of the block with a new ID immediately after the original
 */
export async function duplicateBlock(
  pageId: string,
  blockId: string
): Promise<Block> {
  // Get the current page
  const page = await getPage(pageId);

  // Find the block to duplicate
  const blockIndex = page.content.findIndex(block => block.id === blockId);
  if (blockIndex === -1) {
    throw new Error('Block not found');
  }

  const originalBlock = page.content[blockIndex];

  // Create a duplicate with a new ID
  const now = new Date().toISOString();
  const duplicatedBlock: Block = {
    ...originalBlock,
    id: uuidv4(),
    position: blockIndex + 1,
    created_at: now,
    updated_at: now,
  };

  // Insert the duplicated block after the original
  const updatedContent = [...page.content];
  updatedContent.splice(blockIndex + 1, 0, duplicatedBlock);

  // Update positions for all blocks
  const reindexedContent = updatedContent.map((block, index) => ({
    ...block,
    position: index,
  }));

  // Update the page with the new content
  await updatePage(pageId, { content: reindexedContent });

  return duplicatedBlock;
}
