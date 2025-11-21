import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Calendar,
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Interface flexible para aceptar diferentes estructuras de Shipment
interface Shipment {
  id: number | string;
  trackingCode?: string;
  customerName?: string;
  product?: string;
  quantity?: number | string;
  unit?: string;
  origin?: string;
  destination?: string;
  status: string;
  estimatedDeliveryDate?: string | null;
  createdAt: string;
  updatedAt?: string;
  actualDeliveryDate?: string | null;
  deliveredAt?: string | null;
  cycleTimes?: {
    hoursPendingToTransit?: string | null;
    hoursTransitToDelivered?: string | null;
    hoursToDelivery?: string | null;
  } | null;
  [key: string]: any; // Permitir campos adicionales
}

interface ShipmentsHistoryProps {
  shipments: Shipment[];
  onShipmentClick?: (shipment: Shipment) => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusMap = {
    pending: { label: "Por embarcar", variant: "outline" as const, color: "bg-blue-100 text-blue-800", icon: Clock },
    in_transit: { label: "En Tránsito", variant: "default" as const, color: "bg-orange-100 text-orange-800", icon: Truck },
    delayed: { label: "Retrasado", variant: "destructive" as const, color: "bg-red-100 text-red-800", icon: AlertTriangle },
    delivered: { label: "Entregado", variant: "success" as const, color: "bg-green-100 text-green-800", icon: CheckCircle2 },
    cancelled: { label: "Cerrado", variant: "secondary" as const, color: "bg-gray-100 text-gray-800", icon: X },
  };

