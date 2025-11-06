import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Box,
  CheckCircle2,
  History,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropKanban } from '@/components/shipments/DragDropKanban';
import { ShipmentsHistory } from '@/components/shipments/ShipmentsHistory';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  company_id?: number;
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

interface Product {
  id: number;
  name: string;
  company_id?: number;
  is_active: boolean;
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
  company_id: z.string().min(1, 'Debe seleccionar una empresa'),
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
  const [activeModal, setActiveModal] = useState<'clients' | 'providers' | 'products' | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isProviderFormOpen, setIsProviderFormOpen] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Consulta para obtener empresas
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery<Provider[]>({
    queryKey: ['/api/providers'],
  });

  // Obtener productos de ambas empresas (sin filtro de companyId)
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
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


  // Get build version for debugging (only in production)
  const buildVersion = import.meta.env.MODE === 'production' 
    ? (import.meta.env.VITE_BUILD_VERSION as string | undefined) || 'dev'
    : 'dev';

  return (
    <AppLayout title="Módulo de Logística">
      {/* Botón Dashboard */}
      <div className="flex justify-start items-center mb-6">
        <Link href="/">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </Link>
        {/* Build version indicator for debugging (only visible in production) */}
        {import.meta.env.MODE === 'production' && (
          <div className="ml-auto text-xs text-muted-foreground font-mono">
            v{buildVersion}
          </div>
        )}
      </div>

      {/* Main Stats - Shipments Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Featured Shipment Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-warning">En Tránsito</p>
                  <p className="text-4xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'in_transit').length}
                  </p>
                </div>
                <div className="bg-warning/15 p-3 rounded-full">
                  <Package className="w-10 h-10 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Por embarcar</p>
                  <p className="text-4xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'pending').length}
                  </p>
                </div>
                <div className="bg-primary/15 p-3 rounded-full">
                  <Clock className="w-10 h-10 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta destacada para Entregados */}
          <Card className="border-2 border-success/30 bg-gradient-to-br from-success/5 to-success/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-success">Entregados</p>
                  <p className="text-5xl font-extrabold text-success">
                    {shipments.filter((s: Shipment) => s.status === 'delivered' || s.status === 'cancelled').length}
                  </p>
                </div>
                <div className="bg-success/20 p-3 rounded-full">
                  <CheckCircle2 className="w-12 h-12 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Secondary Stats - Database Info */}
        <div className="space-y-4 max-h-full overflow-y-auto">
          <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveModal('clients')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Clientes</span>
                </div>
                <span className="text-lg font-semibold">{clients.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveModal('providers')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Truck className="w-5 h-5 text-success mr-2" />
                  <span className="text-sm text-muted-foreground">Proveedores</span>
                </div>
                <span className="text-lg font-semibold">{providers.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveModal('products')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Box className="w-5 h-5 text-primary mr-2" />
                  <span className="text-sm text-muted-foreground font-medium">Productos</span>
                </div>
                <span className="text-lg font-semibold">{productsLoading ? '...' : products.filter((p: Product) => p.is_active).length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - Active View with History Button */}
      {activeTab === 'active' ? (
        <DragDropKanban onShowHistory={() => setActiveTab('history')} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <History className="h-6 w-6 text-slate-600" />
              Historial de Embarques
            </h2>
            <Button variant="outline" onClick={() => setActiveTab('active')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Embarcaciones Activas
            </Button>
          </div>
          {shipmentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ShipmentsHistory 
              shipments={shipments as any[]} 
              onShipmentClick={(shipment) => {
                // Opcional: abrir detalles del embarque
                console.log('Ver detalles de:', shipment);
              }}
            />
          )}
        </div>
      )}

      {/* Clients Modal */}
      <Dialog open={activeModal === 'clients'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
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
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg text-gray-900">{client.name}</h3>
                          {client.company_id && (
                            <Badge variant="outline" className="text-xs">
                              {companies.find((c: any) => c.id === client.company_id)?.name || `Empresa ${client.company_id}`}
                            </Badge>
                          )}
                        </div>
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

      {/* Products Modal */}
      <Dialog open={activeModal === 'products'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" />
                Productos ({products.filter((p: Product) => p.is_active).length})
              </DialogTitle>
              <Button 
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {productsLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando productos...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No hay productos registrados</div>
            ) : (
              products
                .filter((product: Product) => product.is_active)
                .map((product: Product) => {
                  const company = companies.find((c: any) => c.id === product.company_id);
                  return (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/15 text-primary">
                                <Box className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                                {company && (
                                  <p className="text-sm text-gray-500">Empresa: {company.name}</p>
                                )}
                                {!product.company_id && (
                                  <p className="text-sm text-gray-500">Empresa: Sin asignar</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingProduct(product);
                                setIsProductFormOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                if (confirm(`¿Estás seguro de que deseas eliminar el producto "${product.name}"?`)) {
                                  try {
                                    console.log('[ProductsModal] Eliminando producto:', product.id);
                                    const response = await apiRequest('DELETE', `/api/products/${product.id}`);
                                    
                                    if (!response.ok) {
                                      let errorMessage = 'Error al eliminar producto';
                                      try {
                                        const errorData = await response.json();
                                        errorMessage = errorData.error || errorData.message || errorMessage;
                                      } catch (e) {
                                        errorMessage = `Error ${response.status}: ${response.statusText}`;
                                      }
                                      throw new Error(errorMessage);
                                    }
                                    
                                    toast({
                                      title: "Producto eliminado",
                                      description: `${product.name} ha sido eliminado.`,
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['/api/products'] });
                                  } catch (error: any) {
                                    console.error('[ProductsModal] Error al eliminar producto:', error);
                                    toast({
                                      title: "Error",
                                      description: error.message || "No se pudo eliminar el producto.",
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
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Form Dialog */}
      <ProductFormDialog
        isOpen={isProductFormOpen}
        onClose={() => {
          setIsProductFormOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        companies={companies}
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
  // Obtener empresas para el selector
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
  });

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
      company_id: client?.company_id?.toString() || '',
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
        company_id: client.company_id?.toString() || '',
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
        company_id: '',
      });
    }
  }, [client, form]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientFormSchema>) => {
      // Mapear campos del formulario a los campos esperados por createClientSchema
      const apiData = {
        name: data.name,
        email: data.email || undefined,
        // phone removido - no se usa en el backend
        rfc: data.rfc || undefined,
        billingAddr: data.billing_addr || undefined,
        shippingAddr: data.shipping_addr || undefined,
        isActive: data.is_active ?? true,
        companyId: parseInt(data.company_id) || undefined,
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
        companyId: parseInt(data.company_id) || undefined,
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

            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company: any) => (
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

// Schema para formulario de productos
const productFormSchema = z.object({
  name: z.string().min(1, 'El nombre del producto es requerido'),
  company_id: z.string().optional(),
});

// Componente de formulario para productos
function ProductFormDialog({ 
  isOpen, 
  onClose, 
  product, 
  companies,
  queryClient,
  toast 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  product: Product | null;
  companies: any[];
  queryClient: any;
  toast: any;
}) {
  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || '',
      company_id: product?.company_id?.toString() || '',
    },
  });

  // Resetear formulario cuando cambia el producto o se abre/cierra el diálogo
  React.useEffect(() => {
    if (!isOpen) {
      // Si el diálogo se cierra, resetear el formulario
      form.reset({
        name: '',
        company_id: '',
      });
      return;
    }
    
    if (product) {
      form.reset({
        name: product.name,
        company_id: product.company_id?.toString() || '',
      });
    } else {
      form.reset({
        name: '',
        company_id: '',
      });
    }
  }, [product, isOpen, form]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      console.log('[ProductForm] Creando producto:', data);
      try {
        const response = await apiRequest('POST', '/api/products', {
          name: data.name.trim(),
          companyId: data.company_id && data.company_id !== '' ? parseInt(data.company_id) : null
        });
        
        if (!response.ok) {
          let errorMessage = 'Error al crear producto';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('[ProductForm] Producto creado exitosamente:', result);
        return result;
      } catch (error: any) {
        console.error('[ProductForm] Error al crear producto:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Producto creado",
        description: "El producto ha sido creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el producto.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      console.log('[ProductForm] Actualizando producto:', product?.id, data);
      try {
        const response = await apiRequest('PUT', `/api/products/${product?.id}`, {
          name: data.name.trim(),
          companyId: data.company_id && data.company_id !== '' ? parseInt(data.company_id) : null
        });
        
        if (!response.ok) {
          let errorMessage = 'Error al actualizar producto';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('[ProductForm] Producto actualizado exitosamente:', result);
        return result;
      } catch (error: any) {
        console.error('[ProductForm] Error al actualizar producto:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Producto actualizado",
        description: "El producto ha sido actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el producto.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof productFormSchema>) => {
    if (product) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="w-5 h-5 text-primary" />
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Producto *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Aceite de Motor, Grano de Maíz, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa (Opcional)</FormLabel>
                  <FormControl>
                    <Select 
                      value={field.value || 'none'} 
                      onValueChange={(value) => {
                        field.onChange(value === 'none' ? '' : value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar (ambas empresas)</SelectItem>
                        {companies.map((company: any) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
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
                    {product ? 'Actualizar' : 'Crear'} Producto
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
