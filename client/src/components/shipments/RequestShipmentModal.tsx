import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Truck, 
  Calendar, 
  MapPin, 
  Package, 
  User, 
  Mail,
  ClipboardCopy,
  Send
} from "lucide-react";

interface Shipment {
  id: number;
  trackingCode: string;
  customerName: string;
  product: string;
  quantity: number;
  unit: string;
  origin: string;
  destination: string;
  estimatedDeliveryDate: string | null;
  comments?: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface Provider {
  id: string;
  name: string;
  email?: string;
  contactName?: string;
  phone?: string;
}

interface RequestShipmentModalProps {
  shipment: Shipment;
  providers: Provider[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestData: RequestFormData) => void;
}

interface RequestFormData {
  providerId: string;
  pickupDate: string;
  appointmentRequired: boolean;
  appointmentNotes: string;
  ccEmails: string[];
  additionalNotes: string;
}

export function RequestShipmentModal({ 
  shipment, 
  providers, 
  isOpen, 
  onClose, 
  onSubmit 
}: RequestShipmentModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<RequestFormData>({
    providerId: '',
    pickupDate: shipment.estimatedDeliveryDate ? 
      new Date(shipment.estimatedDeliveryDate).toISOString().split('T')[0] : 
      new Date().toISOString().split('T')[0],
    appointmentRequired: false,
    appointmentNotes: '',
    ccEmails: [],
    additionalNotes: ''
  });

  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const selectedProvider = providers.find(p => p.id === formData.providerId);

  // Generar vista previa del correo
  const generateEmailPreview = () => {
    const subject = `Solicitud de recolección – ${shipment.customerName} – ${new Date(formData.pickupDate).toLocaleDateString('es-MX')}`;
    
    const appointmentText = formData.appointmentRequired 
      ? `Este servicio LLEVA cita${formData.appointmentNotes ? ` - ${formData.appointmentNotes}` : ''}`
      : 'Este servicio NO lleva cita';

    const emailBody = `
Estimado equipo de ${selectedProvider?.name || '[Proveedor]'},

Esperamos se encuentren bien. Les solicitamos cotización para el siguiente servicio de recolección:

${appointmentText}

DETALLES DEL ENVÍO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Cliente/Proyecto: ${shipment.customerName}
• Código: ${shipment.trackingCode}
• Origen: ${shipment.origin}
• Destino: ${shipment.destination}
• Fecha de recolección: ${new Date(formData.pickupDate).toLocaleDateString('es-MX')}
• Carga: ${shipment.product}
• Cantidad: ${shipment.quantity} ${shipment.unit}
• Observaciones: ${shipment.comments || 'Sin observaciones especiales'}
${shipment.customerPhone ? `• Contacto: ${shipment.customerPhone}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${formData.additionalNotes ? `Notas adicionales: ${formData.additionalNotes}` : ''}

Por favor confirmen disponibilidad y cotización.

Saludos cordiales,
Jesus Daniel Marquez
Grupo Orsega
jesusmarquez@grupoorsega.com
    `.trim();

    return { subject, body: emailBody };
  };

  const handleSubmit = () => {
    if (!formData.providerId) {
      toast({
        title: "Error",
        description: "Por favor selecciona un proveedor",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);
  };

  const handleCopyEmail = () => {
    const { subject, body } = generateEmailPreview();
    const mailtoLink = `mailto:${selectedProvider?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    
    toast({
      title: "Correo copiado",
      description: "Se abrió tu cliente de correo con el mensaje preparado",
    });
  };

  const { subject, body } = generateEmailPreview();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Solicitar Transporte
          </DialogTitle>
          <DialogDescription>
            Enviar solicitud de recolección al proveedor seleccionado
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información del envío (solo lectura) */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Package className="h-4 w-4" />
              Información del Envío
            </h3>
            
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-xs text-gray-600">Cliente/Proyecto</Label>
                <p className="font-medium">{shipment.customerName}</p>
              </div>
              
              <div>
                <Label className="text-xs text-gray-600">Código</Label>
                <p className="font-mono text-sm">{shipment.trackingCode}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Origen</Label>
                  <p className="text-sm">{shipment.origin}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Destino</Label>
                  <p className="text-sm">{shipment.destination}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-gray-600">Carga</Label>
                <p className="text-sm">{shipment.product} - {shipment.quantity} {shipment.unit}</p>
              </div>
              
              {shipment.comments && (
                <div>
                  <Label className="text-xs text-gray-600">Observaciones</Label>
                  <p className="text-sm">{shipment.comments}</p>
                </div>
              )}
              
              {shipment.customerPhone && (
                <div>
                  <Label className="text-xs text-gray-600">Contacto</Label>
                  <p className="text-sm">{shipment.customerPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Formulario de solicitud */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Detalles de la Solicitud
            </h3>
            
            <div className="space-y-4">
              {/* Proveedor */}
              <div className="space-y-2">
                <Label htmlFor="provider">Proveedor *</Label>
                <Select value={formData.providerId} onValueChange={(value) => setFormData(prev => ({ ...prev, providerId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{provider.name}</span>
                          {provider.email && <span className="text-xs text-gray-500">{provider.email}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha de recolección */}
              <div className="space-y-2">
                <Label htmlFor="pickupDate">Fecha de recolección</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickupDate: e.target.value }))}
                />
              </div>

              {/* ¿Lleva cita? */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="appointment"
                    checked={formData.appointmentRequired}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, appointmentRequired: checked }))}
                  />
                  <Label htmlFor="appointment">¿Lleva cita?</Label>
                </div>
                
                {formData.appointmentRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="appointmentNotes">Notas de la cita</Label>
                    <Textarea
                      id="appointmentNotes"
                      value={formData.appointmentNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, appointmentNotes: e.target.value }))}
                      placeholder="Horario preferido, instrucciones especiales..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Notas adicionales */}
              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Notas adicionales (opcional)</Label>
                <Textarea
                  id="additionalNotes"
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                  placeholder="Información adicional para el proveedor..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Vista previa del correo */}
        {selectedProvider && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Vista Previa del Correo</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailPreview(!showEmailPreview)}
              >
                {showEmailPreview ? 'Ocultar' : 'Mostrar'} Vista Previa
              </Button>
            </div>
            
            {showEmailPreview && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-gray-600">Para:</Label>
                  <p className="text-sm">{selectedProvider.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Asunto:</Label>
                  <p className="text-sm font-medium">{subject}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Mensaje:</Label>
                  <pre className="text-xs whitespace-pre-wrap bg-white p-3 rounded border font-mono max-h-32 overflow-y-auto">
                    {body}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCopyEmail}
            disabled={!selectedProvider}
            className="flex items-center gap-2"
          >
            <ClipboardCopy className="h-4 w-4" />
            Copiar Correo
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selectedProvider}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Enviar Solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}