import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Download, X, ChevronRight, Edit2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportChecklistPanel } from "./ImportChecklistPanel";
import { useState } from "react";

interface ImportOrderFull {
  id: number;
  reference: string;
  company_id: number;
  status: string;
  supplier_name: string;
  supplier_country: string | null;
  incoterm: string | null;
  currency: string | null;
  total_value: string | null;
  purchase_order_number: string | null;
  destination: string | null;
  destination_detail: string | null;
  oc_document_key: string | null;
  oc_document_name: string | null;
  estimated_ship_date: string | null;
  estimated_arrival_date: string | null;
  estimated_customs_clear_date: string | null;
  estimated_warehouse_date: string | null;
  actual_ship_date: string | null;
  actual_arrival_date: string | null;
  actual_customs_clear_date: string | null;
  actual_warehouse_date: string | null;
  vessel_name: string | null;
  container_number: string | null;
  bill_of_lading_number: string | null;
  pedimento_number: string | null;
  customs_broker: string | null;
  local_carrier: string | null;
  items: Array<{
    id: number;
    product_name: string;
    quantity: string | null;
    unit: string | null;
    unit_price: string | null;
  }>;
  checklist: Array<{
    id: number;
    import_order_id: number;
    stage: string;
    label: string;
    type: string;
    is_required: boolean;
    sort_order: number;
    is_completed: boolean;
    completed_at: string | null;
    completed_by: number | null;
    file_key: string | null;
    file_name: string | null;
  }>;
  activity: Array<{
    id: number;
    action: string;
    from_status: string | null;
    to_status: string | null;
    details: string | null;
    user_name: string | null;
    created_at: string;
  }>;
}

interface ImportOrderDetailProps {
  orderId: number | null;
  onClose: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  oc_created: "OC Creada",
  in_transit_to_customs: "Camino a Aduana",
  in_customs: "En Aduana",
  in_yard: "En Patio",
  in_transit_to_warehouse: "Camino a Bodega",
  in_warehouse: "En Bodega",
  cancelled: "Cancelada",
};

const STAGES = [
  "oc_created",
  "in_transit_to_customs",
  "in_customs",
  "in_yard",
  "in_transit_to_warehouse",
  "in_warehouse",
];

