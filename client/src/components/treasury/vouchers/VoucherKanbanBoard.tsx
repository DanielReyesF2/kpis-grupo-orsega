import { useState, useMemo, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  Plus,
  LayoutGrid,
  List,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VoucherCard, type PaymentVoucher } from "./VoucherCard";
import { VoucherFilters } from "./VoucherFilters";
import { useVoucherFilters } from "@/hooks/useVoucherFilters";
import { PayVoucherModal } from "./PayVoucherModal";

// Lazy load del panel de detalles para mejor performance
const VoucherDetailPanel = lazy(() =>
  import("./VoucherDetailPanel").then((mod) => ({ default: mod.VoucherDetailPanel }))
);

const STATUS_CONFIG = {
  pago_programado: {
    label: "Pago Programado",
    icon: ClipboardCheck,
    color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    headerColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  pendiente_complemento: {
    label: "Pendiente Complemento",
    icon: AlertTriangle,
    color: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
    headerColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  complemento_recibido: {
    label: "Complemento Recibido",
    icon: FileCheck,
    color: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800",
    headerColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  cierre_contable: {
    label: "Cierre Contable",
    icon: CheckCircle,
    color: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
    headerColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
};

interface KanbanColumnProps {
  status: keyof typeof STATUS_CONFIG;
  vouchers: PaymentVoucher[];
  onVoucherClick: (voucher: PaymentVoucher) => void;
  onPayVoucher: (voucher: PaymentVoucher) => void;
}

function KanbanColumn({ status, vouchers, onVoucherClick, onPayVoucher }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 min-w-[280px] sm:min-w-[300px] max-w-[350px]"
    >
      <Card
        ref={setNodeRef}
        className={`h-full flex flex-col transition-all duration-200 ${
          config.color
        } ${isOver ? "ring-2 ring-primary ring-offset-2 scale-[1.02]" : ""}`}
      >
        <CardHeader className={`${config.headerColor} border-b`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <CardTitle className="text-base font-semibold">
                {config.label}
              </CardTitle>
            </div>
            <Badge variant="secondary" className="font-semibold">
              {vouchers.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4">
          <SortableContext
            items={vouchers.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 min-h-[400px]">
              {vouchers.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                  <p className="text-sm text-slate-500 text-center">
                    {isOver ? "Suelta aquí" : "No hay comprobantes"}
                  </p>
                </div>
              ) : (
                vouchers.map((voucher) => (
                  <VoucherCard
                    key={voucher.id}
                    voucher={voucher}
                    onClick={() => onVoucherClick(voucher)}
                    onPay={() => onPayVoucher(voucher)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface VoucherKanbanBoardProps {
  vouchers: PaymentVoucher[];
}

export function VoucherKanbanBoard({ vouchers }: VoucherKanbanBoardProps) {
  const { toast } = useToast();
  const [activeVoucher, setActiveVoucher] = useState<PaymentVoucher | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null);
  const [payingVoucher, setPayingVoucher] = useState<PaymentVoucher | null>(null);
  const { filters } = useVoucherFilters();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

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

  // Filtrar vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      // Búsqueda de texto
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          voucher.clientName.toLowerCase().includes(searchLower) ||
          voucher.voucherFileName.toLowerCase().includes(searchLower) ||
          voucher.extractedReference?.toLowerCase().includes(searchLower) ||
          voucher.extractedBank?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtro por estado
      if (filters.status && voucher.status !== filters.status) return false;

      // Filtro por moneda
      if (filters.currency && voucher.extractedCurrency !== filters.currency)
        return false;

      // Filtro por rango de fechas
      if (filters.dateFrom && voucher.extractedDate) {
        const voucherDate = new Date(voucher.extractedDate);
        if (voucherDate < filters.dateFrom) return false;
      }
      if (filters.dateTo && voucher.extractedDate) {
        const voucherDate = new Date(voucher.extractedDate);
        if (voucherDate > filters.dateTo) return false;
      }

      // Filtro por rango de montos
      if (filters.amountMin && voucher.extractedAmount) {
        if (voucher.extractedAmount < filters.amountMin) return false;
      }
      if (filters.amountMax && voucher.extractedAmount) {
        if (voucher.extractedAmount > filters.amountMax) return false;
      }

      return true;
    });
  }, [vouchers, filters]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PUT", `/api/payment-vouchers/${id}/status`, {
        status,
      });
      return await response.json();
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
    const voucher = filteredVouchers.find((v) => v.id === event.active.id);
    setActiveVoucher(voucher || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveVoucher(null);

    if (!over) return;

    const activeVoucher = filteredVouchers.find((v) => v.id === active.id);
    if (!activeVoucher) return;

    const newStatus = over.id as keyof typeof STATUS_CONFIG;

    if (!STATUS_CONFIG[newStatus]) {
      console.warn(`Estado inválido: ${newStatus}`);
      return;
    }

    if (activeVoucher.status !== newStatus) {
      updateStatusMutation.mutate({
        id: activeVoucher.id,
        status: newStatus,
      });
    }
  };

  const groupedVouchers = useMemo(() => {
    const grouped = {
      pago_programado: [] as PaymentVoucher[],
      pendiente_complemento: [] as PaymentVoucher[],
      complemento_recibido: [] as PaymentVoucher[],
      cierre_contable: [] as PaymentVoucher[],
    };

    filteredVouchers.forEach((voucher) => {
      // Mapear factura_pagada (legacy) a pago_programado
      const status = voucher.status === 'factura_pagada' ? 'pago_programado' : voucher.status;
      if (grouped[status as keyof typeof grouped]) {
        grouped[status as keyof typeof grouped].push(voucher);
      }
    });

    return grouped;
  }, [filteredVouchers]);

  const handleSave = async (updatedVoucher: Partial<PaymentVoucher>) => {
    if (!selectedVoucher) return;

    try {
      const response = await apiRequest(
        "PUT",
        `/api/payment-vouchers/${selectedVoucher.id}`,
        updatedVoucher
      );
      await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({ title: "Comprobante actualizado correctamente" });
    } catch (error) {
      toast({
        title: "Error al actualizar",
        description: "No se pudo actualizar el comprobante",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con filtros y controles */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[300px]">
          <VoucherFilters />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
        </div>
      </div>

      {/* Tablero Kanban */}
      {viewMode === "kanban" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {/* Responsive: en móvil, mostrar una columna a la vez con scroll horizontal */}
            {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(
              (status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  vouchers={groupedVouchers[status]}
                  onVoucherClick={setSelectedVoucher}
                  onPayVoucher={setPayingVoucher}
                />
              )
            )}
          </div>

          <DragOverlay>
            {activeVoucher ? (
              <div className="opacity-90 rotate-2">
                <VoucherCard voucher={activeVoucher} onClick={() => {}} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Vista de lista (responsive) */}
      {viewMode === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVouchers.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              onClick={() => setSelectedVoucher(voucher)}
              onPay={() => setPayingVoucher(voucher)}
            />
          ))}
        </div>
      )}

      {/* Panel de detalles */}
      <Suspense fallback={null}>
        <VoucherDetailPanel
          voucher={selectedVoucher}
          isOpen={!!selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
          onSave={handleSave}
        />
      </Suspense>

      {/* Modal para pagar voucher */}
      {payingVoucher && (
        <PayVoucherModal
          isOpen={!!payingVoucher}
          onClose={() => setPayingVoucher(null)}
          voucher={payingVoucher}
          onSuccess={() => {
            setPayingVoucher(null);
            queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
          }}
        />
      )}
    </div>
  );
}

