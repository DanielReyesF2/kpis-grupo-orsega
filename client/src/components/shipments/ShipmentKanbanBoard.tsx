import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  useDroppable,
  useDraggable,
  closestCenter
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Clock, Truck, CheckCircle, AlertTriangle, XCircle, Package, 
  MapPin, User, Calendar, Mail, Phone, Leaf 
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FormattedDate } from "@/components/ui/formatted-date";
import { apiRequest } from "@/lib/queryClient";
import { Shipment } from "@shared/schema";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  color: string;
  icon: React.ComponentType<any>;
  count: number;
}

interface ShipmentCardProps {
  shipment: Shipment;
  isDragging?: boolean;
  onViewDetails?: (shipment: Shipment) => void;
}

interface DroppableColumnProps {
  column: KanbanColumn;
  shipments: Shipment[];
  onViewDetails: (shipment: Shipment) => void;
}

interface UpdateConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sendNotification: boolean, comments?: string, invoiceNumber?: string) => void;
  shipment: Shipment | null;
  newStatus: string;
}

const columns: KanbanColumn[] = [
  {
    id: "pending",
    title: "Pendientes",
    status: "pending",
    color: "bg-blue-50 border-blue-200",
    icon: Clock,
    count: 0
  },
  {
    id: "in_transit",
    title: "En Tránsito",
    status: "in_transit",
    color: "bg-yellow-50 border-yellow-200",
    icon: Truck,
    count: 0
  },
  {
    id: "delivered",
    title: "Entregados",
    status: "delivered",
    color: "bg-green-50 border-green-200",
    icon: CheckCircle,
    count: 0
  },
  {
    id: "delayed",
    title: "Retrasados",
    status: "delayed",
    color: "bg-red-50 border-red-200",
    icon: AlertTriangle,
    count: 0
  },
  {
    id: "cancelled",
    title: "Cancelados",
    status: "cancelled",
    color: "bg-gray-50 border-gray-200",
    icon: XCircle,
    count: 0
  }
];

const statusColors = {
  pending: "bg-blue-500 text-white",
  in_transit: "bg-yellow-500 text-white",
  delivered: "bg-green-500 text-white",
  delayed: "bg-red-500 text-white",
  cancelled: "bg-gray-500 text-white"
};

