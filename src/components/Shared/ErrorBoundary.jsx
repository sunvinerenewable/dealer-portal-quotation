import React from 'react';
import { reportCrash } from '../../services/crashReporter.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorDetails = {
      message: error?.message || 'Unknown render error',
      stack: error?.stack?.slice(0, 500),
      componentStack: errorInfo?.componentStack?.slice(0, 300),
      timestamp: new Date().toISOString()
    };

    console.error('[Sunvine Error Boundary Caught]:', errorDetails);

    // Send instant crash alert to Slack
    reportCrash(error, {
      type: 'ReactErrorBoundaryCrash',
      componentStack: errorInfo?.componentStack
    });

    try {
      localStorage.setItem('sunvine_last_error', JSON.stringify(errorDetails));
    } catch (_) {}

    // Auto-recover once on live deployment chunk mismatch
    const isChunkError = error?.message?.includes('dynamically imported module') ||
                         error?.message?.includes('ChunkLoadError') ||
                         error?.message?.includes('Failed to fetch');
    if (isChunkError) {
      const lastAutoReload = sessionStorage.getItem('sunvine_chunk_autoreload');
      const now = Date.now();
      if (!lastAutoReload || now - Number(lastAutoReload) > 15000) {
        sessionStorage.setItem('sunvine_chunk_autoreload', String(now));
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.href = '/';
    }
  };

  handleClearCacheAndRecover = () => {
    try {
      const keysToClear = [
        'sunvine_current_dealer',
        'sunvine_tab',
        'sunvine_preview_quotation',
        'sunvine_last_error',
        'sunvine_db_version'
      ];
      keysToClear.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        }).catch(() => {});
      }
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        }).catch(() => {});
      }
    } catch (_) {}
    window.location.href = '/';
  };

  handleCopyError = () => {
    const errorText = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown'}\n\nStack:\n${this.state.error?.stack || 'No stack'}`;
    navigator.clipboard?.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected application state occurred.';

      return (
        <div className="min-h-screen bg-[#F7F9FF] text-[#181C20] flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8 text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center mb-4 shadow-xs">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>

            <h2 className="text-xl font-bold font-headline text-slate-900 tracking-tight">
              Application Encountered an Issue
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-sm">
              We encountered an unexpected interface error. Your cached quotations and configuration data are safe.
            </p>

            {/* Collapsible Diagnostics Accordion */}
            <div className="w-full mt-4 text-left">
              <button
                type="button"
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 mx-auto py-1 px-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span>{this.state.showDetails ? 'Hide Diagnostics' : 'Show Error Details'}</span>
                <span className="material-symbols-outlined text-[14px]">
                  {this.state.showDetails ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {this.state.showDetails && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800 relative">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-amber-400 font-bold">Diagnostic Log</span>
                    <button
                      type="button"
                      onClick={this.handleCopyError}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-white font-sans cursor-pointer transition-colors"
                    >
                      {this.state.copied ? 'Copied!' : 'Copy Error'}
                    </button>
                  </div>
                  <p className="text-rose-300 font-semibold mb-1">{errorMsg}</p>
                  <pre className="text-slate-400 text-[10px] whitespace-pre-wrap">
                    {this.state.error?.stack || 'No additional stack details'}
                  </pre>
                </div>
              )}
            </div>

            {/* Action Controls */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Return to Home
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#6CBF3D] hover:bg-[#5EAB34] text-white text-xs font-semibold shadow-md shadow-[#6CBF3D]/20 transition-all cursor-pointer"
              >
                Reload Application
              </button>
            </div>

            <button
              type="button"
              onClick={this.handleClearCacheAndRecover}
              className="mt-3 text-[11px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer underline underline-offset-2"
            >
              Reset Cached State &amp; Recover
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
