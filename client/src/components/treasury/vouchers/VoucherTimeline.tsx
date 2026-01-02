import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, CheckCircle, AlertTriangle, FileText, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TimelineEvent {
  id: string;
  type: "created" | "status_changed" | "updated" | "document_uploaded";
  timestamp: string;
  user?: string;
  description: string;
  metadata?: Record<string, any>;
}

interface VoucherTimelineProps {
  events: TimelineEvent[];
  voucherId: number;
}

export function VoucherTimeline({ events, voucherId }: VoucherTimelineProps) {
  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return FileText;
      case "status_changed":
        return CheckCircle;
      case "updated":
        return AlertTriangle;
      case "document_uploaded":
        return FileText;
      default:
        return Clock;
    }
  };

  const getEventColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return "bg-blue-500";
      case "status_changed":
        return "bg-green-500";
      case "updated":
        return "bg-yellow-500";
      case "document_uploaded":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay eventos registrados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Historial de Eventos</h3>
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

        {/* Eventos */}
        <div className="space-y-6">
          {events.map((event, index) => {
            const Icon = getEventIcon(event.type);
            const color = getEventColor(event.type);

            return (
              <div key={event.id} className="relative flex gap-4">
                {/* Icono */}
                <div
                  className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${color} text-white`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Contenido */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                        {event.description}
                      </p>
                      {event.user && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <User className="h-3 w-3" />
                          <span>{event.user}</span>
                        </div>
                      )}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 rounded text-xs">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                {key}:
                              </span>
                              <span className="text-slate-900 dark:text-slate-50">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(event.timestamp), "dd MMM yyyy, HH:mm", {
                        locale: es,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

