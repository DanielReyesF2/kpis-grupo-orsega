import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  isToday as isDateToday,
  isBefore,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ScheduledPayment {
  id: number;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  paymentDate?: string | null;
  status: string;
  reference?: string | null;
}

interface PaymentCalendarProps {
  payments: ScheduledPayment[];
  className?: string;
}

const PENDING_STATUSES = [
  "idrall_imported",
  "pending_approval",
  "approved",
  "payment_scheduled",
  "payment_pending",
  "pago_programado",
  "pending",
];

const CLOSED_STATUSES = [
  "payment_completed",
  "closed",
  "cierre_contable",
  "complemento_recibido",
];

function getDateStatus(
  date: Date,
  payments: ScheduledPayment[]
): "overdue" | "today" | "upcoming" | "paid" | "none" {
  if (payments.length === 0) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const allClosed = payments.every((p) => CLOSED_STATUSES.includes(p.status));
  if (allClosed) return "paid";

  const hasPending = payments.some((p) => PENDING_STATUSES.includes(p.status));
  if (!hasPending) return "none";

  if (isBefore(checkDate, today)) return "overdue";
  if (isSameDay(checkDate, today)) return "today";
  return "upcoming";
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return `$${amount.toLocaleString()}`;
}

export function PaymentCalendar({
  payments,
  className,
}: PaymentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<{
    date: Date;
    payments: ScheduledPayment[];
  } | null>(null);

  const paymentsByDate = useMemo(() => {
    const grouped: Record<string, ScheduledPayment[]> = {};
    payments.forEach((payment) => {
      const dateStr = payment.paymentDate || payment.dueDate;
      if (!dateStr) return;
      const dateKey = format(new Date(dateStr), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(payment);
    });
    return grouped;
  }, [payments]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Padding para completar semanas (lunes = inicio)
  const firstDayOfWeek = monthStart.getDay();
  const daysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const lastDayOfWeek = monthEnd.getDay();
  const daysAfter = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

  const previousMonthDays = Array.from({ length: daysBefore }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - daysBefore + i);
    return date;
  });

  const nextMonthDays = Array.from({ length: daysAfter }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + i + 1);
    return date;
  });

  const allDays = [...previousMonthDays, ...daysInMonth, ...nextMonthDays];

  const getPaymentsForDate = (date: Date): ScheduledPayment[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return paymentsByDate[dateKey] || [];
  };

  // Total del mes visible (solo pagos pendientes)
  const monthTotal = useMemo(() => {
    let total = 0;
    daysInMonth.forEach((day) => {
      const dayPayments = getPaymentsForDate(day);
      dayPayments.forEach((p) => {
        if (PENDING_STATUSES.includes(p.status)) {
          total += p.amount || 0;
        }
      });
    });
    return total;
  }, [daysInMonth, paymentsByDate]);

  const pendingCount = useMemo(() => {
    let count = 0;
    daysInMonth.forEach((day) => {
      const dayPayments = getPaymentsForDate(day);
      dayPayments.forEach((p) => {
        if (PENDING_STATUSES.includes(p.status)) count++;
      });
    });
    return count;
  }, [daysInMonth, paymentsByDate]);

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <>
      <Card className={cn("bg-white border border-slate-200", className)}>
        <CardContent className="p-4">
          {/* Header: navegación + resumen del mes */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-slate-500" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: es })}
                </h3>
                <p className="text-xs text-slate-500">
                  {pendingCount} pagos pendientes · Total:{" "}
                  <span className="font-semibold text-emerald-600">
                    ${monthTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setCurrentMonth(new Date())}>
                Hoy
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-semibold text-slate-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grilla de días */}
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const dayPayments = getPaymentsForDate(day);
              const total = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
              const status = getDateStatus(day, dayPayments);
              const isToday = isDateToday(day);
              const pendingPayments = dayPayments.filter((p) =>
                PENDING_STATUSES.includes(p.status)
              );

              return (
                <button
                  key={`${day.toISOString()}-${index}`}
                  onClick={() =>
                    dayPayments.length > 0 &&
                    setSelectedDate({ date: day, payments: dayPayments })
                  }
                  disabled={dayPayments.length === 0}
                  className={cn(
                    "relative rounded-lg border border-transparent transition-all text-left p-1.5",
                    "min-h-[72px] flex flex-col",
                    !isCurrentMonth && "opacity-25",
                    isToday && "ring-2 ring-blue-400",
                    status === "overdue" &&
                      "bg-red-50 border-red-200 hover:border-red-300",
                    status === "today" &&
                      "bg-blue-50 border-blue-200 hover:border-blue-300",
                    status === "upcoming" &&
                      "bg-amber-50 border-amber-200 hover:border-amber-300",
                    status === "paid" &&
                      "bg-emerald-50 border-emerald-200",
                    dayPayments.length > 0 &&
                      "cursor-pointer hover:shadow-sm",
                    dayPayments.length === 0 && "cursor-default hover:bg-slate-50"
                  )}
                >
                  {/* Número del día */}
                  <div
                    className={cn(
                      "text-xs font-medium mb-0.5",
                      isToday && "text-blue-600 font-bold",
                      !isCurrentMonth && "text-slate-300"
                    )}
                  >
                    {format(day, "d")}
                  </div>

                  {/* Contenido del día */}
                  {dayPayments.length > 0 && (
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      {/* Primer proveedor (truncado) */}
                      <p className="text-[10px] text-slate-600 truncate leading-tight">
                        {pendingPayments[0]?.supplierName ||
                          dayPayments[0]?.supplierName ||
                          "—"}
                      </p>

                      {/* Monto + badge */}
                      <div className="flex items-center justify-between mt-auto gap-0.5">
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            status === "overdue" && "text-red-600",
                            status === "today" && "text-blue-600",
                            status === "upcoming" && "text-amber-700",
                            status === "paid" && "text-emerald-600"
                          )}
                        >
                          {formatAmount(total)}
                        </span>
                        {dayPayments.length > 1 && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 h-3.5 font-medium"
                          >
                            +{dayPayments.length - 1}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Indicador de vencido */}
                  {status === "overdue" && (
                    <AlertTriangle className="absolute top-1 right-1 h-2.5 w-2.5 text-red-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" />
              <span>Vencidos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" />
              <span>Hoy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200" />
              <span>Próximos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" />
              <span>Pagados</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog detalle del día */}
      <Dialog
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-slate-500" />
              Pagos del{" "}
              {selectedDate &&
                format(selectedDate.date, "d 'de' MMMM, yyyy", { locale: es })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedDate?.payments.map((payment) => {
              const isPending = PENDING_STATUSES.includes(payment.status);
              const isClosed = CLOSED_STATUSES.includes(payment.status);

              return (
                <div
                  key={payment.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border text-sm",
                    isPending && "bg-amber-50 border-amber-100",
                    isClosed && "bg-emerald-50 border-emerald-100",
                    !isPending && !isClosed && "bg-orange-50 border-orange-100"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {payment.supplierName || "Sin proveedor"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {payment.reference || "Sin referencia"} ·{" "}
                      {payment.currency || "MXN"}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="font-bold text-slate-800">
                      ${(payment.amount || 0).toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <Badge
                      variant={isPending ? "outline" : isClosed ? "default" : "secondary"}
                      className={cn(
                        "text-[10px]",
                        isClosed && "bg-emerald-600"
                      )}
                    >
                      {isPending
                        ? "Pendiente"
                        : isClosed
                        ? "Pagado"
                        : "Esperando REP"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDate && (
            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm text-slate-500">
                {selectedDate.payments.length} pago
                {selectedDate.payments.length !== 1 ? "s" : ""}
              </span>
              <span className="text-sm font-bold text-slate-800">
                Total: $
                {selectedDate.payments
                  .reduce((sum, p) => sum + (p.amount || 0), 0)
                  .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
