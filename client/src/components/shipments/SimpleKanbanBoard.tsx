import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FormattedDate } from "@/components/ui/formatted-date";
import { apiRequest } from "@/lib/queryClient";
import { 
  Package, 
  MapPin, 
  Calendar, 
  User, 
  Truck 
} from "lucide-react";

interface Shipment {
  id: number;
  trackingCode: string;
  customerName: string;
  product: string;
  quantity: number;
  unit: string;
  origin: string;
  destination: string;
  status: string;
  estimatedDeliveryDate: string | null;
  createdAt: string;
  carbonFootprint: number;
  customerEmail?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusMap = {
    pending: { label: "Pendiente", variant: "outline" as const, color: "bg-blue-100 text-blue-800" },
    in_transit: { label: "En Tránsito", variant: "default" as const, color: "bg-orange-100 text-orange-800" },
    delayed: { label: "Retrasado", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
    delivered: { label: "Entregado", variant: "success" as const, color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelado", variant: "secondary" as const, color: "bg-gray-100 text-gray-800" },
  };

  const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: "outline" as const, color: "bg-gray-100 text-gray-800" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const ShipmentCard = ({ shipment, onStatusChange }: { shipment: Shipment; onStatusChange: (id: number, newStatus: string) => void }) => {
  return (
    <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-semibold text-sm">{shipment.trackingCode}</h4>
            <p className="text-xs text-gray-600">{shipment.customerName}</p>
          </div>
          <StatusBadge status={shipment.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Package className="h-3 w-3" />
            <span>{shipment.product}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="h-3 w-3" />
            <span>{shipment.origin} → {shipment.destination}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Calendar className="h-3 w-3" />
            <span>
              {shipment.estimatedDeliveryDate 
                ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString()
                : "Sin fecha"
              }
            </span>
          </div>
        </div>
        
        <div className="mt-3 flex gap-1">
          {shipment.status === 'pending' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(shipment.id, 'in_transit')}>
              Marcar en Tránsito
            </Button>
          )}
          {shipment.status === 'in_transit' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(shipment.id, 'delivered')}>
              Marcar Entregado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const KanbanColumn = ({ title, status, shipments, onStatusChange }: { 
  title: string; 
  status: string; 
  shipments: Shipment[]; 
  onStatusChange: (id: number, newStatus: string) => void;
}) => {
  const filteredShipments = shipments.filter(s => s.status === status);
  
  return (
    <div className="flex-1 min-w-72">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            {title}
            <Badge variant="outline">{filteredShipments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredShipments.map((shipment) => (
              <ShipmentCard 
                key={shipment.id} 
                shipment={shipment} 
                onStatusChange={onStatusChange}
              />
            ))}
            {filteredShipments.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No hay envíos
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export function SimpleKanbanBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener envíos
  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ['/api/shipments'],
  });

  // Mutación para actualizar estado
  const updateStatusMutation = useMutation({
    mutationFn: async ({ shipmentId, status }: { shipmentId: number; status: string }) => {
      return await apiRequest(`/api/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        body: {
          status,
          sendNotification: true,
          comments: `Estado actualizado a ${status}`,
          location: null
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Estado actualizado",
        description: "El estado del envío se actualizó correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el estado",
        variant: "destructive",
      });
    }
  });

  const handleStatusChange = (shipmentId: number, newStatus: string) => {
    updateStatusMutation.mutate({ shipmentId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Cargando envíos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn 
          title="Pendientes" 
          status="pending" 
          shipments={shipments} 
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn 
          title="En Tránsito" 
          status="in_transit" 
          shipments={shipments} 
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn 
          title="Entregados" 
          status="delivered" 
          shipments={shipments} 
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn 
          title="Retrasados" 
          status="delayed" 
          shipments={shipments} 
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn 
          title="Cancelados" 
          status="cancelled" 
          shipments={shipments} 
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}