/**
 * Global error handling utilities
 */

export interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
}

class GlobalErrorHandler {
  private listeners: ((error: ErrorReport) => void)[] = [];
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      const error: ErrorReport = {
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: new Date(),
        userAgent: navigator.userAgent
      };

      this.reportError(error);
      
      // Prevent the default browser behavior
      event.preventDefault();
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('JavaScript error:', event.error);
      
      const error: ErrorReport = {
        message: event.message || 'JavaScript error',
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        timestamp: new Date(),
        userAgent: navigator.userAgent
      };

      this.reportError(error);
    });

    // Handle fetch errors (for network timeouts)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Log slow requests
        if (response.headers.get('x-response-time')) {
          const responseTime = parseInt(response.headers.get('x-response-time') || '0');
          if (responseTime > 10000) { // 10 seconds
            console.warn(`Slow request detected: ${args[0]} took ${responseTime}ms`);
          }
        }
        
        return response;
      } catch (error) {
        // Log fetch errors with more context
        console.error('Fetch error:', {
          url: args[0],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        const errorReport: ErrorReport = {
          message: `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stack: error instanceof Error ? error.stack : undefined,
          url: typeof args[0] === 'string' ? args[0] : window.location.href,
          timestamp: new Date(),
          userAgent: navigator.userAgent
        };

        this.reportError(errorReport);
        
        throw error;
      }
    };

    this.isInitialized = true;
    console.log('Global error handler initialized');
  }

  addListener(callback: (error: ErrorReport) => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: (error: ErrorReport) => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  reportError(error: ErrorReport) {
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });

    // Store in local storage for debugging
    this.storeErrorLocally(error);
  }

  private storeErrorLocally(error: ErrorReport) {
    try {
      const stored = JSON.parse(localStorage.getItem('df-error-log') || '[]');
      stored.push(error);
      
      // Keep only last 10 errors
      if (stored.length > 10) {
        stored.splice(0, stored.length - 10);
      }
      
      localStorage.setItem('df-error-log', JSON.stringify(stored));
    } catch (err) {
      console.error('Failed to store error locally:', err);
    }
  }

  getStoredErrors(): ErrorReport[] {
    try {
      return JSON.parse(localStorage.getItem('df-error-log') || '[]');
    } catch {
      return [];
    }
  }

  clearStoredErrors() {
    try {
      localStorage.removeItem('df-error-log');
    } catch (err) {
      console.error('Failed to clear stored errors:', err);
    }
  }
}

// Singleton instance
export const globalErrorHandler = new GlobalErrorHandler();

// Utility function to safely execute async operations
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Safe async operation failed${context ? ` (${context})` : ''}:`, error);
    
    globalErrorHandler.reportError({
      message: `Safe async failure${context ? ` in ${context}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stack: error instanceof Error ? error.stack : undefined,
      url: window.location.href,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    });
    
    return fallback;
  }
}

// Utility to wrap functions with error handling
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context?: string
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      
      // Handle promise returns
      if (result && typeof result.then === 'function') {
        return result.catch((error: Error) => {
          console.error(`Error in ${context || fn.name}:`, error);
          globalErrorHandler.reportError({
            message: `${context || fn.name} failed: ${error.message}`,
            stack: error.stack,
            url: window.location.href,
            timestamp: new Date(),
            userAgent: navigator.userAgent
          });
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Error in ${context || fn.name}:`, error);
      globalErrorHandler.reportError({
        message: `${context || fn.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
        timestamp: new Date(),
        userAgent: navigator.userAgent
      });
      throw error;
    }
  }) as T;
}

// Initialize error handling when this module is imported
if (typeof window !== 'undefined') {
  // Delay initialization to avoid blocking the main thread
  setTimeout(() => {
    globalErrorHandler.initialize();
  }, 100);
}