import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Shield, Mail, User, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActivationData {
  valid: boolean;
  email: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  expiresAt: string;
}

export default function UserActivation() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [activationData, setActivationData] = useState<ActivationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Token de activación no válido');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/activate/${token}`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setActivationData(data);
        } else {
          setError(data.message || 'Token de activación no válido');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        setError('Error de conexión. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 8 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error", 
        description: "Las contraseñas no coinciden",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/activate/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        toast({
          title: "¡Éxito!",
          description: "Tu contraseña ha sido establecida correctamente",
          variant: "default"
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          setLocation('/login');
        }, 3000);
      } else {
        toast({
          title: "Error",
          description: data.message || 'Error al establecer la contraseña',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error setting password:', error);
      toast({
        title: "Error",
        description: 'Error de conexión. Inténtalo de nuevo.',
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Validando enlace de activación...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !activationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-800">Enlace No Válido</CardTitle>
            <CardDescription className="text-red-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Si necesitas un nuevo enlace de activación, contacta al administrador del sistema.
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full" 
                onClick={() => setLocation('/login')}
                variant="outline"
              >
                Ir al Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-green-800">¡Cuenta Activada!</CardTitle>
            <CardDescription className="text-green-600">
              Tu contraseña ha sido establecida exitosamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">¡Todo Listo!</h3>
                <p className="text-green-700 text-sm">
                  Ya puedes iniciar sesión con tu email y la contraseña que acabas de crear.
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Serás redirigido al login en unos segundos...
                </p>
                <Button 
                  className="w-full"
                  onClick={() => setLocation('/login')}
                >
                  Ir al Login Ahora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main activation form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Activar tu Cuenta
          </CardTitle>
          <CardDescription>
            Establece tu contraseña para acceder al Sistema ECONOVA
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* User Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-3 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Tu Información
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-blue-700">
                <User className="h-3 w-3 mr-2" />
                <span className="font-medium">Nombre:</span>
                <span className="ml-2">{activationData.user.name}</span>
              </div>
              <div className="flex items-center text-blue-700">
                <Mail className="h-3 w-3 mr-2" />
                <span className="font-medium">Email:</span>
                <span className="ml-2">{activationData.user.email}</span>
              </div>
              <div className="flex items-center text-blue-700">
                <Shield className="h-3 w-3 mr-2" />
                <span className="font-medium">Rol:</span>
                <span className="ml-2 capitalize">{activationData.user.role}</span>
              </div>
            </div>
          </div>

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Nueva Contraseña
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className="pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmar Contraseña
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                minLength={8}
                className="mt-1"
                data-testid="input-confirm-password"
              />
            </div>

            <Alert>
              <AlertDescription>
                <strong>Importante:</strong> Esta contraseña será tu clave de acceso permanente al sistema. 
                Elige una contraseña segura que puedas recordar.
              </AlertDescription>
            </Alert>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              disabled={submitting}
              data-testid="button-activate"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Activando cuenta...
                </>
              ) : (
                'Activar mi Cuenta'
              )}
            </Button>
          </form>

          {/* Footer Info */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>© 2025 ECONOVA - KPI Dashboard</p>
            <p>Sistema de Gestión de Indicadores de Rendimiento</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}