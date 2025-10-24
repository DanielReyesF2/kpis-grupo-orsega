import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Shipment } from '@shared/schema';
import { Truck, Mail, MapPin, MessageSquare, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ShipmentStatusUpdateProps {
  shipment: Shipment;
  onUpdate?: () => void;
}

const statusConfig = {
  pending: { label: 'Preparándose para envío', color: 'text-blue-600', icon: Clock },
  in_transit: { label: 'En tránsito', color: 'text-yellow-600', icon: Truck },
  delayed: { label: 'Retrasado', color: 'text-red-600', icon: AlertCircle },
  delivered: { label: 'Entregado', color: 'text-green-600', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-gray-600', icon: XCircle },
};

export function ShipmentStatusUpdate({ shipment, onUpdate }: ShipmentStatusUpdateProps) {
  const [status, setStatus] = useState(shipment.status);
  const [location, setLocation] = useState('');
  const [comments, setComments] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { 
      status: string; 
      location?: string; 
      comments?: string; 
      sendNotification: boolean; 
    }) => {
      return await apiRequest(`/api/shipments/${shipment.id}/status`, {
        method: 'PATCH',
        body: data
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Estado actualizado",
        description: data.notificationSent 
          ? "El estado del envío se actualizó y se envió una notificación al cliente"
          : "El estado del envío se actualizó correctamente",
      });
      
      // Invalidar cache para actualizar la vista
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipment-updates'] });
      
      // Limpiar formulario
      setLocation('');
      setComments('');
      setIsExpanded(false);
      
      if (onUpdate) onUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el estado del envío",
        variant: "destructive",
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (status === shipment.status && !location && !comments) {
      toast({
        title: "Sin cambios",
        description: "No hay cambios para actualizar",
        variant: "destructive",
      });
      return;
    }
    
    updateStatusMutation.mutate({
      status,
      location: location || undefined,
      comments: comments || undefined,
      sendNotification
    });
  };
  
  const currentStatusConfig = statusConfig[status as keyof typeof statusConfig];
  const CurrentIcon = currentStatusConfig?.icon || Truck;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CurrentIcon className="w-5 h-5" />
          Actualizar Estado del Envío
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Estado actual */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Estado actual:</span>
              <span className={`font-semibold ${statusConfig[shipment.status as keyof typeof statusConfig]?.color}`}>
                {statusConfig[shipment.status as keyof typeof statusConfig]?.label}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Contraer' : 'Actualizar'}
            </Button>
          </div>
          
          {isExpanded && (
            <>
              {/* Selector de nuevo estado */}
              <div className="space-y-2">
                <Label htmlFor="status">Nuevo Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="w-4 h-4" />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Ubicación actual */}
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Ubicación Actual (opcional)
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Ciudad de México, CDMX"
                />
              </div>
              
              {/* Comentarios */}
              <div className="space-y-2">
                <Label htmlFor="comments" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comentarios (opcional)
                </Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Notas adicionales sobre la actualización..."
                  rows={3}
                />
              </div>
              
              {/* Notificación por email */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">Notificar al cliente por email</p>
                    <p className="text-xs text-gray-600">
                      {shipment.customerEmail 
                        ? `Se enviará a: ${shipment.customerEmail}`
                        : 'Cliente sin email registrado'
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  checked={sendNotification}
                  onCheckedChange={setSendNotification}
                  disabled={!shipment.customerEmail}
                />
              </div>
              
              {/* Botones de acción */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="flex-1"
                >
                  {updateStatusMutation.isPending ? 'Actualizando...' : 'Actualizar Estado'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExpanded(false)}
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}