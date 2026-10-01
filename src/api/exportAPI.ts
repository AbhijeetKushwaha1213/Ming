import type { Page, Block, RichText, TextMark } from '@/types/notion';
import { getPage, getPageChildren } from './pageAPI';

/**
 * Export API - Functions for exporting pages to various formats
 */

/**
 * Convert rich text to Markdown format
 */
function richTextToMarkdown(richText: RichText): string {
  let text = richText.text;
  
  // Apply marks in order: bold, italic, underline (as bold+italic), strikethrough, code, link
  const marks = richText.marks || [];
  
  // Check for each mark type
  const hasBold = marks.some(m => m.type === 'bold');
  const hasItalic = marks.some(m => m.type === 'italic');
  const hasStrikethrough = marks.some(m => m.type === 'strikethrough');
  const hasCode = marks.some(m => m.type === 'code');
  const linkMark = marks.find(m => m.type === 'link');
  
  // Apply formatting (innermost to outermost)
  if (hasCode) {
    text = `\`${text}\``;
  }
  if (hasStrikethrough) {
    text = `~~${text}~~`;
  }
  if (hasItalic) {
    text = `*${text}*`;
  }
  if (hasBold) {
    text = `**${text}**`;
  }
  if (linkMark?.attrs?.href) {
    text = `[${text}](${linkMark.attrs.href})`;
  }
  
  return text;
}

/**
 * Convert a single block to Markdown
 */
function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case 'text':
      return richTextToMarkdown(block.content) + '\n\n';
    
    case 'heading1':
      return `# ${richTextToMarkdown(block.content)}\n\n`;
    
    case 'heading2':
      return `## ${richTextToMarkdown(block.content)}\n\n`;
    
    case 'heading3':
      return `### ${richTextToMarkdown(block.content)}\n\n`;
    
    case 'bulletList':
      return block.items.map(item => `- ${richTextToMarkdown(item)}`).join('\n') + '\n\n';
    
    case 'numberedList':
      return block.items.map((item, index) => `${index + 1}. ${richTextToMarkdown(item)}`).join('\n') + '\n\n';
    
    case 'checkbox':
      const checked = block.checked ? 'x' : ' ';
      return `- [${checked}] ${richTextToMarkdown(block.content)}\n\n`;
    
    case 'quote':
      return `> ${richTextToMarkdown(block.content)}\n\n`;
    
    case 'callout':
      const icon = block.icon ? `${block.icon} ` : '';
      return `> ${icon}${richTextToMarkdown(block.content)}\n\n`;
    
    case 'code':
      const language = block.language || '';
      return `\`\`\`${language}\n${block.content}\n\`\`\`\n\n`;
    
    case 'image':
      const caption = block.caption ? ` "${block.caption}"` : '';
      return `![${block.caption || 'Image'}](${block.url}${caption})\n\n`;
    
    case 'file':
      return `[📎 ${block.filename}](file://${block.file_id})\n\n`;
    
    case 'embed':
      return `[🔗 Embed](${block.url})\n\n`;
    
    case 'divider':
      return `---\n\n`;
    
    case 'toc':
      return `**Table of Contents**\n\n`;
    
    case 'table':
      return tableToMarkdown(block) + '\n\n';
    
    default:
      return '';
  }
}

/**
 * Convert a table block to Markdown table format
 */
function tableToMarkdown(table: Block & { type: 'table' }): string {
  if (table.columns.length === 0 || table.rows.length === 0) {
    return '';
  }
  
  // Header row
  const headers = table.columns.map(col => col.name).join(' | ');
  const separator = table.columns.map(() => '---').join(' | ');
  
  // Data rows
  const rows = table.rows.map(row => {
    return table.columns.map(col => {
      const cellValue = row.cells[col.id];
      if (cellValue === null || cellValue === undefined) {
        return '';
      }
      return String(cellValue);
    }).join(' | ');
  });
  
  return `| ${headers} |\n| ${separator} |\n${rows.map(r => `| ${r} |`).join('\n')}`;
}

/**
 * Export a page to Markdown format
 * @param pageId - The ID of the page to export
 * @param includeChildren - Whether to include nested child pages
 * @returns Markdown string
 */
