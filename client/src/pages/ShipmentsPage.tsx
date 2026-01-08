import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Map, Calendar, Truck, AlertTriangle, CheckCircle2, X, Lock } from "lucide-react";
import { useLocation } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShipmentCard } from "@/components/shipments/ShipmentCard";
import { FormattedDate } from "@/components/ui/formatted-date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { Shipment, Company } from "@shared/schema";

const StatusBadge = ({ status }: { status: Shipment['status'] }) => {
  const statusMap = {
    pending: { label: "Pendiente", variant: "outline" as const },
    in_transit: { label: "En tránsito", variant: "default" as const },
    delayed: { label: "Retrasado", variant: "destructive" as const },
    delivered: { label: "Entregado", variant: "success" as const },
    cancelled: { label: "Cancelado", variant: "secondary" as const },
  };

  const { label, variant } = statusMap[status] || { label: status, variant: "outline" as const };

  return <Badge variant={variant}>{label}</Badge>;
};

export default function ShipmentsPage() {
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState<boolean>(false);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Consulta para obtener empresas
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Consulta para obtener envíos
  const {
    data: shipmentsResponse,
    isLoading: isLoadingShipments,
    error: shipmentsError,
    refetch: refetchShipments
  } = useQuery<{ shipments: Shipment[] }>({
    queryKey: ["/api/shipments"],
  });

  // Extraer el array de shipments de la respuesta
  const shipments = shipmentsResponse?.shipments || [];

  useEffect(() => {
    if (shipmentsError) {
      toast({
        title: "Error al cargar envíos",
        description: "No se pudieron cargar los datos de envíos",
        variant: "destructive",
      });
    }
    
    // Log para depuración
    if (shipmentsResponse) {
      console.log("Respuesta de envíos:", shipmentsResponse);
      console.log("Array de envíos:", shipments);
      if (Array.isArray(shipments)) {
        const validShipments = shipments.filter(
          (shipment: Shipment) => shipment.departureDate && shipment.estimatedDeliveryDate
        );
        console.log("Envíos con fechas válidas:", validShipments);
      }
    }
  }, [shipmentsError, toast, shipmentsResponse, shipments]);

  // Filtrar envíos según la pestaña seleccionada
  const filteredShipments = Array.isArray(shipments)
    ? shipments.filter((shipment: Shipment) => {
        // Filtrar por estado
        const statusFilter = 
          selectedTab === "all" || 
          shipment.status === selectedTab;
        
        // Filtrar por empresa
        const companyFilter = 
          selectedCompany === "all" || 
          shipment.companyId === parseInt(selectedCompany);
        
        // Filtrar por búsqueda (código de seguimiento, cliente, producto, destino)
        const searchFilter = 
          !searchQuery || 
          shipment.trackingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shipment.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shipment.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shipment.destination.toLowerCase().includes(searchQuery.toLowerCase());
        
        return statusFilter && companyFilter && searchFilter;
      })
    : [];

  const handleViewDetails = (shipment: Shipment) => {
    setSelectedShipment(shipment);
  };

  const handleCloseDetails = () => {
    setSelectedShipment(null);
  };

  if (isLoadingShipments || isLoadingCompanies) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <AppLayout title="Trazabilidad de Envíos">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-600">
            Gestiona y rastrea tus envíos con el sistema Kanban
          </div>
          <Button onClick={() => setLocation("/shipments/new")}>Nuevo Envío</Button>
        </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por código, cliente, producto o destino..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tarjetas de resumen por estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {shipments && (
          <>
            <Card className="cursor-pointer" onClick={() => setSelectedTab("pending")}>
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="p-2 rounded-full bg-amber-100">
                  <Calendar className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pendientes</p>
                  <p className="text-2xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'pending').length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer" onClick={() => {
              setSelectedTab("in_transit");
              setIsRouteMapOpen(true);
            }}>
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="p-2 rounded-full bg-blue-100">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">En Tránsito</p>
                  <p className="text-2xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'in_transit').length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer" onClick={() => setSelectedTab("delayed")}>
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="p-2 rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Retrasados</p>
                  <p className="text-2xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'delayed').length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer" onClick={() => setSelectedTab("delivered")}>
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Entregados</p>
                  <p className="text-2xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'delivered').length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer" onClick={() => setSelectedTab("cancelled")}>
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="p-2 rounded-full bg-gray-100">
                  <X className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Cancelados</p>
                  <p className="text-2xl font-bold">
                    {shipments.filter((s: Shipment) => s.status === 'cancelled').length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Modal para vista de ruta */}
      <Dialog open={isRouteMapOpen} onOpenChange={setIsRouteMapOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Envíos en Tránsito</DialogTitle>
            <DialogDescription>
              Visualización de envíos actualmente en tránsito con detalles de ruta
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {shipments && shipments.filter((s: Shipment) => s.status === 'in_transit').length > 0 ? (
              <div className="space-y-4">
                {shipments
                  .filter((s: Shipment) => s.status === 'in_transit')
                  .map((shipment: Shipment) => (
                    <Card key={shipment.id} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{shipment.trackingCode}</CardTitle>
                            <CardDescription>{shipment.customerName} • {shipment.product}</CardDescription>
                          </div>
                          <StatusBadge status={shipment.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="flex flex-wrap gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Origen</p>
                            <p className="text-sm">{shipment.origin}</p>
                          </div>
                          <div className="flex-1 flex items-center justify-center px-4">
                            <div className="h-0.5 w-full bg-gray-200 relative">
                              <div 
                                className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-blue-500"
                                title="En ruta"
                              ></div>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Destino</p>
                            <p className="text-sm">{shipment.destination}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-500">Fecha de salida</p>
                            <p>{shipment.departureDate && new Date(shipment.departureDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Entrega estimada</p>
                            <p>{shipment.estimatedDeliveryDate && new Date(shipment.estimatedDeliveryDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Transportista</p>
                            <p>{shipment.carrier}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => {
                              setSelectedShipment(shipment);
                              setIsRouteMapOpen(false);
                            }}
                          >
                            Ver detalles completos
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                }
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay envíos en tránsito actualmente
              </div>
            )}
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="in_transit">En Tránsito</TabsTrigger>
          <TabsTrigger value="delayed">Retrasados</TabsTrigger>
          <TabsTrigger value="delivered">Entregados</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>
                Arrastra las tarjetas entre columnas para actualizar el estado - Mostrando {filteredShipments.length} envíos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredShipments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay envíos que coincidan con los filtros seleccionados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Fecha Estimada</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShipments.map((shipment: Shipment) => (
                        <TableRow key={shipment.id}>
                          <TableCell className="font-medium">
                            {shipment.trackingCode}
                          </TableCell>
                          <TableCell>{shipment.customerName}</TableCell>
                          <TableCell>{shipment.product}</TableCell>
                          <TableCell>
                            {shipment.quantity} {shipment.unit}
                          </TableCell>
                          <TableCell>{shipment.origin}</TableCell>
                          <TableCell>{shipment.destination}</TableCell>
                          <TableCell>
                            {shipment.status === 'delivered' && (shipment.actualDeliveryDate || shipment.deliveredAt) ? (
                              <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="font-semibold text-green-700 dark:text-green-300">
                                  <FormattedDate date={new Date(shipment.actualDeliveryDate || shipment.deliveredAt!)} />
                                </span>
                              </div>
                            ) : shipment.estimatedDeliveryDate ? (
                              <FormattedDate date={new Date(shipment.estimatedDeliveryDate)} />
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={shipment.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(shipment)}
                            >
                              Ver detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedShipment && (
        <ShipmentCard 
          shipment={selectedShipment} 
          onClose={handleCloseDetails}
          onRefresh={() => refetchShipments()}
        />
      )}
      </div>
    </AppLayout>
  );
}