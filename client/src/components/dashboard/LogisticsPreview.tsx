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
  origin: string;
  destination: string;
  scheduled_date: string;
  items_count?: number;
}

export function LogisticsPreview() {
  const [, navigate] = useLocation();

  // Obtener envíos recientes
  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ['/api/logistics/shipments'],
    staleTime: 2 * 60 * 1000,
    refetchInterval: 30000,
  });

  const recentShipments = shipments.slice(0, 3);

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
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1e3a5f]/10 rounded-lg">
              <Truck className="h-5 w-5 text-[#1e3a5f]" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Módulo de Logística</CardTitle>
              <CardDescription>Vista previa de envíos recientes</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/logistics')}
            className="flex items-center gap-2"
          >
            Ver más
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : recentShipments.length > 0 ? (
          <div className="space-y-3">
            {recentShipments.map((shipment) => (
              <div 
                key={shipment.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Envío #{shipment.id}
                    </span>
                  </div>
                  <Badge variant="outline" className={getStatusColor(shipment.status)}>
                    {getStatusText(shipment.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{shipment.origin || 'N/A'}</span>
                  </div>
                  <ArrowRight className="h-3 w-3" />
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{shipment.destination || 'N/A'}</span>
                  </div>
                  {shipment.scheduled_date && (
                    <>
                      <span className="mx-1">•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(shipment.scheduled_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No hay envíos recientes</p>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/logistics')}
              className="mt-4"
            >
              Ir al módulo de logística
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

