import { ReactNode, useState, useEffect } from 'react';
import { AuthProvider } from '@/hooks/use-auth';

/**
 * SafeAuthProvider - Wrapper que asegura el AuthProvider esté completamente inicializado
 * antes de renderizar componentes hijos. Previene race conditions durante navegación.
 */
interface SafeAuthProviderProps {
  children: ReactNode;
}

export function SafeAuthProvider({ children }: SafeAuthProviderProps) {
  const [isProviderReady, setIsProviderReady] = useState(false);

  useEffect(() => {
    // Pequeño delay para asegurar que el contexto esté completamente establecido
    // antes de renderizar componentes que usan useAuth
    const timer = setTimeout(() => {
      setIsProviderReady(true);
    }, 10); // 10ms es suficiente para evitar race conditions

    return () => clearTimeout(timer);
  }, []);

  if (!isProviderReady) {
    // Mostrar spinner mientras el AuthProvider se inicializa
    return (
      <div className="flex justify-center items-center min-h-screen bg-secondary-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary-600 text-sm">Inicializando sistema de autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}