import React, { useState } from 'react';
import Timeline from 'react-calendar-timeline';
import 'react-calendar-timeline/lib/Timeline.css';
import moment from 'moment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { PopoverTrigger, PopoverContent, Popover } from '@/components/ui/popover';
import { Truck, Calendar, AlertTriangle, CheckCircle2, X } from 'lucide-react';

// Tipos para envíos (copiado de ShipmentsPage.tsx)
interface Shipment {
  id: number;
  companyId: number;
  trackingCode: string;
  customerName: string;
  destination: string;
  origin: string;
  product: string;
  quantity: string;
  unit: string;
  departureDate: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
  carrier: string;
  vehicleInfo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
  carbonFootprint?: string;
}

// Tipo para compañía
interface Company {
  id: number;
  name: string;
}

interface ShipmentTimelineProps {
  shipments: Shipment[];
  companies: Company[];
  onSelectShipment: (shipment: Shipment) => void;
}

const getStatusColor = (status: Shipment['status']) => {
  const statusColors = {
    pending: '#f59e0b', // amber-500
    in_transit: '#3b82f6', // blue-500
    delayed: '#ef4444', // red-500
    delivered: '#10b981', // green-500
    cancelled: '#6b7280', // gray-500
  };
  return statusColors[status] || '#6b7280';
};

const getStatusIcon = (status: Shipment['status']) => {
  switch (status) {
    case 'pending':
      return <Calendar className="h-4 w-4 text-amber-500" />;
    case 'in_transit':
      return <Truck className="h-4 w-4 text-blue-500" />;
    case 'delayed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'delivered':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'cancelled':
      return <X className="h-4 w-4 text-gray-500" />;
    default:
      return null;
  }
};

export const ShipmentTimeline: React.FC<ShipmentTimelineProps> = ({ 
  shipments, 
  companies,
  onSelectShipment
}) => {
  const { toast } = useToast();
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);

  // Debug: Log de los datos recibidos
  console.log("ShipmentTimeline - Datos recibidos:");
  console.log("Shipments:", shipments);
  console.log("Companies:", companies);

  // Filtrar envíos que tengan fechas válidas
  const validShipments = shipments.filter(
    (shipment) => shipment.departureDate && shipment.estimatedDeliveryDate
  );
  
  // Debug: Log de envíos válidos
  console.log("Envíos válidos para timeline:", validShipments);

  if (validShipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Línea de tiempo de envíos</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-gray-500">
          No hay envíos con fechas válidas para mostrar en la línea de tiempo
        </CardContent>
      </Card>
    );
  }

  // Definir los grupos (uno por empresa)
  const groups = companies.map((company) => ({
    id: company.id,
    title: company.name,
  }));

  // Definir los items (envíos) para la línea de tiempo
  const items = validShipments.map((shipment) => {
    const startDate = moment(shipment.departureDate);
    const endDate = shipment.actualDeliveryDate 
      ? moment(shipment.actualDeliveryDate) 
      : moment(shipment.estimatedDeliveryDate);
    
    // Debug: Log de fechas procesadas
    console.log(`Envío ${shipment.trackingCode}:`, {
      fechaOrigen: shipment.departureDate,
      startDate: startDate.format('YYYY-MM-DD'),
      fechaEntrega: shipment.estimatedDeliveryDate,
      endDate: endDate.format('YYYY-MM-DD'),
      startTime: startDate.valueOf(),
      endTime: endDate.valueOf()
    });
    
    return {
      id: shipment.id,
      group: shipment.companyId,
      title: shipment.trackingCode,
      start_time: startDate.valueOf(),
      end_time: endDate.valueOf(),
      color: getStatusColor(shipment.status),
      shipment: shipment, // Guardamos la referencia al envío completo
    };
  });

  // Calcular las fechas límite para la visualización
  const minTime = moment().subtract(1, 'month').valueOf();
  const maxTime = moment().add(3, 'months').valueOf();

  // Función para manejar el clic en un envío
  const handleItemClick = (itemId: number) => {
    const shipment = validShipments.find((s) => s.id === itemId);
    if (shipment) {
      setSelectedShipmentId(itemId);
      onSelectShipment(shipment);
    }
  };

  // Personalización del renderizado de items
  const itemRenderer = ({ 
    item, 
    itemContext, 
    getItemProps 
  }: { 
    item: any; 
    itemContext: any; 
    getItemProps: (props: any) => any 
  }) => {
    const { left, width, top } = itemContext;
    const shipment = item.shipment as Shipment;
    const backgroundColor = item.color;
    
    const itemProps = getItemProps({
      style: {
        backgroundColor,
        color: '#fff',
        borderRadius: '4px',
        borderLeft: `4px solid ${backgroundColor}`,
        boxShadow: '1px 1px 5px rgba(0, 0, 0, 0.2)',
      },
    });

    return (
      <div {...itemProps} onClick={() => handleItemClick(item.id)}>
        <div 
          style={{ 
            height: '100%', 
            overflow: 'hidden', 
            paddingLeft: 3, 
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px'
          }}
        >
          <span className="mr-1">{getStatusIcon(shipment.status)}</span>
          <span>{shipment.trackingCode}</span>
          <span className="ml-1 text-xs">
            {shipment.product} - {shipment.destination}
          </span>
        </div>
      </div>
    );
  };

  // Configuración de la línea de tiempo
  const timelineConfig = {
    sidebarWidth: 150,
    lineHeight: 40,
    itemHeightRatio: 0.8,
    minZoom: 24 * 60 * 60 * 1000, // 1 día
    maxZoom: 31 * 24 * 60 * 60 * 1000, // 1 mes
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Vista de Línea de Tiempo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Timeline
            groups={groups}
            items={items}
            defaultTimeStart={moment().subtract(7, 'day').valueOf()}
            defaultTimeEnd={moment().add(30, 'day').valueOf()}
            minZoom={timelineConfig.minZoom}
            maxZoom={timelineConfig.maxZoom}
            sidebarWidth={timelineConfig.sidebarWidth}
            lineHeight={timelineConfig.lineHeight}
            itemHeightRatio={timelineConfig.itemHeightRatio}
            itemRenderer={itemRenderer}
            canMove={false}
            canResize={false}
            canChangeGroup={false}
            stackItems
            className="h-[500px]"
          />
        </div>

        <div className="mt-4 flex justify-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2 bg-amber-500"></div>
            <span className="text-xs">Pendiente</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
            <span className="text-xs">En Tránsito</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
            <span className="text-xs">Retrasado</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2 bg-green-500"></div>
            <span className="text-xs">Entregado</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2 bg-gray-500"></div>
            <span className="text-xs">Cancelado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};