import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export default function LoginForm() {
  const { login, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  // Efecto para redireccionar después de inicio de sesión exitoso
  useEffect(() => {
    if (user) {
      // Verificar si hay una ruta guardada a donde redireccionar
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      
      if (redirectPath) {
        console.log(`[LoginForm] Redireccionando a ruta guardada: ${redirectPath}`);
        sessionStorage.removeItem('redirectAfterLogin'); // Limpiar
        setLocation(redirectPath);
      } else {
        console.log('[LoginForm] No hay ruta guardada, redireccionando al dashboard');
        setLocation('/');
      }
    }
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`[LoginForm] Intentando iniciar sesión con usuario: ${values.username}`);
      await login(values.username, values.password);
      // El efecto se encargará de la redirección
    } catch (err) {
      console.error('[LoginForm] Error en inicio de sesión:', err);
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Iniciar Sesión</h2>
        <p className="text-gray-500 text-sm">
          Acceso al sistema de gestión de indicadores
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium text-sm">Usuario</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="daniel@econova.com.mx" 
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#00a8a8] focus:ring-[#00a8a8]/20 h-12 rounded-md"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-red-500 text-xs" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium text-sm">Contraseña</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#00a8a8] focus:ring-[#00a8a8]/20 h-12 rounded-md"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-red-500 text-xs" />
              </FormItem>
            )}
          />
          
          <Button 
            type="submit" 
            className="w-full bg-[#00a8a8] hover:bg-[#008080] text-white font-semibold py-3 rounded-md transition-all duration-200 h-12" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accediendo...
              </>
            ) : (
              "Acceder al Sistema"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
