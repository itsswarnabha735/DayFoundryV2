import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const isTimeoutError = error?.message.includes('timed out') || error?.message.includes('timeout');
      const isNetworkError = error?.message.includes('Failed to fetch') || error?.message.includes('Network Error');

      return (
        <div 
          className="min-h-screen flex flex-col items-center justify-center p-4"
          style={{ backgroundColor: 'var(--df-surface)' }}
        >
          <div className="max-w-md w-full space-y-4">
            <div className="text-center">
              <AlertTriangle 
                size={48} 
                className="mx-auto mb-4" 
                style={{ color: 'var(--df-danger)' }} 
              />
              <h1 
                className="mb-2"
                style={{
                  fontSize: 'var(--df-type-title-size)',
                  fontWeight: 'var(--df-type-title-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Something went wrong
              </h1>
              <p 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text-muted)',
                  marginBottom: '16px'
                }}
              >
                {isTimeoutError 
                  ? "The request took too long to complete. This might be due to a slow network connection or server issue."
                  : isNetworkError
                    ? "Unable to connect to the server. Please check your internet connection."
                    : "An unexpected error occurred while loading the application."
                }
              </p>
            </div>

            <Alert style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription style={{ color: 'var(--df-text)' }}>
                <strong>Error:</strong> {error?.message || 'Unknown error'}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col space-y-2">
              <Button
                onClick={this.handleRetry}
                style={{
                  backgroundColor: 'var(--df-primary)',
                  color: 'var(--df-primary-contrast)',
                  minHeight: '44px'
                }}
              >
                <RefreshCw size={20} className="mr-2" />
                Try Again
              </Button>
              
              <Button
                variant="outline"
                onClick={this.handleReload}
                style={{ minHeight: '44px' }}
              >
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4">
                <summary 
                  className="cursor-pointer mb-2"
                  style={{ 
                    color: 'var(--df-text-muted)',
                    fontSize: 'var(--df-type-caption-size)'
                  }}
                >
                  Technical Details
                </summary>
                <pre 
                  className="text-xs p-3 rounded border overflow-auto"
                  style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    borderColor: 'var(--df-border)',
                    color: 'var(--df-text-muted)',
                    fontSize: '12px'
                  }}
                >
                  {error.stack}
                  {this.state.errorInfo && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      console.error('Error handled by useErrorHandler:', error);
      // You could also report to an error tracking service here
    }
  }, [error]);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}

// Higher-order component wrapper
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}