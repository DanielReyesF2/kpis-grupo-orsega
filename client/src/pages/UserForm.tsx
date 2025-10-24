import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient } from '@/lib/queryClient';
import { createUser, updateUser } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Form validation schema
const userFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.string().min(1, 'El rol es requerido'),
  companyId: z.string().optional(),
});

interface UserFormProps {
  id?: number;
}

export default function UserForm({ id }: UserFormProps) {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const isEditing = !!id;

  // Fetch user data if editing
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: [`/api/users/${id}`],
    enabled: isEditing,
  });

  // Fetch companies for dropdown
  const { data: companies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['/api/companies'],
  });

  // Setup form with validation
  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: '',
      companyId: '',
    },
  });

  // Set form values when editing and data is loaded
  useEffect(() => {
    if (isEditing && user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: '', // Don't prefill password for security
        role: user.role,
        companyId: user.companyId ? user.companyId.toString() : '',
      });
    }
  }, [isEditing, user, form]);

  // Handle role change to manage companyId field
  const handleRoleChange = (value: string) => {
    form.setValue('role', value);
    // Clear companyId if role is admin
    if (value === 'admin') {
      form.setValue('companyId', '');
    }
  };

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Usuario creado',
        description: 'El usuario ha sido creado exitosamente.',
      });
      setLocation('/users');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo crear el usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Usuario actualizado',
        description: 'El usuario ha sido actualizado exitosamente.',
      });
      setLocation('/users');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo actualizar el usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: 'destructive',
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: z.infer<typeof userFormSchema>) => {
    const formattedData = {
      ...data,
      companyId: data.companyId ? parseInt(data.companyId) : null,
    };

    if (isEditing && id) {
      // For updates, only include password if it was changed
      const updateData = formattedData.password 
        ? formattedData 
        : { ...formattedData, password: undefined };
        
      updateMutation.mutate({ id, data: updateData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  // Determine if the form is in a loading state
  const isLoading = isLoadingUser || isLoadingCompanies || 
                   createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout title={isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUser && isEditing ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="correo@ejemplo.com" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isEditing ? 'Nueva Contraseña (dejar en blanco para mantener)' : 'Contraseña'}</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder={isEditing ? "Nueva contraseña" : "Contraseña"} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={handleRoleChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {form.watch('role') === 'viewer' && (
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isLoadingCompanies}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies?.map((company: any) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation('/users')}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Actualizar' : 'Crear'} Usuario
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
