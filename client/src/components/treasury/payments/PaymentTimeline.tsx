import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  X,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
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
  companyId: number;
}

interface PaymentTimelineProps {
  payments: Payment[];
  onPaymentClick?: (payment: Payment) => void;
  className?: string;
}

export function PaymentTimeline({
  payments,
  onPaymentClick,
  className,
}: PaymentTimelineProps) {
  // Agrupar pagos por fecha
  const groupedPayments = useMemo(() => {
    const groups: Record<string, Payment[]> = {};

    payments.forEach((payment) => {
      const date = new Date(payment.dueDate || payment.paymentDate || new Date());
      const dateKey = format(date, "yyyy-MM-dd");
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(payment);
    });

    // Ordenar por fecha
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [payments]);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    if (isPast(date)) {
      const daysPast = differenceInDays(new Date(), date);
      if (daysPast === 1) return "Ayer";
      if (daysPast <= 7) return `Hace ${daysPast} días`;
      return format(date, "dd MMM yyyy", { locale: es });
    }
    const daysFuture = differenceInDays(date, new Date());
    if (daysFuture <= 7) return `En ${daysFuture} día${daysFuture > 1 ? "s" : ""}`;
    return format(date, "dd MMM yyyy", { locale: es });
  };

  const getStatusBadge = (payment: Payment) => {
    switch (payment.status) {
      case "paid":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="h-3 w-3 mr-1" />
            Pagado
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Vencido
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <X className="h-3 w-3 mr-1" />
            Cancelado
          </Badge>
        );
      default:
        const dueDate = new Date(payment.dueDate);
        const daysUntilDue = differenceInDays(dueDate, new Date());
        if (daysUntilDue <= 3 && daysUntilDue >= 0) {
          return (
            <Badge className="bg-yellow-500 text-white">
              <Clock className="h-3 w-3 mr-1" />
              Próximo
            </Badge>
          );
        }
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
    }
  };

  const getTotalForDate = (datePayments: Payment[]) => {
    return datePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Timeline de Pagos
        </h3>
        <Badge variant="outline">{payments.length} pagos</Badge>
      </div>

      {groupedPayments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No hay pagos programados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Línea vertical */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-8">
            {groupedPayments.map(([dateKey, datePayments], groupIndex) => {
              const date = new Date(dateKey);
              const total = getTotalForDate(datePayments);
              const isPastDate = isPast(date) && !isToday(date);

              return (
                <motion.div
                  key={dateKey}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: groupIndex * 0.1 }}
                  className="relative flex gap-6"
                >
                  {/* Fecha marker */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center border-4 border-background shadow-lg",
                        isToday(date)
                          ? "bg-primary text-primary-foreground"
                          : isPastDate
                          ? "bg-slate-400 dark:bg-slate-600 text-white"
                          : "bg-blue-500 text-white"
                      )}
                    >
                      <div className="text-center">
                        <div className="text-xs font-bold leading-tight">
                          {format(date, "dd", { locale: es })}
                        </div>
                        <div className="text-[10px] leading-tight">
                          {format(date, "MMM", { locale: es })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">
                          {getDateLabel(dateKey)}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {format(date, "EEEE, dd 'de' MMMM", { locale: es })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {datePayments[0]?.currency || "MXN"} $
                          {total.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {datePayments.length} pago{datePayments.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {datePayments.map((payment) => (
                        <motion.div
                          key={payment.id}
                          whileHover={{ scale: 1.01 }}
                          className="cursor-pointer"
                          onClick={() => onPaymentClick?.(payment)}
                        >
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-semibold truncate">
                                      {payment.supplierName}
                                    </h5>
                                    {getStatusBadge(payment)}
                                  </div>
                                  {payment.invoiceNumber && (
                                    <p className="text-sm text-muted-foreground">
                                      Factura: {payment.invoiceNumber}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <div className="text-right">
                                    <p className="font-bold text-lg">
                                      {payment.currency} $
                                      {payment.amount.toLocaleString("es-MX", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </p>
                                    {payment.dueDate && (
                                      <p className="text-xs text-muted-foreground">
                                        Vence: {format(new Date(payment.dueDate), "dd MMM", { locale: es })}
                                      </p>
                                    )}
                                  </div>
                                  {onPaymentClick && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex-shrink-0"
                                    >
                                      <ArrowRight className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

