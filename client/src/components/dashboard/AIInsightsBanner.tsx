/**
 * AI Insights Banner - Resumen ejecutivo y recomendaciones de IA
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { Sparkles, AlertCircle, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInsightsBannerProps {
  companyId: number;
}

const priorityStyles: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  medium: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  low: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
};

const priorityIcons: Record<string, typeof AlertCircle> = {
  high: AlertCircle,
  medium: Target,
  low: TrendingUp,
};

export function AIInsightsBanner({ companyId }: AIInsightsBannerProps) {
  const { data: insights, isLoading } = useSalesAnalyst(companyId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-48" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const aiSummary = insights?.statisticalContext?.aiInsights;
  const recommendations = (insights?.strategicRecommendations || []).slice(0, 3);
  const dormantCount = insights?.focusClients?.dormant?.length ?? 0;
  const criticalCount = insights?.focusClients?.critical?.length ?? 0;
  const atRiskCount = insights?.focusClients?.atRisk?.length ?? 0;
  const churnRisk = insights?.riskAnalysis?.churnRisk ?? 0;

  const totalAtRisk = dormantCount + criticalCount + atRiskCount;

  // Fallback summary if no AI insights
  const fallbackSummary = totalAtRisk > 0
    ? `Hay ${dormantCount} clientes dormidos, ${criticalCount} críticos y ${atRiskCount} en riesgo. El riesgo de churn es de ${churnRisk}/100. Se recomienda acción inmediata.`
    : "La cartera de clientes se encuentra estable. Enfócate en identificar oportunidades de crecimiento y cross-sell.";

  const displaySummary = aiSummary || fallbackSummary;

  if (!displaySummary && recommendations.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* AI Icon */}
          <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">EconovaAI</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Insights</Badge>
            </div>

            {/* Summary */}
            <p className="text-sm text-foreground/80 leading-relaxed">{displaySummary}</p>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {recommendations.map((rec: any) => {
                  const priority = rec.priority || "medium";
                  const Icon = priorityIcons[priority] || Target;
                  return (
                    <div
                      key={rec.id || rec.title}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium",
                        priorityStyles[priority] || priorityStyles.medium
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[250px]">{rec.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
