import { AlertCircle } from 'lucide-react';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="max-w-md w-full">
            <div className="card bg-red-50 border-error text-center animate-fade-in">
              <div className="flex flex-col items-center gap-md">
                <AlertCircle className="text-error" size={48} aria-hidden="true" />
                <div>
                  <h1 className="text-xl font-bold text-error mb-sm">Something went wrong</h1>
                  <p className="text-sm text-text-secondary mb-md">
                    {this.state.error?.message || 'An unexpected error occurred'}
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="text-left mt-md">
                      <summary className="cursor-pointer text-sm font-medium text-error hover:underline">
                        Error details
                      </summary>
                      <pre className="mt-sm p-sm bg-white rounded text-xs overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="mt-md btn btn-primary"
                    aria-label="Return to home page"
                  >
                    Return to Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
