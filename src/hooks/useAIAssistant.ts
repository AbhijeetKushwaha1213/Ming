
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateAIInput, sanitizeHtml, checkRateLimit, createSafeError } from '@/lib/security';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';
import { geminiClient } from '@/utils/geminiClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useAIAssistant = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { monitorAIPrompt } = useSecurityMonitor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string, subject?: string) => {
    if (!message.trim()) return;

    try {
      // Validate and sanitize input
      const validatedMessage = validateAIInput(message);
      
      // Security monitoring for suspicious prompts
      if (!monitorAIPrompt(validatedMessage)) {
        return; // Block suspicious prompts
      }
      
      const sanitizedMessage = sanitizeHtml(validatedMessage);
      
      // Rate limiting - max 20 messages per minute per user
      const userId = user?.user_id || 'anonymous';
      if (!checkRateLimit(`ai_chat_${userId}`, 20, 60000)) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Please wait before sending another message.",
          variant: "destructive",
        });
        return;
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: sanitizedMessage,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      const context = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: sanitizeHtml(msg.content)
      }));

      let responseText = '';
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            message: sanitizedMessage,
            context,
            userType: user?.userType || 'exam',
            subject: subject ? sanitizeHtml(subject) : undefined
          }
        });

        if (error) throw error;
        responseText = data.response;
      } catch (invokeError) {
        console.warn('Supabase edge function invoke failed, falling back to direct Gemini API call:', invokeError);
        const directRes = await geminiClient.generateContent({
          message: sanitizedMessage,
          context,
          userType: user?.userType || 'exam',
          subject: subject ? sanitizeHtml(subject) : undefined
        });
        if (directRes.error) {
          throw new Error(`${directRes.error}: ${directRes.details || ''}`);
        }
        responseText = directRes.response;
      }

      // Sanitize AI response before displaying
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: sanitizeHtml(responseText || 'No response received'),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const safeError = createSafeError(
        error instanceof Error ? error.message : 'Unknown error',
        'AI_CHAT_ERROR'
      );
      
      toast({
        title: "Error",
        description: safeError.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateContent = async (contentType: string, topic: string, difficulty: string, count: number, subject?: string) => {
    setIsLoading(true);
    
    try {
      // Validate inputs
      const validatedTopic = validateAIInput(topic);
      
      // Security monitoring for suspicious prompts
      if (!monitorAIPrompt(validatedTopic)) {
        return null; // Block suspicious prompts
      }
      
      const sanitizedTopic = sanitizeHtml(validatedTopic);
      
      // Rate limiting - max 10 content generations per hour per user
      const userId = user?.user_id || 'anonymous';
      if (!checkRateLimit(`ai_generate_${userId}`, 10, 3600000)) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Please wait before generating more content.",
          variant: "destructive",
        });
        return null;
      }

      // Validate count and difficulty
      const validCount = Math.max(1, Math.min(count, 20)); // Limit to max 20 items
      const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
      const validContentType = ['flashcards', 'mindmaps', 'quizzes', 'summaries'].includes(contentType) ? contentType : 'flashcards';

      let responseText = '';
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            message: sanitizedTopic,
            contentType: validContentType,
            topic: sanitizedTopic,
            difficulty: validDifficulty,
            count: validCount,
            subject: subject ? sanitizeHtml(subject) : undefined,
            userType: user?.userType || 'exam'
          }
        });

        if (error) throw error;
        responseText = data.response;
      } catch (invokeError) {
        console.warn('Supabase edge function invoke failed, falling back to direct Gemini API call:', invokeError);
        const directRes = await geminiClient.generateContent({
          message: sanitizedTopic,
          contentType: validContentType,
          topic: sanitizedTopic,
          difficulty: validDifficulty,
          count: validCount,
          subject: subject ? sanitizeHtml(subject) : undefined,
          userType: user?.userType || 'exam'
        });
        if (directRes.error) {
          throw new Error(`${directRes.error}: ${directRes.details || ''}`);
        }
        responseText = directRes.response;
      }

      // Parse and sanitize the AI response
      let parsedContent;
      try {
        const jsonMatch = responseText.match(/```json\n?(.*?)\n?```/s) || 
                         responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          parsedContent = JSON.parse(responseText);
        }
        
        // Sanitize all text content in the parsed response
        parsedContent = sanitizeContentRecursively(parsedContent);
        
      } catch (parseError) {
        // Fallback: create structured content from text response
        parsedContent = createFallbackContent(validContentType, sanitizeHtml(responseText), sanitizedTopic, validDifficulty, validCount);
      }

      return parsedContent;
    } catch (error) {
      const safeError = createSafeError(
        error instanceof Error ? error.message : 'Content generation failed',
        'AI_GENERATE_ERROR'
      );
      
      toast({
        title: "Generation Failed",
        description: safeError.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitizeContentRecursively = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeHtml(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeContentRecursively);
    }
    if (obj && typeof obj === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeContentRecursively(value);
      }
      return sanitized;
    }
    return obj;
  };

  const createFallbackContent = (contentType: string, response: string, topic: string, difficulty: string, count: number) => {
    // Create fallback structured content if AI doesn't return proper JSON
    switch (contentType) {
      case 'flashcards':
        return {
          flashcards: Array.from({ length: count }, (_, i) => ({
            question: `What is the key concept ${i + 1} about ${topic}?`,
            answer: `This is a detailed answer about ${topic} concept ${i + 1}.`,
            hint: `Remember the importance of ${topic} in this context.`
          }))
        };
      case 'mindmaps':
        return {
          mindmap: {
            central_topic: topic,
            branches: [
              {
                title: `Main Concept`,
                subtopics: [`Subtopic 1`, `Subtopic 2`],
                details: `Key aspects of ${topic}`
              }
            ]
          }
        };
      case 'quizzes':
        return {
          quiz: Array.from({ length: count }, (_, i) => ({
            question: `Quiz question ${i + 1} about ${topic}?`,
            options: [`Option A`, `Option B`, `Option C`, `Option D`],
            correct_answer: 0,
            explanation: `Explanation for question ${i + 1} about ${topic}.`
          }))
        };
      default:
        return { content: response };
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return {
    messages,
    sendMessage,
    generateContent,
    clearChat,
    isLoading,
  };
};
