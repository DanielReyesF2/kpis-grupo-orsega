/**
 * Logistics Compact - Versión minimalista para el dashboard
 * Muestra envíos recientes en una barra horizontal elegante
 */

import { useQuery } from '@tanstack/react-query';
import { Truck, Package, ArrowRight, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';

interface Shipment {
  id: number;
  status: string;
  origin?: string;
  destination?: string;
  scheduled_date?: string;
  estimatedDeliveryDate?: string;
  createdAt?: string;
  purchaseOrder?: string;
  purchase_order?: string;
  trackingCode?: string;
  customerName?: string;
  client_name?: string;
}

const getStatusConfig = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'entregado':
    case 'delivered':
      return { label: 'Entregado', color: 'bg-green-100 text-green-700 border-green-200' };
    case 'en_transito':
    case 'in_transit':
      return { label: 'En Tránsito', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'pendiente':
    case 'pending':
      return { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    default:
      return { label: status || 'Sin estado', color: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
};

export function LogisticsCompact() {
  const [, navigate] = useLocation();

  const { data: shipmentsResponse, isLoading } = useQuery<{shipments: Shipment[], pagination?: any} | Shipment[]>({
    queryKey: ['/api/shipments'],
    staleTime: 60000,
    refetchInterval: 30000,
  });

  const shipments = Array.isArray(shipmentsResponse)
    ? shipmentsResponse
    : (shipmentsResponse?.shipments || []);

  // Tomar los 3 más recientes
  const recentShipments = shipments
    .sort((a, b) => {
      const dateA = a.scheduled_date || a.createdAt || '';
      const dateB = b.scheduled_date || b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/60">
        <Truck className="h-5 w-5 text-primary" />
        <div className="flex gap-4 flex-1">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate('/logistics')}
      className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
    >
      {/* Icono */}
      <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
        <Truck className="h-5 w-5" />
      </div>

      {/* Título */}
      <div className="hidden sm:block min-w-fit">
        <p className="text-sm font-semibold text-foreground">Logística</p>
        <p className="text-xs text-muted-foreground">{shipments.length} envíos</p>
      </div>

      {/* Separador */}
      <div className="hidden sm:block w-px h-10 bg-border/60" />

      {/* Envíos recientes */}
      <div className="flex items-center gap-3 flex-1 overflow-x-auto">
        {recentShipments.length > 0 ? (
          recentShipments.map((shipment) => {
            const statusConfig = getStatusConfig(shipment.status);
            return (
              <div
                key={shipment.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/40 min-w-fit"
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                    {shipment.customerName || shipment.client_name || `#${shipment.id}`}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[60px]">{shipment.origin || 'Origen'}</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[60px]">{shipment.destination || 'Destino'}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0.5 ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </Badge>
              </div>
            );
          })
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Sin envíos recientes</span>
          </div>
        )}
      </div>

      {/* Indicador de ver más */}
      <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors whitespace-nowrap">
        <span>Ver todo</span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  );
}
