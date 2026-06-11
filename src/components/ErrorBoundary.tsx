import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches React rendering errors and shows a fallback UI
 * instead of crashing the entire app.
 */
class ErrorBoundary extends Component<Props, State> {
  declare state: State;
  declare props: Props & { children?: ReactNode };

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Buzz Pilot ErrorBoundary]', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-3xl border border-[#e8e5df] p-8 shadow-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#fdeef2] flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#1a1814] font-['Syne'] mb-2">
              Terjadi Kesalahan
            </h2>
            <p className="text-sm text-[#5a5650] mb-6">
              Maaf, aplikasi mengalami error yang tidak terduga. Silakan muat ulang halaman.
            </p>
            <div className="bg-[#fdeef2] border border-[#f4b0bf] rounded-xl p-3 mb-6 text-left">
              <p className="text-[11px] font-mono text-[#e8476a] break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#1a1814] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-neutral-800 transition-all"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
