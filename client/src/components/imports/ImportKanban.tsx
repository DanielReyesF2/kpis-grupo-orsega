import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  FileText,
  Ship,
  ShieldCheck,
  Package,
  Truck,
  Warehouse,
} from "lucide-react";
import { ImportKanbanCard } from "./ImportKanbanCard";

interface ImportOrder {
  id: number;
  reference: string;
  company_id: number;
  status: string;
  supplier_name: string;
  supplier_country: string | null;
  destination: string | null;
  destination_detail: string | null;
  estimated_ship_date: string | null;
  estimated_arrival_date: string | null;
  estimated_warehouse_date: string | null;
  actual_warehouse_date: string | null;
  vessel_name: string | null;
  container_number: string | null;
  pedimento_number: string | null;
  items: any[] | null;
  total_required: number;
  completed_required: number;
}

interface ImportKanbanProps {
  orders: ImportOrder[];
  onOrderClick: (order: ImportOrder) => void;
}

const COLUMNS = [
  { status: "oc_created", label: "OC Creada", color: "slate-700", Icon: FileText },
  { status: "in_transit_to_customs", label: "Camino a Aduana", color: "blue-600", Icon: Ship },
  { status: "in_customs", label: "En Aduana", color: "orange-600", Icon: ShieldCheck },
  { status: "in_yard", label: "En Patio", color: "amber-600", Icon: Package },
  { status: "in_transit_to_warehouse", label: "Camino a Bodega", color: "purple-600", Icon: Truck },
  { status: "in_warehouse", label: "En Bodega", color: "emerald-600", Icon: Warehouse },
] as const;

const STATUS_ORDER = COLUMNS.map((c) => c.status);

const COLUMN_COLORS: Record<string, string> = {
  "slate-700": "border-t-slate-700 bg-slate-50/50",
  "blue-600": "border-t-blue-600 bg-blue-50/30",
  "orange-600": "border-t-orange-600 bg-orange-50/30",
  "amber-600": "border-t-amber-600 bg-amber-50/30",
  "purple-600": "border-t-purple-600 bg-purple-50/30",
  "emerald-600": "border-t-emerald-600 bg-emerald-50/30",
};

const HEADER_COLORS: Record<string, string> = {
  "slate-700": "text-slate-700",
  "blue-600": "text-blue-600",
  "orange-600": "text-orange-600",
  "amber-600": "text-amber-600",
  "purple-600": "text-purple-600",
  "emerald-600": "text-emerald-600",
};

export function ImportKanban({ orders, onOrderClick }: ImportKanbanProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const ordersByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = orders.filter((o) => o.status === col.status);
      return acc;
    },
    {} as Record<string, ImportOrder[]>
  );

  const handleDragStart = (e: React.DragEvent, order: ImportOrder) => {
    e.dataTransfer.setData("text/plain", String(order.id));
    setDraggingId(order.id);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingId(null);

    const orderId = parseInt(e.dataTransfer.getData("text/plain"));
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === targetStatus) return;

    // Validate it's the next step
    const currentIdx = STATUS_ORDER.indexOf(order.status as typeof STATUS_ORDER[number]);
    const targetIdx = STATUS_ORDER.indexOf(targetStatus as typeof STATUS_ORDER[number]);
    if (targetIdx !== currentIdx + 1) {
      toast({
        title: "Movimiento no permitido",
        description: "Solo puedes avanzar a la siguiente etapa.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await apiRequest("PATCH", `/api/import-orders/${orderId}/status`, {
        status: targetStatus,
      });
      const data = await res.json();

      toast({
        title: `Avanzó a ${COLUMNS.find((c) => c.status === targetStatus)?.label}`,
        description: order.reference,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/import-orders"] });
    } catch (error: any) {
      // Parse error message from backend
      let message = "Error moviendo importación";
      try {
        const errBody = JSON.parse(error.message.split(": ").slice(1).join(": "));
        message = errBody.message || message;
      } catch {
        if (error.message.includes("Faltan")) {
          message = error.message.split(": ").slice(1).join(": ");
        }
      }
      toast({ title: "No se puede mover", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-6 gap-3 min-h-[400px]">
      {COLUMNS.map(({ status, label, color, Icon }) => {
        const colOrders = ordersByStatus[status] || [];
        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              "rounded-lg border-t-4 p-2 transition-all min-h-[300px]",
              COLUMN_COLORS[color],
              dragOverCol === status && "ring-2 ring-purple-400 bg-purple-50/50"
            )}
          >
            {/* Column header */}
            <div className="flex items-center gap-1.5 mb-3 px-1">
              <Icon className={cn("h-4 w-4", HEADER_COLORS[color])} />
              <span className={cn("text-xs font-semibold", HEADER_COLORS[color])}>{label}</span>
              <span className="text-[10px] text-slate-400 ml-auto">({colOrders.length})</span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {colOrders.map((order) => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order)}
                  className={cn(draggingId === order.id && "opacity-50")}
                >
                  <ImportKanbanCard order={order} onClick={() => onOrderClick(order)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
