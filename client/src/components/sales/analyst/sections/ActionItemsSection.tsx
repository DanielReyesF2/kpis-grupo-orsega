/**
 * Sección de Action Items
 * Lista de acciones prioritarias con tracking de progreso
 */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Circle, Clock, Square, CheckSquare, RotateCcw } from "lucide-react";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

interface ActionItemsSectionProps {
  insights: SalesAnalystInsights;
}

const STORAGE_KEY = 'sales_action_items_completed';

export function ActionItemsSection({ insights }: ActionItemsSectionProps) {
  const actionItems = insights.actionItems;
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  // Cargar estado desde localStorage al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCompletedItems(new Set(parsed));
      }
    } catch (e) {
      console.error('Error loading completed items:', e);
    }
  }, []);

  // Guardar estado en localStorage cuando cambie
  const saveCompleted = useCallback((items: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...items]));
    } catch (e) {
      console.error('Error saving completed items:', e);
    }
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      saveCompleted(newSet);
      return newSet;
    });
  }, [saveCompleted]);

  const resetAll = useCallback(() => {
    setCompletedItems(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'critical':
        return {
          color: 'text-red-600',
          bg: 'bg-red-50',
          bgCompleted: 'bg-red-50/30',
          border: 'border-red-200',
          label: 'Crítica',
          checkColor: 'text-red-500'
        };
      case 'high':
        return {
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          bgCompleted: 'bg-amber-50/30',
          border: 'border-amber-200',
          label: 'Alta',
          checkColor: 'text-amber-500'
        };
      case 'medium':
        return {
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          bgCompleted: 'bg-blue-50/30',
          border: 'border-blue-200',
          label: 'Media',
          checkColor: 'text-blue-500'
        };
      case 'low':
        return {
          color: 'text-gray-600',
          bg: 'bg-gray-50',
          bgCompleted: 'bg-gray-50/30',
          border: 'border-gray-200',
          label: 'Baja',
          checkColor: 'text-gray-500'
        };
      default:
        return {
          color: 'text-slate-500',
          bg: 'bg-slate-50',
          bgCompleted: 'bg-slate-50/30',
          border: 'border-slate-200',
          label: priority,
          checkColor: 'text-slate-500'
        };
    }
  };

  const sortedItems = [...actionItems].sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    // Mostrar no completados primero
    const aCompleted = completedItems.has(a.id) ? 1 : 0;
    const bCompleted = completedItems.has(b.id) ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
  });

  const completedCount = actionItems.filter(item => completedItems.has(item.id)).length;
  const totalCount = actionItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <ChartCard
      title="Acciones Prioritarias"
      subtitle={`${completedCount}/${totalCount} completadas`}
      headerActions={
        completedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reiniciar
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Barra de progreso */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progreso</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                progressPercent === 100 ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-xs text-emerald-600 font-medium text-center">
              ¡Todas las acciones completadas!
            </p>
          )}
        </div>

        {/* Lista de acciones */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {sortedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay acciones pendientes</p>
            </div>
          ) : (
            sortedItems.map((item) => {
              const priorityConfig = getPriorityConfig(item.priority);
              const isCompleted = completedItems.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all cursor-pointer group",
                    "hover:shadow-md active:scale-[0.99]",
                    priorityConfig.border,
                    isCompleted ? priorityConfig.bgCompleted : priorityConfig.bg,
                    isCompleted && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className={cn(
                      "flex-shrink-0 mt-0.5 transition-colors",
                      isCompleted ? "text-emerald-500" : priorityConfig.checkColor,
                      "group-hover:scale-110"
                    )}>
                      {isCompleted ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className={cn(
                          "font-semibold text-sm",
                          isCompleted && "line-through text-slate-400"
                        )}>
                          {item.title}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", priorityConfig.color, priorityConfig.border)}
                        >
                          {priorityConfig.label}
                        </Badge>
                      </div>
                      <p className={cn(
                        "text-sm text-slate-600 mb-2",
                        isCompleted && "line-through text-slate-400"
                      )}>
                        {item.description}
                      </p>
                      {item.dueDate && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>Vence: {new Date(item.dueDate).toLocaleDateString('es-MX')}</span>
                        </div>
                      )}
                    </div>

                    {/* Indicador de completado */}
                    {isCompleted && (
                      <div className="flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </ChartCard>
  );
}
