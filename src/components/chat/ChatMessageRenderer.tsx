import React, { useState } from 'react';
import { Copy, Check, Terminal, Lightbulb, FileText, CheckCircle2 } from 'lucide-react';
import { inlineMarkdownToHTML } from '@/components/notion/editor/serialization';

interface ChatMessageRendererProps {
  content: string;
  isUser?: boolean;
}

interface ParsedBlock {
  type: 'h1' | 'h2' | 'h3' | 'numbered-list' | 'bullet-list' | 'code' | 'quote' | 'table' | 'paragraph';
  content?: string;
  items?: Array<{ number?: number; title?: string; text: string }>;
  language?: string;
  tableData?: { headers: string[]; rows: string[][] };
}

/**
 * Parses markdown blocks from raw AI or user response text.
 */
function parseMarkdownBlocks(text: string): ParsedBlock[] {
  if (!text || typeof text !== 'string') return [];

  // Remove any stray JSON action blocks that should not be visible to user
  let cleaned = text.replace(/```(?:json:action|action|json)?\s*\{[\s\S]*?"actions"[\s\S]*?\}\s*```/gi, '').trim();
  cleaned = cleaned.replace(/\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/gi, '').trim();

  const lines = cleaned.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip consecutive empty lines
    if (!line) {
      i++;
      continue;
    }

    // 1. Code Block: ```lang ... ```
    if (line.startsWith('```')) {
      const match = line.match(/^```(\w+)?/);
      const language = match?.[1] || 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: 'code',
        language,
        content: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Headings
    if (line.startsWith('# ')) {
      blocks.push({
        type: 'h1',
        content: line.replace(/^#\s+/, '').trim(),
      });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        type: 'h2',
        content: line.replace(/^##\s+/, '').trim(),
      });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        type: 'h3',
        content: line.replace(/^###\s+/, '').trim(),
      });
      i++;
      continue;
    }

    // 3. Blockquote / Callout
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      blocks.push({
        type: 'quote',
        content: quoteLines.join(' '),
      });
      continue;
    }

    // 4. Tables (| Header 1 | Header 2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const splitRow = (r: string) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
        const headers = splitRow(tableLines[0]);
        const dataRows = tableLines.slice(1).filter((r) => !/^[|\s-:]+$/.test(r)).map(splitRow);
        blocks.push({
          type: 'table',
          tableData: { headers, rows: dataRows },
        });
        continue;
      }
    }

    // 5. Ordered List (e.g. "1. **What is Big Data?**", "2. ...")
    if (/^\d+\.\s+/.test(line)) {
      const items: Array<{ number?: number; title?: string; text: string }> = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemLine = lines[i].trim();
        const numMatch = itemLine.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          let rest = numMatch[2].trim();
          let title: string | undefined = undefined;

          // Check if item starts with bold header like **Title**: or **Title**
          const boldTitleMatch = rest.match(/^\*\*(.+?)\*\*[:\s-]*(.*)/);
          if (boldTitleMatch) {
            title = boldTitleMatch[1];
            rest = boldTitleMatch[2];
          }

          // Also check for sub-bullets directly underneath this numbered item
          i++;
          const subLines: string[] = [];
          while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
            subLines.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
            i++;
          }

          items.push({
            number: num,
            title,
            text: rest + (subLines.length > 0 ? '\n' + subLines.join('\n') : ''),
          });
        } else {
          i++;
        }
      }
      blocks.push({
        type: 'numbered-list',
        items,
      });
      continue;
    }

    // 6. Bullet List (e.g. "- Item" or "* Item" or "• Item")
    if (/^[-*•]\s+/.test(line)) {
      const items: Array<{ title?: string; text: string }> = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        const itemLine = lines[i].trim().replace(/^[-*•]\s+/, '');
        let title: string | undefined = undefined;
        let rest = itemLine;

        const boldTitleMatch = itemLine.match(/^\*\*(.+?)\*\*[:\s-]*(.*)/);
        if (boldTitleMatch) {
          title = boldTitleMatch[1];
          rest = boldTitleMatch[2];
        }

        items.push({ title, text: rest });
        i++;
      }
      blocks.push({
        type: 'bullet-list',
        items,
      });
      continue;
    }

    // 7. Standard Paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: paragraphLines.join(' '),
      });
    }
  }

  return blocks;
}

/**
 * Code Block component with one-click Copy button
 */
function CodeBlockView({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border/60 bg-zinc-950 text-zinc-100 shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>{language || 'code'}</span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[10px]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed scrollbar-thin">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Rich message renderer for AI Chat
 */
export const ChatMessageRenderer: React.FC<ChatMessageRendererProps> = ({ content, isUser }) => {
  if (!content) return null;

  // For user messages, simple clean styled text
  if (isUser) {
    return (
      <div className="text-sm leading-relaxed text-white whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  }

  const blocks = parseMarkdownBlocks(content);

  // If no structured blocks parsed, fallback to single clean formatted paragraph
  if (blocks.length === 0) {
    return (
      <p
        className="text-xs sm:text-sm text-foreground/95 leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(content) }}
      />
    );
  }

  return (
    <div className="space-y-3 text-foreground/95 leading-relaxed text-xs sm:text-sm break-words">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <div
                key={idx}
                className="mt-3.5 mb-2 pb-1.5 border-b border-border/70 flex items-center gap-2"
              >
                <div className="text-base sm:text-lg font-bold text-foreground flex items-center gap-1.5">
                  <span dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(block.content || '') }} />
                </div>
              </div>
            );

          case 'h2':
            return (
              <div
                key={idx}
                className="mt-3 mb-1.5 flex items-center gap-2 text-sm sm:text-base font-semibold text-primary"
              >
                <span dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(block.content || '') }} />
              </div>
            );

          case 'h3':
            return (
              <h4
                key={idx}
                className="mt-2.5 mb-1 text-xs sm:text-sm font-semibold text-foreground/90"
                dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(block.content || '') }}
              />
            );

          case 'numbered-list':
            return (
              <div key={idx} className="space-y-2 my-2.5 pl-0.5">
                {block.items?.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] shrink-0 mt-0.5 border border-primary/20">
                      {item.number ?? iIdx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {item.title && (
                        <span className="font-semibold text-foreground mr-1">
                          {item.title}:
                        </span>
                      )}
                      {item.text.includes('\n') ? (
                        <div className="space-y-1 mt-0.5">
                          {item.text.split('\n').map((subLine, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-1.5 text-muted-foreground pl-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                              <span
                                className="flex-1"
                                dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(subLine) }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(item.text) }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );

          case 'bullet-list':
            return (
              <div key={idx} className="space-y-1.5 my-2 pl-1">
                {block.items?.map((item, bIdx) => (
                  <div key={bIdx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0 mt-2" />
                    <div className="flex-1 min-w-0">
                      {item.title && (
                        <strong className="font-semibold text-foreground mr-1.5">
                          {item.title}:
                        </strong>
                      )}
                      <span dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(item.text) }} />
                    </div>
                  </div>
                ))}
              </div>
            );

          case 'code':
            return <CodeBlockView key={idx} code={block.content || ''} language={block.language} />;

          case 'quote':
            return (
              <div
                key={idx}
                className="border-l-3 border-primary/70 bg-primary/5 dark:bg-primary/10 px-3.5 py-2 rounded-r-xl my-2.5 text-xs sm:text-sm leading-relaxed text-foreground/90 flex items-start gap-2"
              >
                <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span
                  className="flex-1"
                  dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(block.content || '') }}
                />
              </div>
            );

          case 'table':
            if (!block.tableData) return null;
            return (
              <div key={idx} className="overflow-x-auto my-3 rounded-xl border border-border/80 shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/80 text-foreground font-semibold border-b border-border">
                    <tr>
                      {block.tableData.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3 py-2">
                          <span dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(h) }} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {block.tableData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-muted-foreground">
                            <span dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(cell) }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'paragraph':
          default:
            return (
              <p
                key={idx}
                className="text-xs sm:text-sm text-foreground/95 leading-relaxed break-words"
                dangerouslySetInnerHTML={{ __html: inlineMarkdownToHTML(block.content || '') }}
              />
            );
        }
      })}
    </div>
  );
};
