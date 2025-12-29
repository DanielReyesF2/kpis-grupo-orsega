import { devLog } from "@/lib/logger";
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';

/**
 * Hook para limpiar cache de TanStack Query durante navegaciones críticas
 * Previene memory leaks y problemas de estado obsoleto entre módulos
 */
export const useNavigationCleanup = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Rutas que requieren cleanup de cache para evitar problemas de navegación
    const criticalRoutes = ['/logistics', '/kpi-control', '/'];
    
    if (criticalRoutes.includes(location)) {
      devLog.log(`[NavigationCleanup] Limpiando cache para ruta: ${location}`);
      
      // Mantener auth cache crítico, limpiar queries de datos
      queryClient.removeQueries({
        predicate: (query: { queryKey: unknown[] }) => {
          const queryKey = query.queryKey[0]?.toString() || '';
          // No limpiar queries críticas de auth y usuario
          return !queryKey.includes('/api/user') &&
                 !queryKey.includes('/api/login') &&
                 !queryKey.includes('auth');
        }
      });
    }
  }, [location]);
};