export async function exportPageToMarkdown(
  pageId: string,
  includeChildren: boolean = false
): Promise<string> {
  const page = await getPage(pageId);
  
  let markdown = '';
  
  // Add page title
  markdown += `# ${page.title}\n\n`;
  
  // Add page icon if present
  if (page.icon) {
    markdown += `${page.icon}\n\n`;
  }
  
  // Convert all blocks to Markdown
  for (const block of page.content) {
    markdown += blockToMarkdown(block);
  }
  
  // Include nested pages if requested
  if (includeChildren) {
    const children = await getPageChildren(page.id);
    
    if (children.length > 0) {
      markdown += `\n---\n\n## Nested Pages\n\n`;
      
      for (const child of children) {
        const childMarkdown = await exportPageToMarkdown(child.id, true);
        markdown += `\n${childMarkdown}\n`;
      }
    }
  }
  
  return markdown;
}

/**
 * Convert rich text to HTML format
 */
function richTextToHTML(richText: RichText): string {
  let text = escapeHTML(richText.text);
  
  const marks = richText.marks || [];
  
  // Apply marks
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        text = `<strong>${text}</strong>`;
        break;
      case 'italic':
        text = `<em>${text}</em>`;
        break;
      case 'underline':
        text = `<u>${text}</u>`;
        break;
      case 'strikethrough':
        text = `<s>${text}</s>`;
        break;
      case 'code':
        text = `<code>${text}</code>`;
        break;
      case 'link':
        if (mark.attrs?.href) {
          text = `<a href="${escapeHTML(mark.attrs.href)}">${text}</a>`;
        }
        break;
      case 'color':
        if (mark.attrs?.color) {
          text = `<span style="color: ${escapeHTML(mark.attrs.color)}">${text}</span>`;
        }
        if (mark.attrs?.backgroundColor) {
          text = `<span style="background-color: ${escapeHTML(mark.attrs.backgroundColor)}">${text}</span>`;
        }
        break;
    }
  }
  
  return text;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert a single block to HTML
 */
function blockToHTML(block: Block): string {
  switch (block.type) {
    case 'text':
      return `<p>${richTextToHTML(block.content)}</p>\n`;
    
    case 'heading1':
      return `<h1>${richTextToHTML(block.content)}</h1>\n`;
    
    case 'heading2':
      return `<h2>${richTextToHTML(block.content)}</h2>\n`;
    
    case 'heading3':
      return `<h3>${richTextToHTML(block.content)}</h3>\n`;
    
    case 'bulletList':
      const bulletItems = block.items.map(item => `  <li>${richTextToHTML(item)}</li>`).join('\n');
      return `<ul>\n${bulletItems}\n</ul>\n`;
    
    case 'numberedList':
      const numberedItems = block.items.map(item => `  <li>${richTextToHTML(item)}</li>`).join('\n');
      return `<ol>\n${numberedItems}\n</ol>\n`;
    
    case 'checkbox':
      const checkedAttr = block.checked ? ' checked' : '';
      return `<div class="checkbox"><input type="checkbox"${checkedAttr} disabled> ${richTextToHTML(block.content)}</div>\n`;
    
    case 'quote':
      return `<blockquote>${richTextToHTML(block.content)}</blockquote>\n`;
    
    case 'callout':
      const calloutIcon = block.icon ? `<span class="callout-icon">${block.icon}</span>` : '';
      const bgColor = block.backgroundColor ? ` style="background-color: ${escapeHTML(block.backgroundColor)}"` : '';
      return `<div class="callout"${bgColor}>${calloutIcon}${richTextToHTML(block.content)}</div>\n`;
    
    case 'code':
      const lang = block.language ? ` class="language-${escapeHTML(block.language)}"` : '';
      return `<pre><code${lang}>${escapeHTML(block.content)}</code></pre>\n`;
    
    case 'image':
      const alt = escapeHTML(block.caption || 'Image');
      return `<figure><img src="${escapeHTML(block.url)}" alt="${alt}" width="${block.width}" height="${block.height}"><figcaption>${alt}</figcaption></figure>\n`;
    
    case 'file':
      return `<div class="file-attachment"><a href="file://${escapeHTML(block.file_id)}">📎 ${escapeHTML(block.filename)}</a></div>\n`;
    
    case 'embed':
      return `<div class="embed"><iframe src="${escapeHTML(block.url)}" frameborder="0"></iframe></div>\n`;
    
    case 'divider':
      return `<hr>\n`;
    
    case 'toc':
      return `<div class="toc"><strong>Table of Contents</strong></div>\n`;
    
    case 'table':
      return tableToHTML(block) + '\n';
    
    default:
      return '';
  }
}

