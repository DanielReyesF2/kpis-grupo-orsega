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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'en_transito':
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pendiente':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
    <Card className="border shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Truck className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                Módulo de Logística
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Vista previa de envíos recientes
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/logistics')}
            className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Ver más
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : recentShipments.length > 0 ? (
          <div className="space-y-2.5">
            {recentShipments.map((shipment) => (
              <div 
                key={shipment.id}
                className="group p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer"
                onClick={() => navigate('/logistics')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded">
                        <Package className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {(shipment.purchaseOrder || shipment.purchase_order) || shipment.trackingCode || `Envío #${shipment.id}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-medium">{shipment.origin || 'N/A'}</span>
                      </div>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-medium">{shipment.destination || 'N/A'}</span>
                      </div>
                      {(shipment.scheduled_date || shipment.estimatedDeliveryDate || shipment.createdAt) && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span>
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
                    className={`${getStatusColor(shipment.status)} font-medium whitespace-nowrap`}
                  >
                    {getStatusText(shipment.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-fit mx-auto mb-3">
              <Truck className="h-8 w-8 opacity-50" />
            </div>
            <p className="text-sm font-medium mb-1">No hay envíos recientes</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Los envíos aparecerán aquí cuando se agreguen
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/logistics')}
              className="flex items-center gap-2 mx-auto"
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


