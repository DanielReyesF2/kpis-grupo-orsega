import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Clock, Mail, AlertTriangle, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PaymentVoucher {
  id: number;
  clientName: string;
  status: string;
  extractedAmount: number | null;
  extractedCurrency: string | null;
  extractedDate: string | null;
  voucherFileUrl: string;
  voucherFileName: string;
  createdAt: string;
  payerCompanyId: number;
}

interface ManageVouchersFlowProps {
  onBack: () => void;
}

// Estados simplificados para Lolita
type SimplifiedStatus = "recibido" | "enviado" | "pendiente_complemento" | "completado";

const SIMPLIFIED_COLUMNS: {
  id: SimplifiedStatus;
  label: string;
  icon: any;
  color: string;
}[] = [
  {
    id: "recibido",
    label: "Recibido",
    icon: Clock,
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  },
  {
    id: "enviado",
    label: "Enviado",
    icon: Mail,
    color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  },
  {
    id: "pendiente_complemento",
    label: "Pendiente Complemento",
    icon: AlertTriangle,
    color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  },
  {
    id: "completado",
    label: "Completado",
    icon: CheckCircle,
    color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
  },
];

// Mapear estados complejos a estados simplificados
const mapToSimplifiedStatus = (status: string): SimplifiedStatus => {
  if (
    status === "pendiente_validacion" ||
    status === "validado" ||
    status === "pendiente_asociacion"
  ) {
    return "recibido";
  }
  // Asumimos que si tiene extractedAmount y está validado, ya se envió
  if (status === "validado" || status === "pendiente_complemento") {
    return "enviado";
  }
  if (status === "pendiente_complemento") {
    return "pendiente_complemento";
  }
  if (
    status === "complemento_recibido" ||
    status === "cerrado" ||
    status === "cierre_contable"
  ) {
    return "completado";
  }
  return "recibido";
};

// Mapear estados simplificados a estados reales para actualizar
const mapToRealStatus = (simplified: SimplifiedStatus): string => {
  switch (simplified) {
    case "recibido":
      return "pendiente_validacion";
    case "enviado":
      return "validado";
    case "pendiente_complemento":
      return "pendiente_complemento";
    case "completado":
      return "cierre_contable";
  }
};

