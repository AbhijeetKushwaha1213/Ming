/**
 * Utility for normalizing, parsing, and converting any raw AI notes output (JSON, object, or text)
 * into a clean, ready-to-read, beautifully structured study notes format.
 */

export interface NoteKeyPoint {
  heading: string;
  content: string;
  importance?: 'high' | 'medium' | 'low' | string;
}

export interface NoteFormula {
  name: string;
  formula: string;
  explanation?: string;
}

export interface StructuredNotes {
  title: string;
  summary: string;
  keyPoints: NoteKeyPoint[];
  key_points: NoteKeyPoint[];
  formulas: NoteFormula[];
  quickFacts: string[];
  quick_facts: string[];
  examTips: string[];
  exam_tips: string[];
  rawMarkdown?: string;
}

/**
 * Normalizes any input (JSON string, raw object, nested notes object, or markdown)
 * into a strongly-typed StructuredNotes structure.
 */
export function normalizeNotesContent(input: any, defaultTitle?: string): StructuredNotes {
  const fallbackTitle = defaultTitle || 'Study Notes';

  if (!input) {
    return {
      title: fallbackTitle,
      summary: '',
      keyPoints: [],
      key_points: [],
      formulas: [],
      quickFacts: [],
      quick_facts: [],
      examTips: [],
      exam_tips: [],
    };
  }

  let parsed: any = input;

  // 1. If string, attempt JSON extraction if it looks like JSON or code block
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);

    let candidate = '';
    if (codeBlockMatch) {
      candidate = codeBlockMatch[1].trim();
    } else if (trimmed.startsWith('{') || trimmed.includes('"notes":') || trimmed.includes('"key_points":') || trimmed.includes('"summary":')) {
      candidate = objectMatch ? objectMatch[0] : trimmed;
    }

    if (candidate) {
      try {
        parsed = JSON.parse(candidate);
      } catch (e) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (e2) {
          return parseMarkdownToStructuredNotes(trimmed, fallbackTitle);
        }
      }
    } else {
      return parseMarkdownToStructuredNotes(trimmed, fallbackTitle);
    }
  }

  // 2. If object is wrapped in { notes: { ... } } or { content: { ... } }
  if (parsed.notes && typeof parsed.notes === 'object') {
    parsed = parsed.notes;
  } else if (parsed.content && typeof parsed.content === 'object' && (parsed.content.summary || parsed.content.key_points)) {
    parsed = parsed.content;
  }

  // 3. Extract title
  const title = parsed.title || defaultTitle || 'Study Notes';

  // 4. Extract summary
  const summary = parsed.summary || parsed.overview || parsed.description || '';

  // 5. Extract key points
  let keyPoints: NoteKeyPoint[] = [];
  const rawPoints = parsed.key_points || parsed.keyPoints || parsed.concepts || parsed.main_points || [];
  if (Array.isArray(rawPoints)) {
    keyPoints = rawPoints.map((kp: any, idx: number) => {
      if (typeof kp === 'string') {
        const parts = kp.split(':');
        if (parts.length > 1) {
          return {
            heading: parts[0].trim(),
            content: parts.slice(1).join(':').trim(),
            importance: 'medium',
          };
        }
        return {
          heading: `Concept ${idx + 1}`,
          content: kp,
          importance: 'medium',
        };
      }
      return {
        heading: kp.heading || kp.title || kp.name || `Concept ${idx + 1}`,
        content: kp.content || kp.description || kp.explanation || '',
        importance: kp.importance || 'medium',
      };
    });
  }

  // 6. Extract formulas
  let formulas: NoteFormula[] = [];
  const rawFormulas = parsed.formulas || parsed.equations || [];
  if (Array.isArray(rawFormulas)) {
    formulas = rawFormulas.map((f: any, idx: number) => {
      if (typeof f === 'string') {
        return { name: `Formula ${idx + 1}`, formula: f };
      }
      return {
        name: f.name || f.title || `Formula ${idx + 1}`,
        formula: f.formula || f.equation || f.expression || '',
        explanation: f.explanation || f.description || '',
      };
    });
  }

  // 7. Extract quick facts
  let quickFacts: string[] = [];
  const rawFacts = parsed.quick_facts || parsed.quickFacts || parsed.facts || parsed.takeaways || [];
  if (Array.isArray(rawFacts)) {
    quickFacts = rawFacts.map((f: any) => (typeof f === 'string' ? f : JSON.stringify(f)));
  }

  // 8. Extract exam tips
  let examTips: string[] = [];
  const rawTips = parsed.exam_tips || parsed.examTips || parsed.tips || parsed.pitfalls || [];
  if (Array.isArray(rawTips)) {
    examTips = rawTips.map((t: any) => (typeof t === 'string' ? t : JSON.stringify(t)));
  }

  // If parsed object had very little structure but had a markdown or content string
  if (keyPoints.length === 0 && typeof parsed.content === 'string') {
    return parseMarkdownToStructuredNotes(parsed.content, title);
  }

  return {
    title,
    summary,
    keyPoints,
    key_points: keyPoints,
    formulas,
    quickFacts,
    quick_facts: quickFacts,
    examTips,
    exam_tips: examTips,
  };
}

