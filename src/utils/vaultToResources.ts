import { createPage } from '@/api/pageAPI';
import type { Block, TextBlock, HeadingBlock, BulletListBlock, CalloutBlock, CodeBlock, DividerBlock } from '@/types/notion';
import { normalizeNotesContent } from '@/utils/notesFormatter';

export interface VaultItemLike {
  id?: string;
  title?: string;
  topic?: string;
  difficulty?: string;
  tags?: string[];
  type?: string;
  question?: string;
  answer?: string;
  hint?: string;
  content?: any;
  created_at?: string;
}

export function convertVaultItemToBlocks(item: VaultItemLike, explicitType?: string): { title: string; icon: string; blocks: Block[] } {
  const type = (explicitType || item.type || (item.question ? 'flashcards' : 'notes')).toLowerCase();
  const title = item.title || (item.question ? `Flashcard: ${item.question.slice(0, 40)}...` : 'Study Material');
  const now = new Date().toISOString();
  let blockCounter = 0;

  const createId = (prefix: string) => `block-${prefix}-${Date.now()}-${++blockCounter}`;

  const makeCallout = (text: string, icon = '💡'): CalloutBlock => ({
    id: createId('callout'),
    type: 'callout',
    position: blockCounter,
    icon,
    created_at: now,
    updated_at: now,
    content: {
      text,
      marks: [],
    },
  });

  const makeHeading = (text: string, level: 'heading1' | 'heading2' | 'heading3' = 'heading2'): HeadingBlock => ({
    id: createId('heading'),
    type: level,
    position: blockCounter,
    created_at: now,
    updated_at: now,
    content: {
      text,
      marks: [{ type: 'bold' }],
    },
  });

  const makeText = (text: string, isBold = false): TextBlock => ({
    id: createId('text'),
    type: 'text',
    position: blockCounter,
    created_at: now,
    updated_at: now,
    content: {
      text,
      marks: isBold ? [{ type: 'bold' }] : [],
    },
  });

  const makeBulletList = (items: string[]): BulletListBlock => ({
    id: createId('bullets'),
    type: 'bulletList',
    position: blockCounter,
    created_at: now,
    updated_at: now,
    items: items.map(t => ({ text: t, marks: [] })),
  });

  const makeCode = (code: string, language = 'markdown'): CodeBlock => ({
    id: createId('code'),
    type: 'code',
    position: blockCounter,
    language,
    created_at: now,
    updated_at: now,
    content: code,
  });

  const makeDivider = (): DividerBlock => ({
    id: createId('divider'),
    type: 'divider',
    position: blockCounter,
    created_at: now,
    updated_at: now,
  });

  const blocks: Block[] = [];

  // Header Callout metadata
  const metaParts: string[] = [];
  if (item.topic) metaParts.push(`Topic: ${item.topic}`);
  if (item.difficulty) metaParts.push(`Difficulty: ${item.difficulty.toUpperCase()}`);
  if (item.tags && item.tags.length > 0) metaParts.push(`Tags: #${item.tags.join(' #')}`);
  metaParts.push(`Source: StudyMate Vault (${type})`);

  let icon = '📝';

  if (type.includes('flashcard')) {
    icon = '🎴';
    blocks.push(makeCallout(`🎴 Flashcard Material • ${metaParts.join(' • ')}`, '🎴'));

    const flashcardsData: Array<{ question: string; answer: string; hint?: string }> =
      item.content?.flashcards ||
      (item.question ? [{ question: item.question, answer: item.answer || '', hint: item.hint }] : []);

    if (flashcardsData.length > 0) {
      blocks.push(makeHeading(`Flashcard Deck (${flashcardsData.length} cards)`, 'heading2'));
      flashcardsData.forEach((fc, idx) => {
        blocks.push(makeHeading(`Card ${idx + 1}: ${fc.question}`, 'heading3'));
        blocks.push(makeText(`Answer: ${fc.answer}`));
        if (fc.hint) {
          blocks.push(makeCallout(`Hint: ${fc.hint}`, '💡'));
        }
        blocks.push(makeDivider());
      });
    }
  } else if (type.includes('quiz')) {
    icon = '❓';
    blocks.push(makeCallout(`❓ Interactive Assessment • ${metaParts.join(' • ')}`, '❓'));

    const questions: any[] =
      item.content?.questions ||
      item.content?.quiz ||
      (Array.isArray(item.content) ? item.content : []);

    if (questions.length > 0) {
      blocks.push(makeHeading(`Quiz Questions (${questions.length})`, 'heading2'));
      questions.forEach((q, idx) => {
        blocks.push(makeHeading(`${idx + 1}. ${q.question || q.title || 'Question'}`, 'heading3'));
        if (Array.isArray(q.options)) {
          blocks.push(makeBulletList(q.options.map((opt: any, optIdx: number) => {
            const letter = String.fromCharCode(65 + optIdx);
            return `${letter}) ${typeof opt === 'string' ? opt : opt.text || JSON.stringify(opt)}`;
          })));
        }
        if (q.correct_answer || q.answer) {
          blocks.push(makeCallout(`Correct Answer: ${q.correct_answer || q.answer}${q.explanation ? `\n\nExplanation: ${q.explanation}` : ''}`, '✅'));
        }
        blocks.push(makeDivider());
      });
    }
  } else if (type.includes('mindmap') || type.includes('diagram')) {
    icon = '🧠';
    blocks.push(makeCallout(`🧠 Knowledge Map • ${metaParts.join(' • ')}`, '🧠'));
    blocks.push(makeHeading(`Visual Structure: ${title}`, 'heading2'));

    const rawMindmap = item.content?.mindmap || item.content;
    if (typeof rawMindmap === 'string') {
      blocks.push(makeCode(rawMindmap, 'mermaid'));
    } else if (rawMindmap?.mermaid) {
      blocks.push(makeCode(rawMindmap.mermaid, 'mermaid'));
    } else if (rawMindmap?.nodes || rawMindmap?.edges) {
      blocks.push(makeCode(JSON.stringify(rawMindmap, null, 2), 'json'));
    } else if (item.content?.summary) {
      blocks.push(makeCallout(item.content.summary, '📌'));
    }
  } else {
    // Default Notes / Summaries
    icon = '📝';
    blocks.push(makeCallout(`📝 Study Notes • ${metaParts.join(' • ')}`, '📝'));

    const structured = normalizeNotesContent(item.content, title);

    if (structured.summary) {
      blocks.push(makeHeading('Executive Summary', 'heading2'));
      blocks.push(makeCallout(structured.summary, '💡'));
    }

    if (structured.key_points && structured.key_points.length > 0) {
      blocks.push(makeHeading('Key Concepts & Deep Dive', 'heading2'));
      structured.key_points.forEach(kp => {
        blocks.push(makeHeading(kp.heading || 'Concept', 'heading3'));
        if (kp.importance && kp.importance !== 'medium') {
          blocks.push(makeCallout(`Priority: ${kp.importance.toUpperCase()}`, '⭐'));
        }
        blocks.push(makeText(kp.content || ''));
      });
    }

    if (structured.formulas && structured.formulas.length > 0) {
      blocks.push(makeHeading('Essential Formulas & Rules', 'heading2'));
      structured.formulas.forEach(f => {
        blocks.push(makeCallout(`📐 ${f.name}: ${f.formula}${f.explanation ? `\nUsage: ${f.explanation}` : ''}`, '📐'));
      });
    }

    if (structured.quick_facts && structured.quick_facts.length > 0) {
      blocks.push(makeHeading('High-Yield Quick Facts', 'heading2'));
      blocks.push(makeBulletList(structured.quick_facts));
    }

    if (structured.exam_tips && structured.exam_tips.length > 0) {
      blocks.push(makeHeading('Exam Tips & Strategy', 'heading2'));
      blocks.push(makeBulletList(structured.exam_tips));
    }
  }

  return { title, icon, blocks };
}

