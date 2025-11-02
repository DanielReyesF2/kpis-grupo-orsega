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
import {
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";

interface PaymentVoucher {
  id: number;
  status: string;
  clientName: string;
  voucherFileName?: string;
  companyId?: number;
  clientId?: number;
  createdAt?: string;
}

interface ReceiptsModuleProps {
  vouchers?: PaymentVoucher[];
  isLoading?: boolean;
  onUpload?: () => void;
}

const BOARD_COLUMNS = [
  {
    id: "pendiente",
    label: "Validado",
    accent: "bg-pastel-blue/25",
    badge: "bg-pastel-blue/80 text-white",
    icon: ClipboardCheck,
  },
  {
    id: "pendiente_rep",
    label: "Pendiente complemento",
    accent: "bg-pastel-orange/25",
    badge: "bg-pastel-orange/80 text-white",
    icon: AlertTriangle,
  },
  {
    id: "enviado",
    label: "Complemento recibido",
    accent: "bg-pastel-teal/25",
    badge: "bg-pastel-teal/80 text-white",
    icon: FileText,
  },
  {
    id: "completado",
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
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-16 rounded-lg bg-surface-muted/70" />
          <Skeleton className="h-16 rounded-lg bg-surface-muted/70" />
          <Skeleton className="h-16 rounded-lg bg-surface-muted/70" />
          <Skeleton className="h-16 rounded-lg bg-surface-muted/70" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
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
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-white/10 bg-surface-muted/55 p-4 flex flex-col h-full transition-colors ${
        isOver ? "border-pastel-teal/50 bg-surface-muted/70" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <column.icon className="h-4 w-4 text-white/80" />
          <h4 className="text-sm font-semibold text-white">{column.label}</h4>
        </div>
        <Badge className={column.badge}>{vouchers.length}</Badge>
      </div>
      {children}
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
  } = useSortable({ id: voucher.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? 1.02 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      className="rounded-lg border border-white/10 bg-surface/80 px-4 py-3 text-white shadow-[0_14px_25px_-20px_rgba(0,0,0,0.7)] transition-all hover:border-pastel-blue/40 hover:bg-surface-muted/90"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-white">
            {voucher.clientName}
          </p>
          {voucher.voucherFileName && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {voucher.voucherFileName}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
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
    useSensor(PointerSensor),
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
      const status = (voucher.status ?? "pendiente") as (typeof BOARD_COLUMNS)[number]["id"];
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
          (voucher.status ?? "pendiente") === column.id
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
    const newStatus = over.id as (typeof BOARD_COLUMNS)[number]["id"];

    const voucher = vouchers.find((v) => v.id === active.id);
    if (!voucher) return;

    if ((voucher.status ?? "pendiente") !== newStatus) {
      updateStatusMutation.mutate({ id: voucher.id, status: newStatus });
    }
  };

  const handleUpload = () => {
    if (onUpload) {
      onUpload();
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
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Flujo de comprobantes
            </p>
            <h3 className="text-2xl font-semibold text-white mt-1">
              Comprobantes electrónicos
            </h3>
          </div>
          <Button
            size="sm"
            className="bg-pastel-teal/80 text-white hover:bg-pastel-teal transition-colors"
            onClick={handleUpload}
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Subir comprobante
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {BOARD_COLUMNS.map((column) => (
              <div
                key={column.id}
                className={`rounded-lg border border-white/10 ${column.accent} px-4 py-3 flex items-center justify-between text-white`}
              >
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-white/70">
                    {column.label}
                  </p>
                  <p className="text-xl font-semibold text-white">
                    {stats[column.id]}
                  </p>
                </div>
                <column.icon className="h-5 w-5 text-white/80" />
              </div>
            ))}
          </div>

          {vouchers.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-surface-muted/50 py-16 text-center space-y-4 text-white">
              <div className="mx-auto w-16 h-16 rounded-full bg-pastel-blue/20 flex items-center justify-center">
                <FileText className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-semibold">Sin comprobantes cargados</h4>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Sube un comprobante para comenzar a monitorear el flujo y moverlo entre etapas.
              </p>
              <Button
                variant="outline"
                className="border-pastel-blue/60 text-white hover:bg-pastel-blue/20"
                onClick={handleUpload}
              >
                <UploadCloud className="h-4 w-4 mr-2" />
                Subir comprobante
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                          <div className="h-full rounded-lg border border-dashed border-white/10 flex items-center justify-center text-xs text-muted-foreground">
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

