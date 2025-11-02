import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";
import { CalendarCheck2, CalendarClock, CalendarPlus } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

interface TreasuryPayment {
  id: number;
  status: string;
  amount: number;
  currency?: string;
  due_date?: string;
  created_at?: string;
  paid_at?: string;
}

interface PaymentsModuleProps {
  payments?: TreasuryPayment[];
  isLoading?: boolean;
  onSchedulePayment?: () => void;
}

const STATUS_CONFIG: Record<
  "pending" | "authorized" | "disbursed",
  { label: string; accent: string; gradient: string }
> = {
  pending: {
    label: "Pendientes",
    accent: "text-pastel-orange",
    gradient: "from-pastel-orange/20 via-pastel-orange/10 to-transparent",
  },
  authorized: {
    label: "Autorizados",
    accent: "text-pastel-blue",
    gradient: "from-pastel-blue/25 via-pastel-blue/10 to-transparent",
  },
  disbursed: {
    label: "Dispersados",
    accent: "text-pastel-green",
    gradient: "from-pastel-green/25 via-pastel-green/10 to-transparent",
  },
};

function PaymentsSkeleton() {
  return (
    <Card className="border border-border/40 bg-surface/50 backdrop-blur-sm shadow-[0_18px_40px_-28px_rgba(0,0,0,0.65)]">
      <CardContent className="p-6 space-y-6">
        <Skeleton className="h-6 w-40 bg-surface-muted/80" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-lg bg-surface-muted/60" />
          <Skeleton className="h-20 rounded-lg bg-surface-muted/60" />
          <Skeleton className="h-20 rounded-lg bg-surface-muted/60" />
        </div>
        <Skeleton className="h-28 rounded-lg bg-surface-muted/60" />
        <Skeleton className="h-10 w-full rounded-lg bg-surface-muted/60" />
      </CardContent>
    </Card>
  );
}

export function PaymentsModule({
  payments: injectedPayments,
  isLoading: injectedLoading,
  onSchedulePayment,
}: PaymentsModuleProps) {
  const { data, isLoading } = useQuery<TreasuryPayment[]>({
    queryKey: ["/api/treasury/payments"],
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !injectedPayments,
  });

  const payments = injectedPayments ?? data ?? [];
  const loading = injectedLoading ?? isLoading;

  const stats = useMemo(() => {
    const base = {
      pending: 0,
      authorized: 0,
      disbursed: 0,
    };

    payments.forEach((payment) => {
      const status = (payment.status || "").toLowerCase();
      if (status === "pending") base.pending += 1;
      else if (status === "authorized") base.authorized += 1;
      else if (status === "disbursed" || status === "paid") base.disbursed += 1;
    });

    return base;
  }, [payments]);

  const { progress, completedThisMonth, totalThisMonth } = useMemo(() => {
    const now = new Date();
    const thisMonthPayments = payments.filter((payment) => {
      const dueDateString = payment.due_date ?? payment.created_at;
      if (!dueDateString) return false;
      const dueDate = new Date(dueDateString);
      return (
        dueDate.getFullYear() === now.getFullYear() &&
        dueDate.getMonth() === now.getMonth()
      );
    });

    const completed = thisMonthPayments.filter((payment) => {
      const status = (payment.status || "").toLowerCase();
      return status === "paid" || status === "disbursed";
    }).length;

    const total = thisMonthPayments.length;
    const value = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

    return {
      completedThisMonth: completed,
      totalThisMonth: total,
      progress: value,
    };
  }, [payments]);

  const weeklySparkline = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; count: number; isoKey: number }
    >();

    payments.forEach((payment) => {
      const date = payment.due_date ?? payment.created_at;
      if (!date) return;

      const weekStart = startOfWeek(new Date(date), { weekStartsOn: 1 });
      const isoKey = Number(format(weekStart, "yyyyII"));
      const label = format(weekStart, "dd MMM", { locale: es });
      const current = buckets.get(label);
      if (current) {
        current.count += 1;
      } else {
        buckets.set(label, { label, count: 1, isoKey });
      }
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.isoKey - b.isoKey)
      .slice(-6);
  }, [payments]);

  const handleSchedule = () => {
    if (onSchedulePayment) {
      onSchedulePayment();
    }
  };

  if (loading) {
    return <PaymentsSkeleton />;
  }

  if (!payments.length) {
    return (
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-sm shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)] h-full">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="p-5 rounded-full bg-pastel-blue/20 text-white">
            <CalendarClock className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Sin pagos programados</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Cuando registres pagos programados aparecerán aquí para que monitorees el avance del mes.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-pastel-blue/80 text-white hover:bg-pastel-blue transition-colors"
            onClick={handleSchedule}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Programar pago
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden border border-border/40 bg-surface/65 backdrop-blur-md shadow-[0_25px_60px_-35px_rgba(8,12,18,0.8)] h-full">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/5 opacity-70" />
        <CardContent className="relative p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tesorería</p>
              <h3 className="text-2xl font-semibold text-white mt-1">Pagos programados</h3>
            </div>
            <Button
              size="sm"
              className="bg-pastel-blue/80 text-white hover:bg-pastel-blue transition-colors"
              onClick={handleSchedule}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Programar pago
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((key) => {
              const config = STATUS_CONFIG[key];
              const value = stats[key];
              return (
                <div
                  key={key}
                  className={`rounded-lg border border-white/10 bg-gradient-to-br ${config.gradient} px-4 py-3`}
                >
                  <p className="text-xs font-medium text-white/70">{config.label}</p>
                  <p className="text-xl font-semibold text-white mt-1">{value}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-muted/60 p-4 shadow-inner space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avance mensual</p>
                <p className="text-sm text-white font-medium mt-1">
                  {completedThisMonth}/{totalThisMonth} completados
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-white">
                <CalendarCheck2 className="h-4 w-4 text-pastel-green" />
                <span>{progress}%</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pastel-green/80 via-pastel-blue/80 to-pastel-violet/70 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-muted/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Últimas semanas
              </p>
              <span className="text-xs text-muted-foreground">
                Conteo de pagos programados
              </span>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySparkline}>
                  <defs>
                    <linearGradient id="paymentsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--pastel-blue))" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(var(--pastel-violet))" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted))", fontSize: 11 }} />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--pastel-blue) / 0.12)" }}
                    contentStyle={{
                      backgroundColor: "hsla(var(--surface) / 0.95)",
                      borderRadius: 12,
                      border: "1px solid hsla(var(--border) / 0.6)",
                      color: "white",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value} pagos`, "Semana"]}
                    labelFormatter={(label) => `Semana de ${label}`}
                  />
                  <Bar dataKey="count" radius={[6, 6, 6, 6]} fill="url(#paymentsGradient)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

