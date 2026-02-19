import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { getAuthToken } from '@/lib/queryClient';

// Función para guardar la ruta actual
const saveCurrentPath = (path: string) => {
  if (path !== '/login') {
    sessionStorage.setItem('redirectAfterLogin', path);
  }
};

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
  executiveOnly?: boolean;  // Nuevo: solo Mario y admin
  logisticsOnly?: boolean;  // Nuevo: solo Mario, admin y Jesus Daniel (logística)
  salesOnly?: boolean;  // Nuevo: solo área de ventas
}

const ProtectedRoute = ({ children, adminOnly = false, executiveOnly = false, logisticsOnly = false, salesOnly = false }: ProtectedRouteProps) => {
  const { user, isLoading, authReady, isAdmin, isMarioOrAdmin, hasLogisticsAccess, hasSalesAccess, refreshUser } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // CRÍTICO: No hacer nada hasta que authReady sea true para prevenir race conditions
    if (!authReady) {
      return;
    }

    const token = getAuthToken();
    

    // Solo redirigir si authReady es true Y no hay token Y no hay usuario
    if (authReady && !token && !user) {
      saveCurrentPath(location);
      setLocation('/login');
      return;
    }

    // Si hay token pero no hay usuario y authReady es true, refrescar una vez
    if (authReady && token && !user && !isLoading) {
      refreshUser();
      return;
    }

    // Solo validar permisos si authReady es true y hay usuario
    if (authReady && user) {
      // Superadmin: admin bypasses ALL route restrictions
      if (isAdmin) {
        // Admin always has full access — no redirect needed
      } else if (adminOnly) {
        setLocation('/');
      } else if (executiveOnly && !isMarioOrAdmin) {
        setLocation('/');
      } else if (logisticsOnly && !hasLogisticsAccess) {
        setLocation('/');
      } else if (salesOnly && !hasSalesAccess) {
        setLocation('/');
      }
    }
  }, [user, isLoading, authReady, isAdmin, isMarioOrAdmin, adminOnly, executiveOnly, setLocation, location, refreshUser, hasLogisticsAccess, hasSalesAccess, logisticsOnly, salesOnly]);

  // Mostrar loader mientras se determina el estado de la autenticación
  const token = getAuthToken();
  
  // CRÍTICO: Mostrar loader hasta que authReady sea true para prevenir race conditions
  if (!authReady || isLoading || (token && !user)) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-primary-600 text-lg font-medium">Validando acceso...</p>
          <p className="text-gray-500 text-sm mt-2">Por favor espera un momento</p>
        </div>
      </div>
    );
  }

  // No renderizar si el usuario no tiene permisos (pero no devolver null para evitar pantalla en blanco)
  // Superadmin: admin always passes all permission checks
  if (!user || (!isAdmin && ((adminOnly) || (executiveOnly && !isMarioOrAdmin) || (logisticsOnly && !hasLogisticsAccess) || (salesOnly && !hasSalesAccess)))) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-primary-600 text-lg font-medium">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Renderizar los componentes hijos si el usuario está autenticado y tiene permisos
  return <>{children}</>;
};

export default ProtectedRoute;
