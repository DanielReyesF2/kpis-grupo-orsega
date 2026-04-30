import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportHistoryProps {
  companyId: number;
  onOrderClick: (order: any) => void;
}

export function ImportHistory({ companyId, onOrderClick }: ImportHistoryProps) {
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/import-orders", { companyId, limit: "200" }],
  });

  // Filter to completed/cancelled only
  const historyOrders = orders.filter(
    (o: any) => o.status === "in_warehouse" || o.status === "cancelled"
  );

  const filtered = historyOrders.filter((o: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.reference?.toLowerCase().includes(q) ||
      o.supplier_name?.toLowerCase().includes(q) ||
      o.purchase_order_number?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por referencia o proveedor..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">
          No hay importaciones en el historial
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Referencia</TableHead>
                <TableHead className="text-xs">Proveedor</TableHead>
                <TableHead className="text-xs">Productos</TableHead>
                <TableHead className="text-xs">Destino</TableHead>
                <TableHead className="text-xs">Creada</TableHead>
                <TableHead className="text-xs">Entregada</TableHead>
                <TableHead className="text-xs">Días</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order: any) => {
                const createdAt = new Date(order.created_at);
                const deliveredAt = order.actual_warehouse_date
                  ? new Date(order.actual_warehouse_date + "T12:00:00")
                  : null;
                const days = deliveredAt
                  ? Math.ceil(
                      (deliveredAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
                    )
                  : null;

                const mainProduct = order.items?.[0];

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => onOrderClick(order)}
                  >
                    <TableCell className="font-mono text-xs font-medium">
                      {order.reference}
                    </TableCell>
                    <TableCell className="text-sm">{order.supplier_name}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">
                      {mainProduct
                        ? `${mainProduct.productName || mainProduct.product_name}${order.items?.length > 1 ? ` +${order.items.length - 1}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {order.destination === "directo_cliente"
                        ? order.destination_detail || "Cliente"
                        : "Bodega Nextipac"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {createdAt.toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {deliveredAt
                        ? deliveredAt.toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {days ? `${days}d` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          order.status === "in_warehouse"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-red-50 text-red-700 border-red-300"
                        )}
                      >
                        {order.status === "in_warehouse" ? "Entregada" : "Cancelada"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
