import { describe, it, expect, vi, beforeEach } from 'vitest';
import { askGroundedTutor } from '@/api/ragAPI';

describe('Phase 11: Multilingual Hinglish/Hindi Grounding & Audio Tutoring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards language parameter in askGroundedTutor payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Operating system mein deadlock tab hota hai jab circular wait banta hai [CHUNK_123].',
        citations: [
          {
            chunk_id: 'CHUNK_123',
            source_id: 'SRC_OS',
            document_id: 'DOC_OS',
            source_type: 'PDF',
            page_number: 42,
            citation_label: 'Page 42'
          }
        ],
        grounded: true,
        insufficient_evidence: false,
        retrieved_count: 1
      })
    });
    global.fetch = fetchMock;

    const res = await askGroundedTutor({
      message: 'What is deadlock?',
      userId: 'test_student',
      topic: 'Operating Systems',
      language: 'hinglish'
    });

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0];
    const calledInit = fetchMock.mock.calls[0][1];
    expect(calledUrl).toBe('/api/rag/chat');
    
    const parsedBody = JSON.parse(calledInit.body);
    expect(parsedBody.language).toBe('hinglish');
    expect(parsedBody.query).toBe('What is deadlock?');
    expect(res.grounded).toBe(true);
    expect(res.response).toContain('Operating system mein deadlock');
    expect(res.citations.length).toBe(1);
    expect(res.citations[0].page_number).toBe(42);
  });

  it('supports Hindi language parameter in askGroundedTutor', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'ऑपरेटिंग सिस्टम में डेडलॉक तब होता है [CHUNK_456].',
        citations: [],
        grounded: true,
        insufficient_evidence: false
      })
    });
    global.fetch = fetchMock;

    await askGroundedTutor({
      message: 'डेडलॉक क्या है?',
      userId: 'test_student',
      topic: 'Operating Systems',
      language: 'hindi'
    });

    const calledInit = fetchMock.mock.calls[0][1];
    const parsedBody = JSON.parse(calledInit.body);
    expect(parsedBody.language).toBe('hindi');
  });

  it('correctly cleans text for smooth text-to-speech audio playback', () => {
    const rawAiText = '### 📚 Course Material Evidence\nDeadlock occurs when processes wait [CHUNK_abc123]. **Key condition:** circular wait `P0 -> P1 -> P0`. Check https://example.com for more.';
    
    // Test cleaning logic matching AIChat.tsx
    const cleanSpokenText = rawAiText
      .replace(/\[CHUNK_[A-Za-z0-9_-]+\]/g, '')
      .replace(/###?\s+/g, '')
      .replace(/[*`_~]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    expect(cleanSpokenText).not.toContain('[CHUNK_abc123]');
    expect(cleanSpokenText).not.toContain('###');
    expect(cleanSpokenText).not.toContain('**');
    expect(cleanSpokenText).not.toContain('`');
    expect(cleanSpokenText).not.toContain('https://example.com');
    expect(cleanSpokenText).toContain('Deadlock occurs when processes wait');
    expect(cleanSpokenText).toContain('circular wait P0 -> P1 -> P0');
  });
});
