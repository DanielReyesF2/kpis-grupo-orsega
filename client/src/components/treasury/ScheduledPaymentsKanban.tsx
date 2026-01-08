import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileText, DollarSign, Calendar, Building2, Upload, CheckCircle, Clock,
  AlertCircle, CalendarDays, CalendarRange, FileCheck, Landmark, ChevronRight,
  Eye, X
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, isWithinInterval, isBefore, isAfter } from "date-fns";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScheduledPayment {
  id: number;
  companyId: number;
  supplierId: number | null;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  paymentDate?: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  voucherId: number | null;
  hydralFileUrl: string | null;
  hydralFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

type ColumnId = 'esta_semana' | 'siguiente_semana' | 'atrasados' | 'pendiente_complemento' | 'cierre_contable';

const COLUMN_CONFIG: Record<ColumnId, {
  label: string;
  icon: typeof Clock;
  color: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  description: string;
}> = {
  atrasados: {
    label: "Atrasados",
    icon: AlertCircle,
    color: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
    badgeVariant: "destructive",
    description: "Pagos con fecha vencida",
  },
  esta_semana: {
    label: "Esta Semana",
    icon: CalendarDays,
    color: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
    badgeVariant: "secondary",
    description: "Pagos programados para esta semana",
  },
  siguiente_semana: {
    label: "Siguiente Semana",
    icon: CalendarRange,
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    badgeVariant: "outline",
    description: "Pagos programados para la próxima semana",
  },
  pendiente_complemento: {
    label: "Pendiente REP",
    icon: FileCheck,
    color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
    badgeVariant: "outline",
    description: "Esperando complemento de pago del proveedor",
  },
  cierre_contable: {
    label: "Cierre Contable",
    icon: Landmark,
    color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
    badgeVariant: "default",
    description: "Pagos completados y cerrados",
  },
};

// Estados que indican que el pago está pendiente (no pagado aún)
const PENDING_STATUSES = ['idrall_imported', 'pending_approval', 'approved', 'payment_scheduled', 'payment_pending'];
// Estados que indican que se subió comprobante pero falta REP
const PENDING_REP_STATUSES = ['voucher_uploaded', 'pendiente_complemento'];
// Estados que indican cierre contable
const CLOSED_STATUSES = ['payment_completed', 'closed', 'cierre_contable', 'complemento_recibido'];

interface PaymentCardProps {
  payment: ScheduledPayment;
  columnId: ColumnId;
  onViewDocuments: () => void;
  onUploadVoucher: () => void;
  compact?: boolean;
}

function SortablePaymentCard({ payment, columnId, onViewDocuments, onUploadVoucher, compact = false }: PaymentCardProps) {
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
  const isPending = ['esta_semana', 'siguiente_semana', 'atrasados'].includes(columnId);

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="touch-none"
      >
        <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 select-none">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{payment.supplierName || 'Proveedor'}</p>
                <p className="text-xs text-muted-foreground">{payment.reference || 'Sin ref.'}</p>
              </div>
              <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                ${payment.amount.toLocaleString()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <Card
        className="cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 select-none border-l-4 border-l-transparent hover:border-l-primary/50"
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-gray-900 dark:text-white truncate">
                {payment.supplierName || 'Proveedor desconocido'}
              </p>
              {payment.reference && (
                <p className="text-sm text-muted-foreground truncate">
                  Ref: {payment.reference}
                </p>
              )}
            </div>
            <Badge variant={isOverdue ? "destructive" : "outline"} className="flex-shrink-0 font-semibold">
              {payment.currency} ${payment.amount.toLocaleString()}
            </Badge>
          </div>

          <div className="space-y-1 text-xs">
            {payment.paymentDate && (
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                <Calendar className="h-3 w-3" />
                Pago: {format(new Date(payment.paymentDate), "dd MMM", { locale: es })}
              </div>
            )}
            <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
              <Clock className="h-3 w-3" />
              Vence: {format(new Date(payment.dueDate), "dd MMM", { locale: es })}
              {isOverdue && <span className="font-bold">(Vencida)</span>}
            </div>
          </div>

          {isPending && (
            <div className="pt-2 border-t space-y-1.5">
              <Button
                size="sm"
                variant="default"
                className="w-full h-8 text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadVoucher();
                }}
              >
                <Upload className="h-3 w-3 mr-1.5" />
                Subir Comprobante
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDocuments();
                }}
              >
                <Eye className="h-3 w-3 mr-1.5" />
                Ver detalles
              </Button>
            </div>
          )}

          {!isPending && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs mt-2"
              onClick={(e) => {
                e.stopPropagation();
                onViewDocuments();
              }}
            >
              <Eye className="h-3 w-3 mr-1.5" />
              Ver detalles
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface KanbanColumnProps {
  columnId: ColumnId;
  payments: ScheduledPayment[];
  onPaymentClick: (payment: ScheduledPayment) => void;
  onUploadVoucher: (payment: ScheduledPayment) => void;
  onColumnClick: () => void;
  totalAmount: number;
}

function KanbanColumn({ columnId, payments, onPaymentClick, onUploadVoucher, onColumnClick, totalAmount }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnId];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  // Mostrar solo las primeras 3 tarjetas para mantener la vista compacta
  const visiblePayments = payments.slice(0, 3);
  const remainingCount = payments.length - 3;

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div
        ref={setNodeRef}
        className={`rounded-xl border-2 ${config.color} p-4 h-full min-h-[450px] flex flex-col transition-all shadow-sm ${
          isOver ? "ring-2 ring-primary ring-offset-2 scale-[1.02]" : ""
        }`}
      >
        {/* Header clickeable */}
        <button
          onClick={onColumnClick}
          className="w-full text-left mb-4 pb-3 border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-white/30 dark:hover:bg-black/10 rounded-lg p-2 -m-2 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              <h3 className="font-bold text-base text-gray-900 dark:text-white">{config.label}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config.badgeVariant} className="font-semibold">
                {payments.length}
              </Badge>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
          {totalAmount > 0 && (
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-2">
              Total: ${totalAmount.toLocaleString()}
            </p>
          )}
        </button>

        <SortableContext
          items={payments.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 flex-1">
            {payments.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[200px] border-2 border-dashed border-slate-300/50 dark:border-slate-600/50 rounded-lg">
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center px-4">
                  {isOver ? "Suelta aquí" : "Sin pagos"}
                </p>
              </div>
            ) : (
              <>
                {visiblePayments.map((payment) => (
                  <SortablePaymentCard
                    key={payment.id}
                    payment={payment}
                    columnId={columnId}
                    onViewDocuments={() => onPaymentClick(payment)}
                    onUploadVoucher={() => onUploadVoucher(payment)}
                  />
                ))}
                {remainingCount > 0 && (
                  <button
                    onClick={onColumnClick}
                    className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
                  >
                    Ver {remainingCount} más...
                  </button>
                )}
              </>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// Modal para ver todos los pagos de una columna
interface ColumnDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnId: ColumnId | null;
  payments: ScheduledPayment[];
  onPaymentClick: (payment: ScheduledPayment) => void;
  onUploadVoucher: (payment: ScheduledPayment) => void;
}

function ColumnDetailModal({ isOpen, onClose, columnId, payments, onPaymentClick, onUploadVoucher }: ColumnDetailModalProps) {
  if (!columnId) return null;

  const config = COLUMN_CONFIG[columnId];
  const Icon = config.icon;
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const isPendingColumn = ['esta_semana', 'siguiente_semana', 'atrasados'].includes(columnId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">{config.label}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-4">
            <Badge variant={config.badgeVariant} className="text-base px-3 py-1">
              {payments.length} pagos
            </Badge>
            <span className="text-lg font-bold">
              Total: ${totalAmount.toLocaleString()} MXN
            </span>
          </div>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {payments.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No hay pagos en esta categoría</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const isOverdue = new Date(payment.dueDate) < new Date();
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.supplierName || 'Proveedor desconocido'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.reference || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {payment.currency} ${payment.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {payment.paymentDate ? (
                          <span className="text-blue-600 font-medium">
                            {format(new Date(payment.paymentDate), "dd MMM yyyy", { locale: es })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {format(new Date(payment.dueDate), "dd MMM yyyy", { locale: es })}
                          {isOverdue && ' (Vencida)'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPendingColumn && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              onClick={() => {
                                onClose();
                                onUploadVoucher(payment);
                              }}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Pagar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              onClose();
                              onPaymentClick(payment);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
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
  const [selectedColumn, setSelectedColumn] = useState<ColumnId | null>(null);

  // Obtener scheduled payments - queryKey sin companyId para invalidación consistente
  const { data: payments = [], isLoading } = useQuery<ScheduledPayment[]>({
    queryKey: ["/api/treasury/payments"],
    queryFn: async () => {
      const params = companyId ? `?companyId=${companyId}` : '';
      const response = await fetch(`/api/treasury/payments${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();

      // Normalizar datos: convertir snake_case a camelCase si es necesario
      const normalizedData = data.map((payment: any) => ({
        ...payment,
        companyId: payment.company_id || payment.companyId,
        supplierId: payment.supplier_id || payment.supplierId,
        supplierName: payment.supplier_name || payment.supplierName,
        dueDate: payment.due_date || payment.dueDate,
        paymentDate: payment.payment_date || payment.paymentDate,
        voucherId: payment.voucher_id || payment.voucherId,
        hydralFileUrl: payment.hydral_file_url || payment.hydralFileUrl,
        hydralFileName: payment.hydral_file_name || payment.hydralFileName,
        createdAt: payment.created_at || payment.createdAt,
        updatedAt: payment.updated_at || payment.updatedAt,
      }));

      return normalizedData;
    },
    staleTime: 0,
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
      return await apiRequest("PUT", `/api/scheduled-payments/${id}/status`, { status });
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

    const columnId = over.id as ColumnId;
    if (!COLUMN_CONFIG[columnId]) return;

    // Determinar el nuevo estado basado en la columna
    let newStatus: string;
    switch (columnId) {
      case 'pendiente_complemento':
        newStatus = 'voucher_uploaded';
        break;
      case 'cierre_contable':
        newStatus = 'payment_completed';
        break;
      default:
        // Para columnas de fecha, mantener estado pending
        newStatus = 'payment_pending';
    }

    if (activePayment.status !== newStatus) {
      updateStatusMutation.mutate({
        id: activePayment.id,
        status: newStatus,
      });
    }
  };

  // Agrupar pagos por columna basado en fechas y estados
  const groupedPayments = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Lunes
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Domingo
    const nextWeekStart = addWeeks(thisWeekStart, 1);
    const nextWeekEnd = addWeeks(thisWeekEnd, 1);

    const result: Record<ColumnId, ScheduledPayment[]> = {
      atrasados: [],
      esta_semana: [],
      siguiente_semana: [],
      pendiente_complemento: [],
      cierre_contable: [],
    };

    payments.forEach((payment) => {
      // Primero verificar si está en estados finales
      if (CLOSED_STATUSES.includes(payment.status)) {
        result.cierre_contable.push(payment);
        return;
      }

      if (PENDING_REP_STATUSES.includes(payment.status)) {
        result.pendiente_complemento.push(payment);
        return;
      }

      // Para pagos pendientes, clasificar por fecha
      if (PENDING_STATUSES.includes(payment.status)) {
        const paymentDateToUse = payment.paymentDate ? new Date(payment.paymentDate) : new Date(payment.dueDate);

        // Atrasados: fecha de pago anterior a hoy
        if (isBefore(paymentDateToUse, thisWeekStart)) {
          result.atrasados.push(payment);
        }
        // Esta semana
        else if (isWithinInterval(paymentDateToUse, { start: thisWeekStart, end: thisWeekEnd })) {
          result.esta_semana.push(payment);
        }
        // Siguiente semana
        else if (isWithinInterval(paymentDateToUse, { start: nextWeekStart, end: nextWeekEnd })) {
          result.siguiente_semana.push(payment);
        }
        // Futuro (más de 2 semanas) - los ponemos en siguiente semana por ahora
        else {
          result.siguiente_semana.push(payment);
        }
      }
    });

    // Ordenar cada grupo por fecha de pago/vencimiento
    Object.keys(result).forEach((key) => {
      result[key as ColumnId].sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.dueDate);
        const dateB = new Date(b.paymentDate || b.dueDate);
        return dateA.getTime() - dateB.getTime();
      });
    });

    return result;
  }, [payments]);

  // Calcular totales por columna
  const columnTotals = useMemo(() => {
    const totals: Record<ColumnId, number> = {
      atrasados: 0,
      esta_semana: 0,
      siguiente_semana: 0,
      pendiente_complemento: 0,
      cierre_contable: 0,
    };

    (Object.keys(groupedPayments) as ColumnId[]).forEach((columnId) => {
      totals[columnId] = groupedPayments[columnId].reduce((sum, p) => sum + p.amount, 0);
    });

    return totals;
  }, [groupedPayments]);

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

  const columnOrder: ColumnId[] = ['atrasados', 'esta_semana', 'siguiente_semana', 'pendiente_complemento', 'cierre_contable'];

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {columnOrder.map((columnId) => (
            <KanbanColumn
              key={columnId}
              columnId={columnId}
              payments={groupedPayments[columnId]}
              onPaymentClick={setSelectedPayment}
              onUploadVoucher={setUploadVoucherPayment}
              onColumnClick={() => setSelectedColumn(columnId)}
              totalAmount={columnTotals[columnId]}
            />
          ))}
        </div>

        <DragOverlay>
          {activePayment ? (
            <Card className="cursor-grabbing shadow-xl rotate-3 w-[260px]">
              <CardContent className="p-3">
                <p className="font-semibold text-sm">{activePayment.supplierName}</p>
                <p className="text-xs text-slate-500">{activePayment.reference || 'Sin referencia'}</p>
                <p className="text-sm font-bold mt-1">${activePayment.amount.toLocaleString()}</p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de detalle de columna */}
      <ColumnDetailModal
        isOpen={!!selectedColumn}
        onClose={() => setSelectedColumn(null)}
        columnId={selectedColumn}
        payments={selectedColumn ? groupedPayments[selectedColumn] : []}
        onPaymentClick={setSelectedPayment}
        onUploadVoucher={setUploadVoucherPayment}
      />

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
      <PaymentDocumentsView
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        scheduledPaymentId={selectedPayment?.id || 0}
      />
    </>
  );
}
// Build trigger: 20260105-172608
