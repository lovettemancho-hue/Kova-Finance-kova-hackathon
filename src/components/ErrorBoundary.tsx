import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary - ${this.props.sectionName || 'Root'}] Caught error:`, error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const sectionLabel = this.props.sectionName || 'this section';

      return (
        <div
          id={`error-boundary-${this.props.sectionName ? this.props.sectionName.toLowerCase().replace(/\s+/g, '-') : 'general'}`}
          className="w-full h-full min-h-[280px] flex items-center justify-center p-6 text-center"
        >
          <div className="glass-card max-w-md w-full p-6 sm:p-8 rounded-3xl border border-white/15 bg-neutral-950/90 backdrop-blur-2xl text-white space-y-4 shadow-2xl animate-in fade-in duration-300">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 flex items-center justify-center border border-white/15 text-white/80 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">Something went sideways</h3>
              <p className="text-xs text-[#8A8A8E] leading-relaxed max-w-xs mx-auto">
                Take a breath — we can reload {sectionLabel} to get right back on track.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-black bg-white hover:bg-white/90 active:scale-95 transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload {this.props.sectionName || 'View'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
