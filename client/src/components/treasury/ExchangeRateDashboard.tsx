import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Clock, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  onRefreshDOF: () => void;
  isRefreshingDOF: boolean;
}

export function ExchangeRateDashboard({ onRefreshDOF, isRefreshingDOF }: ExchangeRateDashboardProps) {
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
                        {format(new Date(rate.date), "HH:mm", { locale: es })}
                      </Badge>
                    )}
                  </div>
                  {rate ? (
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
              <Button type="button" variant="outline" onClick={onRefreshDOF} disabled={isRefreshingDOF}>
                {isRefreshingDOF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Actualizar DOF
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Historial del Día */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Actualizaciones de Hoy</h2>
          <Badge variant="secondary">{todayRates.length} actualizaciones</Badge>
        </div>
        {todayRates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay actualizaciones de hoy
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayRates.map((rate) => {
              const colors = sourceColors[rate.source] || sourceColors.DOF;
              return (
                <Card key={rate.id} className={`${colors.bg} ${colors.border}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={colors.text} variant="outline">
                          {rate.source}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(rate.date), "HH:mm:ss", { locale: es })}
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span>
                          <span className="text-muted-foreground">Compra:</span>{" "}
                          <span className="font-bold">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">Venta:</span>{" "}
                          <span className="font-bold">${(rate.sell_rate ?? 0).toFixed(4)}</span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial Reciente */}
      {allRates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Historial</h2>
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
          <div className={`space-y-2 ${showFullHistory ? "max-h-[500px] overflow-y-auto" : ""}`}>
            {allRates.slice(0, showFullHistory ? 50 : 10).map((rate) => {
              const colors = sourceColors[rate.source] || sourceColors.DOF;
              const isToday = new Date(rate.date).toDateString() === new Date().toDateString();
              return (
                <Card key={rate.id} className={`${colors.bg} ${colors.border} ${isToday ? "ring-2 ring-primary/20" : ""}`}>
                  <CardContent className="p-2 px-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge className={colors.text} variant="outline" style={{ fontSize: "10px", padding: "2px 6px" }}>
                          {rate.source}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(rate.date), "dd MMM HH:mm", { locale: es })}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <span className="font-mono">${(rate.buy_rate ?? 0).toFixed(4)}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-mono">${(rate.sell_rate ?? 0).toFixed(4)}</span>
                      </div>
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
