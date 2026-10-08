import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary atrapó un error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold mb-2">Algo no cargó correctamente</h1>
          <p className="text-slate-400 text-sm max-w-md mb-6">
            Ocurrió una interrupción al renderizar esta vista. Podés recargar o volver al inicio.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
            >
              Recargar página
            </button>
            <a
              href="/giovanni"
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors"
            >
              Ir al inicio
            </a>
          </div>
          {this.state.error && (
            <pre className="mt-8 p-3 rounded-lg bg-black/60 text-slate-400 text-xs text-left max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
