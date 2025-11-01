import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, Package, Clock, ArrowRight, MapPin, Calendar } from 'lucide-react';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

interface Shipment {
  id: number;
  status: string;
  origin?: string;
  destination?: string;
  scheduled_date?: string;
  estimatedDeliveryDate?: string;
  createdAt?: string;
  items_count?: number;
  purchaseOrder?: string;
  purchase_order?: string;
  trackingCode?: string;
}

export function LogisticsPreview() {
  const [, navigate] = useLocation();

  // Obtener envíos recientes - usar el mismo endpoint que el resto de la app
  const { data: shipmentsResponse, isLoading } = useQuery<{shipments: Shipment[], pagination?: any} | Shipment[]>({
    queryKey: ['/api/shipments'],
    staleTime: 1 * 60 * 1000, // 1 minuto
    refetchInterval: 15000, // Refrescar cada 15 segundos para ver actualizaciones más rápido
    refetchOnWindowFocus: true, // Refrescar cuando se vuelve a la ventana
  });

  // Manejar ambos formatos de respuesta (array directo o objeto con shipments)
  const shipments = Array.isArray(shipmentsResponse) 
    ? shipmentsResponse 
    : (shipmentsResponse?.shipments || []);

  // Ordenar por fecha más reciente y tomar los primeros 3
  const recentShipments = shipments
    .sort((a: Shipment, b: Shipment) => {
      const dateA = a.scheduled_date || a.createdAt || '';
      const dateB = b.scheduled_date || b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 3);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'entregado':
      case 'delivered':
        return 'bg-success/10 text-success border-success/30';
      case 'en_transito':
      case 'in_transit':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'pendiente':
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/30';
      default:
        return 'bg-muted text-muted-foreground border-border/60';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'entregado':
      case 'delivered':
        return 'Entregado';
      case 'en_transito':
      case 'in_transit':
        return 'En Tránsito';
      case 'pendiente':
      case 'pending':
        return 'Pendiente';
      default:
        return status || 'Sin estado';
    }
  };

  return (
    <Card className="border border-border/60 bg-card shadow-soft hover:shadow-lg transition-modern">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/15 rounded-lg text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Módulo de Logística
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Vista previa de envíos recientes
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/logistics')}
            className="flex items-center gap-2 hover:bg-primary/10 text-primary transition-modern"
          >
            Ver más
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : recentShipments.length > 0 ? (
          <div className="space-y-3">
            {recentShipments.map((shipment) => (
              <div 
                key={shipment.id}
                className="group p-4 border border-border/60 rounded-xl bg-card/70 hover:border-primary/40 hover:shadow-md transition-modern cursor-pointer"
                onClick={() => navigate('/logistics')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/15 rounded-lg text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <span className="text-base font-bold text-foreground truncate">
                        {(shipment.purchaseOrder || shipment.purchase_order) || shipment.trackingCode || `Envío #${shipment.id}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">{shipment.origin || 'N/A'}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary/70" />
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">{shipment.destination || 'N/A'}</span>
                      </div>
                      {(shipment.scheduled_date || shipment.estimatedDeliveryDate || shipment.createdAt) && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">
                              {new Date(
                                shipment.scheduled_date || 
                                shipment.estimatedDeliveryDate || 
                                shipment.createdAt || ''
                              ).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge 
                    className={`${getStatusColor(shipment.status)} font-semibold text-xs px-3 py-1.5 whitespace-nowrap shadow-sm`}
                  >
                    {getStatusText(shipment.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <div className="p-4 bg-primary/15 rounded-full w-fit mx-auto mb-3 text-primary">
              <Truck className="h-8 w-8 opacity-70" />
            </div>
            <p className="text-sm font-medium mb-1">No hay envíos recientes</p>
            <p className="text-xs text-muted-foreground mb-4">
              Los envíos aparecerán aquí cuando se agreguen
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/logistics')}
              className="flex items-center gap-2 mx-auto border-primary/40 text-primary hover:bg-primary/10 transition-modern"
            >
              <Truck className="h-3.5 w-3.5" />
              Ir al módulo de logística
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