function SortableVoucherCard({ voucher, onView }: { voucher: PaymentVoucher; onView: () => void }) {
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
    <div ref={setNodeRef} style={style}>
      <Card
        className="cursor-grab active:cursor-grabbing hover:shadow-lg transition-all border-2"
        onClick={onView}
        {...attributes}
        {...listeners}
      >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-base font-bold text-foreground mb-1">
              {voucher.clientName}
            </p>
            {voucher.extractedAmount && (
              <p className="text-lg font-bold text-primary">
                {voucher.extractedCurrency || "MXN"} ${voucher.extractedAmount.toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>
        </div>
        {voucher.extractedDate && (
          <p className="text-sm text-muted-foreground">
            {format(new Date(voucher.extractedDate), "dd 'de' MMM, yyyy", { locale: es })}
          </p>
        )}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground truncate">
            {voucher.voucherFileName}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(voucher.voucherFileUrl, "_blank");
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

function DroppableColumn({
  id,
  children,
  column,
  count,
}: {
  id: SimplifiedStatus;
  children: React.ReactNode;
  column: typeof SIMPLIFIED_COLUMNS[0];
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const ColumnIcon = column.icon;

  return (
    <div ref={setNodeRef} className={`transition-all ${isOver ? "scale-105" : ""}`}>
      <Card className={`border-2 ${column.color} ${isOver ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ColumnIcon className="h-6 w-6" />
              <CardTitle className="text-lg font-bold">{column.label}</CardTitle>
            </div>
            <Badge variant="outline" className="text-base px-2 py-1">
              {count}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export function ManageVouchersFlow({ onBack }: ManageVouchersFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeVoucher, setActiveVoucher] = useState<PaymentVoucher | null>(null);
  const [draggedVoucher, setDraggedVoucher] = useState<PaymentVoucher | null>(null);

  const { data: vouchers = [], isLoading } = useQuery<PaymentVoucher[]>({
    queryKey: ["/api/payment-vouchers"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Agrupar vouchers por estado simplificado
  const groupedVouchers = SIMPLIFIED_COLUMNS.reduce(
    (acc, column) => {
      acc[column.id] = vouchers.filter((v: PaymentVoucher) => mapToSimplifiedStatus(v.status) === column.id);
      return acc;
    },
    {} as Record<SimplifiedStatus, PaymentVoucher[]>
  );

  // Mutación para actualizar estado
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PUT", `/api/payment-vouchers/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({
        title: "✅ Estado actualizado",
        description: "El comprobante ha sido movido correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: () => ({ x: 0, y: 0 }),
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const voucherId = Number(event.active.id);
    const voucher = vouchers.find((v: PaymentVoucher) => v.id === voucherId);
    setDraggedVoucher(voucher || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedVoucher(null);

    const { active, over } = event;

    if (!over) return;

    const voucherId = Number(active.id);
    const targetStatus = over.id as SimplifiedStatus;

    const voucher = vouchers.find((v: PaymentVoucher) => v.id === voucherId);
    if (!voucher) return;

    const currentSimplified = mapToSimplifiedStatus(voucher.status);
    if (currentSimplified === targetStatus) return;

    const realStatus = mapToRealStatus(targetStatus);
    updateStatusMutation.mutate({ id: voucherId, status: realStatus });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <Button onClick={onBack} variant="ghost" size="lg">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver al inicio
        </Button>
        <h1 className="text-3xl font-bold text-foreground">
          Comprobantes
        </h1>
        <div className="w-24" /> {/* Spacer para centrar */}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Cargando comprobantes...</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SIMPLIFIED_COLUMNS.map((column) => {
              const columnVouchers = groupedVouchers[column.id];

              return (
                <DroppableColumn
                  key={column.id}
                  id={column.id}
                  column={column}
                  count={columnVouchers.length}
                >
                  {columnVouchers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Arrastra comprobantes aquí</p>
                    </div>
                  ) : (
                    <SortableContext
                      items={columnVouchers.map((v) => v.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {columnVouchers.map((voucher) => (
                        <SortableVoucherCard
                          key={voucher.id}
                          voucher={voucher}
                          onView={() => setActiveVoucher(voucher)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {draggedVoucher ? (
              <div className="opacity-75 rotate-3">
                <Card className="border-2 shadow-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-base font-bold text-foreground mb-1">
                          {draggedVoucher.clientName}
                        </p>
                        {draggedVoucher.extractedAmount && (
                          <p className="text-lg font-bold text-primary">
                            {draggedVoucher.extractedCurrency || "MXN"} ${draggedVoucher.extractedAmount.toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de detalles (simplificado) */}
      {activeVoucher && (
        <Card className="fixed inset-0 z-50 m-auto max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Detalles del Comprobante</CardTitle>
              <Button variant="ghost" onClick={() => setActiveVoucher(null)}>
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Proveedor/Cliente</p>
              <p className="text-lg font-bold">{activeVoucher.clientName}</p>
            </div>
            {activeVoucher.extractedAmount && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monto</p>
                <p className="text-xl font-bold text-primary">
                  {activeVoucher.extractedCurrency || "MXN"} ${activeVoucher.extractedAmount.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            )}
            {activeVoucher.extractedDate && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Fecha</p>
                <p className="text-base">
                  {format(new Date(activeVoucher.extractedDate), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Archivo</p>
              <Button
                variant="outline"
                onClick={() => window.open(activeVoucher.voucherFileUrl, "_blank")}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Ver/Descargar Comprobante
              </Button>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveVoucher(null)}
                className="flex-1"
              >
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  const currentStatus = mapToSimplifiedStatus(activeVoucher.status);
                  const nextStatus = currentStatus === "recibido" ? "enviado" :
                                   currentStatus === "enviado" ? "pendiente_complemento" :
                                   currentStatus === "pendiente_complemento" ? "completado" :
                                   "completado";
                  const realStatus = mapToRealStatus(nextStatus);
                  updateStatusMutation.mutate({ id: activeVoucher.id, status: realStatus });
                  setActiveVoucher(null);
                }}
                className="flex-1"
                disabled={mapToSimplifiedStatus(activeVoucher.status) === "completado"}
              >
                Marcar como {mapToSimplifiedStatus(activeVoucher.status) === "recibido" ? "Enviado" :
                            mapToSimplifiedStatus(activeVoucher.status) === "enviado" ? "Pendiente Complemento" :
                            mapToSimplifiedStatus(activeVoucher.status) === "pendiente_complemento" ? "Completado" :
                            "Completado"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
