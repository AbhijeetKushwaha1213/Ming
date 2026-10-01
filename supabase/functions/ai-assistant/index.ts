
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, userType, subject, contentType, topic, difficulty, count } = await req.json();

    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Enhanced system prompts for different content types with strict topic anchoring
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
      "options": ["Option A about ${topic || message}", "Option B about ${topic || message}", "Option C about ${topic || message}", "Option D about ${topic || message}"],
      "correct_answer": 0,
      "explanation": "Why this answer is correct, focusing ONLY on ${topic || message}"
    }
  ]
}

Rules:
- Questions should test understanding and application of ${topic || message} ONLY
- Always provide exactly 4 options, ALL related to ${topic || message}
- correct_answer is the index (0-3) of the correct option
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

    const systemPrompt = contentType ? getSystemPrompt(contentType) : 
      `You are a helpful AI study assistant focused ONLY on the specific topic provided by the user. 
      
      CRITICAL: Only discuss topics directly related to: "${topic || message}"
      
      You specialize in helping with:
      - Study planning and organization for the specific topic
      - Explaining concepts ONLY related to the given topic
      - Creating practice questions ONLY about the given topic
      - Providing study tips ONLY for the specific subject area
      
      Be encouraging, concise, and educational. Always stay focused on the specific topic provided.`;

    const userPrompt = contentType ? 
      `Topic: ${topic || message}
      Difficulty Level: ${difficulty || 'medium'}
      Subject Context: ${subject || 'general'}
      
      Generate ${contentType} content STRICTLY for "${topic || message}" ONLY. Focus exclusively on the provided topic and ensure all content is accurate, relevant, and directly related to "${topic || message}". DO NOT include any concepts from other subjects or unrelated topics.` 
      : message;

    // Gemini uses a different message format
    const geminiPrompt = `${systemPrompt}\n\nUser Request:\n${userPrompt}`;

    console.log('Calling Gemini API with enhanced topic-focused prompts for:', contentType, 'Topic:', topic || message);

    // Gemini API endpoint - using gemini-1.5-flash (stable, reliable model)
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    
    console.log('Gemini endpoint:', geminiEndpoint.replace(geminiApiKey, 'API_KEY_HIDDEN'));

    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: geminiPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 10
        }
      }),
    });

    console.log('Gemini API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', response.status, errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
    
    // Clean up the response - remove markdown code blocks if present
    if (aiResponse.includes('```json')) {
      aiResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (aiResponse.includes('```')) {
      aiResponse = aiResponse.replace(/```\s*/g, '');
    }
    
    // Trim whitespace
    aiResponse = aiResponse.trim();

    console.log('AI response generated successfully for topic:', topic || message);

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-assistant function:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to process request';
    let errorDetails = error.message;
    
    if (error.message?.includes('API key')) {
      errorMessage = 'Gemini API key not configured';
      errorDetails = 'Please add GEMINI_API_KEY to Supabase secrets. See GEMINI_SETUP.md for instructions.';
    } else if (error.message?.includes('429')) {
      errorMessage = 'Rate limit exceeded';
      errorDetails = 'Gemini free tier allows 15 requests per minute. Please wait and try again.';
    } else if (error.message?.includes('400')) {
      errorMessage = 'Invalid request';
      errorDetails = 'The request format may be incorrect. Check the Gemini API documentation.';
    } else if (error.message?.includes('403')) {
      errorMessage = 'API key invalid or unauthorized';
      errorDetails = 'Please check your Gemini API key is valid and has the correct permissions.';
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
