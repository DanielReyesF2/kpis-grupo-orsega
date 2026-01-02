import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
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

interface PaymentCalendarProps {
  payments: Payment[];
  onDateClick?: (date: Date, payments: Payment[]) => void;
  className?: string;
}

export function PaymentCalendar({
  payments,
  onDateClick,
  className,
}: PaymentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Agrupar pagos por fecha
  const paymentsByDate = useMemo(() => {
    const grouped: Record<string, Payment[]> = {};
    
    payments.forEach((payment) => {
      const date = new Date(payment.dueDate || payment.paymentDate || new Date());
      const dateKey = format(date, "yyyy-MM-dd");
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(payment);
    });

    return grouped;
  }, [payments]);

  // Generar días del mes
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Agregar días del mes anterior/siguiente para completar la semana
  const firstDayOfWeek = monthStart.getDay();
  const lastDayOfWeek = monthEnd.getDay();
  const daysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
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

  const getPaymentsForDate = (date: Date): Payment[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return paymentsByDate[dateKey] || [];
  };

  const getTotalForDate = (date: Date): number => {
    const datePayments = getPaymentsForDate(date);
    return datePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  const getStatusForDate = (date: Date): "overdue" | "today" | "upcoming" | "none" => {
    const datePayments = getPaymentsForDate(date);
    if (datePayments.length === 0) return "none";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate < today) {
      const hasUnpaid = datePayments.some((p) => p.status !== "paid" && p.status !== "cancelled");
      return hasUnpaid ? "overdue" : "none";
    }
    if (isSameDay(date, new Date())) return "today";
    return "upcoming";
  };

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendario de Pagos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const dayPayments = getPaymentsForDate(day);
            const total = getTotalForDate(day);
            const status = getStatusForDate(day);
            const isToday = isSameDay(day, new Date());

            return (
              <motion.button
                key={`${day.toISOString()}-${index}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => dayPayments.length > 0 && onDateClick?.(day, dayPayments)}
                disabled={dayPayments.length === 0}
                className={cn(
                  "relative p-2 rounded-lg border transition-all text-left min-h-[60px]",
                  !isCurrentMonth && "opacity-30",
                  isToday && "ring-2 ring-primary",
                  status === "overdue" && "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800",
                  status === "today" && "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800",
                  status === "upcoming" && dayPayments.length > 0 && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800",
                  dayPayments.length > 0 && "cursor-pointer hover:shadow-md",
                  dayPayments.length === 0 && "cursor-default"
                )}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, "d")}
                </div>
                {dayPayments.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] font-semibold">
                        ${(total / 1000).toFixed(total >= 1000 ? 0 : 1)}k
                      </span>
                    </div>
                    <Badge
                      variant={status === "overdue" ? "destructive" : "secondary"}
                      className="text-[9px] px-1 py-0 h-4"
                    >
                      {dayPayments.length}
                    </Badge>
                  </div>
                )}
                {status === "overdue" && (
                  <AlertTriangle className="absolute top-1 right-1 h-3 w-3 text-red-500" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-4 pt-4 border-t flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/20 border border-red-300 dark:border-red-800" />
            <span>Vencidos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800" />
            <span>Hoy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-800" />
            <span>Próximos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

