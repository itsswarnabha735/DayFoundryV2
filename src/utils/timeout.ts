/**
 * Utility functions for handling timeouts and preventing hanging requests
 */

export interface TimeoutOptions {
  timeoutMs?: number;
  timeoutMessage?: string;
}

/**
 * Creates a promise that rejects after a specified timeout
 */
export function createTimeoutPromise(timeoutMs: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Wraps a promise with a timeout, rejecting if it takes too long
 */
export async function withTimeout<T>(
  promise: Promise<T>, 
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, timeoutMessage } = options;
  
  return Promise.race([
    promise,
    createTimeoutPromise(timeoutMs, timeoutMessage)
  ]);
}

/**
 * Creates a fetch wrapper with built-in timeout and retry logic
 */
export async function fetchWithTimeout(
  url: string, 
  options: RequestInit & TimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 15000, timeoutMessage, ...fetchOptions } = options;
  
  // Create an AbortController for the fetch request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMessage || `Request timed out after ${timeoutMs}ms`);
    }
    
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2
  } = options;

  let lastError: Error;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry certain errors
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.includes('404')
      )) {
        break;
      }

      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Increase delay for next attempt
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Debounce function to prevent rapid successive calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), waitMs);
  };
}

/**
 * Creates a cache that expires after a specified time
 */
export class TimedCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 300000) { // 5 minutes default
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const expires = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { value, expires });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean up expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
    
    return this.cache.size;
  }
}

/**
 * Circuit breaker pattern to prevent cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private options: {
      failureThreshold?: number;
      recoveryTimeMs?: number;
      timeoutMs?: number;
    } = {}
  ) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeMs: 60000, // 1 minute
      timeoutMs: 30000, // 30 seconds
      ...options
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.options.recoveryTimeMs!) {
        throw new Error('Circuit breaker is open');
      } else {
        this.state = 'half-open';
      }
    }

    try {
      const result = await withTimeout(operation(), { 
        timeoutMs: this.options.timeoutMs 
      });
      
      // Success - reset the circuit breaker
      this.failures = 0;
      this.state = 'closed';
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.options.failureThreshold!) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}