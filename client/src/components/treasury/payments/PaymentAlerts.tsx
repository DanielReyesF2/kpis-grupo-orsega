import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Bell,
  X,
  CheckCircle,
} from "lucide-react";
import { format, differenceInDays, isPast, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Payment {
  id: number;
  supplierName: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentDate?: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  invoiceNumber?: string;
}

interface PaymentAlertsProps {
  payments: Payment[];
  onDismiss?: (paymentId: number) => void;
  onPaymentClick?: (payment: Payment) => void;
  className?: string;
}

interface Alert {
  type: "overdue" | "due-today" | "due-tomorrow" | "due-soon";
  payment: Payment;
  daysUntilDue: number;
  priority: number;
}

export function PaymentAlerts({
  payments,
  onDismiss,
  onPaymentClick,
  className,
}: PaymentAlertsProps) {
  const alerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertsList: Alert[] = [];

    payments.forEach((payment) => {
      if (payment.status === "paid" || payment.status === "cancelled") return;

      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = differenceInDays(dueDate, today);

      let alertType: Alert["type"] | null = null;
      let priority = 0;

      if (isPast(dueDate) && !isToday(dueDate)) {
        alertType = "overdue";
        priority = 1000 + Math.abs(daysUntilDue); // Más días vencidos = mayor prioridad
      } else if (isToday(dueDate)) {
        alertType = "due-today";
        priority = 900;
      } else if (isTomorrow(dueDate)) {
        alertType = "due-tomorrow";
        priority = 800;
      } else if (daysUntilDue <= 7 && daysUntilDue > 0) {
        alertType = "due-soon";
        priority = 700 - daysUntilDue; // Más cerca = mayor prioridad
      }

      if (alertType) {
        alertsList.push({
          type: alertType,
          payment,
          daysUntilDue,
          priority,
        });
      }
    });

    return alertsList.sort((a, b) => b.priority - a.priority);
  }, [payments]);

  const getAlertConfig = (type: Alert["type"]) => {
    switch (type) {
      case "overdue":
        return {
          icon: AlertTriangle,
          title: "Pago Vencido",
          color: "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800",
          iconColor: "text-red-600 dark:text-red-400",
          badge: "destructive" as const,
        };
      case "due-today":
        return {
          icon: Clock,
          title: "Vence Hoy",
          color: "bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800",
          iconColor: "text-orange-600 dark:text-orange-400",
          badge: "default" as const,
        };
      case "due-tomorrow":
        return {
          icon: Bell,
          title: "Vence Mañana",
          color: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800",
          iconColor: "text-yellow-600 dark:text-yellow-400",
          badge: "secondary" as const,
        };
      case "due-soon":
        return {
          icon: Clock,
          title: "Vence Pronto",
          color: "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800",
          iconColor: "text-blue-600 dark:text-blue-400",
          badge: "outline" as const,
        };
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-muted-foreground font-medium">
            No hay alertas de pagos
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Todos los pagos están al día
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-orange-500" />
          Alertas de Pagos
        </h3>
        <Badge variant="destructive">{alerts.length}</Badge>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => {
          const config = getAlertConfig(alert.type);
          const Icon = config.icon;

          return (
            <motion.div
              key={alert.payment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }}
              className="cursor-pointer"
              onClick={() => onPaymentClick?.(alert.payment)}
            >
              <Card className={cn("border-2 transition-all", config.color)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn("p-2 rounded-lg", config.iconColor, "bg-white/50 dark:bg-black/20")}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold truncate">
                            {alert.payment.supplierName}
                          </h4>
                          <Badge variant={config.badge} className="text-xs">
                            {config.title}
                          </Badge>
                        </div>
                        {alert.payment.invoiceNumber && (
                          <p className="text-sm text-muted-foreground mb-1">
                            Factura: {alert.payment.invoiceNumber}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-bold">
                              {alert.payment.currency} $
                              {alert.payment.amount.toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {alert.type === "overdue"
                                ? `Vencido hace ${Math.abs(alert.daysUntilDue)} día${Math.abs(alert.daysUntilDue) > 1 ? "s" : ""}`
                                : alert.type === "due-today"
                                ? "Vence hoy"
                                : alert.type === "due-tomorrow"
                                ? "Vence mañana"
                                : `Vence en ${alert.daysUntilDue} día${alert.daysUntilDue > 1 ? "s" : ""}`}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fecha de vencimiento:{" "}
                          {format(new Date(alert.payment.dueDate), "dd MMM yyyy", {
                            locale: es,
                          })}
                        </p>
                      </div>
                    </div>
                    {onDismiss && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(alert.payment.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

