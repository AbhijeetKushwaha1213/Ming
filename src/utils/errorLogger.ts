/**
 * Centralized error logging utility
 * Provides consistent error logging across the application
 */

export interface ErrorLogContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an error with context
 */
export function logError(error: Error | unknown, context?: ErrorLogContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', {
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // Production error tracking
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
    // Example:
    // Sentry.captureException(error, {
    //   tags: {
    //     component: context?.component,
    //     action: context?.action,
    //   },
    //   user: context?.userId ? { id: context.userId } : undefined,
    //   extra: context?.metadata,
    // });
  }

  // Store in local storage for debugging (last 10 errors)
  try {
    const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
    storedErrors.unshift({
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('app_errors', JSON.stringify(storedErrors.slice(0, 10)));
  } catch (storageError) {
    // Ignore storage errors
    console.warn('Failed to store error in localStorage:', storageError);
  }
}

/**
 * Log a warning (non-critical error)
 */
export function logWarning(message: string, context?: ErrorLogContext): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Warning:', message, context);
  }

  // Production warning tracking
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to monitoring service
  }
}

/**
 * Clear stored error logs
 */
export function clearErrorLogs(): void {
  try {
    localStorage.removeItem('app_errors');
  } catch (error) {
    console.warn('Failed to clear error logs:', error);
  }
}

/**
 * Get stored error logs for debugging
 */
export function getErrorLogs(): any[] {
  try {
    return JSON.parse(localStorage.getItem('app_errors') || '[]');
  } catch (error) {
    console.warn('Failed to retrieve error logs:', error);
    return [];
  }
}
