import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, DollarSign, Calendar, Building2, Receipt, CheckCircle, Clock, FileCheck, Mail, RefreshCw, Send, AlertTriangle, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PaymentVoucher {
  id: number;
  companyId: number;
  payerCompanyId?: number;
  clientId: number;
  clientName: string;
  status: "pendiente_validacion" | "validado" | "pendiente_asociacion" | "pendiente_complemento" | "complemento_recibido" | "cerrado" | "cierre_contable";
  voucherFileUrl: string;
  voucherFileName: string;
  extractedAmount: number | null;
  extractedDate: string | null;
  extractedBank: string | null;
  extractedReference: string | null;
  extractedCurrency: string | null;
  extractedOriginAccount?: string | null;
  extractedDestinationAccount?: string | null;
  extractedTrackingKey?: string | null;
  extractedBeneficiaryName?: string | null;
  ocrConfidence: number | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_CONFIG = {
  pendiente_validacion: {
    label: "Pendiente Validación",
    icon: Clock,
    color: "bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700",
    badgeVariant: "secondary" as const,
  },
  validado: {
    label: "Validado",
    icon: ClipboardCheck,
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    badgeVariant: "default" as const,
  },
  pendiente_asociacion: {
    label: "Pendiente Asociación",
    icon: FileText,
    color: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
    badgeVariant: "secondary" as const,
  },
  pendiente_complemento: {
    label: "Pendiente Complemento",
    icon: AlertTriangle,
    color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
    badgeVariant: "secondary" as const,
  },
  complemento_recibido: {
    label: "Complemento Recibido",
    icon: FileCheck,
    color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
    badgeVariant: "outline" as const,
  },
  cerrado: {
    label: "Cerrado",
    icon: CheckCircle,
    color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
    badgeVariant: "default" as const,
  },
  cierre_contable: {
    label: "Cierre Contable",
    icon: CheckCircle,
    color: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700",
    badgeVariant: "default" as const,
  },
};

interface VoucherCardProps {
  voucher: PaymentVoucher;
  onClick: () => void;
}

function SortableVoucherCard({ voucher, onClick }: VoucherCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: voucher.id,
    data: {
      type: 'voucher',
      voucher: voucher,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`voucher-card-${voucher.id}`}
      className="touch-none" // Mejorar experiencia en móviles
    >
      <Card
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {voucher.clientName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {voucher.voucherFileName}
              </p>
            </div>
            {voucher.extractedCurrency && voucher.extractedAmount && (
              <Badge variant="outline" className="ml-2">
                {voucher.extractedCurrency} ${voucher.extractedAmount.toLocaleString()}
              </Badge>
            )}
          </div>

          {voucher.extractedBank && (
            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
              <Building2 className="h-3 w-3" />
              {voucher.extractedBank}
            </div>
          )}

          {voucher.extractedReference && (
            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
              <FileText className="h-3 w-3" />
              Ref: {voucher.extractedReference}
            </div>
          )}

          {voucher.extractedTrackingKey && (
            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
              <FileText className="h-3 w-3" />
              Clave SPEI: {voucher.extractedTrackingKey}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3 w-3" />
            {format(new Date(voucher.createdAt), "dd MMM yyyy", { locale: es })}
          </div>

          {voucher.ocrConfidence !== null && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Confianza OCR</span>
                <Badge
                  variant={voucher.ocrConfidence > 0.7 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {(voucher.ocrConfidence * 100).toFixed(0)}%
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface KanbanColumnProps {
  status: keyof typeof STATUS_CONFIG;
  vouchers: PaymentVoucher[];
  onVoucherClick: (voucher: PaymentVoucher) => void;
}

function KanbanColumn({ status, vouchers, onVoucherClick }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-1 min-w-[280px]">
      <div 
        ref={setNodeRef}
        className={`rounded-lg border-2 ${config.color} p-4 h-full min-h-[500px] flex flex-col transition-all ${
          isOver ? "ring-2 ring-primary ring-offset-2 bg-opacity-90" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="font-semibold">{config.label}</h3>
          </div>
          <Badge variant={config.badgeVariant}>{vouchers.length}</Badge>
        </div>

        <SortableContext
          items={vouchers.map((v) => v.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 flex-1 min-h-[400px]">
            {vouchers.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-sm text-slate-500 text-center">
                  {isOver ? "Suelta aquí" : "No hay comprobantes"}
                </p>
              </div>
            ) : (
              vouchers.map((voucher) => (
                <SortableVoucherCard
                  key={voucher.id}
                  voucher={voucher}
                  onClick={() => onVoucherClick(voucher)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

interface PaymentVouchersKanbanProps {
  vouchers: PaymentVoucher[];
}

export function PaymentVouchersKanban({ vouchers }: PaymentVouchersKanbanProps) {
  const { toast } = useToast();
  const [activeVoucher, setActiveVoucher] = useState<PaymentVoucher | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Permitir drag inmediato sin delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`/api/payment-vouchers/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({ title: "Estado actualizado correctamente" });
    },
    onError: () => {
      toast({
        title: "Error al actualizar",
        description: "No se pudo cambiar el estado del comprobante",
        variant: "destructive",
      });
    },
  });

  // Mutación para reenviar comprobante
  const resendReceiptMutation = useMutation({
    mutationFn: async (voucher: PaymentVoucher) => {
      return await apiRequest("/api/treasury/resend-receipt", {
        method: "POST",
        body: JSON.stringify({
          voucherId: voucher.id,
          clientId: voucher.clientId,
          companyId: voucher.companyId,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({ 
        title: "✅ Comprobante reenviado", 
        description: data.message || "El comprobante ha sido enviado nuevamente al proveedor"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al reenviar",
        description: error.message || "No se pudo reenviar el comprobante",
        variant: "destructive",
      });
    },
  });

  // Mutación para enviar recordatorio
  const sendReminderMutation = useMutation({
    mutationFn: async (voucher: PaymentVoucher) => {
      return await apiRequest("/api/treasury/send-reminder", {
        method: "POST",
        body: JSON.stringify({
          voucherId: voucher.id,
          clientId: voucher.clientId,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({ 
        title: "📧 Recordatorio enviado", 
        description: data.message || "Se ha enviado un recordatorio al proveedor"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar recordatorio",
        description: error.message || "No se pudo enviar el recordatorio",
        variant: "destructive",
      });
    },
  });

  const handleResendReceipt = (voucher: PaymentVoucher) => {
    resendReceiptMutation.mutate(voucher);
  };

  const handleSendReminder = (voucher: PaymentVoucher) => {
    sendReminderMutation.mutate(voucher);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const voucher = vouchers.find((v) => v.id === event.active.id);
    setActiveVoucher(voucher || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveVoucher(null);

    if (!over) return;

    const activeVoucher = vouchers.find((v) => v.id === active.id);
    if (!activeVoucher) return;

    // Determinar el nuevo estado basado en dónde se soltó
    // Aceptar cualquier estado válido del enum
    const newStatus = over.id as keyof typeof STATUS_CONFIG;
    
    // Validar que el estado existe en STATUS_CONFIG
    if (!STATUS_CONFIG[newStatus]) {
      console.warn(`Estado inválido: ${newStatus}`);
      return;
    }

    // Actualizar solo si el estado cambió
    if (activeVoucher.status !== newStatus) {
      updateStatusMutation.mutate({
        id: activeVoucher.id,
        status: newStatus,
      });
    }
  };

  const groupedVouchers = {
    pendiente_validacion: vouchers.filter((v) => v.status === "pendiente_validacion"),
    validado: vouchers.filter((v) => v.status === "validado"),
    pendiente_asociacion: vouchers.filter((v) => v.status === "pendiente_asociacion"),
    pendiente_complemento: vouchers.filter((v) => v.status === "pendiente_complemento"),
    complemento_recibido: vouchers.filter((v) => v.status === "complemento_recibido"),
    cerrado: vouchers.filter((v) => v.status === "cerrado"),
    cierre_contable: vouchers.filter((v) => v.status === "cierre_contable"),
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              vouchers={groupedVouchers[status]}
              onVoucherClick={setSelectedVoucher}
            />
          ))}
        </div>

        <DragOverlay>
          {activeVoucher ? (
            <Card className="cursor-grabbing shadow-xl rotate-3">
              <CardContent className="p-4">
                <p className="font-semibold">{activeVoucher.clientName}</p>
                <p className="text-sm text-slate-500">{activeVoucher.voucherFileName}</p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de Detalles */}
      <Dialog open={!!selectedVoucher} onOpenChange={() => setSelectedVoucher(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Comprobante</DialogTitle>
          </DialogHeader>
          {selectedVoucher && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Cliente</p>
                  <p className="font-semibold">{selectedVoucher.clientName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Estado</p>
                  <Badge variant={STATUS_CONFIG[selectedVoucher.status].badgeVariant}>
                    {STATUS_CONFIG[selectedVoucher.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Monto</p>
                  <p className="font-semibold">
                    {selectedVoucher.extractedCurrency} ${selectedVoucher.extractedAmount?.toLocaleString() || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Banco</p>
                  <p className="font-semibold">{selectedVoucher.extractedBank || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Referencia</p>
                  <p className="font-semibold">{selectedVoucher.extractedReference || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Fecha</p>
                  <p className="font-semibold">
                    {selectedVoucher.extractedDate 
                      ? format(new Date(selectedVoucher.extractedDate), "dd/MM/yyyy", { locale: es })
                      : "N/A"}
                  </p>
                </div>
              </div>

              {selectedVoucher.notes && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Notas</p>
                  <p className="text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded">
                    {selectedVoucher.notes}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Archivo</p>
                <p className="text-sm">{selectedVoucher.voucherFileName}</p>
              </div>

              {/* Botones de Automatización para Lolita */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  🤖 Acciones Automatizadas
                </h4>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResendReceipt(selectedVoucher)}
                    disabled={resendReceiptMutation.isPending}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {resendReceiptMutation.isPending ? "Enviando..." : "Reenviar Comprobante"}
                  </Button>
                  
                  {selectedVoucher.status === 'pendiente_complemento' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendReminder(selectedVoucher)}
                      disabled={sendReminderMutation.isPending}
                      className="text-orange-600 hover:text-orange-700"
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      {sendReminderMutation.isPending ? "Enviando..." : "Recordatorio"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
