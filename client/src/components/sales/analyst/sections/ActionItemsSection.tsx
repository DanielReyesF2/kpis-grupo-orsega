/**
 * Sección de Action Items
 * Lista de acciones prioritarias para el jefe de ventas
 */

import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

interface ActionItemsSectionProps {
  insights: SalesAnalystInsights;
}

export function ActionItemsSection({ insights }: ActionItemsSectionProps) {
  const actionItems = insights.actionItems;

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'critical':
        return {
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200',
          label: 'Crítica'
        };
      case 'high':
        return {
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          label: 'Alta'
        };
      case 'medium':
        return {
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          label: 'Media'
        };
      case 'low':
        return {
          color: 'text-gray-600',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          label: 'Baja'
        };
      default:
        return {
          color: 'text-slate-500',
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          label: priority
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle2;
      case 'in-progress':
        return Clock;
      default:
        return Circle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600';
      case 'in-progress':
        return 'text-blue-600';
      default:
        return 'text-slate-400';
    }
  };

  const sortedItems = [...actionItems].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <ChartCard
      title="Acciones Prioritarias"
      subtitle={`${actionItems.length} acciones pendientes`}
    >
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay acciones pendientes</p>
          </div>
        ) : (
          sortedItems.map((item) => {
            const priorityConfig = getPriorityConfig(item.priority);
            const StatusIcon = getStatusIcon(item.status);
            const statusColor = getStatusColor(item.status);

            return (
              <div
                key={item.id}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                  priorityConfig.border,
                  priorityConfig.bg
                )}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", statusColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{item.title}</h4>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", priorityConfig.color, priorityConfig.border)}
                      >
                        {priorityConfig.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.status === 'completed' ? 'Completado' :
                         item.status === 'in-progress' ? 'En progreso' :
                         'Pendiente'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {item.dueDate && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Vence: {new Date(item.dueDate).toLocaleDateString('es-MX')}</span>
                        </div>
                      )}
                      {item.assignedTo && (
                        <div className="flex items-center gap-1">
                          <span>Asignado a: {item.assignedTo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ChartCard>
  );
}

