import { useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SecurityEvent {
  type: 'failed_auth' | 'suspicious_ai_prompt' | 'file_upload_failure' | 'rate_limit_exceeded' | 'session_timeout_warning';
  userId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export const useSecurityMonitor = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Session timeout warning (30 minutes of inactivity)
  const SESSION_TIMEOUT_WARNING = 30 * 60 * 1000; // 30 minutes
  const SESSION_TIMEOUT_FINAL = 35 * 60 * 1000; // 35 minutes (5 min after warning)

  const logSecurityEvent = useCallback(async (event: SecurityEvent) => {
    try {
      // Log to Supabase notifications table for tracking
      if (user) {
        await supabase
          .from('notifications')
          .insert({
            user_id: user.user_id,
            title: `Security Event: ${event.type}`,
            message: JSON.stringify(event.details),
            type: 'security'
          });
      }
      
      // In production, you might want to send this to an external monitoring service
      console.warn('Security Event:', event);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, [user]);

  // Session timeout management
  useEffect(() => {
    if (!user) return;

    let warningTimer: NodeJS.Timeout;
    let logoutTimer: NodeJS.Timeout;
    let lastActivity = Date.now();

    const resetTimers = () => {
      lastActivity = Date.now();
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);

      // Set warning timer
      warningTimer = setTimeout(() => {
        toast({
          title: "Session Timeout Warning",
          description: "Your session will expire in 5 minutes due to inactivity.",
          variant: "destructive",
        });

        logSecurityEvent({
          type: 'session_timeout_warning',
          userId: user.user_id,
          details: { lastActivity, warning_time: Date.now() },
          timestamp: new Date()
        });
      }, SESSION_TIMEOUT_WARNING);

      // Set logout timer
      logoutTimer = setTimeout(async () => {
        toast({
          title: "Session Expired",
          description: "You have been logged out due to inactivity.",
          variant: "destructive",
        });
        
        await supabase.auth.signOut();
      }, SESSION_TIMEOUT_FINAL);
    };

    const handleActivity = () => {
      resetTimers();
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize timers
    resetTimers();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [user, toast, logSecurityEvent]);

  // Monitor for suspicious AI prompts
  const monitorAIPrompt = useCallback((prompt: string) => {
    const suspiciousPatterns = [
      /ignore.*previous.*instruction/i,
      /system.*prompt/i,
      /you.*are.*now/i,
      /forget.*everything/i,
      /new.*role/i,
      /admin.*access/i,
      /bypass.*security/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(prompt));
    
    if (isSuspicious) {
      logSecurityEvent({
        type: 'suspicious_ai_prompt',
        userId: user?.user_id,
        details: { prompt: prompt.substring(0, 100), detected_patterns: suspiciousPatterns.filter(p => p.test(prompt)).length },
        timestamp: new Date()
      });
      
      toast({
        title: "Suspicious Input Detected",
        description: "Your input contains potentially harmful content and has been blocked.",
        variant: "destructive",
      });
      
      return false; // Block the prompt
    }
    
    return true; // Allow the prompt
  }, [user, logSecurityEvent, toast]);

  // Monitor failed authentication attempts
  const monitorFailedAuth = useCallback((error: string) => {
    logSecurityEvent({
      type: 'failed_auth',
      details: { error, timestamp: Date.now() },
      timestamp: new Date()
    });
  }, [logSecurityEvent]);

  // Monitor file upload failures
  const monitorFileUpload = useCallback((fileName: string, error: string) => {
    logSecurityEvent({
      type: 'file_upload_failure',
      userId: user?.user_id,
      details: { fileName, error, timestamp: Date.now() },
      timestamp: new Date()
    });
  }, [user, logSecurityEvent]);

  return {
    logSecurityEvent,
    monitorAIPrompt,
    monitorFailedAuth,
    monitorFileUpload
  };
};