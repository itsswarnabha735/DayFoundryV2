import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';

interface LoadingTimeoutProps {
  isLoading: boolean;
  timeoutMs?: number;
  onTimeout?: () => void;
  onRetry?: () => void;
  loadingMessage?: string;
  timeoutMessage?: string;
  children?: React.ReactNode;
}

export function LoadingTimeout({
  isLoading,
  timeoutMs = 30000, // 30 seconds default
  onTimeout,
  onRetry,
  loadingMessage = 'Loading...',
  timeoutMessage = 'This is taking longer than expected.',
  children
}: LoadingTimeoutProps) {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false);
      setTimeElapsed(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeElapsed(elapsed);

      if (elapsed >= timeoutMs && !hasTimedOut) {
        setHasTimedOut(true);
        onTimeout?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, timeoutMs, hasTimedOut, onTimeout]);

  if (!isLoading) {
    return children ? <>{children}</> : null;
  }

  const progressPercentage = Math.min((timeElapsed / timeoutMs) * 100, 100);
  const remainingSeconds = Math.max(0, Math.ceil((timeoutMs - timeElapsed) / 1000));

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <div className="relative">
        <Loader2 
          size={48} 
          className="animate-spin" 
          style={{ color: 'var(--df-primary)' }} 
        />
        
        {/* Progress ring */}
        <svg 
          className="absolute inset-0 -rotate-90" 
          width="48" 
          height="48" 
          viewBox="0 0 48 48"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="var(--df-border)"
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="var(--df-primary)"
            strokeWidth="2"
            strokeDasharray="125.6"
            strokeDashoffset={125.6 - (125.6 * progressPercentage) / 100}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <p 
          style={{
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            color: 'var(--df-text)'
          }}
        >
          {loadingMessage}
        </p>
        
        {timeElapsed > 5000 && !hasTimedOut && (
          <p 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            {remainingSeconds > 0 
              ? `Timeout in ${remainingSeconds}s`
              : 'Almost there...'
            }
          </p>
        )}
      </div>

      {hasTimedOut && (
        <Alert 
          className="max-w-md"
          style={{ 
            backgroundColor: 'var(--df-surface-alt)', 
            borderColor: 'var(--df-warning)' 
          }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--df-warning)' }} />
          <AlertDescription style={{ color: 'var(--df-text)' }}>
            {timeoutMessage}
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="ml-2"
                style={{ minHeight: '32px' }}
              >
                <RefreshCw size={14} className="mr-1" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {children}
    </div>
  );
}

// Hook for managing loading timeout state
export function useLoadingTimeout(timeoutMs = 30000) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLoading = () => {
    setIsLoading(true);
    setHasTimedOut(false);
    setError(null);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setHasTimedOut(false);
    setError(null);
  };

  const handleTimeout = () => {
    setHasTimedOut(true);
    setError('Operation timed out');
  };

  const handleError = (error: string) => {
    setIsLoading(false);
    setError(error);
  };

  return {
    isLoading,
    hasTimedOut,
    error,
    startLoading,
    stopLoading,
    handleTimeout,
    handleError
  };
}