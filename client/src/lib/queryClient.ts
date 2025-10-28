import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Obtener el token JWT con validación y manejo seguro de errores
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('authToken');
  } catch (error) {
    console.warn('[Auth] Error accediendo localStorage para leer token:', error);
    return null;
  }
}

// Almacenar el token JWT con manejo seguro de errores
export function setAuthToken(token: string): void {
  try {
    localStorage.setItem('authToken', token);
  } catch (error) {
    console.error('[Auth] Error guardando token en localStorage:', error);
    throw new Error('No se pudo guardar el token de autenticación');
  }
}

// Eliminar el token JWT con manejo seguro de errores
export function removeAuthToken(): void {
  try {
    localStorage.removeItem('authToken');
  } catch (error) {
    console.warn('[Auth] Error eliminando token de localStorage:', error);
  }
}

// Verificar si hay un token disponible
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Si el error es 401, solo limpiar el token, no redirigir automáticamente
    if (res.status === 401) {
      console.log('[API] Error 401 detectado, limpiando token...');
      removeAuthToken();
      // Solo redirigir si no estamos ya en la página de login
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        console.log('[API] Guardando ruta actual para después del login');
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      }
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  // Preparar los headers incluyendo el token JWT si existe
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Obtener el token JWT del almacenamiento local
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Asegurar que la URL sea absoluta si no lo es
  const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  
  console.log(`🔵 [apiRequest] ${method} ${absoluteUrl}`);
  
  const res = await fetch(absoluteUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const baseUrl = queryKey[0] as string;
      const params = queryKey[1] as Record<string, any> || {};
      
      // Construir URL con query parameters
      const url = new URL(baseUrl, window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
      
      const requestUrl = url.pathname + url.search;
      console.log(`🔵 [QueryClient] Requesting: ${requestUrl}`);
      
      const res = await apiRequest('GET', requestUrl);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      
      // Verificar que la respuesta es JSON antes de parsear
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`❌ [QueryClient] Non-JSON response for ${requestUrl}:`, text.substring(0, 200));
        throw new Error(`Expected JSON but received ${contentType}`);
      }
      
      return await res.json();
    } catch (error) {
      // Si hay un error 401, manejarlo según la configuración
      if (error instanceof Error && error.message.includes('401')) {
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
      }
      
      // Propagar otros errores
      throw error;
    }
  };

// Wrapper para compatibilidad con la interfaz anterior de apiRequest
export async function apiRequestLegacy(
  url: string,
  options: {
    method: string;
    body?: any;
  }
): Promise<any> {
  const res = await apiRequest(options.method, url, options.body);
  return await res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 segundos
      retry: (failureCount, error) => {
        // No reintentar en errores 401 (no autorizado)
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        // Solo 1 reintento para evitar sobrecarga
        return failureCount < 1;
      },
      retryDelay: 1000, // 1 segundo fijo entre reintentos
      gcTime: 10 * 60 * 1000, // 10 minutos para limpiar caché
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
      onSuccess: () => {
        console.log('[QueryClient] Mutación exitosa, invalidando queries');
        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
        queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      },
    },
  },
});