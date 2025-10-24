import { ReactNode, Component, ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AsyncErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function AsyncErrorFallback({ error, resetErrorBoundary }: AsyncErrorFallbackProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-12 h-12 text-destructive" />
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Error de navegación detectado
        </h2>
        
        <p className="text-gray-600 mb-4">
          Ha ocurrido un problema durante la navegación entre módulos. 
          Esto puede resolverse reiniciando la página o regresando al inicio.
        </p>
        
        <details className="text-left mb-6 bg-gray-50 p-3 rounded border">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
            Detalles técnicos
          </summary>
          <code className="text-xs text-gray-600 break-words">
            {error.message}
          </code>
        </details>
        
        <div className="space-y-3">
          <Button 
            onClick={resetErrorBoundary} 
            className="w-full"
            variant="default"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar navegación
          </Button>
          
          <Button 
            onClick={handleGoHome} 
            variant="outline" 
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Regresar al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface AsyncErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * AsyncErrorBoundary - Captura errores async que pueden ocurrir durante navegación
 * entre módulos y proporciona una UI de recuperación amigable
 */
export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AsyncErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AsyncErrorBoundary] Error capturado:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
    // Limpiar cualquier estado que pueda estar causando el error
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <AsyncErrorFallback 
          error={this.state.error} 
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * withAsyncErrorBoundary - HOC para envolver componentes con error boundary async
 */
export const withAsyncErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const WrappedComponent = (props: P) => (
    <AsyncErrorBoundary>
      <Component {...props} />
    </AsyncErrorBoundary>
  );
  
  WrappedComponent.displayName = `withAsyncErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};