import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'wouter';
import { 
  Package, 
  Users, 
  Truck, 
  Plus, 
  Clock,
  ArrowLeft,
  Home,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DragDropKanban } from '@/components/shipments/DragDropKanban';

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



export default function LogisticsPage() {
  const [activeModal, setActiveModal] = useState<'clients' | 'providers' | null>(null);

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
    <div className="container mx-auto p-6">
      {/* Navigation breadcrumb */}
      <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
        <Link href="/" className="flex items-center hover:text-blue-600 transition-colors">
          <Home className="w-4 h-4 mr-1" />
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Módulo de Logística</span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="text-blue-600 hover:text-blue-800 transition-colors">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <span className="text-gray-300">|</span>
            
          </div>
        </div>
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
          <div className="text-sm font-medium text-gray-500 mb-3">Base de Datos</div>
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
              <Button data-testid="button-new-client">
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`button-edit-client-${client.id}`}
                        >
                          Editar
                        </Button>
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
              <Button data-testid="button-new-provider">
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`button-edit-provider-${provider.id}`}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}