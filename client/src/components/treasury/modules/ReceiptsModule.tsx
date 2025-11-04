import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
  Clock,
} from "lucide-react";

interface PaymentVoucher {
  id: number;
  status: string;
  clientName: string;
  voucherFileName?: string;
  companyId?: number;
  payerCompanyId?: number;
  clientId?: number;
  extractedAmount?: number | null;
  extractedCurrency?: string | null;
  extractedBank?: string | null;
  extractedReference?: string | null;
  extractedTrackingKey?: string | null;
  ocrConfidence?: number | null;
  createdAt?: string;
}

interface ReceiptsModuleProps {
  vouchers?: PaymentVoucher[];
  isLoading?: boolean;
  onUpload?: () => void;
}

const BOARD_COLUMNS = [
  {
    id: "pendiente_validacion",
    label: "Pendiente validación",
    accent: "bg-gray-100/25 dark:bg-gray-800/25",
    badge: "bg-gray-600/80 text-white",
    icon: Clock,
  },
  {
    id: "validado",
    label: "Validado",
    accent: "bg-pastel-blue/25",
    badge: "bg-pastel-blue/80 text-white",
    icon: ClipboardCheck,
  },
  {
    id: "pendiente_asociacion",
    label: "Pendiente asociación",
    accent: "bg-amber-100/25 dark:bg-amber-900/25",
    badge: "bg-amber-600/80 text-white",
    icon: FileText,
  },
  {
    id: "pendiente_complemento",
    label: "Pendiente complemento",
    accent: "bg-pastel-orange/25",
    badge: "bg-pastel-orange/80 text-white",
    icon: AlertTriangle,
  },
  {
    id: "complemento_recibido",
    label: "Complemento recibido",
    accent: "bg-pastel-teal/25",
    badge: "bg-pastel-teal/80 text-white",
    icon: FileText,
  },
  {
    id: "cerrado",
    label: "Cerrado",
    accent: "bg-green-100/25 dark:bg-green-900/25",
    badge: "bg-green-600/80 text-white",
    icon: CheckCircle,
  },
  {
    id: "cierre_contable",
    label: "Cierre contable",
    accent: "bg-pastel-violet/25",
    badge: "bg-pastel-violet/80 text-white",
    icon: CheckCircle,
  },
] as const;

