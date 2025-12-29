import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { normalizeExchangeRate, getRateDisplayConfig } from "@/lib/utils/exchange-rates";

interface ExchangeRate {
  id: number;
  source: string;
  buy_rate: number;
  sell_rate: number;
  date: string;
}

interface FxModuleProps {
  exchangeRates?: ExchangeRate[];
  isLoading?: boolean;
  onViewDetail?: () => void;
}

const SOURCES = ["DOF", "MONEX", "Santander"] as const;

function FxSkeleton() {
  return (
    <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
      <CardContent className="p-6 space-y-6">
        <Skeleton className="h-6 w-56 bg-surface-muted/70" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-lg bg-surface-muted/70" />
          <Skeleton className="h-24 rounded-lg bg-surface-muted/70" />
        </div>
        <Skeleton className="h-10 w-40 bg-surface-muted/70" />
        <Skeleton className="h-32 rounded-xl bg-surface-muted/70" />
      </CardContent>
    </Card>
  );
}

export function FxModule({
  exchangeRates: injectedRates,
  isLoading: injectedLoading,
  onViewDetail,
}: FxModuleProps) {
  const { data, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/treasury/exchange-rates"],
    staleTime: 20_000,
    refetchInterval: 30_000,
    enabled: !injectedRates,
  });

  const exchangeRates = injectedRates ?? data ?? [];
  const loading = injectedLoading ?? isLoading;
  const [source, setSource] = useState<(typeof SOURCES)[number]>("DOF");

  const filtered = useMemo(() => {
    return exchangeRates
      .filter((rate: ExchangeRate) => (rate.source ?? "").toUpperCase() === source.toUpperCase())
      .sort(
        (a: ExchangeRate, b: ExchangeRate) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  }, [exchangeRates, source]);

  const latest = filtered[0];
  const previous = filtered[1];

  const normalizedLatest = latest ? normalizeExchangeRate(latest) : null;
  const displayConfig = getRateDisplayConfig(source);

  const trend = useMemo(() => {
    if (!latest || !previous) return "stable" as const;
    if (latest.buy_rate > previous.buy_rate) return "up" as const;
    if (latest.buy_rate < previous.buy_rate) return "down" as const;
    return "stable" as const;
  }, [latest, previous]);

  const sparkline = useMemo(() => {
    return filtered
      .slice(0, 7)
      .reverse()
      .map((rate: ExchangeRate) => {
        const normalized = normalizeExchangeRate(rate);
        return {
          label: format(new Date(rate.date), "dd MMM HH:mm", { locale: es }),
          buy: rate.buy_rate,
          value: normalized.displayValue,
        };
      });
  }, [filtered]);

  const trendBadge = (() => {
    switch (trend) {
      case "up":
        return {
          icon: ArrowUpRight,
          text: "Alza 24h",
          className: "bg-pastel-green/80 text-white",
        };
      case "down":
        return {
          icon: ArrowDownRight,
          text: "Baja 24h",
          className: "bg-pastel-orange/80 text-white",
        };
      default:
        return {
          icon: TrendingUp,
          text: "Estable 24h",
          className: "bg-pastel-blue/70 text-white",
        };
    }
  })();

  if (loading) {
    return <FxSkeleton />;
  }

  if (!latest) {
    return (
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4 text-white">
          <div className="w-16 h-16 rounded-full bg-pastel-blue/20 flex items-center justify-center">
            <TrendingUp className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-semibold">Sin registros recientes</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Cuando registres tipos de cambio se mostrarán aquí con su tendencia y análisis.
          </p>
          <Button
            variant="outline"
            className="border-pastel-blue/50 text-white hover:bg-pastel-blue/20"
            onClick={onViewDetail}
          >
            Ver historial
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
      <Card className="border border-border/40 bg-surface/60 backdrop-blur-md shadow-[0_26px_60px_-36px_rgba(0,0,0,0.75)] h-full">
        <CardHeader className="flex flex-col gap-4 border-b border-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Mercado cambiario
              </p>
              <h3 className="text-2xl font-semibold text-white mt-1">Tipo de cambio USD / MXN</h3>
            </div>
            <Select value={source} onValueChange={(value) => setSource(value as (typeof SOURCES)[number])}>
              <SelectTrigger className="w-[160px] bg-surface-muted/70 border border-white/10 text-white">
                <SelectValue placeholder="Fuente" />
              </SelectTrigger>
              <SelectContent className="bg-surface/90 text-white">
                {SOURCES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={trendBadge.className}>
              <trendBadge.icon className="h-3.5 w-3.5 mr-1" />
              {trendBadge.text}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Última actualización:{" "}
              {format(new Date(latest.date), "dd MMM yyyy HH:mm", { locale: es })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6 text-white">
          <div className={displayConfig.isSingle ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-pastel-blue/20 via-transparent to-transparent p-5">
              <p className="text-sm text-white/80">{displayConfig.buyLabel}</p>
              <p className="text-4xl font-semibold mt-2 tracking-tight">
                ${normalizedLatest?.displayValue.toFixed(4) || latest.buy_rate.toFixed(4)}
              </p>
            </div>
            {!displayConfig.isSingle && (
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-pastel-green/20 via-transparent to-transparent p-5">
                <p className="text-sm text-white/80">{displayConfig.sellLabel}</p>
                <p className="text-4xl font-semibold mt-2 tracking-tight">
                  ${latest.sell_rate.toFixed(4)}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-surface-muted/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Últimas 7 actualizaciones
              </p>
              <span className="text-xs text-muted-foreground">
                Fuente: {source.toUpperCase()}
              </span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline}>
                  <defs>
                    <linearGradient id="fxGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--pastel-blue))" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(var(--pastel-violet))" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted))", fontSize: 11 }}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "hsl(var(--pastel-blue) / 0.4)", strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "hsla(var(--surface) / 0.95)",
                      borderRadius: 12,
                      border: "1px solid hsla(var(--border) / 0.6)",
                      color: "white",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, displayConfig.buyLabel]}
                  />
                  <Line
                    type="monotone"
                    dataKey={displayConfig.isSingle ? "value" : "buy"}
                    stroke="url(#fxGradient)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-pastel-blue/50 text-white hover:bg-pastel-blue/20"
              onClick={onViewDetail}
            >
              Ver detalle
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

