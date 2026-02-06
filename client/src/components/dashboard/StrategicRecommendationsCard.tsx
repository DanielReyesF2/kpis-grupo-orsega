/**
 * Strategic Recommendations Card - Recomendaciones de corto y mediano plazo
 * Replica la sección "Recomendaciones Estratégicas" del análisis Nova
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { Lightbulb, AlertCircle, Target, TrendingUp, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategicRecommendationsCardProps {
  companyId: number;
}

const priorityStyles: Record<string, { bg: string; icon: typeof AlertCircle; label: string }> = {
  critical: {
    bg: "border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-950/20",
    icon: AlertCircle,
    label: "Urgente",
  },
  high: {
    bg: "border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-950/20",
    icon: AlertCircle,
    label: "Alta",
  },
  medium: {
    bg: "border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20",
    icon: Target,
    label: "Media",
  },
  low: {
    bg: "border-blue-200 bg-blue-50/50 dark:border-blue-800/50 dark:bg-blue-950/20",
    icon: TrendingUp,
    label: "Baja",
  },
};

export function StrategicRecommendationsCard({ companyId }: StrategicRecommendationsCardProps) {
  const { data: insights, isLoading } = useSalesAnalyst(companyId);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const recommendations = insights?.strategicRecommendations || [];
  const actionItems = insights?.actionItems || [];

  // Split by urgency
  const shortTerm = [
    ...actionItems.filter((a) => a.priority === 'critical' || a.priority === 'high'),
    ...recommendations.filter((r) => r.priority === 'high'),
  ].slice(0, 4);

  const mediumTerm = recommendations
    .filter((r) => r.priority === 'medium' || r.priority === 'low')
    .slice(0, 4);

  const hasContent = shortTerm.length > 0 || mediumTerm.length > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          Recomendaciones Estratégicas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin recomendaciones disponibles
          </p>
        ) : (
          <>
            {/* Short-term */}
            {shortTerm.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Zap className="w-3.5 h-3.5" />
                  Corto Plazo (Inmediato)
                </div>
                <div className="space-y-2">
                  {shortTerm.map((item: any, idx: number) => {
                    const priority = item.priority || 'high';
                    const ps = priorityStyles[priority] || priorityStyles.high;
                    const Icon = ps.icon;
                    return (
                      <div
                        key={item.id || item.title || idx}
                        className={cn("p-3 rounded-lg border", ps.bg)}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold truncate">{item.title}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {ps.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                            {item.relatedEntities && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(item.relatedEntities.clients || []).slice(0, 2).map((c: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                                ))}
                                {(item.relatedEntities.products || []).slice(0, 2).map((p: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Medium-term */}
            {mediumTerm.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Mediano Plazo (1-3 meses)
                </div>
                <div className="space-y-2">
                  {mediumTerm.map((rec: any, idx: number) => {
                    const priority = rec.priority || 'medium';
                    const ps = priorityStyles[priority] || priorityStyles.medium;
                    const Icon = ps.icon;
                    return (
                      <div
                        key={rec.id || rec.title || idx}
                        className={cn("p-3 rounded-lg border", ps.bg)}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold truncate">{rec.title}</span>
                              {rec.impact && (
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  Impacto: {rec.impact}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {rec.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