function ReceiptsSkeleton() {
  return (
    <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_18px_40px_-26px_rgba(0,0,0,0.65)] h-full">
      <CardContent className="p-6 space-y-6">
        <Skeleton className="h-7 w-44 bg-surface-muted/80" />
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg bg-surface-muted/70" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-[340px] rounded-xl bg-surface-muted/70"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({
  column,
  vouchers,
  children,
}: {
  column: (typeof BOARD_COLUMNS)[number];
  vouchers: PaymentVoucher[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      column: column.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-muted/55 p-4 flex flex-col h-full transition-all ${
        isOver ? "border-blue-400 dark:border-pastel-teal/50 bg-blue-50 dark:bg-surface-muted/70 ring-2 ring-blue-300 dark:ring-pastel-teal/30 ring-offset-2" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <column.icon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{column.label}</h4>
        </div>
        <Badge className={column.badge}>{vouchers.length}</Badge>
      </div>
      <div className="flex-1 relative">
        {children}
        {isOver && vouchers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-100 dark:bg-pastel-teal/20 border-2 border-blue-400 dark:border-pastel-teal/50 rounded-lg px-4 py-2 text-sm font-semibold text-blue-700 dark:text-white">
              Suelta aquí
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableVoucherCard({ voucher }: { voucher: PaymentVoucher }) {
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
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? 1.02 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-surface/80 px-4 py-3 shadow-[0_14px_25px_-20px_rgba(0,0,0,0.7)] transition-all hover:border-blue-400 dark:hover:border-pastel-blue/40 hover:bg-gray-50 dark:hover:bg-surface-muted/90 touch-none select-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">
            {voucher.clientName}
          </p>
          {voucher.voucherFileName && (
            <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-1 font-medium">
              {voucher.voucherFileName}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
        {voucher.createdAt
          ? new Date(voucher.createdAt).toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
            })
          : "Sin fecha"}
      </p>
    </motion.div>
  );
}

export function ReceiptsModule({
  vouchers: injectedVouchers,
  isLoading: injectedLoading,
  onUpload,
}: ReceiptsModuleProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<PaymentVoucher[]>({
    queryKey: ["/api/payment-vouchers"],
    staleTime: 20_000,
    refetchInterval: 30_000,
    enabled: !injectedVouchers,
  });

  const vouchers = injectedVouchers ?? data ?? [];
  const loading = injectedLoading ?? isLoading;

  const [activeVoucher, setActiveVoucher] = useState<PaymentVoucher | null>(null);

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

  const stats = useMemo(() => {
    const counts = BOARD_COLUMNS.reduce(
      (acc, column) => ({ ...acc, [column.id]: 0 }),
      {} as Record<(typeof BOARD_COLUMNS)[number]["id"], number>
    );

    vouchers.forEach((voucher) => {
      const status = (voucher.status ?? "pendiente_validacion") as (typeof BOARD_COLUMNS)[number]["id"];
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [vouchers]);

  const grouped = useMemo(() => {
    return BOARD_COLUMNS.map((column) => ({
      ...column,
      vouchers: vouchers.filter(
        (voucher) =>
          (voucher.status ?? "pendiente_validacion") === column.id
      ),
    }));
  }, [vouchers]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: string;
    }) => {
      return await apiRequest(`/api/payment-vouchers/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({
        title: "No fue posible cambiar el estado",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const voucherId = event.active.id;
    const voucher = vouchers.find((v) => v.id === voucherId);
    if (voucher) {
      setActiveVoucher(voucher);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveVoucher(null);

    if (!over) return;
    
    // Aceptar cualquier estado válido de las columnas
    const newStatus = over.id as (typeof BOARD_COLUMNS)[number]["id"];
    
    // Validar que el estado existe en BOARD_COLUMNS
    const isValidStatus = BOARD_COLUMNS.some(col => col.id === newStatus);
    if (!isValidStatus) {
      console.warn(`Estado inválido: ${newStatus}`);
      return;
    }

    const voucher = vouchers.find((v) => v.id === active.id);
    if (!voucher) return;

    // Actualizar solo si el estado cambió
    if ((voucher.status ?? "pendiente_validacion") !== newStatus) {
      updateStatusMutation.mutate({ id: voucher.id, status: newStatus });
    }
  };

  const handleUpload = () => {
    if (onUpload) {
      onUpload();
    } else {
      // Si no hay handler, navegar al módulo completo con el tab de receipts
      navigate('/treasury?tab=receipts');
    }
  };

  if (loading) {
    return <ReceiptsSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_25px_60px_-35px_rgba(8,12,18,0.8)] h-full">
        <CardHeader className="flex md:flex-row flex-col md:items-center md:justify-between gap-4 border-b border-white/5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-300 dark:text-gray-400 font-medium">
              Flujo de comprobantes
            </p>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
              Comprobantes electrónicos
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/treasury?tab=receipts');
              }}
            >
              Ver módulo completo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="sm"
              className="bg-pastel-teal/80 text-white hover:bg-pastel-teal transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Subir comprobante
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {BOARD_COLUMNS.map((column) => (
              <div
                key={column.id}
                className={`rounded-lg border border-gray-200 dark:border-white/10 ${column.accent} bg-white/80 dark:bg-surface-muted/40 px-4 py-3 flex items-center justify-between`}
              >
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-gray-700 dark:text-gray-200 font-semibold">
                    {column.label}
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats[column.id]}
                  </p>
                </div>
                <column.icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </div>
            ))}
          </div>

          {vouchers.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface-muted/50 py-16 text-center space-y-4 relative z-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-pastel-blue/20 flex items-center justify-center">
                <FileText className="h-7 w-7 text-blue-600 dark:text-blue-300" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Sin comprobantes cargados</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto font-medium">
                Sube un comprobante para comenzar a monitorear el flujo y moverlo entre etapas.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-white/20 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors relative z-20 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/treasury?tab=receipts');
                  }}
                >
                  Ver módulo completo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  className="border-blue-500 dark:border-pastel-blue/60 text-blue-700 dark:text-white bg-blue-50 dark:bg-transparent hover:bg-blue-100 dark:hover:bg-pastel-blue/20 relative z-20 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                >
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Subir comprobante
                </Button>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-7 gap-4 overflow-x-auto">
                {grouped.map((column) => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    vouchers={column.vouchers}
                  >
                    <SortableContext
                      items={column.vouchers.map((voucher) => voucher.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3 flex-1 min-h-[280px]">
                        {column.vouchers.length === 0 && (
                          <div className="h-full rounded-lg border border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium transition-all">
                            Vacío
                          </div>
                        )}
                        {column.vouchers.map((voucher) => (
                          <SortableVoucherCard key={voucher.id} voucher={voucher} />
                        ))}
                      </div>
                    </SortableContext>
                  </DroppableColumn>
                ))}
              </div>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

