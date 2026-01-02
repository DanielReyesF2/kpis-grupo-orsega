import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  Zap,
  Settings,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReconciliationSettings {
  enabled: boolean;
  autoMatch: boolean;
  matchThreshold: number; // 0-1, confianza mínima para matching automático
  reconcileDaily: boolean;
  reconcileTime: string; // HH:mm
}

interface ReconciliationMatch {
  id: number;
  paymentId: number;
  voucherId: number;
  confidence: number;
  amount: number;
  date: string;
  supplierName: string;
  status: "pending" | "approved" | "rejected";
}

interface AutoReconciliationProps {
  className?: string;
}

export function AutoReconciliation({ className }: AutoReconciliationProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ReconciliationSettings>({
    enabled: true,
    autoMatch: false,
    matchThreshold: 0.85,
    reconcileDaily: true,
    reconcileTime: "09:00",
  });

  // Obtener configuración actual
  const { data: currentSettings } = useQuery<ReconciliationSettings>({
    queryKey: ["/api/treasury/reconciliation-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/treasury/reconciliation-settings");
      return await response.json();
    },
    staleTime: 30000,
  });

  // Obtener matches pendientes
  const { data: pendingMatches = [], isLoading: isLoadingMatches } = useQuery<ReconciliationMatch[]>({
    queryKey: ["/api/treasury/reconciliation-matches"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/treasury/reconciliation-matches");
      return await response.json();
    },
    enabled: settings.enabled,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Estadísticas de conciliación
  const { data: stats } = useQuery({
    queryKey: ["/api/treasury/reconciliation-stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/treasury/reconciliation-stats");
      return await response.json();
    },
    enabled: settings.enabled,
    refetchInterval: 60000,
  });

  // Ejecutar conciliación manual
  const runReconciliationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/treasury/reconcile");
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/reconciliation-matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/reconciliation-stats"] });
      toast({
        title: "Conciliación completada",
        description: `Se encontraron ${data.matchesFound || 0} coincidencias`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo ejecutar la conciliación",
        variant: "destructive",
      });
    },
  });

  // Aprobar match
  const approveMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const response = await apiRequest("POST", `/api/treasury/reconciliation-matches/${matchId}/approve`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/reconciliation-matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/reconciliation-stats"] });
      toast({
        title: "Match aprobado",
        description: "La conciliación ha sido aprobada",
      });
    },
  });

  // Rechazar match
  const rejectMatchMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const response = await apiRequest("POST", `/api/treasury/reconciliation-matches/${matchId}/reject`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/reconciliation-matches"] });
      toast({
        title: "Match rechazado",
      });
    },
  });

  const handleToggle = (key: keyof ReconciliationSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    // Aquí guardarías la configuración
  };

  const highConfidenceMatches = useMemo(
    () => pendingMatches.filter((m) => m.confidence >= settings.matchThreshold),
    [pendingMatches, settings.matchThreshold]
  );

  const lowConfidenceMatches = useMemo(
    () => pendingMatches.filter((m) => m.confidence < settings.matchThreshold),
    [pendingMatches, settings.matchThreshold]
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Conciliación Automática
            </CardTitle>
            <CardDescription>
              Empareja automáticamente pagos con comprobantes
            </CardDescription>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => handleToggle("enabled", checked)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.enabled ? (
          <>
            {/* Estadísticas */}
            {stats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {stats.totalMatches || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Coincidencias</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.approvedMatches || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Aprobadas</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {pendingMatches.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Pendientes</div>
                </div>
              </div>
            )}

            {/* Configuración */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="auto-match" className="cursor-pointer">
                      Aprobar automáticamente matches de alta confianza
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Aprobar automáticamente coincidencias con confianza ≥ {(settings.matchThreshold * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-match"
                  checked={settings.autoMatch}
                  onCheckedChange={(checked) => handleToggle("autoMatch", checked)}
                />
              </div>

              <div className="p-3 border rounded-lg">
                <Label className="text-sm font-medium mb-2 block">
                  Umbral de confianza: {(settings.matchThreshold * 100).toFixed(0)}%
                </Label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={settings.matchThreshold}
                  onChange={(e) => handleToggle("matchThreshold", parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Ejecutar conciliación manual */}
            <Button
              onClick={() => runReconciliationMutation.mutate()}
              disabled={runReconciliationMutation.isPending}
              className="w-full"
            >
              {runReconciliationMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Ejecutar Conciliación Ahora
                </>
              )}
            </Button>

            {/* Matches de alta confianza */}
            {highConfidenceMatches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">
                    Coincidencias de Alta Confianza ({highConfidenceMatches.length})
                  </Label>
                  {settings.autoMatch && (
                    <Badge variant="default" className="text-xs">
                      Auto-aprobación activa
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {highConfidenceMatches.slice(0, 5).map((match) => (
                    <Card key={match.id} className="border-green-200 dark:border-green-800">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{match.supplierName}</span>
                              <Badge className="bg-green-500 text-white text-xs">
                                {(match.confidence * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${match.amount.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(match.date), "dd MMM", { locale: es })}
                              </span>
                            </div>
                          </div>
                          {!settings.autoMatch && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveMatchMutation.mutate(match.id)}
                                disabled={approveMatchMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectMatchMutation.mutate(match.id)}
                                disabled={rejectMatchMutation.isPending}
                              >
                                <AlertCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Matches de baja confianza */}
            {lowConfidenceMatches.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Requiere Revisión ({lowConfidenceMatches.length})
                </Label>
                <div className="space-y-2">
                  {lowConfidenceMatches.slice(0, 3).map((match) => (
                    <Card key={match.id} className="border-yellow-200 dark:border-yellow-800">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{match.supplierName}</span>
                              <Badge variant="outline" className="text-xs">
                                {(match.confidence * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${match.amount.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(match.date), "dd MMM", { locale: es })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveMatchMutation.mutate(match.id)}
                              disabled={approveMatchMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectMatchMutation.mutate(match.id)}
                              disabled={rejectMatchMutation.isPending}
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {pendingMatches.length === 0 && !isLoadingMatches && (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p className="text-muted-foreground font-medium">
                  No hay coincidencias pendientes
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground font-medium">
              Conciliación automática desactivada
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

