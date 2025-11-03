import React, { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken, removeAuthToken } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number | null;
  areaId: number | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  authReady: boolean;  // Nuevo: indica si la verificación inicial de auth ha completado
  isAdmin: boolean;
  isMarioOrAdmin: boolean;  // Nuevo: acceso completo
  hasLogisticsAccess: boolean;  // Nuevo: acceso a logística/shipments
  hasSalesAccess: boolean;  // Nuevo: acceso a actualización de ventas
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);  // Nuevo: gate para prevenir race conditions
  const { toast } = useToast();
  
  // Función para refrescar los datos del usuario
  const refreshUser = async (): Promise<void> => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        setUser(null);
        return;
      }
      
      setIsLoading(true);
      
      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        removeAuthToken();
        setUser(null);
        queryClient.invalidateQueries();
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Al iniciar, verificar si hay un token guardado y obtener los datos del usuario
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getAuthToken();
        
        if (!token) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        const response = await fetch('/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          removeAuthToken();
          setUser(null);
        }
      } catch (error) {
        removeAuthToken();
        setUser(null);
      } finally {
        setIsLoading(false);
        setAuthReady(true);  // Marcar como listo después de la verificación inicial
      }
    };
    
    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Usar apiRequest para manejar errores y cache de manera consistente
      const { apiRequest, setAuthToken } = await import('@/lib/queryClient');
      const response = await apiRequest(
        'POST',
        '/api/login',
        { username, password }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al iniciar sesión');
      }
      
      const data = await response.json();
      
      // Aceptar múltiples nombres de campos de token para mayor robustez
      const token = data.token || data.jwt || data.accessToken;
      
      if (!token) {
        throw new Error('No se recibió token del servidor');
      }
      
      // Guardar el token en localStorage usando nuestra función mejorada
      setAuthToken(token);

      // Verificar que el token se guardó correctamente
      const savedToken = getAuthToken();
      if (!savedToken || savedToken !== token) {
        console.error('[Auth] Error: Token no se guardó correctamente');
        throw new Error('Error al guardar el token de autenticación');
      }
      
      // Actualizar el estado del usuario
      setUser(data.user);
      
      // Esperar un ciclo completo del event loop para asegurar que el token esté disponible
      // antes de invalidar queries y que las queries puedan accederlo
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Invalidar todas las consultas para que se recarguen con el nuevo token
      queryClient.invalidateQueries();
      
      
      toast({
        title: "¡Bienvenido!",
        description: `Sesión iniciada como ${data.user.name}`,
      });
    } catch (error: any) {
      console.error('[Auth] Error login:', error);
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Credenciales incorrectas",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Eliminar el token usando nuestra función mejorada
      removeAuthToken();
      setUser(null);
      
      // Limpiar todas las consultas en caché
      queryClient.clear();
      
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    } catch (error) {
      console.error('[Auth] Error logout:', error);
      toast({
        title: "Error al cerrar sesión",
        description: "Ha ocurrido un error al cerrar la sesión",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar si el usuario es administrador
  const isAdmin = user?.role === 'admin';
  
  // Verificar si el usuario es Mario o admin (acceso completo)
  const isMarioOrAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.name === 'Mario Reynoso';

  // ✅ ACCESO UNIVERSAL DE LECTURA: Todos pueden VER logística
  // Mantener función para restricciones de escritura basadas en backend
  const hasLogisticsAccess = true; // Todos tienen acceso de lectura

  // ✅ ACCESO UNIVERSAL DE LECTURA: Todos pueden VER ventas  
  // Mantener función para restricciones de escritura basadas en backend
  const hasSalesAccess = true; // Todos tienen acceso de lectura

  return (
    <AuthContext.Provider value={{ user, isLoading, authReady, isAdmin, isMarioOrAdmin, hasLogisticsAccess, hasSalesAccess, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}