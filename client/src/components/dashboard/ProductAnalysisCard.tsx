/**
 * Product Analysis Card - Productos por nombre y por familia
 * Replica la sección "Análisis de Productos" del análisis Nova
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductAnalysisCardProps {
  companyId: number;
  year: number;
  month: number;
}

export function ProductAnalysisCard({ companyId, year, month }: ProductAnalysisCardProps) {
  const [activeTab, setActiveTab] = useState<'product' | 'family'>('product');

  const { data: topProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/sales-top-products", companyId, "month", 10],
    queryFn: async () => {
      const res = await apiRequest("GET",
        `/api/sales-top-products?companyId=${companyId}&period=month&limit=10`);
      return await res.json();
    },
    staleTime: 60000,
  });

  const { data: financial, isLoading: isLoadingFinancial } = useMonthlyFinancial(companyId, year, month);

  const isLoading = isLoadingProducts || isLoadingFinancial;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-72 w-full" /></CardContent>
      </Card>
    );
  }

  const products = (topProducts || []).slice(0, 10);
  const families: Array<{ family: string; transactions: number; quantity: number; revenue: number; percentOfSales: number; avgMargin: number }> = financial?.productsByFamily || [];
  const totalProductRevenue = products.reduce((s: number, p: any) => s + (p.revenue || 0), 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Análisis de Productos
          </CardTitle>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveTab('product')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition-colors",
              activeTab === 'product'
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Por Producto
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition-colors",
              activeTab === 'family'
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Por Familia
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'product' ? (
          products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos de productos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-2">Producto</th>
                    <th className="text-right py-2 pr-2">Cantidad</th>
                    <th className="text-right py-2 pr-2">Venta</th>
                    <th className="text-right py-2">% Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product: any, idx: number) => {
                    const pct = totalProductRevenue > 0
                      ? ((product.revenue || 0) / totalProductRevenue) * 100 : 0;
                    return (
                      <tr key={product.name || idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-2 font-medium truncate max-w-[180px]">{product.name}</td>
                        <td className="py-2 pr-2 text-right text-muted-foreground">
                          {formatNumber(product.volume || 0)}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold">
                          {formatCurrency(product.revenue || 0, companyId)}
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant="outline" className="text-xs">{pct.toFixed(1)}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          families.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos de familias</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-2">Familia</th>
                    <th className="text-right py-2 pr-2">Txns</th>
                    <th className="text-right py-2 pr-2">Venta</th>
                    <th className="text-right py-2 pr-2">% Ventas</th>
                    <th className="text-right py-2">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {families.map((fam, idx) => (
                    <tr key={fam.family || idx} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-2 font-medium truncate max-w-[150px]">{fam.family}</td>
                      <td className="py-2 pr-2 text-right text-muted-foreground">{fam.transactions}</td>
                      <td className="py-2 pr-2 text-right font-semibold">
                        {formatCurrency(fam.revenue, companyId)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Badge variant="outline" className="text-xs">{fam.percentOfSales.toFixed(1)}%</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <Badge
                          variant="outline"
                          className={cn("text-xs",
                            fam.avgMargin > 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {fam.avgMargin > 0 ? `${fam.avgMargin.toFixed(1)}%` : 'N/A'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
