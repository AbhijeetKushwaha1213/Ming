import type { Block, RichText, TextMark, CreatePageInput } from '@/types/notion';
import { createPage } from './pageAPI';
import { v4 as uuidv4 } from 'uuid';

/**
 * Import API - Functions for importing content from various formats
 */

/**
 * Parse Markdown text to RichText with marks
 */
function parseMarkdownToRichText(text: string): RichText {
  const marks: TextMark[] = [];
  let plainText = text;
  
  // Parse link: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(text)) !== null) {
    marks.push({
      type: 'link',
      attrs: { href: linkMatch[2] }
    });
    plainText = plainText.replace(linkMatch[0], linkMatch[1]);
  }
  
  // Parse bold: **text** or __text__
  if (/\*\*([^*]+)\*\*/.test(plainText) || /__([^_]+)__/.test(plainText)) {
    marks.push({ type: 'bold' });
    plainText = plainText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  }
  
  // Parse italic: *text* or _text_
  if (/\*([^*]+)\*/.test(plainText) || /_([^_]+)_/.test(plainText)) {
    marks.push({ type: 'italic' });
    plainText = plainText.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
  }
  
  // Parse strikethrough: ~~text~~
  if (/~~([^~]+)~~/.test(plainText)) {
    marks.push({ type: 'strikethrough' });
    plainText = plainText.replace(/~~([^~]+)~~/g, '$1');
  }
  
  // Parse inline code: `text`
  if (/`([^`]+)`/.test(plainText)) {
    marks.push({ type: 'code' });
    plainText = plainText.replace(/`([^`]+)`/g, '$1');
  }
  
  return {
    text: plainText,
    marks
  };
}

/**
 * Parse a Markdown string and convert to blocks
 */
