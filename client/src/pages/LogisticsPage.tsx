import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Link } from 'wouter';
import { 
  Package, 
  Users, 
  Truck, 
  Plus, 
  Clock,
  ArrowLeft,
  X,
  Trash2,
  Save,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropKanban } from '@/components/shipments/DragDropKanban';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import React from 'react';
import { Loader2 } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  rfc?: string;
  email?: string;
  phone?: string;
  billing_addr?: string;
  shipping_addr?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Provider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  contact_name?: string;
  rating?: number;
  is_active: boolean;
  channels?: Array<{
    id: string;
    type: string;
    value: string;
    isDefault: boolean;
  }>;
}

interface Shipment {
  id: string;
  status: string;
}



// Schema para formulario de clientes
const clientFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  rfc: z.string().optional(),
  billing_addr: z.string().optional(),
  shipping_addr: z.string().optional(),
  is_active: z.boolean().default(true),
});

// Schema para formulario de proveedores
const providerFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  contact_name: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  is_active: z.boolean().default(true),
});

export default function LogisticsPage() {
  const [activeModal, setActiveModal] = useState<'clients' | 'providers' | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isProviderFormOpen, setIsProviderFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery<Provider[]>({
    queryKey: ['/api/providers'],
  });

  // Handle both old and new API response formats
  const { data: shipmentsResponse, isLoading: shipmentsLoading } = useQuery<{shipments: Shipment[], pagination?: any} | Shipment[]>({
    queryKey: ['/api/shipments'],
  });

  // Extract shipments array (handle both old and new API response formats)
  const shipments = useMemo(() => {
    if (!shipmentsResponse) return [];
    // New format: {shipments: [...], pagination: {...}}
    if (Array.isArray((shipmentsResponse as any).shipments)) {
      return (shipmentsResponse as {shipments: Shipment[]}).shipments;
    }
    // Old format: Shipment[]
    if (Array.isArray(shipmentsResponse)) {
      return shipmentsResponse as Shipment[];
    }
    return [];
  }, [shipmentsResponse]);


  return (
    <AppLayout title="Módulo de Logística">
      {/* Botón Dashboard */}
      <div className="flex justify-start items-center mb-6">
        <Link href="/">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </Link>
      </div>

      {/* Main Stats - Shipments Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Featured Shipment Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">En Tránsito</p>
                  <p className="text-4xl font-bold text-orange-900">
                    {shipments.filter((s: Shipment) => s.status === 'in_transit').length}
                  </p>
                </div>
                <div className="bg-orange-200 p-3 rounded-full">
                  <Package className="w-10 h-10 text-orange-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Pendientes</p>
                  <p className="text-4xl font-bold text-purple-900">
                    {shipments.filter((s: Shipment) => s.status === 'pending').length}
                  </p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <Clock className="w-10 h-10 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Secondary Stats - Database Info */}
        <div className="space-y-4">
          <Card className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors" onClick={() => setActiveModal('clients')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-sm text-gray-600">Clientes</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{clients.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors" onClick={() => setActiveModal('providers')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Truck className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm text-gray-600">Proveedores</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{providers.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - Always Show Shipments */}
      <DragDropKanban />

      {/* Clients Modal */}
      <Dialog open={activeModal === 'clients'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Clientes ({clients.length})
              </DialogTitle>
              <Button 
                data-testid="button-new-client"
                onClick={() => {
                  setEditingClient(null);
                  setIsClientFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Cliente
              </Button>
            </div>
          </DialogHeader>
          <div className="grid gap-4 mt-4">
            {clientsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando clientes...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay clientes registrados</p>
              </div>
            ) : (
              clients.map((client: Client) => (
                <Card key={client.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900">{client.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                          {client.rfc && <p><span className="font-medium">RFC:</span> {client.rfc}</p>}
                          {client.email && <p><span className="font-medium">Email:</span> {client.email}</p>}
                          {client.phone && <p><span className="font-medium">Teléfono:</span> {client.phone}</p>}
                          {client.billing_addr && <p><span className="font-medium">Dir. Facturación:</span> {client.billing_addr}</p>}
                          {client.shipping_addr && <p><span className="font-medium">Dir. Envío:</span> {client.shipping_addr}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={client.is_active ? "default" : "secondary"}>
                          {client.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid={`button-edit-client-${client.id}`}
                            onClick={() => {
                              setEditingClient(client);
                              setIsClientFormOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de que deseas eliminar a ${client.name}?`)) {
                                try {
                                  // Soft delete: marcar como inactivo
                                  await apiRequest('PATCH', `/api/clients/${client.id}`, {
                                    is_active: false
                                  });
                                  toast({
                                    title: "Cliente eliminado",
                                    description: `${client.name} ha sido marcado como inactivo.`,
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message || "No se pudo eliminar el cliente.",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Providers Modal */}
      <Dialog open={activeModal === 'providers'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-green-600" />
                Proveedores de Transporte ({providers.length})
              </DialogTitle>
              <Button 
                data-testid="button-new-provider"
                onClick={() => {
                  setEditingProvider(null);
                  setIsProviderFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Proveedor
              </Button>
            </div>
          </DialogHeader>
          <div className="grid gap-4 mt-4">
            {providersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando proveedores...</p>
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay proveedores registrados</p>
              </div>
            ) : (
              providers.map((provider: Provider) => (
                <Card key={provider.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900">{provider.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                          {provider.contact_name && <p><span className="font-medium">Contacto:</span> {provider.contact_name}</p>}
                          {provider.email && <p><span className="font-medium">Email:</span> {provider.email}</p>}
                          {provider.phone && <p><span className="font-medium">Teléfono:</span> {provider.phone}</p>}
                          {provider.rating && (
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Rating:</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={i < provider.rating! ? 'text-yellow-400' : 'text-gray-300'}>
                                    ⭐
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {provider.channels && provider.channels.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium text-gray-600 mb-2">Canales de comunicación:</p>
                            <div className="flex flex-wrap gap-2">
                              {provider.channels.map((channel, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {channel.type}: {channel.value} {channel.isDefault && '(Principal)'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={provider.is_active ? "default" : "secondary"}>
                          {provider.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid={`button-edit-provider-${provider.id}`}
                            onClick={() => {
                              setEditingProvider(provider);
                              setIsProviderFormOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de que deseas eliminar a ${provider.name}?`)) {
                                try {
                                  // Soft delete: marcar como inactivo usando DELETE o PATCH
                                  try {
                                    await apiRequest('DELETE', `/api/providers/${provider.id}`);
                                  } catch {
                                    // Si DELETE falla, usar PATCH para soft delete
                                    await apiRequest('PATCH', `/api/providers/${provider.id}`, {
                                      is_active: false
                                    });
                                  }
                                  toast({
                                    title: "Proveedor eliminado",
                                    description: `${provider.name} ha sido marcado como inactivo.`,
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['/api/providers'] });
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message || "No se pudo eliminar el proveedor.",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Form Dialog */}
      <ClientFormDialog
        isOpen={isClientFormOpen}
        onClose={() => {
          setIsClientFormOpen(false);
          setEditingClient(null);
        }}
        client={editingClient}
        queryClient={queryClient}
        toast={toast}
      />

      {/* Provider Form Dialog */}
      <ProviderFormDialog
        isOpen={isProviderFormOpen}
        onClose={() => {
          setIsProviderFormOpen(false);
          setEditingProvider(null);
        }}
        provider={editingProvider}
        queryClient={queryClient}
        toast={toast}
      />
    </AppLayout>
  );
}

// Componente de formulario para clientes
function ClientFormDialog({ 
  isOpen, 
  onClose, 
  client, 
  queryClient,
  toast 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  client: Client | null;
  queryClient: any;
  toast: any;
}) {
  const form = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name || '',
      email: client?.email || '',
      phone: client?.phone || '',
      rfc: client?.rfc || '',
      billing_addr: client?.billing_addr || '',
      shipping_addr: client?.shipping_addr || '',
      is_active: client?.is_active ?? true,
    },
  });

  // Reset form when client changes
  React.useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        rfc: client.rfc || '',
        billing_addr: client.billing_addr || '',
        shipping_addr: client.shipping_addr || '',
        is_active: client.is_active ?? true,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        rfc: '',
        billing_addr: '',
        shipping_addr: '',
        is_active: true,
      });
    }
  }, [client, form]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientFormSchema>) => {
      // Mapear campos del formulario a los campos esperados por createClientSchema
      const apiData = {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        rfc: data.rfc || undefined,
        billingAddr: data.billing_addr || undefined,
        shippingAddr: data.shipping_addr || undefined,
        isActive: data.is_active ?? true,
      };
      const response = await apiRequest('POST', '/api/clients', apiData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el cliente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientFormSchema>) => {
      // Mapear campos del formulario a los campos esperados por updateClientSchema
      const apiData = {
        name: data.name,
        email: data.email || undefined,
        // phone removido - no se usa en el backend
        rfc: data.rfc || undefined,
        billingAddr: data.billing_addr || undefined,
        shippingAddr: data.shipping_addr || undefined,
        isActive: data.is_active ?? true,
      };
      const response = await apiRequest('PATCH', `/api/clients/${client?.id}`, apiData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente actualizado",
        description: "El cliente ha sido actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el cliente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof clientFormSchema>) => {
    if (client) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+52 55 1234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="rfc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RFC</FormLabel>
                  <FormControl>
                    <Input placeholder="RFC123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billing_addr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección de Facturación</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Dirección completa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shipping_addr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección de Envío</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Dirección completa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4"
                    />
                  </FormControl>
                  <FormLabel>Cliente Activo</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {client ? 'Actualizar' : 'Crear'} Cliente
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Componente de formulario para proveedores
function ProviderFormDialog({ 
  isOpen, 
  onClose, 
  provider, 
  queryClient,
  toast 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  provider: Provider | null;
  queryClient: any;
  toast: any;
}) {
  const form = useForm<z.infer<typeof providerFormSchema>>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: provider?.name || '',
      email: provider?.email || '',
      phone: provider?.phone || '',
      contact_name: provider?.contact_name || '',
      rating: provider?.rating || undefined,
      is_active: provider?.is_active ?? true,
    },
  });

  // Reset form when provider changes
  React.useEffect(() => {
    if (provider) {
      form.reset({
        name: provider.name || '',
        email: provider.email || '',
        phone: provider.phone || '',
        contact_name: provider.contact_name || '',
        rating: provider.rating || undefined,
        is_active: provider.is_active ?? true,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        contact_name: '',
        rating: undefined,
        is_active: true,
      });
    }
  }, [provider, form]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof providerFormSchema>) => {
      const response = await apiRequest('POST', '/api/providers', {
        ...data,
        contactName: data.contact_name,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Proveedor creado",
        description: "El proveedor ha sido creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/providers'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el proveedor.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof providerFormSchema>) => {
      const response = await apiRequest('PATCH', `/api/providers/${provider?.id}`, {
        ...data,
        contactName: data.contact_name,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Proveedor actualizado",
        description: "El proveedor ha sido actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/providers'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el proveedor.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof providerFormSchema>) => {
    if (provider) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{provider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del proveedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+52 55 1234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de Contacto</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del contacto principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating (0-5)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="5" 
                      step="0.5"
                      placeholder="4.5"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4"
                    />
                  </FormControl>
                  <FormLabel>Proveedor Activo</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {provider ? 'Actualizar' : 'Crear'} Proveedor
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}