export function ImportOrderDetail({ orderId, onClose }: ImportOrderDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: order, isLoading } = useQuery<ImportOrderFull>({
    queryKey: [`/api/import-orders/${orderId}`],
    enabled: !!orderId,
  });

  const advanceMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/import-orders/${orderId}/status`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/import-orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-orders"] });
      toast({ title: "Etapa actualizada" });
    },
    onError: (error: any) => {
      let message = "Error avanzando etapa";
      try {
        const body = JSON.parse(error.message.split(": ").slice(1).join(": "));
        message = body.message || message;
      } catch {}
      toast({ title: "No se puede avanzar", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/import-orders/${orderId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/import-orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/import-orders"] });
      setIsEditing(false);
      setEditData({});
      toast({ title: "Datos actualizados" });
    },
  });

  if (!orderId) return null;

  const currentIdx = order ? STAGES.indexOf(order.status) : -1;
  const nextStatus = currentIdx >= 0 && currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;

  // Count missing required items for current stage
  const currentStageChecklist = order?.checklist?.filter(
    (c: any) => c.stage === order.status && c.is_required && !c.is_completed
  ) || [];
  const canAdvance = currentStageChecklist.length === 0 && nextStatus;

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : !order ? (
          <p className="text-center text-slate-500 py-8">No se encontró la importación</p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                {order.reference}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Header info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg text-slate-900">
                    {order.supplier_name} ({order.supplier_country || "—"})
                  </p>
                  <p className="text-sm text-slate-500">
                    {order.incoterm || "—"} · {order.currency || "USD"} · OC: {order.purchase_order_number || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    className={cn(
                      "text-xs",
                      order.company_id === 1
                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                        : "bg-purple-100 text-purple-700 border-purple-300"
                    )}
                    variant="outline"
                  >
                    {order.company_id === 1 ? "DURA" : "ORSEGA"}
                  </Badge>
                  <p className="text-xs text-slate-500 mt-1">
                    {order.destination === "directo_cliente" ? order.destination_detail : "Bodega Nextipac"}
                  </p>
                </div>
              </div>

              {/* Progress stepper */}
              <div className="flex items-center gap-1 py-2">
                {STAGES.map((stage, idx) => {
                  const isPast = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={stage} className="flex items-center flex-1">
                      <div
                        className={cn(
                          "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold",
                          isPast && "bg-emerald-500 text-white",
                          isCurrent && "bg-purple-600 text-white ring-2 ring-purple-200",
                          !isPast && !isCurrent && "bg-slate-200 text-slate-400"
                        )}
                      >
                        {isPast ? "✓" : idx + 1}
                      </div>
                      {idx < STAGES.length - 1 && (
                        <div className={cn("flex-1 h-0.5 mx-1", isPast ? "bg-emerald-400" : "bg-slate-200")} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 -mt-4 px-1">
                {STAGES.map((s) => (
                  <span key={s} className="text-center" style={{ width: `${100 / STAGES.length}%` }}>
                    {STAGE_LABELS[s]}
                  </span>
                ))}
              </div>

              {/* Checklist */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Checklist</h3>
                <ImportChecklistPanel
                  orderId={order.id}
                  currentStatus={order.status}
                  checklist={order.checklist || []}
                />
              </div>

              {/* Products */}
              {order.items?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Productos</h3>
                  <div className="space-y-1">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-3 py-1.5">
                        <span className="text-slate-800">{item.product_name}</span>
                        <span className="text-slate-500">
                          {item.quantity ? `${Number(item.quantity).toLocaleString()} ${item.unit || ""}` : "—"}
                          {item.unit_price && ` · $${Number(item.unit_price).toFixed(2)} ${order.currency}`}
                        </span>
                      </div>
                    ))}
                    {order.total_value && (
                      <p className="text-sm text-right font-medium text-slate-700 pt-1">
                        Total: ${Number(order.total_value).toLocaleString("en-US", { minimumFractionDigits: 2 })} {order.currency}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Shipping data (visible from stage 2+) */}
              {currentIdx >= 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Datos de Envío</h3>
                    {!isEditing ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(true)}>
                        <Edit2 className="h-3 w-3 mr-1" /> Editar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (Object.keys(editData).length > 0) updateMutation.mutate(editData);
                          else setIsEditing(false);
                        }}
                      >
                        <Save className="h-3 w-3 mr-1" /> Guardar
                      </Button>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Buque</Label>
                        <Input
                          defaultValue={order.vessel_name || ""}
                          onChange={(e) => setEditData({ ...editData, vesselName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Contenedor</Label>
                        <Input
                          defaultValue={order.container_number || ""}
                          onChange={(e) => setEditData({ ...editData, containerNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Bill of Lading</Label>
                        <Input
                          defaultValue={order.bill_of_lading_number || ""}
                          onChange={(e) => setEditData({ ...editData, billOfLadingNumber: e.target.value })}
                        />
                      </div>
                      {currentIdx >= 2 && (
                        <>
                          <div>
                            <Label className="text-xs">Pedimento #</Label>
                            <Input
                              defaultValue={order.pedimento_number || ""}
                              onChange={(e) => setEditData({ ...editData, pedimentoNumber: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Agente Aduanal</Label>
                            <Input
                              defaultValue={order.customs_broker || ""}
                              onChange={(e) => setEditData({ ...editData, customsBroker: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                      {currentIdx >= 4 && (
                        <div>
                          <Label className="text-xs">Transportista local</Label>
                          <Input
                            defaultValue={order.local_carrier || ""}
                            onChange={(e) => setEditData({ ...editData, localCarrier: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Buque:</span>
                        <span className="text-slate-800">{order.vessel_name || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Contenedor:</span>
                        <span className="text-slate-800">{order.container_number || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">BL:</span>
                        <span className="text-slate-800">{order.bill_of_lading_number || "—"}</span>
                      </div>
                      {currentIdx >= 2 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Pedimento:</span>
                            <span className="text-slate-800">{order.pedimento_number || "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Ag. Aduanal:</span>
                            <span className="text-slate-800">{order.customs_broker || "—"}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Dates */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Fechas</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {order.actual_ship_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Embarque real:</span>
                      <span>{new Date(order.actual_ship_date + "T12:00:00").toLocaleDateString("es-MX")}</span>
                    </div>
                  )}
                  {order.estimated_ship_date && !order.actual_ship_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Embarque est.:</span>
                      <span>{new Date(order.estimated_ship_date + "T12:00:00").toLocaleDateString("es-MX")}</span>
                    </div>
                  )}
                  {order.estimated_arrival_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Llegada est.:</span>
                      <span>{new Date(order.estimated_arrival_date + "T12:00:00").toLocaleDateString("es-MX")}</span>
                    </div>
                  )}
                  {order.actual_arrival_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Llegada real:</span>
                      <span>{new Date(order.actual_arrival_date + "T12:00:00").toLocaleDateString("es-MX")}</span>
                    </div>
                  )}
                  {order.actual_warehouse_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Entrega real:</span>
                      <span className="text-emerald-600 font-medium">{new Date(order.actual_warehouse_date + "T12:00:00").toLocaleDateString("es-MX")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* OC Document */}
              {order.oc_document_key && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Documento OC Original</h3>
                  <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600 flex-1">{order.oc_document_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(`/api/files/url/${encodeURIComponent(order.oc_document_key || "")}`, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity log */}
              {order.activity?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Actividad Reciente</h3>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {order.activity.slice(0, 10).map((a: any) => (
                      <div key={a.id} className="text-xs text-slate-500 flex gap-2">
                        <span className="text-slate-400 whitespace-nowrap">
                          {new Date(a.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                        </span>
                        <span>
                          {a.user_name || "Sistema"} — {a.details || a.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {order.status !== "in_warehouse" && order.status !== "cancelled" && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t">
                  {nextStatus && (
                    <div className="flex items-center gap-2">
                      {!canAdvance && (
                        <span className="text-xs text-slate-400">
                          Faltan {currentStageChecklist.length} items
                        </span>
                      )}
                      <Button
                        onClick={() => nextStatus && advanceMutation.mutate(nextStatus)}
                        disabled={!canAdvance || advanceMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {advanceMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-1" />
                        )}
                        Avanzar a {STAGE_LABELS[nextStatus]}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
