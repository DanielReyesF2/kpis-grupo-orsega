import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, DollarSign, Calendar, Building2, Upload, CheckCircle, Clock, AlertCircle } from "lucide-react";
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UploadVoucherToPaymentModal } from "./modals/UploadVoucherToPaymentModal";
import { PaymentDocumentsView } from "./PaymentDocumentsView";

interface ScheduledPayment {
  id: number;
  companyId: number;
  supplierId: number | null;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  reference: string | null;
  notes: string | null;
  voucherId: number | null;
  hydralFileUrl: string | null;
  hydralFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLUMN_CONFIG = {
  por_pagar: {
    label: "Por pagar",
    icon: Clock,
    color: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
    badgeVariant: "secondary" as const,
    statuses: ['idrall_imported', 'pending_approval', 'approved', 'payment_scheduled', 'payment_pending'],
  },
  pagada: {
    label: "Pagada",
    icon: CheckCircle,
    color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
    badgeVariant: "default" as const,
    statuses: ['payment_completed', 'closed'],
  },
  en_seguimiento_rep: {
    label: "En seguimiento REP",
    icon: AlertCircle,
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    badgeVariant: "outline" as const,
    statuses: ['voucher_uploaded'], // Solo si tiene voucherId y requiere REP
  },
};

interface PaymentCardProps {
  payment: ScheduledPayment;
  columnId: keyof typeof COLUMN_CONFIG;
  onViewDocuments: () => void;
  onUploadVoucher: () => void;
}

function SortablePaymentCard({ payment, columnId, onViewDocuments, onUploadVoucher }: PaymentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: payment.id,
    data: {
      type: 'scheduled_payment',
      payment: payment,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const isOverdue = new Date(payment.dueDate) < new Date();
  const isPorPagar = columnId === 'por_pagar';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <Card
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {payment.supplierName || 'Proveedor desconocido'}
              </p>
              {payment.reference && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Factura: {payment.reference}
                </p>
              )}
            </div>
            <Badge variant={isOverdue ? "destructive" : "outline"} className="ml-2">
              {payment.currency} ${payment.amount.toLocaleString()}
            </Badge>
          </div>

          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
            <Calendar className="h-3 w-3" />
            Vence: {format(new Date(payment.dueDate), "dd MMM yyyy", { locale: es })}
            {isOverdue && <span className="ml-1 font-semibold">(Vencida)</span>}
          </div>

          {isPorPagar && (
            <div className="pt-2 border-t space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadVoucher();
                }}
              >
                <Upload className="h-3 w-3 mr-1" />
                Subir comprobante
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDocuments();
                }}
              >
                <FileText className="h-3 w-3 mr-1" />
                Ver documentos
              </Button>
            </div>
          )}

          {!isPorPagar && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs mt-2"
              onClick={(e) => {
                e.stopPropagation();
                onViewDocuments();
              }}
            >
              <FileText className="h-3 w-3 mr-1" />
              Ver documentos
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface KanbanColumnProps {
  columnId: keyof typeof COLUMN_CONFIG;
  payments: ScheduledPayment[];
  onPaymentClick: (payment: ScheduledPayment) => void;
  onUploadVoucher: (payment: ScheduledPayment) => void;
}

function KanbanColumn({ columnId, payments, onPaymentClick, onUploadVoucher }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnId];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
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
          <Badge variant={config.badgeVariant}>{payments.length}</Badge>
        </div>

        <SortableContext
          items={payments.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 flex-1 min-h-[400px]">
            {payments.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-sm text-slate-500 text-center">
                  {isOver ? "Suelta aquí" : "No hay pagos"}
                </p>
              </div>
            ) : (
              payments.map((payment) => (
                <SortablePaymentCard
                  key={payment.id}
                  payment={payment}
                  columnId={columnId}
                  onViewDocuments={() => onPaymentClick(payment)}
                  onUploadVoucher={() => onUploadVoucher(payment)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

interface ScheduledPaymentsKanbanProps {
  companyId?: number;
}

export function ScheduledPaymentsKanban({ companyId }: ScheduledPaymentsKanbanProps) {
  const { toast } = useToast();
  const [activePayment, setActivePayment] = useState<ScheduledPayment | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<ScheduledPayment | null>(null);
  const [uploadVoucherPayment, setUploadVoucherPayment] = useState<ScheduledPayment | null>(null);

  // Obtener scheduled payments
  const { data: payments = [], isLoading } = useQuery<ScheduledPayment[]>({
    queryKey: ["/api/treasury/payments", companyId],
    queryFn: async () => {
      const params = companyId ? `?companyId=${companyId}` : '';
      const response = await fetch(`/api/treasury/payments${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      return await response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`/api/scheduled-payments/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      toast({ title: "Estado actualizado correctamente" });
    },
    onError: () => {
      toast({
        title: "Error al actualizar",
        description: "No se pudo cambiar el estado del pago",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const payment = payments.find((p) => p.id === event.active.id);
    setActivePayment(payment || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePayment(null);

    if (!over) return;

    const activePayment = payments.find((p) => p.id === active.id);
    if (!activePayment) return;

    const columnId = over.id as keyof typeof COLUMN_CONFIG;
    if (!COLUMN_CONFIG[columnId]) return;

    // Determinar el nuevo estado basado en la columna
    const config = COLUMN_CONFIG[columnId];
    const newStatus = config.statuses[0]; // Usar el primer estado de la columna

    if (activePayment.status !== newStatus) {
      updateStatusMutation.mutate({
        id: activePayment.id,
        status: newStatus,
      });
    }
  };

  // Agrupar pagos por columna
  const groupedPayments = useMemo(() => {
    const porPagar = payments.filter((p) => 
      COLUMN_CONFIG.por_pagar.statuses.includes(p.status)
    );
    const pagada = payments.filter((p) => 
      COLUMN_CONFIG.pagada.statuses.includes(p.status)
    );
    const enSeguimientoREP = payments.filter((p) => 
      p.voucherId && COLUMN_CONFIG.en_seguimiento_rep.statuses.includes(p.status)
    );

    return {
      por_pagar: porPagar,
      pagada: pagada,
      en_seguimiento_rep: enSeguimientoREP,
    };
  }, [payments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando cuentas por pagar...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {(Object.keys(COLUMN_CONFIG) as Array<keyof typeof COLUMN_CONFIG>).map((columnId) => (
            <KanbanColumn
              key={columnId}
              columnId={columnId}
              payments={groupedPayments[columnId]}
              onPaymentClick={setSelectedPayment}
              onUploadVoucher={setUploadVoucherPayment}
            />
          ))}
        </div>

        <DragOverlay>
          {activePayment ? (
            <Card className="cursor-grabbing shadow-xl rotate-3">
              <CardContent className="p-4">
                <p className="font-semibold">{activePayment.supplierName}</p>
                <p className="text-sm text-slate-500">{activePayment.reference || 'Sin referencia'}</p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de Upload de Comprobante */}
      {uploadVoucherPayment && (
        <UploadVoucherToPaymentModal
          isOpen={!!uploadVoucherPayment}
          onClose={() => setUploadVoucherPayment(null)}
          scheduledPayment={uploadVoucherPayment}
          onSuccess={() => {
            setUploadVoucherPayment(null);
            queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
          }}
        />
      )}

      {/* Modal de Detalles y Documentos */}
      {selectedPayment && (
        <PaymentDocumentsView
          isOpen={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          scheduledPaymentId={selectedPayment.id}
        />
      )}
    </>
  );
}

