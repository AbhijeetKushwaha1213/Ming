import { supabase } from '@/integrations/supabase/client';

export interface GeminiRequest {
  message: string;
  context?: { role: string; content: string }[];
  userType?: string;
  subject?: string;
  contentType?: string;
  topic?: string;
  difficulty?: string;
  count?: number;
  systemPrompt?: string;
  inlineData?: { mimeType: string; data: string };
  groundedContext?: string;
  sourceTitle?: string;
}

export interface GeminiResponse {
  response: string;
  error?: string;
  details?: string;
}

export const geminiClient = {
  async generateContent(req: GeminiRequest): Promise<GeminiResponse> {
    const customLocalKey = typeof window !== 'undefined' ? localStorage.getItem('ming_gemini_api_key') : null;
    const { message, context, userType, subject, contentType, topic, difficulty, count } = req;

    // System Prompts matching the Deno Edge Function
    const getSystemPrompt = (type: string) => {
      const basePrompt = `You are an expert educational content creator. 

CRITICAL RULES:
1. ONLY generate content DIRECTLY related to the specific topic provided
2. DO NOT include unrelated concepts, subjects, or tangential information
3. If the topic is "Algebra", ONLY include basic algebraic concepts (variables, equations, expressions)
4. If the topic is "Photosynthesis", ONLY include photosynthesis-related processes
5. NEVER hallucinate or add content beyond the scope of the given topic
6. Stay focused and accurate - quality over quantity

TOPIC CONSTRAINT: All content must be directly relevant to: "${topic || message}"`;
      
      switch (type) {
        case 'flashcards':
          return `${basePrompt}

Create flashcards in this EXACT JSON format:
{
  "flashcards": [
    {
      "question": "Clear, specific question ONLY about ${topic || message}",
      "answer": "Comprehensive but concise answer (2-3 sentences max) ONLY about ${topic || message}",
      "hint": "Optional helpful hint or memory aid ONLY about ${topic || message}"
    }
  ]
}

Rules:
- Focus ONLY on key concepts directly related to ${topic || message}
- Questions should test understanding of ${topic || message} specifically
- Answers must be factual and to-the-point about ${topic || message}
- Include hints for complex concepts within ${topic || message}
- Generate exactly ${count || 5} flashcards
- DO NOT include concepts from other subjects or topics`;

        case 'mindmaps':
          return `${basePrompt}

Create a mind map in this EXACT JSON format:
{
  "mindmap": {
    "central_topic": "${topic || message}",
    "branches": [
      {
        "title": "Main branch ONLY related to ${topic || message}",
        "subtopics": [
          "Subtopic 1 about ${topic || message}",
          "Subtopic 2 about ${topic || message}"
        ],
        "details": "Brief explanation ONLY about ${topic || message}"
      }
    ]
  }
}

Rules:
- Central topic must be exactly "${topic || message}"
- Create 3-5 main branches maximum, ALL related to ${topic || message}
- Each branch should have 2-4 subtopics ONLY about ${topic || message}
- Keep subtopics concise (1-3 words) and relevant to ${topic || message}
- Details should explain connection to ${topic || message} only`;

        case 'quizzes':
          return `${basePrompt}

Create quiz questions in this EXACT JSON format:
{
  "quiz": [
    {
      "question": "Clear, specific question ONLY about ${topic || message}",
      "options": ["Plausible distractor 1 about ${topic || message}", "Plausible distractor 2 about ${topic || message}", "Accurate correct answer about ${topic || message}", "Plausible distractor 3 about ${topic || message}"],
      "correct_answer": 2,
      "explanation": "Why this answer is correct, focusing ONLY on ${topic || message}"
    }
  ]
}

Rules:
- Questions should test understanding and application of ${topic || message} ONLY
- Always provide exactly 4 options, ALL related to ${topic || message}
- CRITICAL: Randomize the placement of the correct answer across indices 0, 1, 2, and 3. DO NOT always make the first option (index 0) the correct answer. Distribute correct answers across all positions.
- correct_answer is the integer index (0-3) of the correct option
- Explanations must be educational and focused on ${topic || message}
- Generate exactly ${count || 5} questions
- DO NOT include questions about unrelated topics`;

        case 'diagrams':
          return `${basePrompt}

Create diagram descriptions in this EXACT JSON format:
{
  "diagram": {
    "title": "Diagram title for ${topic || message}",
    "type": "flowchart|hierarchy|process|concept",
    "components": [
      {
        "id": "component1",
        "label": "Component name related to ${topic || message}",
        "description": "What this represents in ${topic || message}"
      }
    ],
    "connections": [
      {
        "from": "component1",
        "to": "component2",
        "relationship": "leads to|part of|causes|connects to"
      }
    ]
  }
}

Rules:
- Create clear, logical flow or hierarchy for ${topic || message} ONLY
- Components should be key elements of ${topic || message}
- Connections must show relationships within ${topic || message}
- Keep labels concise but descriptive about ${topic || message}`;

        case 'notes':
          return `${basePrompt}

Create revision notes in this EXACT JSON format:
{
  "notes": {
    "title": "${topic || message}",
    "summary": "Brief 1-2 sentence overview of ${topic || message}",
    "key_points": [
      {
        "heading": "Main point heading about ${topic || message}",
        "content": "Detailed explanation about ${topic || message}",
        "importance": "high|medium|low"
      }
    ],
    "formulas": [
      {
        "name": "Formula name related to ${topic || message}",
        "formula": "Mathematical expression for ${topic || message}",
        "explanation": "When and how to use in ${topic || message}"
      }
    ],
    "quick_facts": [
      "Important fact 1 about ${topic || message}",
      "Important fact 2 about ${topic || message}"
    ]
  }
}

Rules:
- Start with clear overview of ${topic || message}
- 5-8 key points maximum, ALL about ${topic || message}
- Include relevant formulas ONLY if applicable to ${topic || message}
- Quick facts should be memorable points about ${topic || message}
- Use student-friendly language focused on ${topic || message}`;

        default:
          return `${basePrompt} Provide helpful, accurate information ONLY about ${topic || message}.`;
      }
    };

    const effectiveSystemPrompt = req.systemPrompt || (contentType ? getSystemPrompt(contentType) : 
      `You are Ming AI, an expert, versatile, and friendly educational AI study assistant and workspace orchestrator.
      
      You help students with:
      - Answering academic, educational, and general knowledge questions clearly and accurately
      - Explaining complex concepts in intuitive, easy-to-understand ways with helpful examples
      - Providing study advice, exam preparation tips, summaries, and practice problems
      - Organizing notes, files, resources, and vault materials
      
      Always be helpful, encouraging, accurate, and concise. Format key points cleanly with markdown.`);

    let userPrompt = contentType ? 
      `Topic: ${topic || message}
      Difficulty Level: ${difficulty || 'medium'}
      Subject Context: ${subject || 'general'}
      
      Generate ${contentType} content STRICTLY for "${topic || message}" ONLY. Focus exclusively on the provided topic and ensure all content is accurate, relevant, and directly related to "${topic || message}". DO NOT include any concepts from other subjects or unrelated topics.` 
      : (topic && topic !== 'General' && !['hy', 'hi', 'hello', 'hey'].includes(topic.toLowerCase().trim()) ? `[Context Topic: ${topic}]\n${message}` : message);

    if (req.groundedContext && req.groundedContext.trim()) {
      userPrompt += `\n\n=== VERIFIED GROUNDED COURSE SOURCE MATERIAL (${req.sourceTitle || 'Selected Course Resource'}) ===\n${req.groundedContext}\n=======================================================\nCRITICAL GROUNDING REQUIREMENT: All generated ${contentType || 'study material'} (questions, answers, branches, formulas, key points) MUST be strictly grounded in, derived from, and faithful to the provided course source material above. Do not invent facts or concepts not found in this material.`;
    }

    const historyParts = context && context.length > 0 
      ? "\n\nConversation History:\n" + context.map(c => `${c.role === 'user' ? 'User' : 'Assistant'}: ${c.content}`).join("\n") + "\n"
      : "";
    const geminiPrompt = `${effectiveSystemPrompt}${historyParts}\nUser Request:\n${userPrompt}`;

    const promptParts: any[] = [{ text: geminiPrompt }];
    if (req.inlineData && req.inlineData.data) {
      promptParts.push({
        inline_data: {
          mime_type: req.inlineData.mimeType,
          data: req.inlineData.data
        }
      });
    }

    const callDirectGemini = async (): Promise<GeminiResponse> => {
      const clientEnvKey =
        (typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_GEMINI_API_KEY || (import.meta.env as any).GEMINI_API_KEY) : null) ||
        (typeof process !== 'undefined' ? (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY) : null);
      const directKey = (customLocalKey || clientEnvKey || '').trim().replace(/^["']|["']$/g, '');

      if (!directKey) {
        return {
          response: '',
          error: 'No Gemini API key configured',
          details: 'Please set VITE_GEMINI_API_KEY in your environment or provide a custom key in settings.',
        };
      }

      const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest'];
      let lastErrorStatus = 0;
      let lastErrorText = '';

      for (const model of candidateModels) {
        try {
          const directEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${directKey}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 35000);
          const directRes = await fetch(directEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: promptParts }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                topP: 0.8,
                ...(contentType && ['notes', 'flashcards', 'quizzes', 'mindmaps'].includes(contentType)
                  ? { responseMimeType: 'application/json' }
                  : {}),
              },
            }),
          });
          clearTimeout(timer);

          if (!directRes.ok) {
            lastErrorStatus = directRes.status;
            lastErrorText = await directRes.text();
            const isQuotaExceeded =
              directRes.status === 429 ||
              lastErrorText.includes('RESOURCE_EXHAUSTED') ||
              lastErrorText.toLowerCase().includes('quota') ||
              lastErrorText.toLowerCase().includes('rate limit');

            if (isQuotaExceeded && typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('gemini-quota-exceeded', {
                  detail: {
                    status: directRes.status,
                    message: "You've hit your daily Gemini API quota limit. Please wait or use a custom API key.",
                    details: lastErrorText,
                  },
                }),
              );
            }
            continue;
          }

          const directData = await directRes.json();
          let directAiResponse = directData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

          if (contentType && directAiResponse) {
            if (directAiResponse.includes('```json')) {
              directAiResponse = directAiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            } else if (directAiResponse.includes('```')) {
              directAiResponse = directAiResponse.replace(/```\s*/g, '');
            }
          }

          return { response: directAiResponse.trim() };
        } catch (directErr) {
          lastErrorText = directErr instanceof Error ? directErr.message : String(directErr);
        }
      }

      return {
        response: '',
        error: lastErrorStatus === 429 ? 'Gemini API Quota Exceeded (HTTP 429)' : `Gemini API Error (${lastErrorStatus || 500})`,
        details: lastErrorText || 'Failed to generate response across candidate models.',
      };
    };

    try {
      const apiEndpoint = typeof window !== 'undefined' ? '/api/ai/generate' : 'http://127.0.0.1:3001/api/ai/generate';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 600)
        );
        const { data } = (await Promise.race([sessionPromise, timeoutPromise])) as any;
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      } catch {
        // Fallback for non-browser, offline, or test execution
      }

      if (customLocalKey) {
        headers['x-custom-api-key'] = customLocalKey;
      }

      let backendErrorResponse: GeminiResponse | null = null;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 35000);
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            message,
            context,
            userType,
            subject,
            contentType,
            topic,
            difficulty,
            count,
            systemPrompt: effectiveSystemPrompt,
            promptParts,
            inlineData: req.inlineData,
            groundedContext: req.groundedContext,
            sourceTitle: req.sourceTitle,
          }),
        });
        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json();
          let aiResponse = data.response || data.content || "I'm sorry, I couldn't generate a response.";

          if (contentType) {
            if (aiResponse.includes('```json')) {
              aiResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            } else if (aiResponse.includes('```')) {
              aiResponse = aiResponse.replace(/```\s*/g, '');
            }
          }

          return { response: aiResponse.trim() };
        } else {
          const errorText = await response.text();
          const isQuotaExceeded =
            response.status === 429 ||
            errorText.includes('RESOURCE_EXHAUSTED') ||
            errorText.toLowerCase().includes('quota') ||
            errorText.toLowerCase().includes('rate limit');

          if (isQuotaExceeded && typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gemini-quota-exceeded', {
                detail: {
                  status: response.status,
                  message: "You've hit your daily Gemini API quota limit. Please wait or use a custom API key.",
                  details: errorText,
                },
              }),
            );
          }

          backendErrorResponse = {
            response: '',
            error: isQuotaExceeded ? 'Gemini API Quota Exceeded (HTTP 429)' : `AI Gateway Error (${response.status})`,
            details: errorText,
          };
        }
      } catch (fetchErr) {
        console.warn('Backend /api/ai/generate unreachable, falling back to direct client-side Gemini:', fetchErr);
      }

      // Backend gateway was unreachable or returned an error; execute client-side direct fallback
      const directFallback = await callDirectGemini();
      if (directFallback.response) {
        return directFallback;
      }

      // If direct fallback failed but backend gave a specific quota error, preserve quota error
      return backendErrorResponse || directFallback;
    } catch (error) {
      console.error('Error calling AI Gateway:', error);
      return {
        response: '',
        error: error instanceof Error ? error.message : 'Failed to generate AI content',
        details: 'Both backend gateway and direct client fallback failed.',
      };
    }
  }
};