/**
 * Parses markdown text into StructuredNotes
 */
function parseMarkdownToStructuredNotes(text: string, defaultTitle: string): StructuredNotes {
  const lines = text.split('\n');
  let title = defaultTitle;
  let summary = '';
  const keyPoints: NoteKeyPoint[] = [];
  const formulas: NoteFormula[] = [];
  const quickFacts: string[] = [];
  const examTips: string[] = [];

  let currentHeading = '';
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for title (# Title)
    if (line.startsWith('# ') && title === defaultTitle) {
      title = line.replace(/^#\s+/, '').replace(/^[\p{Emoji}\s]+/u, '').trim();
      continue;
    }

    // Check for H2 or H3
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentHeading) {
        processSection(currentHeading, currentContent.join('\n').trim(), {
          setSummary: (s) => { if (!summary) summary = s; },
          keyPoints,
          formulas,
          quickFacts,
          examTips,
        });
        currentContent = [];
      }
      currentHeading = line.replace(/^#+\s+/, '').replace(/^[\p{Emoji}\s]+/u, '').trim();
      continue;
    }

    currentContent.push(line);
  }

  if (currentHeading) {
    processSection(currentHeading, currentContent.join('\n').trim(), {
      setSummary: (s) => { if (!summary) summary = s; },
      keyPoints,
      formulas,
      quickFacts,
      examTips,
    });
  } else if (!summary && currentContent.length > 0) {
    summary = currentContent.join('\n').trim();
  }

  return {
    title: title || defaultTitle,
    summary: summary || (keyPoints.length > 0 ? keyPoints[0].content.slice(0, 150) + '...' : text.slice(0, 200)),
    keyPoints,
    key_points: keyPoints,
    formulas,
    quickFacts,
    quick_facts: quickFacts,
    examTips,
    exam_tips: examTips,
    rawMarkdown: text,
  };
}

function processSection(
  heading: string,
  content: string,
  collectors: {
    setSummary: (s: string) => void;
    keyPoints: NoteKeyPoint[];
    formulas: NoteFormula[];
    quickFacts: string[];
    examTips: string[];
  }
) {
  const norm = heading.toLowerCase();

  if (norm.includes('summary') || norm.includes('overview') || norm.includes('introduction')) {
    collectors.setSummary(content);
  } else if (norm.includes('formula') || norm.includes('equation')) {
    const formulaLines = content.split('\n').filter((l) => l.trim().length > 0);
    formulaLines.forEach((fl, idx) => {
      collectors.formulas.push({
        name: `Formula ${idx + 1}`,
        formula: fl.replace(/^[-*•]\s*/, '').trim(),
      });
    });
  } else if (norm.includes('fact') || norm.includes('takeaway') || norm.includes('highlight')) {
    const factLines = content.split('\n').filter((l) => l.trim().length > 0);
    factLines.forEach((fl) => {
      collectors.quickFacts.push(fl.replace(/^[-*•]\s*/, '').trim());
    });
  } else if (norm.includes('tip') || norm.includes('pitfall') || norm.includes('exam')) {
    const tipLines = content.split('\n').filter((l) => l.trim().length > 0);
    tipLines.forEach((tl) => {
      collectors.examTips.push(tl.replace(/^[-*•]\s*/, '').trim());
    });
  } else {
    collectors.keyPoints.push({
      heading,
      content,
      importance: norm.includes('key') || norm.includes('core') ? 'high' : 'medium',
    });
  }
}

