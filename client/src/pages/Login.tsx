import { useEffect } from 'react';
import { useLocation } from 'wouter';
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Minimalist Header - Just Logos */}
        <div className="text-center mb-12">
          {/* Logos Container - Protagonistas */}
          <div className="flex justify-center items-center space-x-16">
            {/* Grupo Orsega Logo */}
            <div className="relative">
              <img 
                src="/logo orsega.jpg" 
                alt="Grupo Orsega Logo" 
                className="w-40 h-40 object-contain"
                onError={(e) => {
                  // Fallback si la imagen no carga
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-40 h-40 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xl font-medium">
                        ORSEGA
                      </div>
                    `;
                  }
                }}
              />
            </div>

            {/* Dura International Logo */}
            <div className="relative">
              <img 
                src="/logodura.jpg" 
                alt="Dura International Logo" 
                className="w-40 h-40 object-contain"
                onError={(e) => {
                  // Fallback si la imagen no carga
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-40 h-40 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-xl font-medium">
                        DURA
                      </div>
                    `;
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Minimalist Login Form */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
