import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, Leaf, Ruler, Fuel, PackageCheck, Truck, Clock, 
  AlertTriangle, CheckCircle, XCircle, Package, Map, Calendar, 
  CheckCircle2, X
} from "lucide-react";
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
import { ExportMenu } from "@/components/ui/export-menu";
import { ShipmentStatusUpdate } from "@/components/shipments/ShipmentStatusUpdate";
import { ShipmentKanbanBoard } from "@/components/shipments/ShipmentKanbanBoard";

// Tipos para empresas y envíos
interface Company {
  id: number;
  name: string;
  description?: string;
  sector?: string;
}

interface Shipment {
  id: number;
  companyId: number;
  trackingCode: string;
  customerName: string;
  destination: string;
  origin: string;
  product: string;
  quantity: string;
  unit: string;
  departureDate: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
  carrier: string;
  vehicleInfo: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  distance: string | null;
  carbonFootprint: string | null;
  driverName: string | null;
  driverPhone: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export function ShipmentTracker() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [totalCarbonFootprint, setTotalCarbonFootprint] = useState<number>(0);

  const { toast } = useToast();

  // Consulta para obtener empresas
  const { data: companies, isLoading: isLoadingCompanies, error: companiesError } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Consulta para obtener envíos
  const { 
    data: shipments, 
    isLoading: isLoadingShipments,
    error: shipmentsError,
    refetch: refetchShipments
  } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments"],
  });

  useEffect(() => {
    if (shipmentsError) {
      toast({
        title: "Error al cargar envíos",
        description: "No se pudieron cargar los datos de envíos",
        variant: "destructive",
      });
    }
  }, [shipmentsError, toast]);
  
  // Calcular huella de carbono total cuando los envíos cambian
  useEffect(() => {
    if (shipments) {
      let totalCarbonKg = 0;
      
      shipments.forEach((shipment: Shipment) => {
        if (shipment.carbonFootprint) {
          // Extraer solo los números del string (por si tiene "kg CO2e" u otros textos)
          const carbonValue = parseFloat(shipment.carbonFootprint.replace(/[^\d.-]/g, ''));
          if (!isNaN(carbonValue)) {
            totalCarbonKg += carbonValue;
          }
        }
      });
      
      setTotalCarbonFootprint(totalCarbonKg);
    }
  }, [shipments]);

  // Filtrar envíos según la pestaña seleccionada y ordenarlos de más reciente a más antiguo
  const filteredShipments = shipments && Array.isArray(shipments)
    ? shipments
        .filter((shipment: Shipment) => {
          try {
            // Validar que shipment tenga las propiedades necesarias
            if (!shipment || typeof shipment !== 'object') return false;
            
            // Filtrar por estado
            const statusFilter = 
              selectedTab === "all" || 
              (shipment.status && shipment.status === selectedTab);
            
            // Filtrar por empresa
            const companyFilter = 
              selectedCompany === "all" || 
              (shipment.companyId && shipment.companyId === parseInt(selectedCompany));
            
            // Filtrar por búsqueda (código de seguimiento, cliente, producto, destino)
            const searchFilter = 
              !searchQuery || 
              (shipment.trackingCode && shipment.trackingCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (shipment.customerName && shipment.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (shipment.product && shipment.product.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (shipment.destination && shipment.destination.toLowerCase().includes(searchQuery.toLowerCase()));
            
            return statusFilter && companyFilter && searchFilter;
          } catch (error) {
            console.error('Error filtering shipment:', error);
            return false;
          }
        })
        // Ordenar por fechas, priorizando la más reciente primero
        .sort((a, b) => {
          try {
            // Usar la fecha de creación si está disponible, o fechas de envío o entrega como alternativa
            const dateA = a.departureDate ? new Date(a.departureDate) : 
                         (a.estimatedDeliveryDate ? new Date(a.estimatedDeliveryDate) : new Date(0));
            const dateB = b.departureDate ? new Date(b.departureDate) : 
                         (b.estimatedDeliveryDate ? new Date(b.estimatedDeliveryDate) : new Date(0));
            
            // Ordenar descendente (de más reciente a más antiguo)
            return dateB.getTime() - dateA.getTime();
          } catch (error) {
            console.error('Error sorting shipments:', error);
            return 0;
          }
        })
    : [];

  const handleViewDetails = (shipment: Shipment) => {
    setSelectedShipment(shipment);
  };

  const handleCloseDetails = () => {
    setSelectedShipment(null);
  };
  
  // Calcular los totales por estado
  const getStatusCounts = () => {
    if (!shipments) return { pending: 0, in_transit: 0, delayed: 0, delivered: 0, cancelled: 0 };
    
    const counts: Record<string, number> = {
      pending: 0,
      in_transit: 0,
      delayed: 0,
      delivered: 0,
      cancelled: 0
    };
    
    shipments.forEach((shipment: Shipment) => {
      if (shipment.status in counts) {
        counts[shipment.status]++;
      }
    });
    
    return counts;
  };
  
  const statusCounts = getStatusCounts();

  // Mostrar carga mientras se obtienen los datos
  if (isLoadingShipments || isLoadingCompanies) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Mostrar error si hay problemas con la carga de datos
  if (shipmentsError || companiesError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Error al cargar datos</h2>
          <p className="text-gray-600 mt-2">
            {shipmentsError ? 'No se pudieron cargar los envíos' : 'No se pudieron cargar las empresas'}
          </p>
          <Button 
            onClick={() => {
              if (shipmentsError) refetchShipments();
              window.location.reload();
            }}
            className="mt-4"
          >
            Intentar de nuevo
          </Button>
        </div>
      </div>
    );
  }

  // Verificar que tenemos los datos necesarios - mostrar contenido vacío en lugar de error
  if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
    return (
      <div className="max-w-full">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Seguimiento de Envíos</h1>
            <p className="text-sm text-gray-500 mt-1">Responsable: <span className="font-medium text-primary">Thalia Rodriguez</span> - Departamento de Logística</p>
          </div>
          <Button onClick={() => setLocation("/shipments/new")}>Nuevo Envío</Button>
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Package className="h-16 w-16 text-gray-400" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">No hay envíos registrados</h2>
            <p className="text-gray-600 mt-2">Comienza creando tu primer envío</p>
            <Button onClick={() => setLocation("/shipments/new")} className="mt-4">
              Crear primer envío
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Seguimiento de Envíos</h1>
          <p className="text-sm text-gray-500 mt-1">Responsable: <span className="font-medium text-primary">Thalia Rodriguez</span> - Departamento de Logística</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu 
            data={filteredShipments} 
            type="shipments" 
            title={`Reporte de Envíos - ${selectedTab === 'all' ? 'Todos' : selectedTab}`}
            disabled={!filteredShipments.length} 
          />
          <Button onClick={() => setLocation("/shipments/new")}>Nuevo Envío</Button>
        </div>
      </div>
      
      {/* Resumen de estados de los envíos - Versión más minimalista */}
      <div className="mb-6">
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-primary py-3 px-4">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-white mr-2" />
              <CardTitle className="text-white text-lg">Resumen de Envíos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 divide-x divide-y sm:divide-y-0 border-t">
              {/* Por Enviar (Pendientes) */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setSelectedTab("pending");
                  setSelectedStatus("pending");
                  setIsRouteMapOpen(true);
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    <p className="text-sm font-medium">Por Enviar</p>
                  </div>
                  <p className="text-3xl font-semibold text-[#273949]">{statusCounts.pending}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <PackageCheck className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              
              {/* En Tránsito */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setSelectedTab("in_transit");
                  setSelectedStatus("in_transit");
                  setIsRouteMapOpen(true);
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mr-2"></div>
                    <p className="text-sm font-medium">En Tránsito</p>
                  </div>
                  <p className="text-3xl font-semibold text-[#273949]">{statusCounts.in_transit}</p>
                </div>
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Truck className="h-5 w-5 text-orange-500" />
                </div>
              </div>
              
              {/* Retrasados */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setSelectedTab("delayed");
                  setSelectedStatus("delayed");
                  setIsRouteMapOpen(true);
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                    <p className="text-sm font-medium">Retrasados</p>
                  </div>
                  <p className="text-3xl font-semibold text-[#273949]">{statusCounts.delayed}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
              
              {/* Entregados */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setSelectedTab("delivered");
                  setSelectedStatus("delivered");
                  setIsRouteMapOpen(true);
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-[#b5e951] mr-2"></div>
                    <p className="text-sm font-medium">Entregados</p>
                  </div>
                  <p className="text-3xl font-semibold text-[#273949]">{statusCounts.delivered}</p>
                </div>
                <div className="w-10 h-10 bg-[#edfad2] rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-[#b5e951]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tarjeta de resumen de huella de carbono - Versión más minimalista */}
      <div className="mb-6">
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-[#b5e951] py-3 px-4">
            <div className="flex items-center">
              <Leaf className="h-5 w-5 text-[#273949] mr-2" />
              <CardTitle className="text-[#273949] text-lg">Huella de Carbono</CardTitle>
            </div>
            <CardDescription className="text-[#1e2e3c] mt-1">
              Emisiones totales de CO₂ de todos los envíos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-end">
                  <span className="text-4xl font-bold text-[#273949]">{(totalCarbonFootprint / 1000).toFixed(2)}</span>
                  <span className="text-lg ml-2 text-gray-600">toneladas CO₂e</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Basado en {shipments?.length || 0} envíos registrados
                </p>
              </div>
              <div className="bg-[#edfad2] p-3 rounded-lg">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#b5e951] flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-[#273949]" />
                  </div>
                  <span className="text-xs font-medium text-[#273949] mt-1">Alcance 3</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-3 bg-gray-50 p-2 rounded">
              <span className="font-medium">NOTA:</span> Estos datos son utilizados para reportes de emisiones de gases de efecto invernadero según el Protocolo GHG. Las emisiones de Alcance 3 incluyen las indirectas producidas en nuestra cadena de valor.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="text-center text-gray-600">
            Los filtros se gestionan desde el tablero Kanban
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          Arrastra las tarjetas entre columnas para actualizar estados
        </div>
      </div>

      <ShipmentKanbanBoard />



      {/* Modal para vista de envíos por estado */}
      <Dialog open={isRouteMapOpen} onOpenChange={setIsRouteMapOpen}>
        <DialogContent className="max-w-4xl h-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedStatus === 'pending' && <div className="p-2 bg-blue-100 rounded-full"><PackageCheck className="h-5 w-5 text-blue-600" /></div>}
              {selectedStatus === 'in_transit' && <div className="p-2 bg-orange-100 rounded-full"><Truck className="h-5 w-5 text-orange-600" /></div>}
              {selectedStatus === 'delayed' && <div className="p-2 bg-red-100 rounded-full"><AlertTriangle className="h-5 w-5 text-red-600" /></div>}
              {selectedStatus === 'delivered' && <div className="p-2 bg-[#edfad2] rounded-full"><CheckCircle className="h-5 w-5 text-[#b5e951]" /></div>}
              {selectedStatus === 'cancelled' && <div className="p-2 bg-gray-100 rounded-full"><XCircle className="h-5 w-5 text-gray-600" /></div>}
              <DialogTitle>
                {selectedStatus === 'pending' && 'Envíos Pendientes'}
                {selectedStatus === 'in_transit' && 'Envíos en Tránsito'}
                {selectedStatus === 'delayed' && 'Envíos Retrasados'}
                {selectedStatus === 'delivered' && 'Envíos Entregados'}
                {selectedStatus === 'cancelled' && 'Envíos Cancelados'}
              </DialogTitle>
            </div>
            <DialogDescription>
              {selectedStatus === 'pending' && 'Visualización de envíos pendientes programados para salir próximamente'}
              {selectedStatus === 'in_transit' && 'Visualización de envíos actualmente en tránsito con detalles de ruta'}
              {selectedStatus === 'delayed' && 'Visualización de envíos retrasados que requieren atención inmediata'}
              {selectedStatus === 'delivered' && 'Visualización de envíos completados y entregados correctamente'}
              {selectedStatus === 'cancelled' && 'Visualización de envíos cancelados y sus motivos'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {shipments && shipments.filter((s: Shipment) => s.status === selectedStatus).length > 0 ? (
              <div className="space-y-4">
                {shipments
                  .filter((s: Shipment) => s.status === selectedStatus)
                  // Ordenar por fechas, priorizando la más reciente primero
                  .sort((a, b) => {
                    const dateA = a.departureDate ? new Date(a.departureDate) : 
                                 (a.estimatedDeliveryDate ? new Date(a.estimatedDeliveryDate) : new Date(0));
                    const dateB = b.departureDate ? new Date(b.departureDate) : 
                                 (b.estimatedDeliveryDate ? new Date(b.estimatedDeliveryDate) : new Date(0));
                    
                    // Ordenar descendente (de más reciente a más antiguo)
                    return dateB.getTime() - dateA.getTime();
                  })
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
                              {/* Línea con etiquetas de Origen y Destino */}
                              <div className="absolute -top-1 left-0 -translate-x-0 text-xs font-medium text-gray-500">
                                Origen
                              </div>
                              <div className="absolute -top-1 right-0 translate-x-0 text-xs font-medium text-gray-500">
                                Destino
                              </div>
                              
                              {/* Camión/pipa según el estado */}
                              <div 
                                className={`absolute -top-3 ${
                                  shipment.status === 'delivered' ? 'right-0' : 'left-1/2 -translate-x-1/2'
                                }`}
                                title={
                                  shipment.status === 'pending' ? 'Por enviar' :
                                  shipment.status === 'in_transit' ? 'En tránsito' :
                                  shipment.status === 'delayed' ? 'Retrasado' :
                                  shipment.status === 'delivered' ? 'Entregado' : 'Cancelado'
                                }
                              >
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  viewBox="0 0 640 512" 
                                  fill={
                                    shipment.status === 'delayed' ? '#ef4444' : 
                                    shipment.status === 'delivered' ? '#4ade80' : 
                                    shipment.status === 'in_transit' ? '#f97316' : 
                                    shipment.status === 'pending' ? '#3b82f6' : 
                                    '#6b7280'
                                  }
                                  width="24" 
                                  height="24"
                                >
                                  <path d="M32 96c0-35.3 28.7-64 64-64H320c23.7 0 44.4 12.9 55.4 32h51.8c25.3 0 48.2 14.9 58.5 38l52.8 118.8c.5 1.1 .9 2.3 1.3 3.5 6.5 2.5 12.7 5.5 18.7 9.1 18.9 11.3 34.1 28.3 43.8 48.8 9.2 19.4 14 40.5 14.1 61.7L640 409.1v7c0 22.1-17.9 40-40 40H608c0 8.8-7.2 16-16 16s-16-7.2-16-16H378.5c0 8.8-7.2 16-16 16s-16-7.2-16-16H320 288 205.5c0 8.8-7.2 16-16 16s-16-7.2-16-16H64c-8.8 0-16-7.2-16-16V409.1C27.8 407.9 8.4 393.9 2.6 373.3c-2.1-7.9 2.5-16.1 10.4-18.3s16.1 2.5 18.3 10.4c3.3 11.9 14.2 20.2 26.7 20.5l32 .9c23.5 .7 42.9-17.8 43.6-41.2s-17.8-42.9-41.2-43.6l-25.6-.7c-12.2-.3-22.8-8.2-27.4-19.8C29.1 255.8 32 228.3 32 200.7V96zm345.6 160H485.3l-42.7-96H390.9c-3.1 5.6-6.8 10.9-11.1 15.6-14.8 16.4-34.5 27.8-57.2 31.8V256zM151.5 176c6.6-18.6 24.4-32 45.3-32h48.5c-7.4 11.4-11.2 24.4-11.2 38.1c0 38.2 30.4 69.3 68.3 70.5l.7 0c30.1-1.2 54.9-23.4 61.1-52.5H440c-.2 34.5-6.4 61.9-16.7 82.3-12.4 24.3-30.6 39.4-54 43.2-10.5 1.7-21.6 2.1-32.7 1.3-15.3 24.9-42.8 41.5-74.1 41.5c-24.7 0-46.9-10.2-62.7-26.5c-2.9-.5-5.7-1-8.6-1.5c-28.9-5.4-54.8-20.8-73.2-42.2c-13.2-15.4-22.8-33.5-28.1-53.1c-2.2-8.1-3.9-16.5-5.1-25.1l5.1 .1c8.8 .2 16.9 3.3 23.4 8.3c7.1-11.8 17.7-21.2 30.7-26.5c6.2-2.6 12.9-4.1 19.9-4.4z"/>
                                </svg>
                              </div>
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
                {selectedStatus === 'pending' && 'No hay envíos pendientes actualmente'}
                {selectedStatus === 'in_transit' && 'No hay envíos en tránsito actualmente'}
                {selectedStatus === 'delayed' && 'No hay envíos retrasados actualmente'}
                {selectedStatus === 'delivered' && 'No hay envíos entregados actualmente'}
                {selectedStatus === 'cancelled' && 'No hay envíos cancelados actualmente'}
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
    </div>
  );
}