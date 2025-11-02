import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TreasuryPayment {
  id: number;
  status: string;
  amount: number;
  currency?: string;
  due_date?: string;
  created_at?: string;
}

interface AlertsModuleProps {
  payments?: TreasuryPayment[];
  isLoading?: boolean;
  onViewAlerts?: () => void;
}

function AlertsSkeleton() {
  return (
    <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
      <CardContent className="p-6 space-y-5">
        <Skeleton className="h-6 w-48 bg-surface-muted/70" />
        <Skeleton className="h-20 rounded-xl bg-surface-muted/70" />
        <Skeleton className="h-6 w-32 bg-surface-muted/70" />
        <Skeleton className="h-28 rounded-xl bg-surface-muted/70" />
      </CardContent>
    </Card>
  );
}

export function AlertsModule({
  payments: injectedPayments,
  isLoading: injectedLoading,
  onViewAlerts,
}: AlertsModuleProps) {
  const { data, isLoading } = useQuery<TreasuryPayment[]>({
    queryKey: ["/api/treasury/payments"],
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !injectedPayments,
  });

  const payments = injectedPayments ?? data ?? [];
  const loading = injectedLoading ?? isLoading;

  const { overdue, pendingThisMonth, completedThisMonth, chart } = useMemo(() => {
    const now = new Date();
    const overduePayments = payments.filter((payment) => {
      if (!payment.due_date) return false;
      const due = new Date(payment.due_date);
      const status = (payment.status || "").toLowerCase();
      return due.getTime() < now.getTime() && status !== "paid" && status !== "disbursed";
    });

    const monthlyPayments = payments.filter((payment) => {
      const due = payment.due_date ?? payment.created_at;
      if (!due) return false;
      const date = new Date(due);
      return (
        date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      );
    });

    const completed = monthlyPayments.filter((payment) => {
      const status = (payment.status || "").toLowerCase();
      return status === "paid" || status === "disbursed";
    }).length;

    const pending = monthlyPayments.length - completed;

    // Build sparkline by day (last 10 days)
    const dayBuckets = new Map<
      string,
      { label: string; pending: number; completed: number; order: number }
    >();

    monthlyPayments.forEach((payment) => {
      const dateStr = payment.due_date ?? payment.created_at;
      if (!dateStr) return;
      const date = new Date(dateStr);
      const label = format(date, "dd MMM", { locale: es });
      const key = format(date, "yyyyMMdd");
      const status = (payment.status || "").toLowerCase();
      const bucket =
        dayBuckets.get(key) ??
        {
          label,
          pending: 0,
          completed: 0,
          order: Number(key),
        };

      if (status === "paid" || status === "disbursed") {
        bucket.completed += 1;
      } else {
        bucket.pending += 1;
      }

      dayBuckets.set(key, bucket);
    });

    const chartData = Array.from(dayBuckets.values())
      .sort((a, b) => a.order - b.order)
      .slice(-10);

    return {
      overdue: overduePayments,
      pendingThisMonth: pending,
      completedThisMonth: completed,
      chart: chartData,
    };
  }, [payments]);

  const handleView = () => {
    if (onViewAlerts) {
      onViewAlerts();
    }
  };

  if (loading) {
    return <AlertsSkeleton />;
  }

  if (!payments.length) {
    return (
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center text-white space-y-3">
          <div className="w-14 h-14 rounded-full bg-pastel-green/25 flex items-center justify-center">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">Sin datos de pagos</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Programa pagos para recibir alertas de vencimiento y mantener tu calendario al día.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasAlerts = overdue.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
        <CardHeader className="border-b border-white/5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Centro de alertas
              </p>
              <h3 className="text-2xl font-semibold text-white mt-1">Alertas del mes</h3>
            </div>
            <Button
              variant="outline"
              className="border-pastel-orange/60 text-white hover:bg-pastel-orange/20"
              onClick={handleView}
            >
              Ver detalles
            </Button>
          </div>
          {hasAlerts ? (
            <div className="flex items-center gap-3 text-white">
              <Badge className="bg-pastel-orange/80 text-white px-3 py-1.5">
                {overdue.length} alertas activas
              </Badge>
              <span className="text-sm text-white/80">
                Pagos vencidos o próximos a vencer
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-white">
              <Badge className="bg-pastel-green/80 text-white px-3 py-1.5">
                Sin alertas activas
              </Badge>
              <span className="text-sm text-muted-foreground">
                Todos los pagos del mes están controlados.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6 text-white">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-pastel-orange/20 via-transparent to-transparent p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-pastel-orange/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-white/70">
                Alertas pendientes
              </p>
              <p className="text-3xl font-semibold text-white mt-1">
                {overdue.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">Pagos completados este mes</p>
              <p className="text-lg font-semibold text-white">
                {completedThisMonth}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-surface-muted/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Seguimiento mensual
              </p>
              <span className="text-xs text-muted-foreground">
                Completados vs pendientes
              </span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="alertsPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--pastel-orange))" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="hsl(var(--pastel-orange))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="alertsCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--pastel-green))" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="hsl(var(--pastel-green))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted))", fontSize: 11 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsla(var(--surface) / 0.95)",
                      borderRadius: 12,
                      border: "1px solid hsla(var(--border) / 0.6)",
                      color: "white",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      [`${value} pagos`, name === "pending" ? "Pendientes" : "Completados"]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    stroke="hsl(var(--pastel-orange))"
                    strokeWidth={2}
                    fill="url(#alertsPending)"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(var(--pastel-green))"
                    strokeWidth={2}
                    fill="url(#alertsCompleted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