/**
 * Convert a table block to HTML table format
 */
function tableToHTML(table: Block & { type: 'table' }): string {
  if (table.columns.length === 0 || table.rows.length === 0) {
    return '';
  }
  
  // Header row
  const headers = table.columns.map(col => `    <th>${escapeHTML(col.name)}</th>`).join('\n');
  
  // Data rows
  const rows = table.rows.map(row => {
    const cells = table.columns.map(col => {
      const cellValue = row.cells[col.id];
      const value = cellValue === null || cellValue === undefined ? '' : String(cellValue);
      return `      <td>${escapeHTML(value)}</td>`;
    }).join('\n');
    return `    <tr>\n${cells}\n    </tr>`;
  }).join('\n');
  
  return `<table>\n  <thead>\n    <tr>\n${headers}\n    </tr>\n  </thead>\n  <tbody>\n${rows}\n  </tbody>\n</table>`;
}

/**
 * Export a page to HTML format
 * @param pageId - The ID of the page to export
 * @param includeChildren - Whether to include nested child pages
 * @returns HTML string
 */
export async function exportPageToHTML(
  pageId: string,
  includeChildren: boolean = false
): Promise<string> {
  const page = await getPage(pageId);
  
  let html = '';
  
  // Add HTML document structure with styling
  html += `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(page.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666; }
    .callout { padding: 15px; border-radius: 5px; margin: 1em 0; background: #f9f9f9; }
    .callout-icon { margin-right: 8px; }
    .checkbox { margin: 0.5em 0; }
    .checkbox input { margin-right: 8px; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f4; font-weight: 600; }
    figure { margin: 1em 0; }
    figure img { max-width: 100%; height: auto; }
    figcaption { font-size: 0.9em; color: #666; margin-top: 0.5em; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    .file-attachment { margin: 1em 0; }
    .embed { margin: 1em 0; }
    .embed iframe { width: 100%; height: 400px; }
    .page-icon { font-size: 3em; margin-bottom: 0.5em; }
  </style>
</head>
<body>
`;
  
  // Add page icon if present
  if (page.icon) {
    html += `  <div class="page-icon">${page.icon}</div>\n`;
  }
  
  // Add page title
  html += `  <h1>${escapeHTML(page.title)}</h1>\n\n`;
  
  // Convert all blocks to HTML
  for (const block of page.content) {
    html += '  ' + blockToHTML(block);
  }
  
  // Include nested pages if requested
  if (includeChildren) {
    const children = await getPageChildren(page.id);
    
    if (children.length > 0) {
      html += `\n  <hr>\n  <h2>Nested Pages</h2>\n\n`;
      
      for (const child of children) {
        const childHTML = await exportPageToHTML(child.id, true);
        // Extract body content from child HTML
        const bodyMatch = childHTML.match(/<body>([\s\S]*)<\/body>/);
        if (bodyMatch) {
          html += `  <div class="nested-page">\n${bodyMatch[1]}  </div>\n`;
        }
      }
    }
  }
  
  html += `</body>
</html>`;
  
  return html;
}

/**
 * Export a page to PDF format
 * @param pageId - The ID of the page to export
 * @param includeChildren - Whether to include nested child pages
 * @returns Blob containing the PDF
 */
