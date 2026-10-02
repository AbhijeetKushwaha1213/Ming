import { createPage } from '@/api/pageAPI';
import type { Block, TextBlock, HeadingBlock, BulletListBlock, CalloutBlock, CodeBlock, DividerBlock } from '@/types/notion';

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

    const noteSummary =
      item.content?.summary ||
      item.content?.notes?.summary ||
      item.content?.overview;
    if (noteSummary) {
      blocks.push(makeHeading('Executive Summary', 'heading2'));
      blocks.push(makeCallout(noteSummary, '📌'));
    }

    const keyPoints =
      item.content?.key_points ||
      item.content?.notes?.key_points ||
      item.content?.keyConcepts;
    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
      blocks.push(makeHeading('Key Concepts', 'heading2'));
      keyPoints.forEach((kp: any) => {
        if (typeof kp === 'string') {
          blocks.push(makeText(`• ${kp}`));
        } else {
          blocks.push(makeHeading(kp.heading || kp.title || 'Concept', 'heading3'));
          blocks.push(makeText(kp.content || kp.description || ''));
        }
      });
    }

    const quickFacts =
      item.content?.quick_facts ||
      item.content?.notes?.quick_facts ||
      item.content?.facts;
    if (Array.isArray(quickFacts) && quickFacts.length > 0) {
      blocks.push(makeHeading('Quick Facts', 'heading2'));
      blocks.push(makeBulletList(quickFacts.map((f: any) => typeof f === 'string' ? f : JSON.stringify(f))));
    }

    const rawText =
      typeof item.content?.content === 'string'
        ? item.content.content
        : typeof item.content === 'string'
        ? item.content
        : null;

    if (rawText) {
      blocks.push(makeHeading('Detailed Content', 'heading2'));
      const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      for (const para of paragraphs) {
        if (para.startsWith('# ')) {
          blocks.push(makeHeading(para.replace(/^#\s+/, ''), 'heading1'));
        } else if (para.startsWith('## ')) {
          blocks.push(makeHeading(para.replace(/^##\s+/, ''), 'heading2'));
        } else if (para.startsWith('### ')) {
          blocks.push(makeHeading(para.replace(/^###\s+/, ''), 'heading3'));
        } else if (para.startsWith('- ') || para.startsWith('* ')) {
          const lines = para.split('\n').map(l => l.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
          blocks.push(makeBulletList(lines));
        } else {
          blocks.push(makeText(para));
        }
      }
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
