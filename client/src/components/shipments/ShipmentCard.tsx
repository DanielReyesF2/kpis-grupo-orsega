import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Truck, Calendar, MapPin, Package, User, Phone, Mail, AlertTriangle, Clock, Check, RotateCw, Leaf, Ruler, Fuel, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShipmentMap } from "./ShipmentMap";
import { getCoordinates } from "@/utils/geo-utils";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useToast } from "@/hooks/use-toast";
import { FormattedDate } from "@/components/ui/formatted-date";
import { ShipmentStatusUpdate } from "./ShipmentStatusUpdate";
import type { Shipment } from "@shared/schema";

// Local schema definition for update form
const updateShipmentSchema = z.object({
  status: z.enum(['pending', 'in_transit', 'delayed', 'delivered', 'cancelled']).optional(),
  comments: z.string().optional(),
  location: z.string().optional(),
});

type UpdateShipmentFormValues = z.infer<typeof updateShipmentSchema>;

interface ShipmentUpdate {
  id: number;
  shipmentId: number;
  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
  timestamp: string;
  location: string | null;
  comments: string | null;
  updatedBy: number | null;
}

interface ShipmentCardProps {
  shipment: Shipment;
  onClose: () => void;
  onRefresh: () => void;
}

export function ShipmentCard({ shipment, onClose, onRefresh }: ShipmentCardProps) {
  const { toast } = useToast();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  // Consulta para obtener actualizaciones del envío
  const { data: updates = [], isLoading: isLoadingUpdates, refetch: refetchUpdates } = useQuery<ShipmentUpdate[]>({
    queryKey: [`/api/shipments/${shipment.id}/updates`],
  });
  
  // Consulta para obtener los datos de la empresa
  interface Company {
    id: number;
    name: string;
    description: string;
  }
  
  const { data: company } = useQuery<Company>({
    queryKey: [`/api/companies/${shipment.companyId}`],
  });

  // Formulario para agregar actualizaciones
  const form = useForm<UpdateShipmentFormValues>({
    resolver: zodResolver(updateShipmentSchema),
    defaultValues: {
      status: shipment.status,
    },
  });
  
  // Mutación para agregar una actualización
  const createUpdateMutation = useMutation({
    mutationFn: async (values: UpdateShipmentFormValues) => {
      const response = await apiRequest(
        "POST", 
        `/api/shipments/${shipment.id}/updates`, 
        values
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Actualización creada",
        description: "La actualización del envío se ha creado correctamente",
      });
      // Cerrar el diálogo
      setUpdateDialogOpen(false);
      // Limpiar el formulario
      form.reset();
      // Refrescar actualizaciones
      refetchUpdates();
      // Refrescar lista de envíos
      onRefresh();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la actualización",
        variant: "destructive",
      });
    },
  });

  // Estado del envío con colores y etiquetas
  const getStatusInfo = (status: Shipment['status']) => {
    const statusMap = {
      pending: { 
        label: "Pendiente", 
        color: "bg-slate-200", 
        icon: <Clock className="h-5 w-5" /> 
      },
      in_transit: { 
        label: "En tránsito", 
        color: "bg-blue-100", 
        icon: <Truck className="h-5 w-5" /> 
      },
      delayed: { 
        label: "Retrasado", 
        color: "bg-red-100", 
        icon: <AlertTriangle className="h-5 w-5" /> 
      },
      delivered: { 
        label: "Entregado", 
        color: "bg-green-100", 
        icon: <Check className="h-5 w-5" /> 
      },
      cancelled: { 
        label: "Cancelado", 
        color: "bg-gray-100", 
        icon: <X className="h-5 w-5" /> 
      },
    };

    return statusMap[status] || { label: status, color: "bg-gray-100", icon: null };
  };

  const onSubmit = (values: UpdateShipmentFormValues) => {
    createUpdateMutation.mutate(values);
  };

  const { label: statusLabel, color: statusColor, icon: statusIcon } = getStatusInfo(shipment.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-2xl">
              Orden de Compra: {shipment.purchaseOrder}
            </CardTitle>
            <CardDescription>
              {company?.name} • Código: {shipment.trackingCode} • Creado el{" "}
              <FormattedDate date={shipment.createdAt ? new Date(shipment.createdAt) : new Date()} />
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <Tabs defaultValue="details">
          <CardContent className="pt-6">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="timeline">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex-1 space-y-4">
                  {/* Información del envío */}
                  <div className="bg-slate-50 p-4 rounded-md">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className={`p-2 rounded-full ${statusColor}`}>
                        {statusIcon}
                      </div>
                      <h3 className="text-lg font-semibold">Estado: {statusLabel}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Producto:</span> {shipment.product}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium ml-6">Cantidad:</span> {shipment.quantity} {shipment.unit}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Origen:</span> {shipment.origin}
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Destino:</span> {shipment.destination}
                        </div>
                      </div>
                    </div>
                    
                    {/* Mapa interactivo */}
                    <div className="mt-4">
                      <ShipmentMap
                        origin={{
                          ...getCoordinates(shipment.origin),
                          name: shipment.origin
                        }}
                        destination={{
                          ...getCoordinates(shipment.destination),
                          name: shipment.destination
                        }}
                        currentLocation={
                          updates && updates.length > 0 && updates[0].location
                            ? {
                                ...getCoordinates(updates[0].location),
                                name: updates[0].location
                              }
                            : undefined
                        }
                        status={shipment.status}
                      />
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Fecha de salida:</span>{" "}
                          {shipment.departureDate ? (
                            <FormattedDate date={new Date(shipment.departureDate)} />
                          ) : (
                            "No definida"
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Fecha estimada de entrega:</span>{" "}
                          {shipment.estimatedDeliveryDate ? (
                            <FormattedDate date={new Date(shipment.estimatedDeliveryDate)} />
                          ) : (
                            "No definida"
                          )}
                        </div>

                        {(shipment.actualDeliveryDate || (shipment as any).deliveredAt) && (
                          <div className="flex items-center space-x-2">
                            <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-medium text-green-700 dark:text-green-300">Fecha real de entrega:</span>{" "}
                            <span className="font-semibold text-green-700 dark:text-green-300">
                              <FormattedDate date={new Date(shipment.actualDeliveryDate || (shipment as any).deliveredAt)} />
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Transportista:</span> {shipment.carrier}
                        </div>
                        {shipment.vehicleInfo && (
                          <div className="flex items-center space-x-2">
                            <span className="font-medium ml-6">Vehículo:</span> {shipment.vehicleInfo}
                          </div>
                        )}
                        {shipment.driverName && (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Conductor:</span> {shipment.driverName}
                          </div>
                        )}
                        {shipment.driverPhone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Teléfono del conductor:</span> {shipment.driverPhone}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Información del responsable de logística */}
                    <div className="mt-4 bg-blue-50 p-3 rounded-md border border-blue-100">
                      <h3 className="text-sm font-semibold mb-2 text-primary">Responsable de Logística</h3>
                      <div className="flex items-center space-x-2 mb-1">
                        <User className="h-4 w-4 text-primary" />
                        <span className="text-sm text-gray-700">Thalia Rodriguez</span>
                      </div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="text-sm text-gray-700">thalia.rodriguez@econova.mx</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="text-sm text-gray-700">+52 (55) 1234-5678</span>
                      </div>
                    </div>
                  </div>

                  {/* Información de huella de carbono */}
                  {(shipment.carbonFootprint || shipment.distance || shipment.vehicleType || shipment.fuelType) && (
                    <div className="bg-green-50 p-4 rounded-md border border-green-100">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="p-2 rounded-full bg-green-100">
                          <Leaf className="h-5 w-5 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-green-800">Huella de Carbono</h3>
                      </div>
                      
                      {/* Sección principal - datos de emisiones */}
                      {shipment.carbonFootprint && (
                        <div className="flex flex-col items-center mb-6 bg-white p-4 rounded-lg border border-green-200">
                          <h4 className="text-green-800 font-medium mb-2">Emisiones de CO₂</h4>
                          <div className="text-4xl font-bold text-green-800 flex items-end">
                            {shipment.carbonFootprint}
                            <span className="text-xl ml-1 font-normal">kg CO₂e</span>
                          </div>
                          <p className="mt-2 text-green-600 text-sm text-center">
                            Equivalente a <span className="font-semibold">{(parseFloat(shipment.carbonFootprint.replace(/[^\d.-]/g, '')) / 1000).toFixed(2)}</span> toneladas de CO₂
                          </p>
                        </div>
                      )}
                      
                      {/* Sección de detalles */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        {shipment.distance && (
                          <div className="bg-white p-3 rounded-lg border border-green-200">
                            <div className="flex flex-col items-center">
                              <Ruler className="h-5 w-5 text-green-600 mb-1" />
                              <span className="font-medium text-green-800 text-sm">Distancia</span> 
                              <span className="text-lg font-bold text-green-700">{shipment.distance} km</span>
                            </div>
                          </div>
                        )}
                        
                        {shipment.vehicleType && (
                          <div className="bg-white p-3 rounded-lg border border-green-200">
                            <div className="flex flex-col items-center">
                              <Truck className="h-5 w-5 text-green-600 mb-1" />
                              <span className="font-medium text-green-800 text-sm">Vehículo</span> 
                              <span className="text-lg font-bold text-green-700">{shipment.vehicleType}</span>
                            </div>
                          </div>
                        )}
                        
                        {shipment.fuelType && (
                          <div className="bg-white p-3 rounded-lg border border-green-200">
                            <div className="flex flex-col items-center">
                              <Fuel className="h-5 w-5 text-green-600 mb-1" />
                              <span className="font-medium text-green-800 text-sm">Combustible</span> 
                              <span className="text-lg font-bold text-green-700">{shipment.fuelType}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 text-xs text-green-600 bg-green-50 p-2 rounded border-t border-green-100">
                        <span className="font-semibold">¿Cómo se calcula?</span> La huella de carbono se determina en base al tipo de vehículo, 
                        combustible utilizado y distancia recorrida, usando factores de emisión estándar de la industria.
                        <br/><br/>
                        <span className="font-semibold">Nota:</span> Esta información es utilizada para nuestros reportes de sostenibilidad y emisiones de Alcance 3.
                      </div>
                    </div>
                  )}

                  {/* Información del cliente */}
                  <div className="bg-slate-50 p-4 rounded-md">
                    <h3 className="text-lg font-semibold mb-4">Información del Cliente</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Cliente:</span> {shipment.customerName}
                      </div>
                      {shipment.customerEmail && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Email:</span> {shipment.customerEmail}
                        </div>
                      )}
                      {shipment.customerPhone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Teléfono:</span> {shipment.customerPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comentarios */}
                  {shipment.comments && (
                    <div className="bg-slate-50 p-4 rounded-md">
                      <h3 className="text-lg font-semibold mb-2">Comentarios</h3>
                      <p className="text-gray-700">{shipment.comments}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Componente de actualización de estado */}
                <ShipmentStatusUpdate 
                  shipment={shipment} 
                  onUpdate={() => {
                    onRefresh();
                    refetchUpdates();
                  }}
                />
                
                {/* Historial de actualizaciones */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Historial de Actualizaciones</h3>
                  {isLoadingUpdates ? (
                    <div className="text-center py-8">
                      <RotateCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="mt-2 text-muted-foreground">Cargando historial de actualizaciones...</p>
                    </div>
                  ) : updates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No hay actualizaciones disponibles para este envío
                    </div>
                  ) : (
                    <div className="relative space-y-8 before:absolute before:inset-0 before:left-5 before:h-full before:border-l-2 before:border-slate-200 pl-12">
                      {updates.map((update: ShipmentUpdate) => {
                        const { color, icon } = getStatusInfo(update.status);
                        return (
                          <div key={update.id} className="relative">
                            <div className={`absolute left-0 -translate-x-[27px] p-1.5 rounded-full ${color}`}>
                              {icon}
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                              <p className="text-sm text-muted-foreground">
                                <FormattedDate date={new Date(update.timestamp)} showTime />
                              </p>
                              <h4 className="text-lg font-medium mt-1">
                                {getStatusInfo(update.status).label}
                                {update.location && (
                                  <span className="font-normal"> - {update.location}</span>
                                )}
                              </h4>
                              {update.comments && <p className="mt-2">{update.comments}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>

        <CardFooter className="flex justify-between border-t px-6 py-4 mt-auto">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}