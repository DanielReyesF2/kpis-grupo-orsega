import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Clock, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isSingleValueSource } from "@/lib/utils/exchange-rates";

// Zona horaria de México (Ciudad de México)
const MEXICO_TIMEZONE = "America/Mexico_City";

// Función para formatear fecha en hora de México
function formatMexicoTime(dateStr: string, formatStr: string): string {
  const date = new Date(dateStr);
  const mexicoDate = toZonedTime(date, MEXICO_TIMEZONE);
  return format(mexicoDate, formatStr, { locale: es });
}

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  notes?: string;
  date: string;
  created_by?: number;
}

interface ExchangeRateDashboardProps {
  onRefreshDOF?: () => void;
  isRefreshingDOF?: boolean;
}

export function ExchangeRateDashboard(_props: ExchangeRateDashboardProps) {
  const { toast } = useToast();
  const [selectedSource, setSelectedSource] = useState<"Santander" | "MONEX">("Santander");
  const [buyRate, setBuyRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Obtener todos los tipos de cambio de hoy
  const { data: allRates = [], isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/treasury/exchange-rates"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/treasury/exchange-rates?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch rates");
      return response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000, // Refrescar cada minuto
  });

  // Mutación para agregar tipo de cambio
  const addRateMutation = useMutation({
    mutationFn: async (data: { buyRate: number; sellRate: number; source: string }) => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/treasury/exchange-rates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add rate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/exchange-rates"] });
      toast({ title: "✅ Tipo de cambio agregado" });
      setBuyRate("");
      setSellRate("");
    },
    onError: () => {
      toast({ title: "Error al agregar tipo de cambio", variant: "destructive" });
    },
  });

  // Agrupar por fuente y obtener el más reciente de cada una
  const latestBySource = allRates.reduce((acc, rate) => {
    if (!acc[rate.source] || new Date(rate.date) > new Date(acc[rate.source].date)) {
      acc[rate.source] = rate;
    }
    return acc;
  }, {} as Record<string, ExchangeRate>);

  // Filtrar solo los de hoy para el historial diario
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRates = allRates.filter(rate => {
    const rateDate = new Date(rate.date);
    rateDate.setHours(0, 0, 0, 0);
    return rateDate.getTime() === today.getTime();
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const buy = parseFloat(buyRate);
    const sell = parseFloat(sellRate);
    if (isNaN(buy) || isNaN(sell)) {
      toast({ title: "Ingresa valores válidos", variant: "destructive" });
      return;
    }
    addRateMutation.mutate({ buyRate: buy, sellRate: sell, source: selectedSource });
  };

  const sourceColors: Record<string, { bg: string; text: string; border: string }> = {
    Santander: { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
    MONEX: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
    DOF: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tipos de Cambio Actuales */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Tipos de Cambio Actuales</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["Santander", "MONEX", "DOF"].map((source) => {
            const rate = latestBySource[source];
            const colors = sourceColors[source] || sourceColors.DOF;
            return (
              <Card key={source} className={`${colors.border} border-2`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold text-lg ${colors.text}`}>{source}</span>
                    {rate && (
                      <Badge variant="outline" className="text-xs">
                        {formatMexicoTime(rate.date, "HH:mm")}
                      </Badge>
                    )}
                  </div>
                  {rate ? (
                    isSingleValueSource(source) ? (
                      /* DOF - Solo muestra Tipo de Cambio */
                      <div className="text-center py-2">
                        <span className="text-sm text-muted-foreground block mb-1">Tipo de Cambio</span>
                        <span className="font-bold text-2xl">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                      </div>
                    ) : (
                      /* Santander/MONEX - Compra y Venta */
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Compra:</span>
                          <span className="font-bold text-lg">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Venta:</span>
                          <span className="font-bold text-lg">${(rate.sell_rate ?? 0).toFixed(4)}</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin datos</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Formulario para agregar Santander/Monex */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agregar Tipo de Cambio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedSource === "Santander" ? "default" : "outline"}
                onClick={() => setSelectedSource("Santander")}
                className="flex-1"
              >
                Santander
              </Button>
              <Button
                type="button"
                variant={selectedSource === "MONEX" ? "default" : "outline"}
                onClick={() => setSelectedSource("MONEX")}
                className="flex-1"
              >
                MONEX
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buyRate">Compra</Label>
                <Input
                  id="buyRate"
                  type="number"
                  step="0.0001"
                  placeholder="20.1234"
                  value={buyRate}
                  onChange={(e) => setBuyRate(e.target.value)}
                  className="text-lg font-mono"
                />
              </div>
              <div>
                <Label htmlFor="sellRate">Venta</Label>
                <Input
                  id="sellRate"
                  type="number"
                  step="0.0001"
                  placeholder="20.5678"
                  value={sellRate}
                  onChange={(e) => setSellRate(e.target.value)}
                  className="text-lg font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={addRateMutation.isPending} className="flex-1">
                {addRateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Agregar {selectedSource}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Última Actualización - Destacada */}
      {todayRates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Última Actualización</h2>
          </div>
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              {(() => {
                const latestRate = todayRates[0];
                const colors = sourceColors[latestRate.source] || sourceColors.DOF;
                const isSingle = isSingleValueSource(latestRate.source);
                return (
                  <div className="flex items-center gap-4">
                    <Badge
                      className={`${colors.bg} ${colors.text} border-2 ${colors.border} px-3 py-1 text-sm font-bold`}
                    >
                      {latestRate.source}
                    </Badge>
                    <div className="flex items-center gap-2 text-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">
                        {formatMexicoTime(latestRate.date, "HH:mm:ss")}
                      </span>
                    </div>
                    <div className="flex-1" />
                    {isSingle ? (
                      /* DOF - Solo un valor */
                      <div className="text-center">
                        <span className="text-xs text-muted-foreground block mb-1">Tipo de Cambio</span>
                        <span className="font-bold text-2xl text-primary">
                          ${(latestRate.buy_rate ?? 0).toFixed(4)}
                        </span>
                      </div>
                    ) : (
                      /* Santander/MONEX - Compra y Venta */
                      <div className="flex gap-8">
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground block mb-1">Compra</span>
                          <span className="font-bold text-xl text-green-600 dark:text-green-400">
                            ${(latestRate.buy_rate ?? 0).toFixed(4)}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground block mb-1">Venta</span>
                          <span className="font-bold text-xl text-red-600 dark:text-red-400">
                            ${(latestRate.sell_rate ?? 0).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historial del Día */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Historial de Hoy</h2>
          <Badge variant="secondary" className="font-normal">
            {todayRates.length} {todayRates.length === 1 ? 'registro' : 'registros'}
          </Badge>
        </div>
        {todayRates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay actualizaciones de hoy
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayRates.slice(1).map((rate) => {
              const colors = sourceColors[rate.source] || sourceColors.DOF;
              const isSingle = isSingleValueSource(rate.source);
              const borderAccent = rate.source === 'Santander' ? 'border-l-green-500' : rate.source === 'MONEX' ? 'border-l-blue-500' : 'border-l-orange-500';
              return (
                <Card key={rate.id} className={`overflow-hidden border ${colors.border} bg-card shadow-sm hover:shadow transition-shadow rounded-lg border-l-4 ${borderAccent}`}>
                  <CardContent className="p-3 px-4">
                    <div className="flex items-center gap-4">
                      <Badge
                        className={`${colors.bg} ${colors.text} border-0 min-w-[72px] justify-center text-xs font-semibold rounded-full px-3 py-0.5`}
                      >
                        {rate.source}
                      </Badge>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium tabular-nums">
                          {formatMexicoTime(rate.date, "HH:mm:ss")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-2" />
                      {isSingle ? (
                        <div className="text-right min-w-[100px]">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-0.5">Tipo de cambio</span>
                          <span className="font-semibold text-base tabular-nums text-foreground">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                        </div>
                      ) : (
                        <div className="flex gap-6">
                          <div className="text-right min-w-[90px]">
                            <span className="text-[10px] text-muted-foreground block mb-0.5">Compra</span>
                            <span className="font-semibold text-sm tabular-nums">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                          </div>
                          <div className="text-right min-w-[90px]">
                            <span className="text-[10px] text-muted-foreground block mb-0.5">Venta</span>
                            <span className="font-semibold text-sm tabular-nums">${(rate.sell_rate ?? 0).toFixed(4)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial Completo */}
      {allRates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Historial Completo</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {allRates.length} {allRates.length === 1 ? 'registro' : 'registros'}
              </Badge>
              {allRates.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullHistory(!showFullHistory)}
                >
                  {showFullHistory ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver más ({allRates.length - 10})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          <div className={`space-y-2 ${showFullHistory ? "max-h-[400px] overflow-y-auto pr-2" : ""}`}>
            {allRates.slice(0, showFullHistory ? 50 : 10).map((rate) => {
              const colors = sourceColors[rate.source] || sourceColors.DOF;
              const isToday = new Date(rate.date).toDateString() === new Date().toDateString();
              const isSingle = isSingleValueSource(rate.source);
              const borderAccent = rate.source === 'Santander' ? 'border-l-green-500' : rate.source === 'MONEX' ? 'border-l-blue-500' : 'border-l-orange-500';
              return (
                <Card key={rate.id} className={`border ${colors.border} border-l-4 ${borderAccent} ${isToday ? colors.bg : "bg-card"} shadow-sm hover:shadow transition-shadow rounded-lg`}>
                  <CardContent className="p-3 px-4">
                    <div className="flex items-center gap-4">
                      <Badge
                        className={`${colors.bg} ${colors.text} border-0 min-w-[72px] justify-center text-xs font-semibold rounded-full px-3 py-0.5`}
                      >
                        {rate.source}
                      </Badge>
                      <span className="text-foreground text-sm font-medium min-w-[120px] tabular-nums">
                        {formatMexicoTime(rate.date, "dd MMM HH:mm")}
                      </span>
                      <div className="flex-1 min-w-2" />
                      {isSingle ? (
                        <span className="font-semibold text-sm tabular-nums text-foreground">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                      ) : (
                        <div className="flex items-center gap-4 font-mono text-sm tabular-nums">
                          <span className="font-semibold text-foreground">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="font-semibold text-foreground">${(rate.sell_rate ?? 0).toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
