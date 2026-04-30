import { Badge } from "@/components/ui/badge";
import { GripVertical, Factory, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// Country flag emoji from ISO code
function getCountryFlag(country: string | null): string {
  if (!country) return "";
  const lower = country.toLowerCase();
  const flagMap: Record<string, string> = {
    china: "\u{1F1E8}\u{1F1F3}", usa: "\u{1F1FA}\u{1F1F8}", mexico: "\u{1F1F2}\u{1F1FD}",
    germany: "\u{1F1E9}\u{1F1EA}", japan: "\u{1F1EF}\u{1F1F5}", india: "\u{1F1EE}\u{1F1F3}",
    brazil: "\u{1F1E7}\u{1F1F7}", korea: "\u{1F1F0}\u{1F1F7}", taiwan: "\u{1F1F9}\u{1F1FC}",
    thailand: "\u{1F1F9}\u{1F1ED}", vietnam: "\u{1F1FB}\u{1F1F3}", italy: "\u{1F1EE}\u{1F1F9}",
    spain: "\u{1F1EA}\u{1F1F8}", france: "\u{1F1EB}\u{1F1F7}", uk: "\u{1F1EC}\u{1F1E7}",
    canada: "\u{1F1E8}\u{1F1E6}", alemania: "\u{1F1E9}\u{1F1EA}", japon: "\u{1F1EF}\u{1F1F5}",
    corea: "\u{1F1F0}\u{1F1F7}", "estados unidos": "\u{1F1FA}\u{1F1F8}",
  };
  return flagMap[lower] || "";
}

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

interface ImportKanbanCardProps {
  order: ImportOrder;
  onClick: () => void;
}

const STATUS_DATE_FIELD: Record<string, { label: string; field: keyof ImportOrder }> = {
  oc_created: { label: "Embarque est.", field: "estimated_ship_date" },
  in_transit_to_customs: { label: "Llegada est.", field: "estimated_arrival_date" },
  in_customs: { label: "Liberación est.", field: "estimated_arrival_date" },
  in_yard: { label: "Salida est.", field: "estimated_warehouse_date" },
  in_transit_to_warehouse: { label: "Entrega est.", field: "estimated_warehouse_date" },
  in_warehouse: { label: "Entregado", field: "actual_warehouse_date" },
};

export function ImportKanbanCard({ order, onClick }: ImportKanbanCardProps) {
  const flag = getCountryFlag(order.supplier_country);
  const mainProduct = order.items?.[0];
  const dateInfo = STATUS_DATE_FIELD[order.status] || { label: "", field: "estimated_arrival_date" };
  const dateValue = order[dateInfo.field] as string | null;
  const total = order.total_required || 0;
  const completed = order.completed_required || 0;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;
  const destination = order.destination === "directo_cliente"
    ? order.destination_detail || "Cliente"
    : "Bodega Nextipac";

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
    >
      {/* Header: reference + company badge */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-mono font-semibold text-slate-700">{order.reference}</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0",
            order.company_id === 1
              ? "border-emerald-300 text-emerald-700 bg-emerald-50"
              : "border-purple-300 text-purple-700 bg-purple-50"
          )}
        >
          {order.company_id === 1 ? "DURA" : "ORS"}
        </Badge>
      </div>

      {/* Supplier */}
      <p className="text-sm font-medium text-slate-900 truncate">
        {order.supplier_name} {flag}
      </p>

      {/* Main product */}
      {mainProduct && (
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {mainProduct.productName || mainProduct.product_name}
          {mainProduct.quantity && ` · ${Number(mainProduct.quantity).toLocaleString()}${mainProduct.unit ? mainProduct.unit.toLowerCase() : ""}`}
        </p>
      )}

      {/* Destination */}
      <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
        <Factory className="h-3 w-3" />
        <span className="truncate">{destination}</span>
      </div>

      {/* Date */}
      {dateValue && (
        <p className="text-xs text-slate-500 mt-1">
          {dateInfo.label}: {new Date(dateValue + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}

      {/* Checklist progress */}
      {total > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                progressPct >= 100 ? "bg-emerald-500" : "bg-purple-500"
              )}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 tabular-nums">{completed}/{total}</span>
        </div>
      )}

      {/* Drag handle */}
      <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="h-4 w-4 text-slate-300" />
      </div>
    </div>
  );
}