/**
 * Copies a vault study item directly into a new Notion Resource Page
 */
export async function copyVaultItemToResources(item: VaultItemLike, explicitType?: string) {
  const { title, icon, blocks } = convertVaultItemToBlocks(item, explicitType);

  const newPage = await createPage({
    title,
    icon,
    content: blocks,
    parent_id: null,
  });

  // Dispatch events to notify page tree and listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('studymate-page-created', {
        detail: { pageId: newPage.id, page: newPage },
      })
    );
    window.dispatchEvent(
      new CustomEvent('studymate-select-resource-page', {
        detail: { pageId: newPage.id },
      })
    );
  }

  return newPage;
}

/**
 * Converts any markdown string or text into Notion Block[]
 */
export function markdownToBlocks(markdown: string): Block[] {
  if (!markdown || typeof markdown !== 'string') return [];
  const now = new Date().toISOString();
  let blockCounter = 0;
  const createId = (p: string) => `block-md-${p}-${Date.now()}-${++blockCounter}`;

  const blocks: Block[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Code block (collect until closing ```)
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```(\w+)?/);
      const lang = langMatch?.[1] || 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        id: createId('code'),
        type: 'code',
        position: blockCounter,
        language: lang,
        created_at: now,
        updated_at: now,
        content: codeLines.join('\n').trim(),
      } as Block);
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      blocks.push({
        id: createId('h1'),
        type: 'heading1',
        position: blockCounter,
        created_at: now,
        updated_at: now,
        content: { text: line.replace(/^#\s+/, ''), marks: [{ type: 'bold' }] },
      } as Block);
      i++;
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      blocks.push({
        id: createId('h2'),
        type: 'heading2',
        position: blockCounter,
        created_at: now,
        updated_at: now,
        content: { text: line.replace(/^##\s+/, ''), marks: [{ type: 'bold' }] },
      } as Block);
      i++;
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      blocks.push({
        id: createId('h3'),
        type: 'heading3',
        position: blockCounter,
        created_at: now,
        updated_at: now,
        content: { text: line.replace(/^###\s+/, ''), marks: [{ type: 'bold' }] },
      } as Block);
      i++;
      continue;
    }

    // Blockquote / Callout
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].replace(/^>\s*/, ''));
        i++;
      }
      blocks.push({
        id: createId('callout'),
        type: 'callout',
        position: blockCounter,
        icon: '💡',
        created_at: now,
        updated_at: now,
        content: { text: quoteLines.join('\n'), marks: [] },
      } as Block);
      continue;
    }

    // Checkbox list item(s)
    if (/^[-*]\s+\[[ x]\]/i.test(line)) {
      while (i < lines.length && /^[-*]\s+\[[ x]\]/i.test(lines[i])) {
        const cbLine = lines[i];
        const checked = /^[-*]\s+\[x\]/i.test(cbLine);
        const text = cbLine.replace(/^[-*]\s+\[[ x]\]\s*/i, '');
        blocks.push({
          id: createId('checkbox'),
          type: 'checkbox',
          checked,
          position: blockCounter,
          created_at: now,
          updated_at: now,
          content: { text, marks: [] },
        } as Block);
        i++;
      }
      continue;
    }

    // Bullet list items (collect consecutive)
    if (/^[-*]\s+/.test(line)) {
      const bulletItems: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        bulletItems.push(lines[i].replace(/^[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({
        id: createId('bullets'),
        type: 'bulletList',
        position: blockCounter,
        created_at: now,
        updated_at: now,
        items: bulletItems.map(t => ({ text: t, marks: [] })),
      } as Block);
      continue;
    }

    // Numbered list items or section headings
    if (/^\d+\.\s+/.test(line)) {
      const numItems: string[] = [];
      const startLine = line.trim();
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        numItems.push(lines[i].replace(/^\d+\.\s+/, '').trim());
        i++;
      }

      // If only 1 numbered line and followed by bullets or bold definition, it is an outline concept heading
      if (numItems.length === 1 && i < lines.length && (/^[-*]\s+/.test(lines[i]) || lines[i].trim().startsWith('**'))) {
        blocks.push({
          id: createId('h3'),
          type: 'heading3',
          position: blockCounter,
          created_at: now,
          updated_at: now,
          content: { text: startLine, marks: [{ type: 'bold' }] },
        } as Block);
        continue;
      }

      blocks.push({
        id: createId('numbers'),
        type: 'numberedList',
        position: blockCounter,
        created_at: now,
        updated_at: now,
        items: numItems.map(t => ({ text: t, marks: [] })),
      } as Block);
      continue;
    }

    // Divider
    if (line.trim() === '---' || line.trim() === '***') {
      blocks.push({
        id: createId('divider'),
        type: 'divider',
        position: blockCounter,
        created_at: now,
        updated_at: now,
      } as Block);
      i++;
      continue;
    }

    // Plain text paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('> ') &&
      !lines[i].startsWith('```') &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      lines[i].trim() !== '---' &&
      lines[i].trim() !== '***'
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        id: createId('text'),
        type: 'text',
        position: blockCounter,
        created_at: now,
        updated_at: now,
        content: { text: paraLines.join('\n').trim(), marks: [] },
      } as Block);
    }
  }

  return blocks;
}
