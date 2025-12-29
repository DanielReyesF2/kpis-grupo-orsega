import { devLog } from "@/lib/logger";
import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    devLog.error('[ErrorBoundary] Error capturado:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Algo salió mal
              </h1>
              <p className="text-gray-600 mb-6">
                Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al inicio.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 p-4 bg-gray-100 rounded text-left text-sm">
                  <summary className="cursor-pointer font-medium mb-2">
                    Detalles del error (desarrollo)
                  </summary>
                  <pre className="whitespace-pre-wrap text-xs text-red-600">
                    {this.state.error.message}
                    {this.state.error.stack && '\n\n' + this.state.error.stack}
                  </pre>
                </details>
              )}
              
              <div className="space-y-3">
                <Button 
                  onClick={this.handleReload}
                  className="w-full"
                  data-testid="button-reload"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recargar página
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={this.handleReset}
                  className="w-full"
                  data-testid="button-retry"
                >
                  Intentar de nuevo
                </Button>
                
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.href = '/'}
                  className="w-full"
                  data-testid="button-home"
                >
                  Ir al inicio
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;