/**
 * Sección de Insights Estratégicos
 * Panel tipo documento con recomendaciones escritas
 */

import { useMemo } from "react";
import { Lightbulb, Target, TrendingUp, AlertTriangle, Users, Package } from "lucide-react";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/sales-utils";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

interface StrategicInsightsSectionProps {
  insights: SalesAnalystInsights;
  companyId: number;
}

export function StrategicInsightsSection({ insights, companyId }: StrategicInsightsSectionProps) {
  const recommendations = insights.strategicRecommendations;

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'client': return Users;
      case 'product': return Package;
      case 'strategy': return Target;
      case 'risk': return AlertTriangle;
      default: return Lightbulb;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getImpactEffortColor = (value: string) => {
    switch (value) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'low': return 'text-emerald-600 dark:text-emerald-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <ChartCard
      title="Insights Estratégicos"
      subtitle="Recomendaciones basadas en análisis de datos"
    >
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay recomendaciones disponibles</p>
          </div>
        ) : (
          recommendations.map((rec) => {
            const Icon = getRecommendationIcon(rec.type);
            return (
              <div
                key={rec.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{rec.title}</h4>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getPriorityColor(rec.priority))}
                      >
                        {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Baja'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>

                    <div className="flex flex-wrap gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Impacto:</span>
                        <span className={cn("font-medium", getImpactEffortColor(rec.impact))}>
                          {rec.impact === 'high' ? 'Alto' : rec.impact === 'medium' ? 'Medio' : 'Bajo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Esfuerzo:</span>
                        <span className={cn("font-medium", getImpactEffortColor(rec.effort))}>
                          {rec.effort === 'high' ? 'Alto' : rec.effort === 'medium' ? 'Medio' : 'Bajo'}
                        </span>
                      </div>
                      {rec.estimatedValue && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Valor estimado:</span>
                          <span className="font-medium text-emerald-600">
                            {formatCurrency(rec.estimatedValue, companyId)}
                          </span>
                        </div>
                      )}
                    </div>

                    {(rec.relatedEntities.clients?.length || rec.relatedEntities.products?.length) && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        {rec.relatedEntities.clients && rec.relatedEntities.clients.length > 0 && (
                          <div className="mb-2">
                            <span className="text-xs text-muted-foreground">Clientes relacionados: </span>
                            <span className="text-xs font-medium">
                              {rec.relatedEntities.clients.join(', ')}
                            </span>
                          </div>
                        )}
                        {rec.relatedEntities.products && rec.relatedEntities.products.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Productos relacionados: </span>
                            <span className="text-xs font-medium">
                              {rec.relatedEntities.products.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
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

