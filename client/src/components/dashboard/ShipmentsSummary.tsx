import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, Clock, CheckCircle, MapPin, AlertTriangle, BarChart, BadgeCheck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyFilter } from "@/hooks/use-company-filter";

// Constantes para manejo de estados
const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_transit: "En Tránsito",
  delivered: "Entregado",
  delayed: "Retrasado",
  cancelled: "Cancelado"
};

const statusChartColors: Record<string, string> = {
  pending: "#3b82f6",
  in_transit: "#f59e0b",
  delivered: "#10b981",
  delayed: "#ef4444",
  cancelled: "#64748b"
};

// Interfaz para los envíos
interface Shipment {
  id: number;
  trackingCode: string;
  companyId: number;
  origin: string;
  destination: string;
  product: string;
  quantity: string;
  status: string;
  carbonFootprint: number;
  departureDate?: Date;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  carrier: string;
  driverName?: string;
  driverPhone?: string;
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function ShipmentsSummary() {
  const { selectedCompany } = useCompanyFilter();

  // Consulta para obtener los envíos
  const { data: shipments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/shipments', selectedCompany],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/shipments');
      const data = await response.json();
      const allShipments = data as Shipment[];
      
      // Si hay una compañía seleccionada, filtrar los envíos
      if (selectedCompany) {
        console.log(`[ShipmentsSummary] Filtrando envíos para compañía ID: ${selectedCompany}`);
        return allShipments.filter(shipment => shipment.companyId === selectedCompany);
      }
      
      return allShipments;
    },
    refetchInterval: 5000, // Refrescar cada 5 segundos
    refetchOnWindowFocus: true, // Refrescar cuando la ventana vuelve a estar en foco
  });

  // Calcular contadores para cada tipo de estado
  const getStatusCounts = (shipments: Shipment[]) => {
    const counts = {
      pending: 0,
      in_transit: 0,
      delivered: 0,
      delayed: 0,
      cancelled: 0
    };
    
    shipments.forEach(shipment => {
      if (counts[shipment.status as keyof typeof counts] !== undefined) {
        counts[shipment.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  };

  // Preparar datos para el gráfico de pastel
  const prepareChartData = (counts: Record<string, number>) => {
    return Object.entries(counts).map(([key, value]) => ({
      name: statusLabels[key as keyof typeof statusLabels] || key,
      value,
      fill: statusChartColors[key as keyof typeof statusChartColors] || "#999999"
    })).filter(item => item.value > 0);
  };

  // Preparar datos para el gráfico de destinos por región
  const prepareDestinationChartData = (shipments: Shipment[]) => {
    const destinations: Record<string, number> = {};
    
    // Agrupar por región simplificada (extraer estado del formato "Ciudad, ESTADO")
    shipments.forEach(shipment => {
      const parts = shipment.destination.split(', ');
      const state = parts.length > 1 ? parts[1] : shipment.destination;
      
      if (!destinations[state]) {
        destinations[state] = 0;
      }
      destinations[state]++;
    });
    
    return Object.entries(destinations)
      .map(([destination, count]) => ({
        name: destination,
        value: count
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Mostrar solo los 5 principales destinos
  };

  // Obtener los últimos 3 envíos
  const getRecentShipments = (shipments: Shipment[]) => {
    return [...shipments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  };

  // Procesar datos solo cuando estén disponibles
  const totalShipments = shipments.length;
  const statusCounts = getStatusCounts(shipments);
  const chartData = prepareChartData(statusCounts);
  const destinationData = prepareDestinationChartData(shipments);
  const recentShipments = getRecentShipments(shipments);
  
  // Tarjetas con indicadores
  const cards = [
    {
      title: "Pendientes",
      value: statusCounts.pending,
      icon: <Package className="h-8 w-8 text-white" />,
      color: "bg-gradient-to-br from-blue-500 to-blue-700",
      percent: totalShipments > 0 ? Math.round((statusCounts.pending / totalShipments) * 100) : 0,
      iconBg: "bg-blue-600"
    },
    {
      title: "En Tránsito",
      value: statusCounts.in_transit,
      icon: <Truck className="h-8 w-8 text-white" />,
      color: "bg-gradient-to-br from-amber-500 to-amber-700",
      percent: totalShipments > 0 ? Math.round((statusCounts.in_transit / totalShipments) * 100) : 0,
      iconBg: "bg-amber-600"
    },
    {
      title: "Retrasados",
      value: statusCounts.delayed,
      icon: <AlertTriangle className="h-8 w-8 text-white" />,
      color: "bg-gradient-to-br from-red-500 to-red-700",
      percent: totalShipments > 0 ? Math.round((statusCounts.delayed / totalShipments) * 100) : 0,
      iconBg: "bg-red-600"
    },
    {
      title: "Entregados",
      value: statusCounts.delivered,
      icon: <BadgeCheck className="h-8 w-8 text-white" />,
      color: "bg-gradient-to-br from-emerald-500 to-emerald-700",
      percent: totalShipments > 0 ? Math.round((statusCounts.delivered / totalShipments) * 100) : 0,
      iconBg: "bg-emerald-600"
    },
  ];

  // Si estamos cargando, mostrar un esqueleto
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Trazabilidad de Envíos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardHeader className="pb-2 pt-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20 mt-2" />
              </CardHeader>
              <CardContent className="pb-6">
                <Skeleton className="h-10 w-16 my-2" />
                <Skeleton className="h-2 w-full mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje
  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Trazabilidad de Envíos</h2>
        <Card className="border-0 shadow-lg bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error al cargar datos</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No se pudieron cargar los datos de envíos. Por favor, intente nuevamente más tarde.</p>
            <button 
              onClick={() => refetch()} 
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si no hay envíos, mostrar mensaje
  if (shipments.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Trazabilidad de Envíos</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="py-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium">No hay envíos registrados</h3>
            <p className="mt-2 text-gray-500">Los envíos que cree aparecerán aquí.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Trazabilidad de Envíos</h2>
      
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <Card 
            key={index} 
            className={`border-0 shadow-lg ${card.color} text-white overflow-hidden`}
          >
            <CardHeader className="pb-2 pt-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium text-white">{card.title}</CardTitle>
                <CardDescription className="text-white/80">
                  {card.percent}% del total
                </CardDescription>
              </div>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                {card.icon}
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="text-4xl font-bold my-2">{card.value}</div>
              <div className="w-full h-1 bg-white/20 rounded-full mt-3">
                <div 
                  className="h-full bg-white/80 rounded-full"
                  style={{ width: `${card.percent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Gráficos y lista de últimos envíos */}
      <div className="grid gap-6 grid-cols-1">
        {/* Gráfico de estado de envíos */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Estado de Envíos</CardTitle>
                <CardDescription>Distribución por estatus</CardDescription>
              </div>
              <BarChart className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[230px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value} envíos`, 'Cantidad']}
                      contentStyle={{ 
                        borderRadius: '8px', 
                        border: 'none', 
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)'
                      }}
                    />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      align="center"
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No hay datos suficientes</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Gráfico de destinos por región eliminado a petición del usuario */}
      </div>
      
      {/* Últimos envíos creados */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Últimos Envíos</CardTitle>
              <CardDescription>Pedidos más recientes</CardDescription>
            </div>
            <Clock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
        </CardHeader>
        <CardContent>
          {recentShipments.length > 0 ? (
            <div className="space-y-4">
              {recentShipments.map(shipment => (
                <div 
                  key={shipment.id} 
                  className="flex items-center p-3 rounded-lg bg-secondary-50 dark:bg-primary-950/40 border border-secondary-100 dark:border-primary-800/40"
                >
                  <div className="mr-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      shipment.status === 'delivered' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                      shipment.status === 'in_transit' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                      shipment.status === 'delayed' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                      'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    }`}>
                      {shipment.status === 'delivered' ? <BadgeCheck className="h-5 w-5" /> :
                       shipment.status === 'in_transit' ? <Truck className="h-5 w-5" /> :
                       shipment.status === 'delayed' ? <AlertTriangle className="h-5 w-5" /> :
                       <Package className="h-5 w-5" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold">{shipment.trackingCode}</h4>
                      <Badge 
                        className={
                          shipment.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
                          shipment.status === 'in_transit' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400' :
                          shipment.status === 'delayed' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400'
                        }
                      >
                        {statusLabels[shipment.status as keyof typeof statusLabels] || 'Desconocido'}
                      </Badge>
                    </div>
                    <div className="text-sm text-secondary-600 dark:text-secondary-400 flex flex-wrap gap-x-4 items-center">
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1 inline-block" />
                        {shipment.destination}
                      </span>
                      <span className="flex items-center">
                        <Package className="h-3 w-3 mr-1 inline-block" />
                        {shipment.product}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-gray-500">No hay envíos recientes</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}