export function parseMarkdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split('\n');
  let position = 0;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (trimmedLine === '') {
      i++;
      continue;
    }
    
    // Heading 1: # text
    if (trimmedLine.startsWith('# ')) {
      const content = trimmedLine.substring(2);
      blocks.push({
        id: uuidv4(),
        type: 'heading1',
        content: parseMarkdownToRichText(content),
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++;
      continue;
    }
    
    // Heading 2: ## text
    if (trimmedLine.startsWith('## ')) {
      const content = trimmedLine.substring(3);
      blocks.push({
        id: uuidv4(),
        type: 'heading2',
        content: parseMarkdownToRichText(content),
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++;
      continue;
    }
    
    // Heading 3: ### text
    if (trimmedLine.startsWith('### ')) {
      const content = trimmedLine.substring(4);
      blocks.push({
        id: uuidv4(),
        type: 'heading3',
        content: parseMarkdownToRichText(content),
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++;
      continue;
    }
    
    // Divider: --- or ***
    if (trimmedLine === '---' || trimmedLine === '***') {
      blocks.push({
        id: uuidv4(),
        type: 'divider',
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++;
      continue;
    }
    
    // Code block: ```language
    if (trimmedLine.startsWith('```')) {
      const language = trimmedLine.substring(3).trim();
      const codeLines: string[] = [];
      i++;
      
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      
      blocks.push({
        id: uuidv4(),
        type: 'code',
        content: codeLines.join('\n'),
        language: language || undefined,
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++; // Skip closing ```
      continue;
    }
    
    // Quote: > text
    if (trimmedLine.startsWith('> ')) {
      const content = trimmedLine.substring(2);
      blocks.push({
        id: uuidv4(),
        type: 'quote',
        content: parseMarkdownToRichText(content),
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++;
      continue;
    }
    
    // Checkbox: - [ ] text or - [x] text
    if (/^- \[([ x])\] /.test(trimmedLine)) {
      const checked = trimmedLine[3] === 'x';
      const content = trimmedLine.substring(6);
      blocks.push({
        id: uuidv4(),
        type: 'checkbox',
        checked,
        content: parseMarkdownToRichText(content),
        position: position++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      i++;
      continue;
    }
    
    // Bullet list: - text or * text
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const items: RichText[] = [];
      
      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (listLine.startsWith('- ') || listLine.startsWith('* ')) {
          const content = listLine.substring(2);
          items.push(parseMarkdownToRichText(content));
          i++;
        } else if (listLine === '') {
          break;
        } else {
          break;
        }
      }
      
      if (items.length > 0) {
        blocks.push({
          id: uuidv4(),
          type: 'bulletList',
          items,
          position: position++,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      continue;
    }
    
    // Numbered list: 1. text
    if (/^\d+\. /.test(trimmedLine)) {
      const items: RichText[] = [];
      
      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (/^\d+\. /.test(listLine)) {
          const content = listLine.replace(/^\d+\. /, '');
          items.push(parseMarkdownToRichText(content));
          i++;
        } else if (listLine === '') {
          break;
        } else {
          break;
        }
      }
      
      if (items.length > 0) {
        blocks.push({
          id: uuidv4(),
          type: 'numberedList',
          items,
          position: position++,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      continue;
    }
    
    // Image: ![alt](url)
    if (/^!\[([^\]]*)\]\(([^)]+)\)/.test(trimmedLine)) {
      const match = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (match) {
        blocks.push({
          id: uuidv4(),
          type: 'image',
          url: match[2],
          caption: match[1] || '',
          width: 800,
          height: 600,
          position: position++,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      i++;
      continue;
    }
    
    // Table: | header | header |
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      // Check if next line is separator
      if (i + 1 < lines.length && /^\|[\s-:|]+\|$/.test(lines[i + 1].trim())) {
        // Parse table
        const headerLine = trimmedLine;
        const separatorLine = lines[i + 1].trim();
        
        // Extract column names
        const columnNames = headerLine
          .split('|')
          .map(col => col.trim())
          .filter(col => col !== '');
        
        const columns = columnNames.map(name => ({
          id: uuidv4(),
          name,
          type: 'text' as const,
          width: 150
        }));
        
        // Parse rows
        const rows: any[] = [];
        i += 2; // Skip header and separator
        
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (rowLine.startsWith('|') && rowLine.endsWith('|')) {
            const cellValues = rowLine
              .split('|')
              .map(cell => cell.trim())
              .filter(cell => cell !== '');
            
            const cells: Record<string, any> = {};
            columns.forEach((col, index) => {
              cells[col.id] = cellValues[index] || '';
            });
            
            rows.push({
              id: uuidv4(),
              cells
            });
            i++;
          } else {
            break;
          }
        }
        
        blocks.push({
          id: uuidv4(),
          type: 'table',
          columns,
          rows,
          position: position++,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        continue;
      }
    }
    
    // Default: text block
    blocks.push({
      id: uuidv4(),
      type: 'text',
      content: parseMarkdownToRichText(trimmedLine),
      position: position++,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    i++;
  }
  
  return blocks;
}

/**
 * Import a Markdown file and create a page
 * @param markdown - The Markdown content to import
 * @param title - Optional title for the page (defaults to first heading or "Imported Page")
 * @param parentId - Optional parent page ID
 * @returns The created page
 */
export async function importMarkdownAsPage(
  markdown: string,
  title?: string,
  parentId?: string | null
): Promise<any> {
  // Parse markdown to blocks
  const blocks = parseMarkdownToBlocks(markdown);
  
  // Extract title from first heading if not provided
  let pageTitle = title;
  if (!pageTitle && blocks.length > 0) {
    const firstBlock = blocks[0];
    if (firstBlock.type === 'heading1' || firstBlock.type === 'heading2' || firstBlock.type === 'heading3') {
      pageTitle = firstBlock.content.text;
      // Remove the first block since it's used as title
      blocks.shift();
      // Adjust positions
      blocks.forEach((block, index) => {
        block.position = index;
      });
    }
  }
  
  // Default title if still not set
  if (!pageTitle) {
    pageTitle = 'Imported Page';
  }
  
  // Create page with imported content
  const pageData: CreatePageInput = {
    title: pageTitle,
    parent_id: parentId,
    content: blocks
  };
  
  const page = await createPage(pageData);
  return page;
}
