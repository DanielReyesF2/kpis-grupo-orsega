/**
 * Monthly Financial KPI Cards - 6 tarjetas con métricas financieras del mes
 * Replica la sección "Desempeño Financiero - Métricas Principales" del análisis Nova
 */

import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { SalesKPICard } from "@/components/sales/dashboard/SalesKPICard";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { DollarSign, Receipt, TrendingUp, Percent, Calculator, Hash, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MonthlyKPICardsProps {
  companyId: number;
  year: number;
  month: number;
}

export function MonthlyKPICards({ companyId, year, month }: MonthlyKPICardsProps) {
  const { data, isLoading } = useMonthlyFinancial(companyId, year, month);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  const d = data as any;
  const fm = d?.financialMetrics as { totalRevenueMXN: number; totalCostMXN: number; grossProfitMXN: number; grossMarginPercent: number; avgTransactionValue: number; totalTransactions: number; totalItems: number; totalQuantity: number; unit: string } | undefined;
  const prev = d?.previousMonth as { totalRevenue: number; grossProfit: number; grossMarginPercent: number; totalTransactions: number } | undefined;
  const monthName: string = d?.monthName || 'este mes';

  if (!fm) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Sin datos financieros para {monthName}
      </div>
    );
  }

  // MoM calculations
  const revenueMoM = prev && prev.totalRevenue > 0
    ? ((fm.totalRevenueMXN - prev.totalRevenue) / prev.totalRevenue) * 100
    : undefined;
  const profitMoM = prev && prev.grossProfit > 0
    ? ((fm.grossProfitMXN - prev.grossProfit) / prev.grossProfit) * 100
    : undefined;
  const txnMoM = prev && prev.totalTransactions > 0
    ? ((fm.totalTransactions - prev.totalTransactions) / prev.totalTransactions) * 100
    : undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 1. Venta Total */}
      <SalesKPICard
        title={`Venta Total ${monthName}`}
        value={formatCurrency(fm.totalRevenueMXN, companyId)}
        subtitle={prev ? `${formatCurrency(prev.totalRevenue, companyId)} mes anterior` : undefined}
        icon={DollarSign}
        trend={revenueMoM !== undefined ? { value: revenueMoM, label: "MoM" } : undefined}
        variant="success"
      />

      {/* 2. Costo Total */}
      <SalesKPICard
        title="Costo Total"
        value={formatCurrency(fm.totalCostMXN, companyId)}
        subtitle={fm.totalCostMXN > 0 ? `${((fm.totalCostMXN / fm.totalRevenueMXN) * 100).toFixed(1)}% del ingreso` : 'Sin datos de costo'}
        icon={Receipt}
        variant={fm.totalCostMXN > 0 ? "warning" : "default"}
      />

      {/* 3. Utilidad Bruta */}
      <SalesKPICard
        title="Utilidad Bruta"
        value={formatCurrency(fm.grossProfitMXN, companyId)}
        subtitle={prev ? `${formatCurrency(prev.grossProfit, companyId)} mes anterior` : undefined}
        icon={TrendingUp}
        trend={profitMoM !== undefined ? { value: profitMoM, label: "MoM" } : undefined}
        variant={fm.grossProfitMXN > 0 ? "success" : "danger"}
      />

      {/* 4. Margen Bruto % */}
      <SalesKPICard
        title="Margen Bruto"
        value={`${fm.grossMarginPercent.toFixed(2)}%`}
        subtitle={prev && prev.grossMarginPercent > 0
          ? `${prev.grossMarginPercent.toFixed(2)}% mes anterior`
          : undefined}
        icon={Percent}
        variant={fm.grossMarginPercent >= 15 ? "success" : fm.grossMarginPercent >= 8 ? "warning" : "danger"}
      />

      {/* 5. Promedio por Transacción */}
      <SalesKPICard
        title="Promedio/Transacción"
        value={formatCurrency(fm.avgTransactionValue, companyId)}
        subtitle={`${formatNumber(fm.totalQuantity)} ${fm.unit} totales`}
        icon={Calculator}
        variant="default"
      />

      {/* 6. Total Transacciones */}
      <SalesKPICard
        title="Transacciones"
        value={formatNumber(fm.totalTransactions)}
        subtitle={`${formatNumber(fm.totalItems)} líneas de detalle`}
        icon={Hash}
        trend={txnMoM !== undefined ? { value: txnMoM, label: "MoM" } : undefined}
        variant="default"
      />
    </div>
  );
}
