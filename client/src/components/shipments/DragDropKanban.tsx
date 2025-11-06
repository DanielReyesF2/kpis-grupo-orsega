import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequestLegacy as apiRequest } from "@/lib/queryClient";
import { 
  Package, 
  MapPin, 
  Calendar, 
  GripVertical,
  Plus,
  Truck,
  Download,
  Clock,
  X,
  History
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RequestShipmentModal } from './RequestShipmentModal';
import { ReportModal } from '../reports/ReportModal';

interface ShipmentItem {
  id: number;
  shipmentId: number;
  product: string;
  quantity: string;
  unit: string;
  description?: string;
}

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
  items?: ShipmentItem[];
  // Include cycle times data to eliminate N+1 queries
  cycleTimes?: {
    hoursTotalCycle?: string | null;
    hoursPendingToTransit?: string | null;
    hoursTransitToDelivered?: string | null;
    hoursDeliveredToClosed?: string | null;
    hoursToDelivery?: string | null;
    computedAt?: Date | string;
    updatedAt?: Date | string;
  } | null;
}

interface ShipmentCycleTimes {
  id: number;
  shipmentId: number;
  companyId: number;
  hoursTotalCycle: string | null;
  hoursPendingToTransit: string | null;
  hoursTransitToDelivered: string | null;
  hoursDeliveredToClosed: string | null;
  hoursToDelivery: string | null;  // FIXED: Added missing field used in delivered status
  computedAt: string;
  updatedAt: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusMap = {
    pending: { label: "Por embarcar", variant: "outline" as const, color: "bg-blue-100 text-blue-800" },
    in_transit: { label: "En Tránsito", variant: "default" as const, color: "bg-orange-100 text-orange-800" },
    delayed: { label: "Retrasado", variant: "destructive" as const, color: "bg-red-100 text-red-800" },
    delivered: { label: "Entregado", variant: "success" as const, color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cerrado", variant: "secondary" as const, color: "bg-gray-100 text-gray-800" },
  };

  const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: "outline" as const, color: "bg-gray-100 text-gray-800" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const ShipmentCard = ({ 
  shipment, 
  onCardClick,
  onRequestTransport
}: { 
  shipment: Shipment;
  onCardClick: (shipment: Shipment) => void;
  onRequestTransport?: (shipment: Shipment) => void;
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Helper function to format time duration
  const formatDuration = (hours: number): string => {
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) {
        return `${days} ${days === 1 ? 'día' : 'días'}`;
      } else {
        return `${days} ${days === 1 ? 'día' : 'días'}, ${remainingHours.toFixed(1)}h`;
      }
    } else {
      return `${hours.toFixed(1)} horas`;
    }
  };

  // Use preloaded cycle times data (N+1 problem eliminated)
  const cycleTime = shipment.cycleTimes;
  const cycleTimeLoading = false; // Data is already loaded

  // Determine which metric to show and label based on status
  const getCycleTimeDisplay = () => {
    const createdAt = new Date(shipment.createdAt);
    const now = new Date();
    
    switch (shipment.status) {
      case 'delivered':
        // Show creation → delivery time (most important as requested)
        if (cycleTime?.hoursToDelivery != null) {
          return {
            label: 'Tiempo entrega',
            value: formatDuration(parseFloat(cycleTime.hoursToDelivery)),
            icon: '📦'
          };
        }
        break;
      case 'cancelled':
        // Show total cycle time
        if (cycleTime?.hoursTotalCycle != null) {
          return {
            label: 'Tiempo total',
            value: formatDuration(parseFloat(cycleTime.hoursTotalCycle)),
            icon: '⏱️'
          };
        }
        break;
      case 'in_transit':
        // Show time since creation (client-side calculation)
        const hoursSinceCreatedInTransit = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return {
          label: 'En tránsito',
          value: formatDuration(hoursSinceCreatedInTransit),
          icon: '🚛'
        };
      case 'delayed':
        // Show time since creation for delayed shipments
        const hoursSinceCreatedDelayed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return {
          label: 'Tiempo retraso',
          value: formatDuration(hoursSinceCreatedDelayed),
          icon: '⚠️'
        };
      case 'pending':
        // Show time since creation
        const hoursSinceCreatedPending = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return {
          label: 'Tiempo espera',
          value: formatDuration(hoursSinceCreatedPending),
          icon: '⏳'
        };
      default:
        return null;
    }
    return null;
  };

  const cycleDisplay = getCycleTimeDisplay();

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData("shipment", JSON.stringify(shipment));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      e.stopPropagation();
      onCardClick(shipment);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-blue-500/30';
      case 'in_transit': return 'border-l-orange-500/30';
      case 'delivered': return 'border-l-emerald-500/30';
      case 'delayed': return 'border-l-red-500/30';
      case 'cancelled': return 'border-l-gray-400/30';
      default: return 'border-l-gray-300';
    }
  };

  const getPriorityIcon = (status: string) => {
    switch (status) {
      case 'delayed': return '🚨';
      case 'in_transit': return '🚚';
      case 'delivered': return '✅';
      case 'cancelled': return '🔒';
      default: return '📦';
    }
  };

  return (
    <div 
      className={`mb-3 cursor-move transition-all duration-200 border-l-4 rounded-lg p-3 bg-card border ${getStatusColor(shipment.status)} ${
        isDragging 
          ? 'opacity-50 shadow-xl scale-105' 
          : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
    >
      {/* Header compacto */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{getPriorityIcon(shipment.status)}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm">{shipment.trackingCode}</div>
          <div className="text-xs text-muted-foreground">{shipment.customerName}</div>
        </div>
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Productos (mostrar items si existen, si no mostrar producto legacy) */}
      <div className="mb-2">
        {shipment.items && shipment.items.length > 0 ? (
          <div className="space-y-1">
            {shipment.items.slice(0, 2).map((item, index) => (
              <div key={item.id || index}>
                <div className="text-sm font-medium truncate">{item.product}</div>
                <div className="text-xs text-muted-foreground">{item.quantity} {item.unit}</div>
              </div>
            ))}
            {shipment.items.length > 2 && (
              <div className="text-xs text-muted-foreground italic">+{shipment.items.length - 2} más...</div>
            )}
          </div>
        ) : (
          <>
            <div className="text-sm font-medium truncate">{shipment.product}</div>
            <div className="text-xs text-muted-foreground">{shipment.quantity} {shipment.unit}</div>
          </>
        )}
      </div>

      {/* Ruta compacta */}
      <div className="flex items-center gap-1 text-xs mb-2">
        <span className="text-muted-foreground font-medium truncate flex-1">{shipment.origin}</span>
        <span className="text-muted-foreground text-xs">→</span>
        <span className="text-muted-foreground font-medium truncate flex-1">{shipment.destination}</span>
      </div>

      {/* Fecha en línea */}
      {shipment.estimatedDeliveryDate && (
        <div className="text-xs text-muted-foreground">
          📅 {new Date(shipment.estimatedDeliveryDate).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
          })}
        </div>
      )}

      {/* Cycle Time Display - Show for all statuses with relevant metrics */}
      {cycleDisplay && (
        <div className="mt-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{cycleDisplay.icon}</span>
            <span className="text-muted-foreground font-medium">{cycleDisplay.label}:</span>
            <span 
              className="font-semibold"
              data-testid={`text-cycle-hours-${shipment.id}`}
            >
              {cycleTimeLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                cycleDisplay.value
              )}
            </span>
          </div>
        </div>
      )}

      {/* Botón Solicitar envío para pendientes */}
      {shipment.status === 'pending' && onRequestTransport && (
        <div className="mt-3 pt-2 border-t border-border">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestTransport(shipment);
            }}
            className="w-full text-xs bg-primary hover:bg-primary/90 text-white py-1.5 px-2 rounded transition-colors duration-200 flex items-center justify-center gap-1"
          >
            <Truck className="h-3 w-3" />
            Solicitar envío
          </button>
        </div>
      )}
    </div>
  );
};

const KanbanColumn = ({ 
  title, 
  status, 
  shipments, 
  onDrop,
  onCardClick,
  onRequestTransport,
  showLoadMoreButton,
  onLoadMore,
  isLoadingMore
}: { 
  title: string; 
  status: string; 
  shipments: Shipment[]; 
  onDrop: (shipment: Shipment, newStatus: string) => void;
  onCardClick: (shipment: Shipment) => void;
  onRequestTransport?: (shipment: Shipment) => void;
  showLoadMoreButton?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  // Incluir cancelled en la columna de delivered (simplificación)
  const filteredShipments = status === 'delivered' 
    ? shipments.filter(s => s.status === 'delivered' || s.status === 'cancelled')
    : shipments.filter(s => s.status === status);
  
  // Agrupar por mes solo para columna entregados (ahora incluye cancelled)
  const groupedShipments = useMemo(() => {
    if (status !== 'delivered') {
      return [{ month: null, shipments: filteredShipments }];
    }

    // Agrupar por mes para shipments entregados (incluye cancelled)
    const groups: { [key: string]: Shipment[] } = {};
    
    filteredShipments.forEach(shipment => {
      // Usar fechas de cierre/delivery apropiadas para agrupar
      let groupingDate: Date;
      
      if (shipment.status === 'delivered') {
        // Para delivered: usar actualDeliveryDate con fallback a createdAt
        groupingDate = shipment.actualDeliveryDate 
          ? new Date(shipment.actualDeliveryDate) 
          : new Date(shipment.createdAt);
      } else if (shipment.status === 'cancelled') {
        // Para cancelled: usar updatedAt con fallback a createdAt
        groupingDate = shipment.updatedAt 
          ? new Date(shipment.updatedAt) 
          : new Date(shipment.createdAt);
      } else {
        // Fallback para otros estados
        groupingDate = new Date(shipment.createdAt);
      }
      
      const monthKey = `${groupingDate.getFullYear()}-${(groupingDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(shipment);
    });

    // Convertir a array y ordenar por mes (más reciente primero)
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, shipments]) => ({
        month: monthKey,
        shipments: shipments.sort((a, b) => {
          // Ordenar usando las fechas correctas de cierre/delivery
          const getRelevantDate = (shipment: Shipment): Date => {
            if (shipment.status === 'delivered') {
              return shipment.actualDeliveryDate 
                ? new Date(shipment.actualDeliveryDate) 
                : new Date(shipment.createdAt);
            } else if (shipment.status === 'cancelled') {
              return shipment.updatedAt 
                ? new Date(shipment.updatedAt) 
                : new Date(shipment.createdAt);
            }
            return new Date(shipment.createdAt);
          };
          
          return getRelevantDate(b).getTime() - getRelevantDate(a).getTime();
        })
      }));
  }, [filteredShipments, status]);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const shipmentData = e.dataTransfer.getData("shipment");
      const shipment = JSON.parse(shipmentData);
      
      if (shipment.status !== status) {
        onDrop(shipment, status);
      }
    } catch (error) {
      console.error("Error al procesar el drop:", error);
    }
  };

  const getColumnConfig = (status: string) => {
    switch (status) {
      case 'pending': 
        return { 
          color: 'border-border bg-card', 
          headerColor: 'bg-muted/50',
          icon: '📋',
          description: 'Listos para enviar'
        };
      case 'in_transit': 
        return { 
          color: 'border-border bg-card', 
          headerColor: 'bg-orange-600/20 text-orange-300',
          icon: '🚚',
          description: 'En camino'
        };
      case 'delivered': 
        return { 
          color: 'border-border bg-card', 
          headerColor: 'bg-emerald-600/20 text-emerald-300',
          icon: '✅',
          description: 'Completados'
        };
      case 'delayed': 
        return { 
          color: 'border-border bg-card', 
          headerColor: 'bg-red-600/20 text-red-300',
          icon: '⚠️',
          description: 'Requieren atención'
        };
      case 'cancelled': 
        return { 
          color: 'border-border bg-card', 
          headerColor: 'bg-muted/50',
          icon: '🔒',
          description: 'Cerrados'
        };
      default: 
        return { 
          color: 'border-border bg-card', 
          headerColor: 'bg-muted/50',
          icon: '📦',
          description: 'Envíos'
        };
    }
  };

  const config = getColumnConfig(status);
  
  return (
    <div className="flex-1 min-w-80">
      <Card 
        className={`${config.color} ${isDragOver ? 'ring-2 ring-blue-400 ring-opacity-50 shadow-lg' : ''} transition-all duration-200`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardHeader className={`${config.headerColor} rounded-t-lg -m-[1px] mb-3`}>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{config.icon}</span>
              <div>
                <div className="font-bold">{title}</div>
                <div className="text-xs opacity-80 font-normal">{config.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {filteredShipments.length}
              </Badge>
              {filteredShipments.length > 0 && (
                <div className="text-xs opacity-80">
                  {Math.round((filteredShipments.length / shipments.length) * 100)}%
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className={`space-y-3 max-h-96 overflow-y-auto transition-all ${
              isDragOver ? 'bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-3' : ''
            }`}
          >
            {groupedShipments.map((group, groupIndex) => (
              <div key={group.month || 'ungrouped'}>
                {/* Header de mes solo para columnas cerrados */}
                {group.month && (
                  <div className="sticky top-0 bg-gray-100 border rounded-lg p-2 mb-3 text-center">
                    <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {new Date(group.month + '-01').toLocaleDateString('es-ES', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {group.shipments.length} envío{group.shipments.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                
                {/* Tarjetas del grupo */}
                {group.shipments.map((shipment) => (
                  <ShipmentCard 
                    key={shipment.id} 
                    shipment={shipment} 
                    onCardClick={onCardClick}
                    onRequestTransport={onRequestTransport}
                  />
                ))}
                
                {/* Espaciado entre grupos */}
                {group.month && groupIndex < groupedShipments.length - 1 && (
                  <div className="mb-4" />
                )}
              </div>
            ))}
            
            {/* Botón "Ver más antiguos" solo para columna cerrados */}
            {showLoadMoreButton && onLoadMore && (
              <div className="pt-3 mt-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="w-full text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Ver más antiguos
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {filteredShipments.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <div className="text-4xl mb-2">{config.icon}</div>
                <div className="text-sm font-medium">
                  {isDragOver ? "Suelta la tarjeta aquí" : "No hay envíos"}
                </div>
                <div className="text-xs opacity-75 mt-1">
                  {isDragOver ? "para cambiar el estado" : config.description.toLowerCase()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export function DragDropKanban({ onShowHistory }: { onShowHistory?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detailsDialog, setDetailsDialog] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
  }>({
    isOpen: false,
    shipment: null
  });
  const [editDialog, setEditDialog] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
  }>({
    isOpen: false,
    shipment: null
  });

  const [requestDialog, setRequestDialog] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
  }>({
    isOpen: false,
    shipment: null
  });
  
  const [reportDialog, setReportDialog] = useState(false);
  const [newShipmentDialog, setNewShipmentDialog] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState<{
    isOpen: boolean;
    shipment: Shipment | null;
    targetStatus: string;
  }>({
    isOpen: false,
    shipment: null,
    targetStatus: ''
  });
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [newShipmentForm, setNewShipmentForm] = useState({
    companyId: '1',
    trackingCode: '',
    customerName: '',
    customerId: undefined as number | undefined, // ID del cliente de la BD
    purchaseOrder: '',
    customerEmail: '',
    product: '',
    quantity: '',
    unit: 'kg',
    origin: '',
    destination: '',
    estimatedDeliveryDate: ''
  });

  // Estado para múltiples productos
  const [shipmentProducts, setShipmentProducts] = useState<Array<{product: string, quantity: string, unit: string}>>([
    { product: '', quantity: '', unit: 'kg' }
  ]);

  // Función para generar código de seguimiento automático
  const generateTrackingCode = (companyId: string, existingShipments: Shipment[]) => {
    const prefix = companyId === '1' ? 'DUR' : 'ORS';
    const year = new Date().getFullYear();
    
    // Filtrar envíos de la misma empresa y año
    const companyShipments = existingShipments.filter(s => {
      const shipmentYear = new Date(s.createdAt).getFullYear();
      return s.trackingCode.startsWith(prefix) && shipmentYear === year;
    });
    
    // Encontrar el número más alto
    let maxNumber = 0;
    companyShipments.forEach(shipment => {
      const match = shipment.trackingCode.match(new RegExp(`${prefix}-${year}-(\\d+)`));
      if (match) {
        const number = parseInt(match[1]);
        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    });
    
    // Generar el siguiente número
    const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
    return `${prefix}-${year}-${nextNumber}`;
  };

  // State para paginación
  const [shipmentsPage, setShipmentsPage] = useState(1);
  const [loadMoreClosed, setLoadMoreClosed] = useState(false);

  // Obtener envíos con paginación inteligente
  const { data: shipmentsResponse, isLoading } = useQuery<{shipments: Shipment[], pagination?: any} | Shipment[]>({
    queryKey: ['/api/shipments', { page: shipmentsPage, limit: 50, loadMoreClosed }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: shipmentsPage.toString(),
        limit: '50'
      });
      
      // SMART FILTER: Para optimización, solo cargar últimos 30 días inicialmente
      // Esto mejora performance cuando hay 300+ shipments cerrados acumulados
      if (!loadMoreClosed) {
        params.append('since', '30d');
      }
      
      const response = await fetch(`/api/shipments?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch shipments');
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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

  const paginationInfo = useMemo(() => {
    if (!shipmentsResponse || Array.isArray(shipmentsResponse)) return null;
    return (shipmentsResponse as {pagination?: any}).pagination;
  }, [shipmentsResponse]);

  // Obtener proveedores para el modal de solicitud
  const { data: providers = [] } = useQuery<any[]>({
    queryKey: ['/api/providers'],
  });

  // Obtener clientes de la base de datos
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  // Obtener productos filtrados por empresa desde la base de datos
  const selectedCompanyId = newShipmentForm.companyId;
  const companyIdNum = selectedCompanyId ? parseInt(selectedCompanyId) : null;
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ['/api/products', { companyId: companyIdNum }],
    enabled: !!companyIdNum,
  });

  // Debug: Ver qué productos se están recibiendo
  useEffect(() => {
    if (products.length > 0) {
      console.log(`🔵 [DragDropKanban] Productos recibidos (companyId=${companyIdNum}):`, products.map(p => p.name));
    }
  }, [products, companyIdNum]);

  // Generar código automáticamente cuando cambie la empresa
  useEffect(() => {
    if (newShipmentForm.companyId && shipments) {
      const autoCode = generateTrackingCode(newShipmentForm.companyId, shipments);
      // Solo actualizar si el código es diferente para evitar ciclos infinitos
      if (autoCode !== newShipmentForm.trackingCode) {
        setNewShipmentForm(prev => ({ 
          ...prev, 
          trackingCode: autoCode,
          product: '' // Resetear producto al cambiar empresa
        }));
      }
    }
  }, [newShipmentForm.companyId, shipments.length]); // Usar shipments.length en lugar de shipments

  // Mutación para actualizar estado
  const updateStatusMutation = useMutation({
    mutationFn: async ({ shipmentId, status, invoiceNumber }: { shipmentId: number; status: string; invoiceNumber?: string }) => {
      return await apiRequest(`/api/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        body: {
          status,
          invoiceNumber,
          sendNotification: true,
          comments: `Estado actualizado mediante drag & drop a ${status}`
          // Omitimos location en lugar de enviar null
        }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Estado actualizado",
        description: data.notificationSent 
          ? "Se actualizó el estado y se envió notificación al cliente"
          : "El estado se actualizó correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      // Cerrar el diálogo de invoice solo si está abierto
      if (invoiceDialog.isOpen) {
        setInvoiceDialog({ isOpen: false, shipment: null, targetStatus: '' });
        setInvoiceNumber('');
      }
    },
    onError: (error: any) => {
      // Si el error es por falta de invoice number y tenemos el shipment guardado
      if (error.requiresInvoiceNumber && invoiceDialog.shipment) {
        // El diálogo ya está abierto, solo actualizamos el mensaje
        toast({
          title: "Número de factura requerido",
          description: error.error || "Para mover a 'En Tránsito' debes ingresar el número de factura",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || error.error || "Error al actualizar el estado",
          variant: "destructive",
        });
      }
    }
  });

  // Mutación para crear nuevo envío
  const createShipmentMutation = useMutation({
    mutationFn: async (shipmentData: any) => {
      return await apiRequest('/api/shipments', {
        method: 'POST',
        body: {
          ...shipmentData,
          quantity: shipmentData.quantity || shipmentProducts[0]?.quantity || "0",
          carbonFootprint: "0",
          status: 'pending',
          companyId: parseInt(shipmentData.companyId),
          estimatedDeliveryDate: shipmentData.estimatedDeliveryDate || null,
          // Enviar los productos múltiples
          items: shipmentProducts.filter(p => p.product && p.quantity)
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Envío creado",
        description: "El nuevo envío se ha registrado correctamente",
      });
      // Invalidar todas las queries relacionadas con shipments para actualizar el dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logistics/shipments'] }); // Por compatibilidad
      setNewShipmentDialog(false);
      // Generar nuevo código automáticamente para el siguiente envío
      const autoCode = generateTrackingCode('1', shipments || []);
      setNewShipmentForm({
        companyId: '1',
        trackingCode: autoCode,
        customerName: '',
        customerId: undefined,
        purchaseOrder: '',
        customerEmail: '',
        product: '',
        quantity: '',
        unit: 'kg',
        origin: '',
        destination: '',
        estimatedDeliveryDate: ''
      });
      // Resetear productos
      setShipmentProducts([{ product: '', quantity: '', unit: 'kg' }]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el envío",
        variant: "destructive",
      });
    }
  });

  const handleDrop = (shipment: Shipment, newStatus: string) => {
    // Si se intenta mover a in_transit y no tiene invoice number, mostrar diálogo
    if (newStatus === 'in_transit' && !shipment.invoiceNumber) {
      setInvoiceDialog({
        isOpen: true,
        shipment,
        targetStatus: newStatus
      });
      setInvoiceNumber('');
    } else {
      // Actualizar directamente
      updateStatusMutation.mutate({ 
        shipmentId: shipment.id, 
        status: newStatus,
        invoiceNumber: shipment.invoiceNumber || undefined
      });
    }
  };

  const handleInvoiceSubmit = () => {
    if (!invoiceDialog.shipment || !invoiceNumber.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el número de factura",
        variant: "destructive",
      });
      return;
    }

    // Ejecutar la mutación pero NO cerrar el diálogo aquí
    // El diálogo se cerrará automáticamente en onSuccess
    updateStatusMutation.mutate({
      shipmentId: invoiceDialog.shipment.id,
      status: invoiceDialog.targetStatus,
      invoiceNumber: invoiceNumber.trim()
    });
  };

  const handleCardClick = (shipment: Shipment) => {
    setDetailsDialog({
      isOpen: true,
      shipment
    });
  };

  const handleRequestTransport = (shipment: Shipment) => {
    setRequestDialog({
      isOpen: true,
      shipment
    });
  };

  const handleRequestSubmit = async (requestData: any) => {
    // TODO: Implementar llamada al backend
    console.log('Datos de solicitud:', requestData);
    console.log('Envío:', requestDialog.shipment);
    
    toast({
      title: "Solicitud enviada",
      description: "La solicitud de transporte se ha enviado al proveedor",
    });
    
    setRequestDialog({
      isOpen: false,
      shipment: null
    });
  };

  const handleCreateShipment = () => {
    // Validar productos
    const validProducts = shipmentProducts.filter(p => p.product && p.quantity);
    
    if (!newShipmentForm.trackingCode || !newShipmentForm.customerName || !newShipmentForm.purchaseOrder) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa los campos obligatorios (código, nombre del cliente y orden de compra)",
        variant: "destructive",
      });
      return;
    }
    
    if (validProducts.length === 0) {
      toast({
        title: "Producto requerido",
        description: "Debes agregar al menos un producto con cantidad",
        variant: "destructive",
      });
      return;
    }
    
    createShipmentMutation.mutate(newShipmentForm);
  };

  // Handler para cargar más shipments antiguos (específicamente para columna cerrados)
  const handleLoadMore = () => {
    setLoadMoreClosed(true);
    toast({
      title: "Cargando envíos históricos",
      description: "Se están cargando todos los envíos cerrados...",
    });
  };



  const getStatusLabel = (status: string) => {
    const labels = {
      pending: "Por embarcar",
      in_transit: "En Tránsito", 
      delivered: "Entregado",
      delayed: "Retrasado",
      cancelled: "Cerrado"
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-lg">🚚</div>
            </div>
          </div>
          <p className="text-gray-700 mt-4 font-medium">Cargando tablero de envíos...</p>
          <p className="text-gray-500 text-sm mt-1">Preparando tu vista Kanban</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con botón de nuevo envío */}
      <div className="flex justify-end items-center mb-6">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportDialog(true)} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Descargar Reporte
          </Button>
          {onShowHistory && (
            <Button variant="outline" onClick={onShowHistory} className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Ver Historial
            </Button>
          )}
          <Button onClick={() => setNewShipmentDialog(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Envío
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { status: 'pending', label: 'Por embarcar', icon: '📋', color: 'bg-slate-100 text-slate-700' },
          { status: 'in_transit', label: 'En Tránsito', icon: '🚚', color: 'bg-amber-100 text-amber-700' },
          { status: 'delayed', label: 'Retrasados', icon: '⚠️', color: 'bg-rose-100 text-rose-700' },
          { 
            status: 'delivered', 
            label: 'Entregados', 
            icon: '✅', 
            color: 'bg-[#b5e951]/20 text-[#6b7a00]',
            includeCancelled: true 
          }
        ].map((item) => {
          const count = item.includeCancelled 
            ? shipments.filter(s => s.status === 'delivered' || s.status === 'cancelled').length
            : shipments.filter(s => s.status === item.status).length;
          return (
            <div key={item.status} className={`${item.color} rounded-lg p-3 text-center`}>
              <div className="text-lg">{item.icon}</div>
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs font-medium">{item.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tablero principal */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn 
          title="Por embarcar" 
          status="pending" 
          shipments={shipments} 
          onDrop={handleDrop}
          onCardClick={handleCardClick}
          onRequestTransport={handleRequestTransport}
        />
        <KanbanColumn 
          title="En Tránsito" 
          status="in_transit" 
          shipments={shipments} 
          onDrop={handleDrop}
          onCardClick={handleCardClick}
        />
        <KanbanColumn 
          title="Retrasados" 
          status="delayed" 
          shipments={shipments} 
          onDrop={handleDrop}
          onCardClick={handleCardClick}
        />
        <KanbanColumn 
          title="Entregados" 
          status="delivered" 
          shipments={shipments.filter(s => s.status === 'delivered' || s.status === 'cancelled')} 
          onDrop={handleDrop}
          onCardClick={handleCardClick}
        />
      </div>



      {/* Diálogo para nuevo envío */}
      <Dialog open={newShipmentDialog} onOpenChange={setNewShipmentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-slate-600" />
              Crear Nuevo Envío
            </DialogTitle>
            <DialogDescription>
              Completa la información del nuevo envío
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selección de empresa */}
            <div className="space-y-2">
              <Label htmlFor="companyId">Empresa *</Label>
              <Select value={newShipmentForm.companyId} onValueChange={(value) => {
                setNewShipmentForm(prev => ({ 
                  ...prev, 
                  companyId: value
                  // El código se generará automáticamente por el useEffect
                }));
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Dura International</SelectItem>
                  <SelectItem value="2">Grupo Orsega</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trackingCode">Código de Seguimiento *</Label>
                <div className="relative">
                  <Input
                    id="trackingCode"
                    value={newShipmentForm.trackingCode}
                    readOnly
                    className="bg-gray-50 font-mono text-sm"
                    placeholder="Se generará automáticamente"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      AUTO
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Se genera automáticamente según la empresa</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Nombre del Cliente *</Label>
                {isLoadingClients ? (
                  <Input 
                    placeholder="Cargando clientes..." 
                    disabled 
                  />
                ) : clients.length > 0 ? (
                  <Select 
                    value={newShipmentForm.customerName} 
                    onValueChange={(value) => {
                      const selectedClient = clients.find((client: any) => client.name === value);
                      setNewShipmentForm(prev => ({ 
                        ...prev, 
                        customerName: value,
                        customerId: selectedClient?.id || undefined,
                        customerEmail: selectedClient?.email || prev.customerEmail
                      }));
                      if (selectedClient) {
                        toast({
                          title: "Cliente seleccionado",
                          description: `${selectedClient.name}${selectedClient.email ? ` (${selectedClient.email})` : ''}`,
                        });
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-customer">
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients
                        .filter((client: any) => 
                          !newShipmentForm.companyId || 
                          client.company_id?.toString() === newShipmentForm.companyId.toString()
                        )
                        .map((client: any) => (
                          <SelectItem key={client.id} value={client.name}>
                            <div>
                              <div className="font-medium">{client.name}</div>
                              {client.email && (
                                <div className="text-xs text-muted-foreground">{client.email}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="customerName"
                    value={newShipmentForm.customerName}
                    onChange={(e) => setNewShipmentForm(prev => ({ ...prev, customerName: e.target.value, customerId: undefined }))}
                    placeholder="Nombre completo del cliente"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseOrder">Orden de Compra *</Label>
                <Input
                  id="purchaseOrder"
                  value={newShipmentForm.purchaseOrder}
                  onChange={(e) => setNewShipmentForm(prev => ({ ...prev, purchaseOrder: e.target.value }))}
                  placeholder="Número de orden de compra"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email del Cliente</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={newShipmentForm.customerEmail}
                  onChange={(e) => setNewShipmentForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="email@cliente.com"
                />
              </div>
            </div>

            {/* Productos múltiples */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Productos *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShipmentProducts([...shipmentProducts, { product: '', quantity: '', unit: 'kg' }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Producto
                </Button>
              </div>
              
              {shipmentProducts.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Producto {index + 1}</span>
                    {shipmentProducts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShipmentProducts(shipmentProducts.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Select 
                      value={item.product} 
                      onValueChange={(value) => {
                        const newProducts = [...shipmentProducts];
                        newProducts[index].product = value;
                        setShipmentProducts(newProducts);
                      }}
                    >
                      <SelectTrigger disabled={isLoadingProducts || products.length === 0}>
                        <SelectValue placeholder={isLoadingProducts ? "Cargando productos..." : products.length === 0 ? "No hay productos disponibles" : "Selecciona un producto"} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product: any) => (
                          <SelectItem key={product.id} value={product.name}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const newProducts = [...shipmentProducts];
                          newProducts[index].quantity = e.target.value;
                          setShipmentProducts(newProducts);
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Unidad</Label>
                      <Select 
                        value={item.unit} 
                        onValueChange={(value) => {
                          const newProducts = [...shipmentProducts];
                          newProducts[index].unit = value;
                          setShipmentProducts(newProducts);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                          <SelectItem value="toneladas">Toneladas</SelectItem>
                          <SelectItem value="piezas">Piezas</SelectItem>
                          <SelectItem value="cajas">Cajas</SelectItem>
                          <SelectItem value="litros">Litros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin">Origen</Label>
                <Input
                  id="origin"
                  value={newShipmentForm.origin}
                  onChange={(e) => setNewShipmentForm(prev => ({ ...prev, origin: e.target.value }))}
                  placeholder="Ciudad/Estado de origen"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destino</Label>
                <Input
                  id="destination"
                  value={newShipmentForm.destination}
                  onChange={(e) => setNewShipmentForm(prev => ({ ...prev, destination: e.target.value }))}
                  placeholder="Ciudad/Estado de destino"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDeliveryDate">Fecha Estimada de Entrega</Label>
              <Input
                id="estimatedDeliveryDate"
                type="date"
                value={newShipmentForm.estimatedDeliveryDate}
                onChange={(e) => setNewShipmentForm(prev => ({ ...prev, estimatedDeliveryDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewShipmentDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateShipment}
              disabled={createShipmentMutation.isPending}
            >
              {createShipmentMutation.isPending ? "Creando..." : "Crear Envío"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de detalles */}
      <Dialog open={detailsDialog.isOpen} onOpenChange={(open) => !open && setDetailsDialog({ isOpen: false, shipment: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{detailsDialog.shipment?.status === 'in_transit' ? '🚚' : detailsDialog.shipment?.status === 'delivered' ? '✅' : detailsDialog.shipment?.status === 'delayed' ? '⚠️' : detailsDialog.shipment?.status === 'cancelled' ? '❌' : '📦'}</span>
              Detalles del Envío
            </DialogTitle>
            <DialogDescription>
              Información completa del envío {detailsDialog.shipment?.trackingCode}
            </DialogDescription>
          </DialogHeader>
          
          {detailsDialog.shipment && (
            <div className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Código de seguimiento</label>
                    <p className="text-lg font-bold text-gray-900">{detailsDialog.shipment.trackingCode}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cliente</label>
                    <p className="text-base text-gray-900">{detailsDialog.shipment.customerName}</p>
                    {detailsDialog.shipment.customerEmail && (
                      <p className="text-sm text-gray-600">{detailsDialog.shipment.customerEmail}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Estado actual</label>
                    <div className="mt-1">
                      <StatusBadge status={detailsDialog.shipment.status} />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Mostrar productos múltiples si existen */}
                  {detailsDialog.shipment.items && detailsDialog.shipment.items.length > 0 ? (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Productos ({detailsDialog.shipment.items.length})</label>
                      <div className="mt-2 space-y-2">
                        {detailsDialog.shipment.items.map((item, index) => (
                          <div key={item.id || index} className="bg-white p-2 rounded border border-gray-200">
                            <div className="font-medium text-gray-900">{item.product}</div>
                            <div className="text-sm text-gray-600">{item.quantity} {item.unit}</div>
                            {item.description && (
                              <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Producto</label>
                        <p className="text-base text-gray-900">{detailsDialog.shipment.product}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Cantidad</label>
                        <p className="text-base text-gray-900">{detailsDialog.shipment.quantity} {detailsDialog.shipment.unit}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Fecha de creación</label>
                    <p className="text-base text-gray-900">
                      {new Date(detailsDialog.shipment.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Información de envío */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Información de Envío
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Origen</label>
                    <p className="text-base text-gray-900">{detailsDialog.shipment.origin}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Destino</label>
                    <p className="text-base text-gray-900">{detailsDialog.shipment.destination}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Fecha estimada de entrega</label>
                    <p className="text-base text-gray-900">
                      {detailsDialog.shipment.estimatedDeliveryDate 
                        ? new Date(detailsDialog.shipment.estimatedDeliveryDate).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : "No programada"
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Fecha de creación</label>
                    <p className="text-base text-gray-900">
                      {new Date(detailsDialog.shipment.createdAt).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Acciones rápidas */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setDetailsDialog({ isOpen: false, shipment: null })}
                  className="flex-1"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => {
                    setDetailsDialog({ isOpen: false, shipment: null });
                    setEditDialog({ isOpen: true, shipment: detailsDialog.shipment });
                  }}
                  className="flex-1"
                >
                  Editar Envío
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar envío */}
      <Dialog open={editDialog.isOpen} onOpenChange={(open) => !open && setEditDialog({ isOpen: false, shipment: null })}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Envío</DialogTitle>
            <DialogDescription>
              Modifica los campos necesarios y guarda los cambios.
            </DialogDescription>
          </DialogHeader>
          {editDialog.shipment && (
            <EditShipmentInline
              shipment={editDialog.shipment}
              onCancel={() => setEditDialog({ isOpen: false, shipment: null })}
              onSaved={() => {
                setEditDialog({ isOpen: false, shipment: null });
                queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo para solicitar número de factura */}
      <Dialog open={invoiceDialog.isOpen} onOpenChange={(open) => !open && setInvoiceDialog({ isOpen: false, shipment: null, targetStatus: '' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-600" />
              Número de Factura Requerido
            </DialogTitle>
            <DialogDescription>
              Para mover el envío <strong>{invoiceDialog.shipment?.trackingCode}</strong> a "En Tránsito" es necesario ingresar el número de factura.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number">Número de Factura *</Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej: FAC-2025-001"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleInvoiceSubmit();
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                Este número quedará registrado en el sistema y no se volverá a solicitar.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInvoiceDialog({ isOpen: false, shipment: null, targetStatus: '' })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleInvoiceSubmit}
              disabled={!invoiceNumber.trim() || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Actualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de solicitud de transporte */}
      {requestDialog.shipment && (
        <RequestShipmentModal
          shipment={requestDialog.shipment}
          providers={providers}
          isOpen={requestDialog.isOpen}
          onClose={() => setRequestDialog({ isOpen: false, shipment: null })}
          onSubmit={handleRequestSubmit}
        />
      )}

      {/* Modal de reporte PDF */}
      <ReportModal
        isOpen={reportDialog}
        onClose={() => setReportDialog(false)}
        shipments={shipments}
      />
    </div>
  );
}

// Formulario inline para editar un envío (campos principales)
function EditShipmentInline({ shipment, onCancel, onSaved }: { shipment: Shipment; onCancel: () => void; onSaved: () => void; }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    purchaseOrder: shipment.purchaseOrder || '',
    customerName: shipment.customerName || '',
    customerEmail: shipment.customerEmail || '',
    origin: shipment.origin || '',
    destination: shipment.destination || '',
    estimatedDeliveryDate: shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate).toISOString().slice(0, 10) : ''
  });

  // Productos del envío
  const { data: items = [], refetch: refetchItems, isLoading: itemsLoading } = useQuery({
    queryKey: [`/api/shipments/${shipment.id}/items`],
  });

  // Catálogo de productos por empresa (como en Nuevo Envío)
  const selectedCompanyId = shipment.companyId?.toString();
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ["/api/products", { companyId: selectedCompanyId }],
    enabled: !!selectedCompanyId,
  });

  const queryClient = useQueryClient();

  // Mutación para crear producto nuevo
  const createProductMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/products', {
        name,
        companyId: shipment.companyId || null
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear producto');
      }
      return res.json();
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", { companyId: selectedCompanyId }] });
      toast({ title: 'Producto creado', description: `"${newProduct.name}" fue agregado al catálogo` });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo crear el producto', 
        variant: 'destructive' 
      });
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: { product: string; quantity: string; unit: string; description?: string }) => {
      const res = await apiRequest('POST', `/api/shipments/${shipment.id}/items`, item);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al agregar producto');
      }
      return res.json();
    },
    onSuccess: () => { 
      refetchItems();
      toast({ title: 'Producto agregado', description: 'El producto fue agregado al envío' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo agregar el producto', 
        variant: 'destructive' 
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, item }: { id: number; item: { product?: string; quantity?: string; unit?: string; description?: string } }) => {
      const res = await apiRequest('PATCH', `/api/shipments/${shipment.id}/items/${id}`, item);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al actualizar producto');
      }
      return res.json();
    },
    onSuccess: () => { 
      refetchItems();
      toast({ title: 'Actualizado', description: 'Cambios guardados' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudieron guardar los cambios', 
        variant: 'destructive' 
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/shipments/${shipment.id}/items/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al eliminar producto');
      }
      return res.json();
    },
    onSuccess: () => { 
      refetchItems();
      toast({ title: 'Eliminado', description: 'Producto removido del envío' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo eliminar el producto', 
        variant: 'destructive' 
      });
    }
  });

  const [newItem, setNewItem] = useState({ product: '', quantity: '', unit: 'kg', description: '' });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/shipments/${shipment.id}`, {
        purchaseOrder: form.purchaseOrder,
        customerName: form.customerName,
        customerEmail: form.customerEmail || null,
        origin: form.origin,
        destination: form.destination,
        estimatedDeliveryDate: form.estimatedDeliveryDate || null,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al actualizar el envío');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Envío actualizado', description: 'Los cambios fueron guardados.' });
      onSaved();
    },
    onError: (err: any) => {
      console.error('[EditShipmentInline] Error actualizando envío:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'No se pudo actualizar el envío. Verifique su conexión.', 
        variant: 'destructive' 
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Orden</Label>
          <Input value={form.purchaseOrder} onChange={(e) => setForm({ ...form, purchaseOrder: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Email del Cliente</Label>
          <Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Origen</Label>
          <Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Destino</Label>
          <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Fecha estimada de entrega</Label>
          <Input type="date" value={form.estimatedDeliveryDate} onChange={(e) => setForm({ ...form, estimatedDeliveryDate: e.target.value })} />
        </div>
      </div>

      {/* Productos */}
      <div className="space-y-2">
        <div className="sticky top-0 bg-white z-10 pb-2">
          <h4 className="font-semibold">Productos</h4>
        </div>
        {itemsLoading ? (
          <div className="text-sm text-gray-500">Cargando productos…</div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {items.length === 0 && <div className="text-sm text-gray-500">Sin productos agregados</div>}
            {items.map((it: any) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Label className="text-xs">Producto</Label>
                  {!selectedCompanyId ? (
                    <Input defaultValue={it.product} disabled />
                  ) : isLoadingProducts ? (
                    <Input defaultValue={it.product} disabled />
                  ) : products.length > 0 ? (
                    <Select 
                      value={it.product}
                      onValueChange={(value) => updateItemMutation.mutate({ id: it.id, item: { product: value } })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input defaultValue={it.product} onBlur={(e) => updateItemMutation.mutate({ id: it.id, item: { product: e.target.value } })} />
                  )}
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Cantidad</Label>
                  <Input defaultValue={it.quantity} onBlur={(e) => updateItemMutation.mutate({ id: it.id, item: { quantity: e.target.value } })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Unidad</Label>
                  <Input defaultValue={it.unit} onBlur={(e) => updateItemMutation.mutate({ id: it.id, item: { unit: e.target.value } })} />
                </div>
                <div className="col-span-10">
                  <Label className="text-xs">Descripción</Label>
                  <Input defaultValue={it.description || ''} onBlur={(e) => updateItemMutation.mutate({ id: it.id, item: { description: e.target.value } })} />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="destructive" onClick={() => deleteItemMutation.mutate(it.id)} size="sm">Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nuevo producto */}
        <div className="grid grid-cols-12 gap-2 items-end mt-2">
          <div className="col-span-5">
            <Label className="text-xs">Producto</Label>
            {!selectedCompanyId ? (
              <Input placeholder="Selecciona empresa" disabled />
            ) : isLoadingProducts ? (
              <Input placeholder="Cargando..." disabled />
            ) : products.length > 0 ? (
              <div className="flex gap-1">
                <Select 
                  value={newItem.product}
                  onValueChange={(value) => setNewItem({ ...newItem, product: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccione un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const productName = prompt('Ingrese el nombre del nuevo producto:');
                    if (productName && productName.trim()) {
                      createProductMutation.mutate(productName.trim(), {
                        onSuccess: (newProduct) => {
                          setNewItem({ ...newItem, product: newProduct.name });
                        }
                      });
                    }
                  }}
                  title="Crear nuevo producto"
                >
                  +
                </Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <Input 
                  value={newItem.product} 
                  onChange={(e) => setNewItem({ ...newItem, product: e.target.value })}
                  placeholder="Escriba el producto o cree uno nuevo"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newItem.product && newItem.product.trim()) {
                      createProductMutation.mutate(newItem.product.trim(), {
                        onSuccess: (newProduct) => {
                          setNewItem({ ...newItem, product: newProduct.name });
                        }
                      });
                    } else {
                      toast({ title: 'Error', description: 'Ingrese un nombre de producto', variant: 'destructive' });
                    }
                  }}
                  title="Guardar como nuevo producto"
                >
                  💾
                </Button>
              </div>
            )}
          </div>
          <div className="col-span-3">
            <Label className="text-xs">Cantidad</Label>
            <Input value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Unidad</Label>
            <Input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
          </div>
          <div className="col-span-10">
            <Label className="text-xs">Descripción</Label>
            <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                if (!newItem.product || !newItem.quantity || !newItem.unit) {
                  toast({ title: 'Completa producto/cantidad/unidad', variant: 'destructive' });
                  return;
                }
                addItemMutation.mutate({ ...newItem });
                setNewItem({ product: '', quantity: '', unit: 'kg', description: '' });
              }}
            >
              Agregar
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </DialogFooter>
    </div>
  );
}