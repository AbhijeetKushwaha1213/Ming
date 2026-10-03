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
 * Safely extracts a balanced JSON object containing notes, summary, or key_points
 * from messy AI output that may contain markdown headings or multiple blocks.
 */
export function extractBalancedJsonObject(str: string): any {
  if (!str || typeof str !== 'string') return null;

  // Search for candidate opening braces near key identifiers
  const searchTerms = ['"notes"', '"key_points"', '"summary"', '"title"'];
  let candidateIndices: number[] = [];

  for (const term of searchTerms) {
    let pos = 0;
    while ((pos = str.indexOf(term, pos)) !== -1) {
      const openBrace = str.lastIndexOf('{', pos);
      if (openBrace !== -1 && !candidateIndices.includes(openBrace)) {
        candidateIndices.push(openBrace);
      }
      pos += term.length;
    }
  }

  // Also try the very first '{'
  const firstBrace = str.indexOf('{');
  if (firstBrace !== -1 && !candidateIndices.includes(firstBrace)) {
    candidateIndices.push(firstBrace);
  }

  candidateIndices.sort((a, b) => a - b);

  for (const startIndex of candidateIndices) {
    let openBraces = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < str.length; i++) {
      const char = str[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          openBraces++;
        } else if (char === '}') {
          openBraces--;
          if (openBraces === 0) {
            const candidate = str.substring(startIndex, i + 1);
            try {
              const res = JSON.parse(candidate);
              if (res && typeof res === 'object') {
                return res;
              }
            } catch {
              // continue scanning
            }
          }
        }
      }
    }
  }

  return null;
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

    let parsedSuccess = false;

    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1].trim());
        parsedSuccess = true;
      } catch {}
    }

    if (!parsedSuccess) {
      const balanced = extractBalancedJsonObject(trimmed);
      if (balanced && typeof balanced === 'object') {
        parsed = balanced;
        parsedSuccess = true;
      }
    }

    if (!parsedSuccess) {
      try {
        parsed = JSON.parse(trimmed);
        parsedSuccess = true;
      } catch (e) {
        return parseMarkdownToStructuredNotes(trimmed, fallbackTitle);
      }
    }
  }

  // 2. If object is wrapped in { notes: { ... } } or { content: { ... } }
  if (parsed && typeof parsed === 'object') {
    if (parsed.notes && typeof parsed.notes === 'object') {
      parsed = parsed.notes;
    } else if (parsed.content && typeof parsed.content === 'object' && (parsed.content.summary || parsed.content.key_points)) {
      parsed = parsed.content;
    }
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

    // Check if the only key point is an accidentally stringified nested notes object
    if (
      keyPoints.length === 1 &&
      typeof keyPoints[0].content === 'string' &&
      (keyPoints[0].content.includes('"notes"') || keyPoints[0].content.includes('"key_points"') || keyPoints[0].content.includes('"summary"'))
    ) {
      const innerBalanced = extractBalancedJsonObject(keyPoints[0].content);
      if (innerBalanced && typeof innerBalanced === 'object') {
        const nested = normalizeNotesContent(innerBalanced, defaultTitle);
        if (nested.keyPoints.length > 0) {
          return nested;
        }
      }
    }

    // Clean any accidental markdown headers or raw JSON leftovers from key points
    keyPoints = keyPoints.map((kp) => {
      let cleanContent = kp.content;
      cleanContent = cleanContent.replace(/^#+\s+[^\n]+\n+/gm, '').trim();
      return {
        ...kp,
        heading: kp.heading.replace(/^#+\s+/, '').replace(/^[\p{Emoji}\s]+/u, '').trim(),
        content: cleanContent,
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
  let cleanContent = content.trim();

  // If content contains an embedded raw JSON notes block, extract its true contents!
  if (cleanContent.includes('"notes"') || cleanContent.includes('"key_points"') || cleanContent.includes('"summary"')) {
    const balanced = extractBalancedJsonObject(cleanContent);
    if (balanced && typeof balanced === 'object') {
      const extracted = balanced.notes || balanced;
      if (extracted.summary && typeof extracted.summary === 'string') {
        collectors.setSummary(extracted.summary);
      }
      if (Array.isArray(extracted.key_points) && extracted.key_points.length > 0) {
        extracted.key_points.forEach((kp: any, idx: number) => {
          collectors.keyPoints.push({
            heading: kp.heading || kp.title || `Concept ${idx + 1}`,
            content: kp.content || kp.description || '',
            importance: kp.importance || 'medium',
          });
        });
        return;
      }
    }
  }

  // Strip any raw markdown headers repeated in content (e.g. # Title or ## Heading)
  cleanContent = cleanContent.replace(/^#+\s+[^\n]+\n*/gm, '').trim();

  const norm = heading.toLowerCase();

  if (norm.includes('summary') || norm.includes('overview') || norm.includes('introduction')) {
    collectors.setSummary(cleanContent);
  } else if (norm.includes('formula') || norm.includes('equation')) {
    const formulaLines = cleanContent.split('\n').filter((l) => l.trim().length > 0);
    formulaLines.forEach((fl, idx) => {
      collectors.formulas.push({
        name: `Formula ${idx + 1}`,
        formula: fl.replace(/^[-*•]\s*/, '').trim(),
      });
    });
  } else if (norm.includes('fact') || norm.includes('takeaway') || norm.includes('highlight')) {
    const factLines = cleanContent.split('\n').filter((l) => l.trim().length > 0);
    factLines.forEach((fl) => {
      collectors.quickFacts.push(fl.replace(/^[-*•]\s*/, '').trim());
    });
  } else if (norm.includes('tip') || norm.includes('pitfall') || norm.includes('exam')) {
    const tipLines = cleanContent.split('\n').filter((l) => l.trim().length > 0);
    tipLines.forEach((tl) => {
      collectors.examTips.push(tl.replace(/^[-*•]\s*/, '').trim());
    });
  } else {
    collectors.keyPoints.push({
      heading: heading.replace(/^#+\s+/, '').replace(/^[\p{Emoji}\s]+/u, '').trim(),
      content: cleanContent,
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
      // ignore and try balanced extractor
    }
  }

  const balanced = extractBalancedJsonObject(text);
  if (balanced && typeof balanced === 'object' && (balanced.notes || balanced.key_points || balanced.summary)) {
    return convertAnyContentToMarkdown(balanced);
  }

  return text;
}