export async function exportPageToPDF(
  pageId: string,
  includeChildren: boolean = false
): Promise<Blob> {
  // Dynamically import jsPDF to avoid bundling it if not used
  const { jsPDF } = await import('jspdf');
  
  const page = await getPage(pageId);
  
  // Create a new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;
  
  // Helper function to add text with word wrapping
  const addText = (text: string, fontSize: number, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, maxWidth);
    
    for (const line of lines) {
      // Check if we need a new page
      if (yPosition + fontSize / 2 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.text(line, margin, yPosition);
      yPosition += fontSize / 2 + 2;
    }
  };
  
  // Helper function to add spacing
  const addSpacing = (space: number) => {
    yPosition += space;
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };
  
  // Add page icon if present
  if (page.icon) {
    addText(page.icon, 24);
    addSpacing(5);
  }
  
  // Add page title
  addText(page.title, 20, true);
  addSpacing(10);
  
  // Convert blocks to PDF
  for (const block of page.content) {
    await blockToPDF(doc, block, margin, maxWidth, pageWidth, pageHeight, yPosition, addText, addSpacing);
  }
  
  // Include nested pages if requested
  if (includeChildren) {
    const children = await getPageChildren(page.id);
    
    if (children.length > 0) {
      doc.addPage();
      yPosition = margin;
      addText('Nested Pages', 16, true);
      addSpacing(10);
      
      for (const child of children) {
        const childPDFBlob = await exportPageToPDF(child.id, true);
        // Note: Merging PDFs requires additional library, so we'll just add a reference
        addText(`• ${child.title}`, 12);
        addSpacing(5);
      }
    }
  }
  
  // Return PDF as Blob
  return doc.output('blob');
}

/**
 * Convert a single block to PDF content
 */
async function blockToPDF(
  doc: any,
  block: Block,
  margin: number,
  maxWidth: number,
  pageWidth: number,
  pageHeight: number,
  yPosition: number,
  addText: (text: string, fontSize: number, isBold?: boolean) => void,
  addSpacing: (space: number) => void
): Promise<void> {
  switch (block.type) {
    case 'text':
      addText(richTextToPlainText(block.content), 12);
      addSpacing(5);
      break;
    
    case 'heading1':
      addText(richTextToPlainText(block.content), 18, true);
      addSpacing(8);
      break;
    
    case 'heading2':
      addText(richTextToPlainText(block.content), 16, true);
      addSpacing(7);
      break;
    
    case 'heading3':
      addText(richTextToPlainText(block.content), 14, true);
      addSpacing(6);
      break;
    
    case 'bulletList':
      for (const item of block.items) {
        addText(`• ${richTextToPlainText(item)}`, 12);
      }
      addSpacing(5);
      break;
    
    case 'numberedList':
      block.items.forEach((item, index) => {
        addText(`${index + 1}. ${richTextToPlainText(item)}`, 12);
      });
      addSpacing(5);
      break;
    
    case 'checkbox':
      const checkmark = block.checked ? '☑' : '☐';
      addText(`${checkmark} ${richTextToPlainText(block.content)}`, 12);
      addSpacing(5);
      break;
    
    case 'quote':
      doc.setTextColor(100, 100, 100);
      addText(`"${richTextToPlainText(block.content)}"`, 12);
      doc.setTextColor(0, 0, 0);
      addSpacing(5);
      break;
    
    case 'callout':
      const calloutText = block.icon 
        ? `${block.icon} ${richTextToPlainText(block.content)}`
        : richTextToPlainText(block.content);
      addText(calloutText, 12);
      addSpacing(5);
      break;
    
    case 'code':
      doc.setFont('courier', 'normal');
      addText(block.content, 10);
      doc.setFont('helvetica', 'normal');
      addSpacing(5);
      break;
    
    case 'image':
      addText(`[Image: ${block.caption || block.url}]`, 10);
      addSpacing(5);
      break;
    
    case 'file':
      addText(`📎 ${block.filename}`, 12);
      addSpacing(5);
      break;
    
    case 'embed':
      addText(`🔗 Embed: ${block.url}`, 10);
      addSpacing(5);
      break;
    
    case 'divider':
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      addSpacing(5);
      break;
    
    case 'toc':
      addText('Table of Contents', 12, true);
      addSpacing(5);
      break;
    
    case 'table':
      addText('[Table content]', 10);
      addSpacing(5);
      break;
  }
}

/**
 * Convert rich text to plain text (for PDF)
 */
function richTextToPlainText(richText: RichText): string {
  return richText.text;
}