function ShipmentCard({ shipment, isDragging, onViewDetails }: ShipmentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: shipment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">{shipment.purchaseOrder}</CardTitle>
          <Badge className={statusColors[shipment.status as keyof typeof statusColors]}>
            {shipment.status === 'pending' && 'Pendiente'}
            {shipment.status === 'in_transit' && 'En Tránsito'}
            {shipment.status === 'delivered' && 'Entregado'}
            {shipment.status === 'delayed' && 'Retrasado'}
            {shipment.status === 'cancelled' && 'Cancelado'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Código: {shipment.trackingCode}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">{shipment.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{shipment.product}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{shipment.destination}</span>
          </div>
          {shipment.estimatedDeliveryDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                <FormattedDate date={new Date(shipment.estimatedDeliveryDate)} />
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          {shipment.customerEmail && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Email disponible</span>
            </div>
          )}
          {shipment.carbonFootprint && (
            <div className="flex items-center gap-1">
              <Leaf className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">{shipment.carbonFootprint}</span>
            </div>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-2"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.(shipment);
          }}
        >
          Ver detalles
        </Button>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({ column, shipments, onViewDetails }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.icon;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[300px] p-4 rounded-lg border-2 transition-colors ${
        column.color
      } ${isOver ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{column.title}</h3>
        </div>
        <Badge variant="secondary">{shipments.length}</Badge>
      </div>
      
      <div className="space-y-3">
        <SortableContext items={shipments.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {shipments.map((shipment) => (
            <ShipmentCard 
              key={shipment.id} 
              shipment={shipment} 
              onViewDetails={onViewDetails}
            />
          ))}
        </SortableContext>
        
        {shipments.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay envíos en esta columna</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UpdateConfirmationDialog({ isOpen, onClose, onConfirm, shipment, newStatus }: UpdateConfirmationProps) {
  const [sendNotification, setSendNotification] = useState(true);
  const [comments, setComments] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const { toast } = useToast();

  const statusLabels = {
    pending: "Pendiente",
    in_transit: "En Tránsito", 
    delivered: "Entregado",
    delayed: "Retrasado",
    cancelled: "Cancelado"
  };

  // Verificar si se requiere número de factura (de pending a in_transit)
  const requiresInvoice = shipment?.status === 'pending' && newStatus === 'in_transit';

  const handleConfirm = () => {
    // Validar que el número de factura esté presente si es requerido
    if (requiresInvoice && !invoiceNumber.trim()) {
      toast({
        title: "Número de factura requerido",
        description: "Debe proporcionar el número de factura para cambiar el envío a 'En Tránsito'",
        variant: "destructive"
      });
      return;
    }

    onConfirm(sendNotification, comments, invoiceNumber);
    setComments("");
    setInvoiceNumber("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar actualización de estado</DialogTitle>
          <DialogDescription>
            ¿Deseas cambiar el estado del envío <strong>{shipment?.trackingCode}</strong> a <strong>{statusLabels[newStatus as keyof typeof statusLabels]}</strong>?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {requiresInvoice && (
            <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Label htmlFor="invoiceNumber" className="text-amber-900 font-semibold">
                Número de Factura *
              </Label>
              <input
                id="invoiceNumber"
                type="text"
                className="w-full px-3 py-2 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ingrese el número de factura..."
                required
              />
              <p className="text-xs text-amber-700">
                El número de factura es obligatorio para cambiar el envío a "En Tránsito"
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium text-sm">Notificar al cliente por email</p>
                <p className="text-xs text-gray-600">
                  {shipment?.customerEmail 
                    ? `Se enviará a: ${shipment.customerEmail}`
                    : 'Cliente sin email registrado'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={sendNotification}
              onCheckedChange={setSendNotification}
              disabled={!shipment?.customerEmail}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="comments">Comentarios (opcional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Notas adicionales sobre la actualización..."
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar actualización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShipmentKanbanBoard() {
  console.log("[ShipmentKanbanBoard] Componente renderizado");
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedShipment, setDraggedShipment] = useState<Shipment | null>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
    newStatus: string;
  }>({
    isOpen: false,
    shipment: null,
    newStatus: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener envíos
  const { data: shipments = [], isLoading, refetch } = useQuery<Shipment[]>({
    queryKey: ['/api/shipments'],
  });

  console.log("[ShipmentKanbanBoard] Shipments loaded:", shipments.length, "items");

  // Mutación para actualizar estado
  const updateStatusMutation = useMutation({
    mutationFn: async ({ shipmentId, status, sendNotification, comments, invoiceNumber }: {
      shipmentId: number;
      status: string;
      sendNotification: boolean;
      comments?: string;
      invoiceNumber?: string;
    }) => {
      const response = await apiRequest(`/api/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        body: {
          status,
          sendNotification,
          comments,
          invoiceNumber,
          location: null // Campo requerido por el endpoint
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Estado actualizado",
        description: data.notificationSent 
          ? "Se actualizó el estado y se envió notificación al cliente"
          : "Se actualizó el estado correctamente",
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

  // Agrupar envíos por estado
  const groupedShipments = shipments.reduce((acc, shipment) => {
    const status = shipment.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(shipment);
    return acc;
  }, {} as Record<string, Shipment[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    const shipment = shipments.find(s => s.id === active.id);
    setDraggedShipment(shipment || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setDraggedShipment(null);
      return;
    }

    const shipmentId = active.id as number;
    const newStatus = over.id as string;
    const shipment = shipments.find(s => s.id === shipmentId);
    
    if (shipment && shipment.status !== newStatus) {
      setConfirmationDialog({
        isOpen: true,
        shipment,
        newStatus
      });
    }
    
    setActiveId(null);
    setDraggedShipment(null);
  };

  const handleConfirmUpdate = (sendNotification: boolean, comments?: string, invoiceNumber?: string) => {
    if (confirmationDialog.shipment) {
      updateStatusMutation.mutate({
        shipmentId: confirmationDialog.shipment.id,
        status: confirmationDialog.newStatus,
        sendNotification,
        comments,
        invoiceNumber
      });
    }
    setConfirmationDialog({ isOpen: false, shipment: null, newStatus: "" });
  };

  const handleViewDetails = (shipment: Shipment) => {
    // Implementar modal de detalles o navegación
    console.log("Ver detalles del envío:", shipment);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando envíos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Gestión de Envíos</h2>
        <p className="text-gray-600">Arrastra las tarjetas entre columnas para actualizar el estado de los envíos</p>
      </div>

      <DndContext 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              shipments={groupedShipments[column.status] || []}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
        
        <DragOverlay>
          {activeId && draggedShipment ? (
            <ShipmentCard shipment={draggedShipment} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <UpdateConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={() => setConfirmationDialog({ isOpen: false, shipment: null, newStatus: "" })}
        onConfirm={handleConfirmUpdate}
        shipment={confirmationDialog.shipment}
        newStatus={confirmationDialog.newStatus}
      />
    </div>
  );
}