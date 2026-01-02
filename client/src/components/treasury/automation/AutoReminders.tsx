import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Clock,
  Mail,
  Settings,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReminderSettings {
  enabled: boolean;
  daysBefore: number[];
  sendEmail: boolean;
  sendNotification: boolean;
  recipients: string[];
}

interface AutoRemindersProps {
  className?: string;
}

export function AutoReminders({ className }: AutoRemindersProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: true,
    daysBefore: [7, 3, 1],
    sendEmail: true,
    sendNotification: true,
    recipients: [],
  });

  // Obtener configuración actual
  const { data: currentSettings } = useQuery<ReminderSettings>({
    queryKey: ["/api/treasury/reminder-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/treasury/reminder-settings");
      return await response.json();
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  // Guardar configuración
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: ReminderSettings) => {
      const response = await apiRequest("PUT", "/api/treasury/reminder-settings", newSettings);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/reminder-settings"] });
      toast({
        title: "Configuración guardada",
        description: "Los recordatorios automáticos han sido actualizados",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Obtener próximos recordatorios programados
  const { data: scheduledReminders = [] } = useQuery<any[]>({
    queryKey: ["/api/treasury/scheduled-reminders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/treasury/scheduled-reminders");
      return await response.json();
    },
    enabled: settings.enabled,
    refetchInterval: 60000, // Refrescar cada minuto
  });

  const handleToggle = (key: keyof ReminderSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettingsMutation.mutate(newSettings);
  };

  const addDayBefore = (days: number) => {
    if (!settings.daysBefore.includes(days) && settings.daysBefore.length < 5) {
      const newDays = [...settings.daysBefore, days].sort((a, b) => b - a);
      handleToggle("daysBefore", newDays);
    }
  };

  const removeDayBefore = (days: number) => {
    const newDays = settings.daysBefore.filter((d) => d !== days);
    handleToggle("daysBefore", newDays);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recordatorios Automáticos
            </CardTitle>
            <CardDescription>
              Configura recordatorios automáticos para pagos próximos a vencer
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
            {/* Días antes de vencer */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Recordar días antes de vencer
              </Label>
              <div className="flex flex-wrap gap-2">
                {[14, 7, 5, 3, 2, 1].map((days) => (
                  <Badge
                    key={days}
                    variant={settings.daysBefore.includes(days) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (settings.daysBefore.includes(days)) {
                        removeDayBefore(days);
                      } else {
                        addDayBefore(days);
                      }
                    }}
                  >
                    {days} día{days > 1 ? "s" : ""}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selecciona los días antes del vencimiento para enviar recordatorios
              </p>
            </div>

            {/* Métodos de notificación */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Métodos de notificación</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="email-reminders" className="cursor-pointer">
                        Enviar por correo
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar recordatorios por email a los proveedores
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="email-reminders"
                    checked={settings.sendEmail}
                    onCheckedChange={(checked) => handleToggle("sendEmail", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="push-reminders" className="cursor-pointer">
                        Notificaciones en la app
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Mostrar notificaciones en el dashboard
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="push-reminders"
                    checked={settings.sendNotification}
                    onCheckedChange={(checked) => handleToggle("sendNotification", checked)}
                  />
                </div>
              </div>
            </div>

            {/* Próximos recordatorios */}
            {scheduledReminders.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Próximos recordatorios programados
                </Label>
                <div className="space-y-2">
                  {scheduledReminders.slice(0, 5).map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between p-2 border rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{reminder.supplierName}</span>
                        <span className="text-muted-foreground">
                          - Vence en {reminder.daysUntilDue} día{reminder.daysUntilDue > 1 ? "s" : ""}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {new Date(reminder.scheduledDate).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estado */}
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Recordatorios activos
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Se enviarán {settings.daysBefore.length} recordatorio{settings.daysBefore.length > 1 ? "s" : ""} por pago
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground font-medium">
              Recordatorios automáticos desactivados
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Activa el interruptor para habilitar los recordatorios
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

