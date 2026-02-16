import { formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Clock,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAlerts,
  useAcknowledgeAlert,
  useDismissAlert,
  useGenerateAlerts,
} from "@/hooks/useComercial";

interface AlertsDropdownProps {
  children: React.ReactNode;
}

const alertIcons: Record<string, React.ReactNode> = {
  overdue_follow_up: <Clock className="h-4 w-4" />,
  stale_prospect: <AlertTriangle className="h-4 w-4" />,
  high_value_at_risk: <TrendingDown className="h-4 w-4" />,
  scheduled_reminder: <Calendar className="h-4 w-4" />,
};

const alertColors: Record<string, string> = {
  overdue_follow_up: "bg-orange-100 text-orange-600",
  stale_prospect: "bg-yellow-100 text-yellow-600",
  high_value_at_risk: "bg-red-100 text-red-600",
  scheduled_reminder: "bg-blue-100 text-blue-600",
};

const priorityColors: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-orange-500",
  media: "bg-blue-500",
  baja: "bg-gray-400",
};

export function AlertsDropdown({ children }: AlertsDropdownProps) {
  const { toast } = useToast();
  const { data: alerts = [], isLoading, refetch } = useAlerts("pending");
  const acknowledgeAlert = useAcknowledgeAlert();
  const dismissAlert = useDismissAlert();
  const generateAlerts = useGenerateAlerts();

  const handleAcknowledge = async (id: number) => {
    try {
      await acknowledgeAlert.mutateAsync(id);
      toast({ title: "Alerta reconocida" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo reconocer la alerta",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await dismissAlert.mutateAsync(id);
      toast({ title: "Alerta descartada" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descartar la alerta",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateAlerts.mutateAsync();
      toast({
        title: "Alertas actualizadas",
        description: `Se generaron ${result.generated} nuevas alertas`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron generar alertas",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-medium">Alertas</span>
            {alerts.length > 0 && (
              <Badge variant="secondary">{alerts.length}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleGenerate}
            disabled={generateAlerts.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 ${generateAlerts.isPending ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay alertas pendientes</p>
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Priority indicator */}
                    <div
                      className={`w-1 h-full min-h-[60px] rounded-full ${
                        priorityColors[alert.priority || "media"]
                      }`}
                    />

                    {/* Icon */}
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        alertColors[alert.alertType || "overdue_follow_up"]
                      }`}
                    >
                      {alertIcons[alert.alertType || "overdue_follow_up"]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{alert.title}</p>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {alert.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {alert.createdAt &&
                            formatDistance(new Date(alert.createdAt), new Date(), {
                              addSuffix: true,
                              locale: es,
                            })}
                        </span>
                        {alert.dueDate && (
                          <Badge variant="outline" className="text-xs py-0">
                            Vence{" "}
                            {formatDistance(new Date(alert.dueDate), new Date(), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledgeAlert.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDismiss(alert.id)}
                        disabled={dismissAlert.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {alerts.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button variant="ghost" className="w-full text-sm" size="sm">
                Ver todas las alertas
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
