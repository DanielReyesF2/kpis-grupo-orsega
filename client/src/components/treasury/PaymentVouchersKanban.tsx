import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, DollarSign, Calendar, Building2, Receipt, CheckCircle, Clock, FileCheck } from "lucide-react";
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
  clientId: number;
  clientName: string;
  status: "factura_pagada" | "pendiente_complemento" | "complemento_recibido" | "cierre_contable";
  voucherFileUrl: string;
  voucherFileName: string;
  extractedAmount: number | null;
  extractedDate: string | null;
  extractedBank: string | null;
  extractedReference: string | null;
  extractedCurrency: string | null;
  ocrConfidence: number | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_CONFIG = {
  factura_pagada: {
    label: "Factura Pagada",
    icon: Receipt,
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    badgeVariant: "default" as const,
  },
  pendiente_complemento: {
    label: "Pendiente Complemento",
    icon: Clock,
    color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
    badgeVariant: "secondary" as const,
  },
  complemento_recibido: {
    label: "Complemento Recibido",
    icon: FileCheck,
    color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
    badgeVariant: "outline" as const,
  },
  cierre_contable: {
    label: "Cierre Contable",
    icon: CheckCircle,
    color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
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
  } = useSortable({ id: voucher.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`voucher-card-${voucher.id}`}
    >
      <Card
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
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

  return (
    <div className="flex-1 min-w-[280px]">
      <div className={`rounded-lg border-2 ${config.color} p-4 h-full`}>
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
          <div className="space-y-3 min-h-[200px]">
            {vouchers.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay comprobantes
              </p>
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
    useSensor(PointerSensor),
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
    const newStatus = over.id as string;
    if (activeVoucher.status !== newStatus) {
      updateStatusMutation.mutate({
        id: activeVoucher.id,
        status: newStatus,
      });
    }
  };

  const groupedVouchers = {
    factura_pagada: vouchers.filter((v) => v.status === "factura_pagada"),
    pendiente_complemento: vouchers.filter((v) => v.status === "pendiente_complemento"),
    complemento_recibido: vouchers.filter((v) => v.status === "complemento_recibido"),
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => (
            <div key={status} id={status} className="flex-1 min-w-[280px]">
              <KanbanColumn
                status={status}
                vouchers={groupedVouchers[status]}
                onVoucherClick={setSelectedVoucher}
              />
            </div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