  const config = statusMap[status as keyof typeof statusMap] || { 
    label: status, 
    variant: "outline" as const, 
    color: "bg-gray-100 text-gray-800",
    icon: Package
  };
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

const formatMonth = (monthKey: string): string => {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
};

// Función para formatear horas en días y horas
const formatDuration = (hours: string | null | undefined): string | null => {
  if (!hours || hours === 'null' || hours === '') return null;
  
  const hoursNum = parseFloat(hours);
  if (isNaN(hoursNum) || hoursNum < 0) return null;
  
  const days = Math.floor(hoursNum / 24);
  const remainingHours = Math.floor(hoursNum % 24);
  const minutes = Math.floor((hoursNum % 1) * 60);
  
  if (days > 0) {
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  } else if (remainingHours > 0) {
    if (minutes > 0) {
      return `${remainingHours}h ${minutes}m`;
    }
    return `${remainingHours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  }
  
  return `${Math.round(hoursNum * 60)}m`;
};

export function ShipmentsHistory({ shipments, onShipmentClick }: ShipmentsHistoryProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Agrupar todos los embarques por mes basado en createdAt
  const groupedByMonth = useMemo(() => {
    const groups: { [key: string]: Shipment[] } = {};

    shipments.forEach(shipment => {
      // Usar createdAt como fecha principal para agrupar
      const date = new Date(shipment.createdAt);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(shipment);
    });

    // Ordenar por mes (más reciente primero) y ordenar embarques dentro de cada mes
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0])) // Más reciente primero
      .map(([monthKey, shipmentList]) => ({
        monthKey,
        monthLabel: formatMonth(monthKey),
        shipments: shipmentList.sort((a, b) => {
          // Ordenar por fecha de creación (más reciente primero)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
      }));
  }, [shipments]);

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  // Expandir los primeros 3 meses por defecto
  const initiallyExpanded = useMemo(() => {
    const expanded = new Set<string>();
    groupedByMonth.slice(0, 3).forEach(group => {
      expanded.add(group.monthKey);
    });
    return expanded;
  }, [groupedByMonth]);

  // Usar expandedMonths si hay algo, sino usar initiallyExpanded
  const isExpanded = (monthKey: string) => {
    if (expandedMonths.size > 0) {
      return expandedMonths.has(monthKey);
    }
    return initiallyExpanded.has(monthKey);
  };

  if (groupedByMonth.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay embarques registrados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groupedByMonth.map(({ monthKey, monthLabel, shipments }) => {
        const expanded = isExpanded(monthKey);
        const totalDelivered = shipments.filter(s => s.status === 'delivered' || s.status === 'cancelled').length;
        const totalInTransit = shipments.filter(s => s.status === 'in_transit').length;
        const totalPending = shipments.filter(s => s.status === 'pending').length;
        const totalDelayed = shipments.filter(s => s.status === 'delayed').length;

        return (
          <Card key={monthKey} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleMonth(monthKey)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{monthLabel}</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {shipments.length} {shipments.length === 1 ? 'embarque' : 'embarques'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  {/* Estadísticas rápidas del mes */}
                  <div className="hidden md:flex items-center gap-3 text-sm">
                    {totalDelivered > 0 && (
                      <span className="text-success font-medium">
                        {totalDelivered} entregados
                      </span>
                    )}
                    {totalInTransit > 0 && (
                      <span className="text-warning font-medium">
                        {totalInTransit} en tránsito
                      </span>
                    )}
                    {totalPending > 0 && (
                      <span className="text-primary font-medium">
                        {totalPending} pendientes
                      </span>
                    )}
                    {totalDelayed > 0 && (
                      <span className="text-destructive font-medium">
                        {totalDelayed} retrasados
                      </span>
                    )}
                  </div>
                  {expanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
            
            {expanded && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {shipments.map((shipment) => (
                    <Card 
                      key={shipment.id} 
                      className={`border cursor-pointer hover:shadow-md transition-all ${
                        onShipmentClick ? 'hover:border-primary' : ''
                      }`}
                      onClick={() => onShipmentClick?.(shipment)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-lg">
                                {shipment.trackingCode || `#${shipment.id}`}
                              </span>
                              <StatusBadge status={shipment.status} />
                              {shipment.customerName && (
                                <span className="text-sm text-muted-foreground">
                                  {shipment.customerName}
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              {shipment.product && (
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">Producto:</span>
                                  <span>{shipment.product}</span>
                                  {shipment.quantity && (
                                    <span className="text-muted-foreground">
                                      ({shipment.quantity} {shipment.unit || ''})
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {shipment.origin && shipment.destination && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">Ruta:</span>
                                  <span>{shipment.origin} → {shipment.destination}</span>
                                </div>
                              )}
                              
                              {/* Fecha de entrega: mostrar real si está entregado, sino estimada */}
                              {shipment.status === 'delivered' && (shipment.actualDeliveryDate || shipment.deliveredAt) ? (
                                <div className="flex items-center gap-2">
                                  <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <span className="font-medium text-green-700 dark:text-green-300">Entrega real:</span>
                                  <span className="font-semibold text-green-700 dark:text-green-300">
                                    {new Date(shipment.actualDeliveryDate || shipment.deliveredAt!).toLocaleDateString('es-MX', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              ) : shipment.estimatedDeliveryDate ? (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">Entrega estimada:</span>
                                  <span>
                                    {new Date(shipment.estimatedDeliveryDate).toLocaleDateString('es-MX', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              ) : null}
                              
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">Creado:</span>
                                <span>
                                  {new Date(shipment.createdAt).toLocaleDateString('es-MX', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                              
                              {/* Tiempos de ciclo */}
                              {shipment.cycleTimes?.hoursPendingToTransit && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  <span className="font-medium">Creación → En Tránsito:</span>
                                  <span className="text-blue-600 font-semibold">
                                    {formatDuration(shipment.cycleTimes.hoursPendingToTransit)}
                                  </span>
                                </div>
                              )}
                              
                              {shipment.cycleTimes?.hoursTransitToDelivered && (
                                <div className="flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-orange-600" />
                                  <span className="font-medium">En Tránsito → Entregado:</span>
                                  <span className="text-orange-600 font-semibold">
                                    {formatDuration(shipment.cycleTimes.hoursTransitToDelivered)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