/**
 * Converts StructuredNotes into a clean, ready-to-read Markdown document
 */
export function notesToMarkdown(notes: StructuredNotes): string {
  let md = `# 📚 ${notes.title}\n\n`;

  if (notes.summary) {
    md += `## 💡 Executive Summary\n${notes.summary}\n\n`;
  }

  if (notes.keyPoints && notes.keyPoints.length > 0) {
    md += `## 🔑 Key Concepts & Deep Dive\n\n`;
    notes.keyPoints.forEach((kp, idx) => {
      const importanceBadge = kp.importance === 'high' ? '🔥 [HIGH PRIORITY]' : '';
      md += `### ${idx + 1}. ${kp.heading} ${importanceBadge}\n${kp.content}\n\n`;
    });
  }

  if (notes.formulas && notes.formulas.length > 0) {
    md += `## 📐 Essential Formulas & Rules\n\n`;
    notes.formulas.forEach((f) => {
      md += `- **${f.name}**: \`${f.formula}\`${f.explanation ? `\n  *${f.explanation}*` : ''}\n`;
    });
    md += `\n`;
  }

  if (notes.quickFacts && notes.quickFacts.length > 0) {
    md += `## ⚡ High-Yield Quick Facts\n\n`;
    notes.quickFacts.forEach((fact) => {
      md += `- ${fact}\n`;
    });
    md += `\n`;
  }

  if (notes.examTips && notes.examTips.length > 0) {
    md += `## 🎯 Exam Tips & Pitfalls\n\n`;
    notes.examTips.forEach((tip) => {
      md += `- ⚠️ ${tip}\n`;
    });
    md += `\n`;
  }

  return md.trim();
}

/**
 * Universal converter: transforms ANY raw content (JSON object, JSON string, or text)
 * into human-readable, ready-to-study Markdown notes.
 */
export function convertAnyContentToMarkdown(input: any, defaultTitle?: string): string {
  if (!input) return '';

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Check if it's already markdown text that DOES NOT contain JSON
    if (!trimmed.startsWith('{') && !trimmed.startsWith('```json') && !trimmed.includes('"notes":')) {
      return trimmed;
    }
  }

  const structured = normalizeNotesContent(input, defaultTitle);
  return notesToMarkdown(structured);
}

/**
 * Detects if a text string is an accidentally serialized JSON notes object from an AI model.
 */
export function isJsonNotesString(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return (
    (trimmed.startsWith('{') && (trimmed.includes('"notes"') || trimmed.includes('"key_points"') || trimmed.includes('"summary"'))) ||
    /```(?:json)?\s*\{[\s\S]*?"(?:notes|key_points|summary)"[\s\S]*?\}\s*```/i.test(trimmed)
  );
}

/**
 * If an AI response text contains a raw JSON notes object, formats it into clean,
 * ready-to-read Markdown notes with sections and bullet points.
 */
export function cleanAiResponseToReadableNotes(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Check for code-fenced or raw JSON notes
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?"(?:notes|key_points|summary)"[\s\S]*?\})\s*```/i)
    || text.match(/(\{[\s\S]*?"(?:notes|key_points|summary)"[\s\S]*?\})/i);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const formatted = convertAnyContentToMarkdown(parsed);
      return text.replace(jsonMatch[0], formatted).trim();
    } catch (e) {
      // ignore
    }
  }

  return text;
}
