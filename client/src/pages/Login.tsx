import { useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useNavigationCleanup } from '@/hooks/use-navigation-cleanup';
import LoginForm from '@/components/auth/LoginForm';
import { LogoEconova } from '@/components/ui/LogoEconova';

export default function Login() {
  const { user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();
  
  // Limpiar cache de navegación para evitar problemas de estado
  useNavigationCleanup();

  // Redirect to dashboard or saved location if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      // Check if there's a saved redirect path
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && redirectPath !== '/login') {
        // Clear the stored path first to prevent redirect loops
        sessionStorage.removeItem('redirectAfterLogin');
        // Redirect to the stored path
        setLocation(redirectPath);
      } else {
        // Otherwise redirect to dashboard
        setLocation('/');
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-secondary-100">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#273949] p-4">
      <div className="w-full max-w-md mb-8">
        <div className="text-center mb-8 flex flex-col items-center">
          <LogoEconova height={120} className="mb-4" />
          <h1 className="text-3xl font-bold text-[#b5e951]">Grupo Orsega y Dura International</h1>
          <p className="text-white mt-2">Sistema de gestión de indicadores clave de rendimiento</p>
        </div>
        <LoginForm />
        
        <div className="mt-6 text-center">
          <p className="text-white text-sm">
            ¿No tienes cuenta?{' '}
            <Link 
              href="/register" 
              className="text-[#b5e951] hover:text-[#9fd63f] font-medium underline"
              data-testid="link-register"
            >
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
