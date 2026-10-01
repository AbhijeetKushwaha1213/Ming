import { z } from 'zod';

// Input validation schemas
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name too long');

// Content sanitization
export const sanitizeHtml = (content: string): string => {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '');
};

// Rate limiting utility
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimit>();

export const checkRateLimit = (
  identifier: string,
  maxRequests: number,
  windowMs: number
): boolean => {
  const now = Date.now();
  const key = identifier;
  
  const existing = rateLimitStore.get(key);
  
  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (existing.count >= maxRequests) {
    return false;
  }
  
  existing.count++;
  return true;
};

// Input validation for different content types
export const validateFlashcardContent = (content: any) => {
  const schema = z.object({
    question: z.string().min(1, 'Question is required').max(1000, 'Question too long'),
    answer: z.string().min(1, 'Answer is required').max(2000, 'Answer too long'),
    tags: z.array(z.string()).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard'])
  });
  
  return schema.parse(content);
};

export const validateChatMessage = (content: string) => {
  const schema = z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long')
    .refine(msg => !msg.includes('<script'), 'Invalid content detected');
    
  return schema.parse(content);
};

export const validateFileUpload = (file: File) => {
  const allowedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed');
  }
  
  if (file.size > maxSize) {
    throw new Error('File size too large');
  }
  
  return true;
};

// Secure error handling - don't leak sensitive info
export const createSafeError = (message: string, code?: string) => {
  // In production, log the full error but return sanitized version to user
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    message: isDev ? message : 'An error occurred. Please try again.',
    code: code || 'GENERIC_ERROR'
  };
};

// Validate user input for AI content generation
export const validateAIInput = (input: string, maxLength = 5000) => {
  const schema = z.string()
    .min(1, 'Input is required')
    .max(maxLength, 'Input too long')
    .refine(text => {
      // Check for potential prompt injection attempts
      const suspiciousPatterns = [
        /ignore.*previous.*instruction/i,
        /system.*prompt/i,
        /you.*are.*now/i,
        /forget.*everything/i,
        /new.*role/i
      ];
      
      return !suspiciousPatterns.some(pattern => pattern.test(text));
    }, 'Invalid input detected');
    
  return schema.parse(input);
};