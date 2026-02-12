/**
 * AI Insights Widget - Versión compacta del resumen de IA
 * Se muestra como una card en el grid del dashboard
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { Sparkles, AlertCircle, TrendingUp, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface AIInsightsWidgetProps {
  companyId: number;
}

const priorityStyles: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  low: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
};

const priorityIcons: Record<string, typeof AlertCircle> = {
  high: AlertCircle,
  medium: Target,
  low: TrendingUp,
};

export function AIInsightsWidget({ companyId }: AIInsightsWidgetProps) {
  const { data: insights, isLoading } = useSalesAnalyst(companyId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const aiSummary = insights?.statisticalContext?.aiInsights;
  const recommendations = (insights?.strategicRecommendations || []).slice(0, 4);
  const criticalCount = insights?.focusClients?.critical?.length ?? 0;
  const warningCount = insights?.focusClients?.warning?.length ?? 0;
  const churnRisk = insights?.riskAnalysis?.churnRisk ?? 0;

  // Fallback summary if no AI insights
  const fallbackSummary = criticalCount > 0 || warningCount > 0
    ? `${criticalCount} clientes críticos, ${warningCount} en seguimiento. Riesgo de churn: ${churnRisk}/100.`
    : "Cartera estable. Enfócate en oportunidades de crecimiento.";

  const displaySummary = aiSummary || fallbackSummary;

  if (!displaySummary && recommendations.length === 0) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span>EconovaAI</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">Insights</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary - truncated unless expanded */}
        <p className={cn(
          "text-xs text-muted-foreground leading-relaxed",
          !expanded && "line-clamp-2"
        )}>
          {displaySummary}
        </p>

        {/* Recommendations list */}
        {recommendations.length > 0 && (
          <div className="space-y-1.5">
            {recommendations.slice(0, expanded ? 4 : 2).map((rec: any, idx: number) => {
              const priority = rec.priority || "medium";
              const Icon = priorityIcons[priority] || Target;
              return (
                <div
                  key={rec.id || idx}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs",
                    priorityStyles[priority] || priorityStyles.medium
                  )}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{rec.title}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expand/collapse toggle */}
        {(recommendations.length > 2 || (displaySummary && displaySummary.length > 100)) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <span>{expanded ? 'Ver menos' : 'Ver más'}</span>
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
