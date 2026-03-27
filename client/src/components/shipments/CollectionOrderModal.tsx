import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  Package,
  MapPin,
  Download,
  Send,
  Scale,
  Layers,
  History,
  Mail,
  Check,
  AlertCircle,
} from "lucide-react";
import { calculatePalletDistribution } from "@shared/collection-order-utils";

interface Shipment {
  id: number;
  trackingCode: string;
  customerName: string;
  customerId?: number | null;
  product: string;
  quantity: number;
  unit: string;
  origin: string;
  destination: string;
  estimatedDeliveryDate: string | null;
  drumCount?: number | null;
}

interface Provider {
  id: string;
  name: string;
  email?: string;
}

interface CollectionOrderRecord {
  id: number;
  action: string;
  drum_count: number;
  total_weight_kg: number;
  total_tarimas: number;
  pallet_description: string;
  pickup_date: string;
  provider_name: string | null;
  provider_email: string | null;
  email_message_id: string | null;
  email_error: string | null;
  sent_by_name: string | null;
  created_at: string;
}

interface CollectionOrderModalProps {
  shipment: Shipment;
  providers: Provider[];
  isOpen: boolean;
  onClose: () => void;
}

export function CollectionOrderModal({
  shipment,
  providers,
  isOpen,
  onClose,
}: CollectionOrderModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [drumCount, setDrumCount] = useState<string>(
    shipment.drumCount ? String(shipment.drumCount) : ""
  );
  const [pickupDate, setPickupDate] = useState(
    shipment.estimatedDeliveryDate
      ? new Date(shipment.estimatedDeliveryDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [pickupWindow, setPickupWindow] = useState("DE 10:00 A 16:00 HRS");
  const [providerId, setProviderId] = useState("");

  // Client address fields (inline editing)
  const [clientColonia, setClientColonia] = useState("");
  const [clientMunicipality, setClientMunicipality] = useState("");
  const [showClientFields, setShowClientFields] = useState(false);

  const drums = parseInt(drumCount) || 0;
  const distribution = useMemo(() => calculatePalletDistribution(drums), [drums]);

  // Fetch history
  const { data: history = [], refetch: refetchHistory } = useQuery<CollectionOrderRecord[]>({
    queryKey: [`/api/shipments/${shipment.id}/collection-orders`],
    enabled: isOpen,
  });

  // Build request body with optional client overrides
  const buildBody = (extra?: Record<string, unknown>) => ({
    drumCount: drums,
    pickupDate,
    pickupWindow,
    ...(clientColonia.trim() ? { clientColonia: clientColonia.trim() } : {}),
    ...(clientMunicipality.trim() ? { clientMunicipality: clientMunicipality.trim() } : {}),
    ...extra,
  });

  const invalidateAndRefetch = () => {
    refetchHistory();
    queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/shipments/${shipment.id}/collection-order/generate`,
        buildBody()
      );
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Orden_Recoleccion_${shipment.trackingCode}_${pickupDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Excel descargado", description: "La orden de recolección se descargó correctamente" });
      invalidateAndRefetch();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo generar el Excel", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/shipments/${shipment.id}/collection-order/send`,
        buildBody({ providerId })
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Enviado", description: "La orden de recolección fue enviada al transportista" });
        invalidateAndRefetch();
        onClose();
      } else {
        toast({ title: "Error al enviar", description: data.error || "No se pudo enviar el email", variant: "destructive" });
        invalidateAndRefetch();
      }
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo enviar la orden", variant: "destructive" });
    },
  });

  const selectedProvider = providers.find((p) => p.id === providerId);
  const canGenerate = drums > 0;
  const canSend = drums > 0 && providerId && selectedProvider?.email;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Solicitar Envío
          </DialogTitle>
          <DialogDescription>
            Genera la orden de recolección y la envía al proveedor de transporte
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel izquierdo: Info del envío */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Datos del Envío
            </h3>
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <p className="font-medium">{shipment.customerName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Código</Label>
                <p className="font-mono text-xs">{shipment.trackingCode}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Origen</Label>
                  <p className="text-xs flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    {shipment.origin}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Destino</Label>
                  <p className="text-xs flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    {shipment.destination}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Producto</Label>
                <p className="text-xs">{shipment.product} - {shipment.quantity} {shipment.unit}</p>
              </div>
            </div>

            {/* Datos del cliente para el Excel (colonia/municipio) */}
            {shipment.customerId && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowClientFields(!showClientFields)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  {showClientFields ? "Ocultar" : "Completar"} datos de destino (colonia/municipio)
                </button>
                {showClientFields && (
                  <div className="space-y-2 p-3 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs">Colonia</Label>
                      <Input
                        value={clientColonia}
                        onChange={(e) => setClientColonia(e.target.value)}
                        placeholder="Ej: Centro, Industrial, etc."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Municipio</Label>
                      <Input
                        value={clientMunicipality}
                        onChange={(e) => setClientMunicipality(e.target.value)}
                        placeholder="Ej: Guadalajara, Monterrey, etc."
                        className="h-8 text-xs"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se guardarán en el cliente para futuras órdenes
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel derecho: Formulario */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Datos de Recolección
            </h3>
            <div className="space-y-4">
              {/* # de Tambos */}
              <div className="space-y-2">
                <Label htmlFor="drumCount"># de Tambos *</Label>
                <Input
                  id="drumCount"
                  type="number"
                  min={1}
                  value={drumCount}
                  onChange={(e) => setDrumCount(e.target.value)}
                  placeholder="Ej: 10"
                />
              </div>

              {/* Preview en vivo */}
              {drums > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2 text-sm border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Peso:</span>
                    <span>{distribution.totalWeightKg.toLocaleString("es-MX")} kg</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Tarimas:</span>
                    <span>{distribution.totalTarimas}</span>
                  </div>
                  {distribution.description && (
                    <p className="text-xs text-muted-foreground">{distribution.description}</p>
                  )}
                </div>
              )}

              {/* Fecha de recolección */}
              <div className="space-y-2">
                <Label htmlFor="pickupDate">Fecha de recolección</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
              </div>

              {/* Horario */}
              <div className="space-y-2">
                <Label htmlFor="pickupWindow">Horario</Label>
                <Input
                  id="pickupWindow"
                  value={pickupWindow}
                  onChange={(e) => setPickupWindow(e.target.value)}
                />
              </div>

              {/* Proveedor */}
              <div className="space-y-2">
                <Label htmlFor="provider">Proveedor de transporte</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-medium">{p.name}</span>
                        {p.email && <span className="text-xs text-muted-foreground ml-2">({p.email})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {providerId && selectedProvider && !selectedProvider.email && (
                  <p className="text-xs text-destructive">Este proveedor no tiene email configurado</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Historial de órdenes */}
        {history.length > 0 && (
          <div className="space-y-3 mt-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial de Órdenes ({history.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-3 p-3 rounded-lg border text-xs"
                >
                  <div className="mt-0.5">
                    {record.action === 'sent' ? (
                      record.email_error ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Mail className="h-4 w-4 text-green-600" />
                      )
                    ) : (
                      <Download className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={record.action === 'sent' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                        {record.action === 'sent' ? 'Enviado' : 'Descargado'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {record.drum_count} tambos / {record.total_weight_kg.toLocaleString()} kg / {record.total_tarimas} tarimas
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Recolección: {record.pickup_date}
                      {record.provider_name && (
                        <span> &rarr; {record.provider_name} ({record.provider_email})</span>
                      )}
                    </div>
                    {record.email_error && (
                      <p className="text-red-500">Error: {record.email_error}</p>
                    )}
                    <div className="text-muted-foreground/70">
                      Por: {record.sent_by_name || 'Sistema'} &middot; {new Date(record.created_at).toLocaleString('es-MX')}
                    </div>
                  </div>
                  {record.action === 'sent' && !record.email_error && (
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={!canGenerate || generateMutation.isPending}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {generateMutation.isPending ? "Generando..." : "Descargar Excel"}
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend || sendMutation.isPending}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Enviando..." : "Enviar a Transportista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
