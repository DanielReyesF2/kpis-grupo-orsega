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
  Truck,
  Package,
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

interface Shipment {
  id: number;
  trackingCode: string;
  customerName: string;
  product: string;
  origin: string;
  destination: string;
  status: string;
  departureDate?: string | null;
  estimatedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  companyId?: number | null;
  carrier?: string | null;
  guideNumber?: string | null;
}

interface CalendarEntry {
  shipment: Shipment;
  type: "departure" | "delivery";
}

interface ShipmentCalendarProps {
  shipments: Shipment[];
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Por embarcar", color: "text-blue-600" },
  in_transit: { label: "En tránsito", color: "text-amber-600" },
  delayed: { label: "Retrasado", color: "text-red-600" },
  delivered: { label: "Entregado", color: "text-emerald-600" },
  cancelled: { label: "Cancelado", color: "text-slate-400" },
};

function getDateStatus(
  date: Date,
  entries: CalendarEntry[]
): "overdue" | "today" | "upcoming" | "completed" | "none" {
  if (entries.length === 0) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const allDone = entries.every(
    (e) => e.shipment.status === "delivered" || e.shipment.status === "cancelled"
  );
  if (allDone) return "completed";

  const hasActive = entries.some(
    (e) => e.shipment.status !== "delivered" && e.shipment.status !== "cancelled"
  );
  if (!hasActive) return "none";

  if (isBefore(checkDate, today)) return "overdue";
  if (isSameDay(checkDate, today)) return "today";
  return "upcoming";
}

export function ShipmentCalendar({ shipments, className }: ShipmentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<{
    date: Date;
    entries: CalendarEntry[];
  } | null>(null);

  // Agrupar embarques por fecha (salida + entrega)
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, CalendarEntry[]> = {};

    const addEntry = (dateStr: string | null | undefined, shipment: Shipment, type: "departure" | "delivery") => {
      if (!dateStr) return;
      const dateKey = format(new Date(dateStr), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({ shipment, type });
    };

    shipments.forEach((shipment) => {
      if (shipment.status === "cancelled") return;
      addEntry(shipment.departureDate, shipment, "departure");
      // Mostrar entrega estimada solo si no ha sido entregado, o la fecha real si sí
      if (shipment.status === "delivered" && shipment.actualDeliveryDate) {
        addEntry(shipment.actualDeliveryDate, shipment, "delivery");
      } else if (shipment.estimatedDeliveryDate) {
        addEntry(shipment.estimatedDeliveryDate, shipment, "delivery");
      }
    });

    return grouped;
  }, [shipments]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

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

  const getEntriesForDate = (date: Date): CalendarEntry[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return entriesByDate[dateKey] || [];
  };

  // Stats del mes
  const monthStats = useMemo(() => {
    let departures = 0;
    let deliveries = 0;
    daysInMonth.forEach((day) => {
      const entries = getEntriesForDate(day);
      entries.forEach((e) => {
        if (e.type === "departure") departures++;
        if (e.type === "delivery") deliveries++;
      });
    });
    return { departures, deliveries };
  }, [daysInMonth, entriesByDate]);

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <>
      <Card className={cn("bg-white border border-slate-200", className)}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-slate-500" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: es })}
                </h3>
                <p className="text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3 w-3" /> {monthStats.departures} salidas
                  </span>
                  {" · "}
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3 w-3" /> {monthStats.deliveries} entregas
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
              <div key={day} className="text-center text-[11px] font-semibold text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Grilla */}
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const entries = getEntriesForDate(day);
              const status = getDateStatus(day, entries);
              const isToday = isDateToday(day);
              const departures = entries.filter((e) => e.type === "departure");
              const deliveries = entries.filter((e) => e.type === "delivery");

              return (
                <button
                  key={`${day.toISOString()}-${index}`}
                  onClick={() => entries.length > 0 && setSelectedDate({ date: day, entries })}
                  disabled={entries.length === 0}
                  className={cn(
                    "relative rounded-lg border border-transparent transition-all text-left p-1.5",
                    "min-h-[72px] flex flex-col",
                    !isCurrentMonth && "opacity-25",
                    isToday && "ring-2 ring-blue-400",
                    status === "overdue" && "bg-red-50 border-red-200 hover:border-red-300",
                    status === "today" && "bg-blue-50 border-blue-200 hover:border-blue-300",
                    status === "upcoming" && "bg-amber-50 border-amber-200 hover:border-amber-300",
                    status === "completed" && "bg-emerald-50 border-emerald-200",
                    entries.length > 0 && "cursor-pointer hover:shadow-sm",
                    entries.length === 0 && "cursor-default hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium mb-0.5",
                    isToday && "text-blue-600 font-bold",
                    !isCurrentMonth && "text-slate-300"
                  )}>
                    {format(day, "d")}
                  </div>

                  {entries.length > 0 && (
                    <div className="flex-1 flex flex-col justify-between min-w-0 gap-0.5">
                      {/* Indicadores de salida/entrega */}
                      {departures.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Truck className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                          <span className="text-[10px] text-slate-600 truncate">
                            {departures[0].shipment.customerName}
                          </span>
                        </div>
                      )}
                      {deliveries.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Package className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                          <span className="text-[10px] text-slate-600 truncate">
                            {deliveries[0].shipment.customerName}
                          </span>
                        </div>
                      )}

                      {/* Badge si hay más de 2 */}
                      {entries.length > 2 && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-medium w-fit">
                          +{entries.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}

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
              <Truck className="h-3 w-3 text-blue-500" />
              <span>Salida</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="h-3 w-3 text-emerald-500" />
              <span>Entrega</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" />
              <span>Atrasado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" />
              <span>Hoy</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog detalle del día */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-slate-500" />
              Embarques del{" "}
              {selectedDate && format(selectedDate.date, "d 'de' MMMM, yyyy", { locale: es })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedDate?.entries.map((entry, idx) => {
              const s = entry.shipment;
              const statusInfo = STATUS_CONFIG[s.status] || { label: s.status, color: "text-slate-500" };

              return (
                <div
                  key={`${s.id}-${entry.type}-${idx}`}
                  className={cn(
                    "p-3 rounded-lg border text-sm",
                    entry.type === "departure" ? "bg-blue-50 border-blue-100" : "bg-emerald-50 border-emerald-100"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {entry.type === "departure" ? (
                        <Truck className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Package className="h-4 w-4 text-emerald-500" />
                      )}
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {s.trackingCode}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", statusInfo.color)}
                      >
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {entry.type === "departure" ? "Salida" : "Entrega"}
                    </Badge>
                  </div>

                  <p className="font-semibold text-slate-900 truncate">{s.customerName}</p>

                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p>{s.origin} → {s.destination}</p>
                    <p>{s.product}</p>
                    {s.carrier && <p>Transportista: {s.carrier}</p>}
                    {s.guideNumber && (
                      <p>
                        Guía:{" "}
                        <span className="font-mono font-medium bg-amber-50 px-1 rounded border border-amber-200 text-amber-800">
                          {s.guideNumber}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDate && (
            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
              <span>
                {selectedDate.entries.filter((e) => e.type === "departure").length} salida(s),{" "}
                {selectedDate.entries.filter((e) => e.type === "delivery").length} entrega(s)
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
