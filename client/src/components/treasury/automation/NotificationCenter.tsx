import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  X,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Calendar,
  Mail,
  Settings,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: "payment_due" | "payment_overdue" | "reconciliation_match" | "reminder" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: {
    paymentId?: number;
    amount?: number;
    dueDate?: string;
    supplierName?: string;
  };
}

interface NotificationCenterProps {
  className?: string;
  maxNotifications?: number;
}

export function NotificationCenter({
  className,
  maxNotifications = 10,
}: NotificationCenterProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Obtener notificaciones
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications");
      return await response.json();
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Marcar como leída
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("POST", `/api/notifications/${notificationId}/read`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Marcar todas como leídas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/read-all");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notificaciones marcadas como leídas",
      });
    },
  });

  // Eliminar notificación
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("DELETE", `/api/notifications/${notificationId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const sortedNotifications = useMemo(() => {
    return [...notifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, maxNotifications);
  }, [notifications, maxNotifications]);

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "payment_due":
      case "payment_overdue":
        return AlertTriangle;
      case "reconciliation_match":
        return CheckCircle;
      case "reminder":
        return Calendar;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "payment_overdue":
        return "text-red-600 dark:text-red-400";
      case "payment_due":
        return "text-orange-600 dark:text-orange-400";
      case "reconciliation_match":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  return (
    <>
      {/* Botón de notificaciones */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Panel de notificaciones */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="fixed right-4 top-16 w-96 max-h-[600px] z-50"
            >
              <Card className="shadow-xl">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notificaciones
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {unreadCount}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAllAsReadMutation.mutate()}
                          disabled={markAllAsReadMutation.isPending}
                        >
                          Marcar todas
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-8 text-center">
                      <p className="text-muted-foreground">Cargando notificaciones...</p>
                    </div>
                  ) : sortedNotifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium">
                        No hay notificaciones
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {sortedNotifications.map((notification) => {
                        const Icon = getNotificationIcon(notification.type);
                        const iconColor = getNotificationColor(notification.type);

                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer",
                              !notification.read && "bg-blue-50/50 dark:bg-blue-950/20"
                            )}
                            onClick={() => {
                              if (!notification.read) {
                                markAsReadMutation.mutate(notification.id);
                              }
                              if (notification.actionUrl) {
                                window.location.href = notification.actionUrl;
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn("p-2 rounded-lg flex-shrink-0", iconColor, "bg-current/10")}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className={cn("font-semibold text-sm", !notification.read && "font-bold")}>
                                    {notification.title}
                                  </h4>
                                  {!notification.read && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {notification.message}
                                </p>
                                {notification.metadata && (
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {notification.metadata.amount && (
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        ${notification.metadata.amount.toLocaleString()}
                                      </span>
                                    )}
                                    {notification.metadata.dueDate && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(notification.metadata.dueDate), "dd MMM", { locale: es })}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {format(new Date(notification.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotificationMutation.mutate(notification.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

