import { describe, it, expect } from 'vitest';
import {
  normalizeNotesContent,
  notesToMarkdown,
  convertAnyContentToMarkdown,
  cleanAiResponseToReadableNotes,
} from '@/utils/notesFormatter';

describe('Universal Notes Formatter & Normalizer', () => {
  const sampleJsonNotes = {
    notes: {
      title: 'Neural Networks & Deep Learning',
      summary: 'An introductory guide to artificial neural networks, backpropagation, and activation functions.',
      key_points: [
        {
          heading: 'Forward Propagation',
          content: 'Computes layer-by-layer activations using weights and biases.',
          importance: 'high',
        },
        {
          heading: 'Backpropagation',
          content: 'Computes gradients of the loss function using the chain rule.',
          importance: 'high',
        },
      ],
      formulas: [
        {
          name: 'Sigmoid Function',
          formula: 'σ(z) = 1 / (1 + e^(-z))',
          explanation: 'Squashes input values between 0 and 1.',
        },
      ],
      quick_facts: [
        'Geoffrey Hinton is widely recognized as a godfather of deep learning.',
        'ReLU avoids the vanishing gradient problem in positive regimes.',
      ],
      exam_tips: [
        'Always check the dimension compatibility of weight matrices.',
      ],
    },
  };

  it('normalizes standard nested JSON notes object', () => {
    const normalized = normalizeNotesContent(sampleJsonNotes);
    expect(normalized.title).toBe('Neural Networks & Deep Learning');
    expect(normalized.summary).toContain('An introductory guide');
    expect(normalized.key_points).toHaveLength(2);
    expect(normalized.formulas).toHaveLength(1);
    expect(normalized.quick_facts).toHaveLength(2);
    expect(normalized.exam_tips).toHaveLength(1);
  });

  it('normalizes stringified JSON input', () => {
    const rawString = JSON.stringify(sampleJsonNotes);
    const normalized = normalizeNotesContent(rawString);
    expect(normalized.title).toBe('Neural Networks & Deep Learning');
    expect(normalized.key_points[0].heading).toBe('Forward Propagation');
  });

  it('normalizes markdown code block containing JSON', () => {
    const fenced = `Here are your notes:\n\`\`\`json\n${JSON.stringify(sampleJsonNotes, null, 2)}\n\`\`\``;
    const normalized = normalizeNotesContent(fenced);
    expect(normalized.title).toBe('Neural Networks & Deep Learning');
    expect(normalized.formulas[0].name).toBe('Sigmoid Function');
  });

  it('normalizes flat JSON object without notes wrapper', () => {
    const flatObject = {
      title: 'Operating Systems',
      summary: 'Manages computer hardware and software resources.',
      key_points: ['Process scheduling', 'Memory management (paging/segmentation)'],
      facts: ['Virtual memory provides the illusion of a larger address space.'],
    };
    const normalized = normalizeNotesContent(flatObject);
    expect(normalized.title).toBe('Operating Systems');
    expect(normalized.key_points).toHaveLength(2);
    expect(normalized.key_points[0].content).toBe('Process scheduling');
    expect(normalized.quick_facts).toHaveLength(1);
  });

  it('parses plain markdown text into structured notes', () => {
    const markdown = `# Calculus Basics\n\nLimits and derivatives form the foundation.\n\n## Differential Calculus\nDerivatives represent instantaneous rates of change.\n\n## Integral Calculus\nIntegrals calculate area under curves.`;
    const normalized = normalizeNotesContent(markdown);
    expect(normalized.title).toBe('Calculus Basics');
    expect(normalized.summary).toContain('Limits and derivatives');
    expect(normalized.key_points.length).toBeGreaterThanOrEqual(1);
  });

  it('converts structured notes to clean, ready-to-read markdown', () => {
    const normalized = normalizeNotesContent(sampleJsonNotes);
    const md = notesToMarkdown(normalized);

    // Verify key sections are present
    expect(md).toContain('# 📚 Neural Networks & Deep Learning');
    expect(md).toContain('## 💡 Executive Summary');
    expect(md).toContain('## 🔑 Key Concepts & Deep Dive');
    expect(md).toContain('### 1. Forward Propagation');
    expect(md).toContain('## 📐 Essential Formulas & Rules');
    expect(md).toContain('σ(z) = 1 / (1 + e^(-z))');
    expect(md).toContain('## ⚡ High-Yield Quick Facts');
    expect(md).toContain('Geoffrey Hinton');
    expect(md).toContain('## 🎯 Exam Tips');

    // Crucial check: MUST NOT contain raw JSON syntax
    expect(md).not.toContain('"key_points":');
    expect(md).not.toContain('"formulas":');
  });

  it('convertAnyContentToMarkdown directly produces ready-to-read notes', () => {
    const md = convertAnyContentToMarkdown(sampleJsonNotes);
    expect(md).toContain('## 💡 Executive Summary');
    expect(typeof md).toBe('string');
  });

  it('cleanAiResponseToReadableNotes intercepts raw JSON blocks in chat responses', () => {
    const aiChatWithJson = `Here are the short revision notes you requested:\n\n\`\`\`json\n${JSON.stringify(sampleJsonNotes, null, 2)}\n\`\`\`\n\nLet me know if you want practice questions!`;
    const cleaned = cleanAiResponseToReadableNotes(aiChatWithJson);

    expect(cleaned).toContain('Here are the short revision notes you requested:');
    expect(cleaned).toContain('# 📚 Neural Networks & Deep Learning');
    expect(cleaned).toContain('## 💡 Executive Summary');
    expect(cleaned).toContain('Let me know if you want practice questions!');
    // Verify no raw json remains
    expect(cleaned).not.toContain('"key_points":');
    expect(cleaned).not.toContain('```json');
  });

  it('cleanAiResponseToReadableNotes preserves regular conversational text unharmed', () => {
    const normalChat = 'Hello! I am ready to help you prepare for your upcoming Computer Science exam.';
    const cleaned = cleanAiResponseToReadableNotes(normalChat);
    expect(cleaned).toBe(normalChat);
  });

  it('extracts structured notes from mixed markdown and embedded JSON blocks', () => {
    const mixedInput = `# 📚 Machine Learning\n\n## 💡 Overview\n{\n  "notes": {\n    "title": "Machine Learning",\n    "summary": "Machine Learning enables computers to learn from data.",\n    "key_points": [\n      {\n        "heading": "Supervised Learning",\n        "content": "Uses labeled datasets to train algorithms.",\n        "importance": "high"\n      }\n    ]\n  }\n}`;
    const normalized = normalizeNotesContent(mixedInput);
    expect(normalized.title).toBe('Machine Learning');
    expect(normalized.summary).toContain('enables computers to learn from data');
    expect(normalized.keyPoints).toHaveLength(1);
    expect(normalized.keyPoints[0].heading).toBe('Supervised Learning');
    expect(normalized.keyPoints[0].content).not.toContain('"notes":');
  });
});
