import type { Block, RichText, TextMark } from '@/types/notion';

/**
 * Serialization utilities for converting between Block types and editor content
 */

/**
 * Convert RichText to HTML string for TipTap
 */
export function richTextToHTML(richText: RichText): string {
  let html = richText.text;
  
  // Apply marks in order
  richText.marks.forEach(mark => {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'strikethrough':
        html = `<s>${html}</s>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'link':
        html = `<a href="${mark.attrs?.href || ''}">${html}</a>`;
        break;
      case 'color':
        const style = [];
        if (mark.attrs?.color) style.push(`color: ${mark.attrs.color}`);
        if (mark.attrs?.backgroundColor) style.push(`background-color: ${mark.attrs.backgroundColor}`);
        html = `<span style="${style.join('; ')}">${html}</span>`;
        break;
    }
  });
  
  return html;
}

/**
 * Convert HTML string to RichText
 */
export function htmlToRichText(html: string): RichText {
  // Simple parser - in production, use DOMParser
  const text = html.replace(/<[^>]*>/g, '');
  const marks: TextMark[] = [];
  
  if (html.includes('<strong>') || html.includes('<b>')) {
    marks.push({ type: 'bold' });
  }
  if (html.includes('<em>') || html.includes('<i>')) {
    marks.push({ type: 'italic' });
  }
  if (html.includes('<u>')) {
    marks.push({ type: 'underline' });
  }
  if (html.includes('<s>')) {
    marks.push({ type: 'strikethrough' });
  }
  if (html.includes('<code>')) {
    marks.push({ type: 'code' });
  }
  
  // Extract link href
  const linkMatch = html.match(/<a href="([^"]*)">/);
  if (linkMatch) {
    marks.push({ type: 'link', attrs: { href: linkMatch[1] } });
  }
  
  // Extract color styles
  const styleMatch = html.match(/style="([^"]*)"/);
  if (styleMatch) {
    const colorMatch = styleMatch[1].match(/color:\s*([^;]*)/);
    const bgMatch = styleMatch[1].match(/background-color:\s*([^;]*)/);
    if (colorMatch || bgMatch) {
      marks.push({
        type: 'color',
        attrs: {
          color: colorMatch?.[1],
          backgroundColor: bgMatch?.[1],
        },
      });
    }
  }
  
  return { text, marks };
}

/**
 * Convert Block to HTML for rendering
 */
export function blockToHTML(block: Block): string {
  switch (block.type) {
    case 'text':
      return `<p>${richTextToHTML(block.content)}</p>`;
    
    case 'heading1':
      return `<h1>${richTextToHTML(block.content)}</h1>`;
    
    case 'heading2':
      return `<h2>${richTextToHTML(block.content)}</h2>`;
    
    case 'heading3':
      return `<h3>${richTextToHTML(block.content)}</h3>`;
    
    case 'bulletList':
      return `<ul>${block.items.map(item => `<li>${richTextToHTML(item)}</li>`).join('')}</ul>`;
    
    case 'numberedList':
      return `<ol>${block.items.map(item => `<li>${richTextToHTML(item)}</li>`).join('')}</ol>`;
    
    case 'checkbox':
      return `<div><input type="checkbox" ${block.checked ? 'checked' : ''} /> ${richTextToHTML(block.content)}</div>`;
    
    case 'quote':
      return `<blockquote>${richTextToHTML(block.content)}</blockquote>`;
    
    case 'callout':
      return `<div class="callout" style="background-color: ${block.backgroundColor || '#f0f0f0'}">${block.icon || '💡'} ${richTextToHTML(block.content)}</div>`;
    
    case 'code':
      return `<pre><code class="language-${block.language || 'text'}">${block.content}</code></pre>`;
    
    case 'image':
      return `<img src="${block.url}" alt="${block.caption}" width="${block.width}" height="${block.height}" />`;
    
    case 'file':
      return `<div class="file-block"><a href="#" data-file-id="${block.file_id}">${block.filename}</a> (${formatFileSize(block.file_size)})</div>`;
    
    case 'embed':
      return `<div class="embed-block"><iframe src="${block.url}"></iframe></div>`;
    
    case 'divider':
      return '<hr />';
    
    case 'toc':
      return '<div class="toc">Table of Contents</div>';
    
    case 'table':
      return `
        <table>
          <thead>
            <tr>${block.columns.map(col => `<th>${col.name}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${block.rows.map(row => `
              <tr>${block.columns.map(col => `<td>${row.cells[col.id] || ''}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      `;
    
    default:
      return '';
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Parse HTML content back to Block
 * This is a simplified version - in production, use a proper HTML parser
 */
export function htmlToBlock(html: string, type: Block['type'], blockId: string): Partial<Block> {
  const now = new Date().toISOString();
  
  switch (type) {
    case 'text':
    case 'heading1':
    case 'heading2':
    case 'heading3':
      return {
        type,
        content: htmlToRichText(html),
        updated_at: now,
      };
    
    default:
      return { updated_at: now };
  }
}
