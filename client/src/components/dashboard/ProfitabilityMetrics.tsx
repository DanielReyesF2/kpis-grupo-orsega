/**
 * Componente para mostrar métricas detalladas de rentabilidad
 * Top productos, clientes y envíos por rentabilidad
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { 
  TrendingUp, 
  Package, 
  Users, 
  Truck,
  DollarSign,
  Percent
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProfitabilityMetricsProps {
  companyId: number;
  year?: number;
}

interface ProductProfitability {
  productName: string;
  productId: number | null;
  totalRevenue: number;
  totalQuantity: number;
  avgUnitPrice: number;
  transactionCount: number;
  profitability: number;
}

interface ClientProfitability {
  clientName: string;
  clientId: number | null;
  totalRevenue: number;
  transactionCount: number;
  avgOrderValue: number;
  lastPurchaseDate: string;
}

interface ShipmentProfitability {
  invoiceNumber: string;
  folio: string | null;
  saleDate: string;
  clientName: string;
  totalAmount: number;
  itemCount: number;
  products: string[];
}

interface ProfitabilityData {
  overallProfitability: number;
  totalRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
  topProducts: ProductProfitability[];
  topClients: ClientProfitability[];
  topShipments: ShipmentProfitability[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}

export function ProfitabilityMetrics({ companyId, year }: ProfitabilityMetricsProps) {
  const { data, isLoading } = useQuery<ProfitabilityData>({
    queryKey: ["/api/profitability-metrics", companyId, year],
    queryFn: async () => {
      const yearParam = year ? `&year=${year}` : '';
      const res = await apiRequest("GET", `/api/profitability-metrics?companyId=${companyId}${yearParam}`);
      return await res.json();
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Resumen de rentabilidad */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rentabilidad General</p>
                <p className="text-3xl font-bold">{data.overallProfitability.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Percent className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ingresos Totales</p>
                <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Transacciones</p>
                <p className="text-2xl font-bold">{formatNumber(data.totalTransactions)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ticket Promedio</p>
                <p className="text-2xl font-bold">{formatCurrency(data.avgTransactionValue)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top productos, clientes y envíos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Productos por Rentabilidad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Top Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topProducts.slice(0, 5).map((product, index) => (
                <motion.div
                  key={product.productName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.productName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(product.totalRevenue)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {product.profitability.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(product.totalQuantity)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Clientes por Rentabilidad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topClients.slice(0, 5).map((client, index) => (
                <motion.div
                  key={client.clientName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{client.clientName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(client.totalRevenue)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {client.transactionCount} trans.
                      </span>
                    </div>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(client.avgOrderValue)}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      ticket promedio
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Envíos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Top Envíos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topShipments.slice(0, 5).map((shipment, index) => (
                <motion.div
                  key={shipment.invoiceNumber}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{shipment.clientName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {shipment.invoiceNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {shipment.itemCount} items
                      </span>
                    </div>
                    {shipment.products.length > 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-1 truncate">
                        {shipment.products.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="ml-2 text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(shipment.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {shipment.saleDate}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

