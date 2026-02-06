/**
 * Strategic Recommendations Card - Recomendaciones de corto y mediano plazo
 * Usa datos del Sales Analyst + fallback con datos financieros reales
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesAnalyst } from "@/hooks/useSalesAnalyst";
import { useMonthlyFinancial } from "@/hooks/useMonthlyFinancial";
import { Lightbulb, AlertCircle, Target, TrendingUp, Clock, Zap, Users, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategicRecommendationsCardProps {
  companyId: number;
  year: number;
  month: number;
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

function generateDataDrivenRecommendations(financial: any, companyId: number): Array<{ title: string; description: string; priority: string; section: 'short' | 'medium' }> {
  const recs: Array<{ title: string; description: string; priority: string; section: 'short' | 'medium' }> = [];
  if (!financial) return recs;

  const fm = financial.financialMetrics;
  const clients = financial.clientEfficiency || [];
  const families = financial.productsByFamily || [];
  const anomalies = financial.anomalies;

  // Check margin health
  if (fm && fm.grossMarginPercent < 10) {
    recs.push({
      title: 'Margen bruto por debajo del objetivo',
      description: `El margen bruto es ${fm.grossMarginPercent.toFixed(1)}%, debajo del 10% objetivo. Revisar estructura de costos y precios de venta.`,
      priority: fm.grossMarginPercent < 5 ? 'critical' : 'high',
      section: 'short',
    });
  }

  // Check client concentration
  if (clients.length > 0) {
    const totalRev = clients.reduce((s: number, c: any) => s + (c.totalRevenue || 0), 0);
    const top1Pct = totalRev > 0 && clients[0] ? (clients[0].totalRevenue / totalRev) * 100 : 0;
    if (top1Pct > 40) {
      recs.push({
        title: `Dependencia crítica: ${clients[0].name}`,
        description: `El cliente principal concentra ${top1Pct.toFixed(0)}% de los ingresos. Diversificar la cartera de clientes para reducir riesgo.`,
        priority: 'high',
        section: 'short',
      });
    } else if (top1Pct > 25) {
      recs.push({
        title: 'Diversificar cartera de clientes',
        description: `El cliente principal representa ${top1Pct.toFixed(0)}% del ingreso. Buscar nuevos clientes para reducir concentración.`,
        priority: 'medium',
        section: 'medium',
      });
    }
  }

  // Check cancelled transactions
  if (anomalies && anomalies.cancelledTransactions > 0) {
    recs.push({
      title: `${anomalies.cancelledTransactions} transacciones canceladas`,
      description: `Se detectaron cancelaciones en el mes. Analizar causas raíz para reducir devoluciones y cancelaciones.`,
      priority: anomalies.cancelledTransactions > 5 ? 'high' : 'medium',
      section: 'short',
    });
  }

  // Product family recommendations
  if (families.length > 0) {
    const lowMarginFamilies = families.filter((f: any) => f.avgMargin > 0 && f.avgMargin < 5 && f.revenue > 0);
    if (lowMarginFamilies.length > 0) {
      recs.push({
        title: 'Familias de producto con margen bajo',
        description: `${lowMarginFamilies.map((f: any) => f.family).join(', ')} tienen margen menor al 5%. Evaluar incremento de precio o reducción de costos.`,
        priority: 'medium',
        section: 'medium',
      });
    }

    const highMarginFamilies = families.filter((f: any) => f.avgMargin > 15 && f.revenue > 0);
    if (highMarginFamilies.length > 0) {
      recs.push({
        title: 'Impulsar familias de alto margen',
        description: `${highMarginFamilies.map((f: any) => f.family).join(', ')} tienen margen >15%. Enfocar estrategia comercial en estos productos.`,
        priority: 'low',
        section: 'medium',
      });
    }
  }

  // Transaction volume
  if (fm && fm.totalTransactions < 20) {
    recs.push({
      title: 'Volumen de transacciones bajo',
      description: `Solo ${fm.totalTransactions} transacciones en el mes. Activar campañas para incrementar frecuencia de compra.`,
      priority: 'medium',
      section: 'short',
    });
  }

  // MoM comparison
  if (financial.previousMonth) {
    const prev = financial.previousMonth;
    const change = prev.totalRevenue > 0 ? ((fm.totalRevenueMXN - prev.totalRevenue) / prev.totalRevenue) * 100 : 0;
    if (change < -10) {
      recs.push({
        title: `Caída de ingresos MoM: ${change.toFixed(1)}%`,
        description: `Los ingresos bajaron vs. mes anterior. Investigar causas y activar plan de recuperación.`,
        priority: change < -25 ? 'critical' : 'high',
        section: 'short',
      });
    }
  }

  return recs;
}

export function StrategicRecommendationsCard({ companyId, year, month }: StrategicRecommendationsCardProps) {
  const { data: insights, isLoading: isLoadingInsights } = useSalesAnalyst(companyId);
  const { data: financial, isLoading: isLoadingFinancial } = useMonthlyFinancial(companyId, year, month);

  if (isLoadingInsights && isLoadingFinancial) {
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

  // Try Sales Analyst data first
  const recommendations = insights?.strategicRecommendations || [];
  const actionItems = insights?.actionItems || [];

  const shortTerm = [
    ...actionItems.filter((a) => a.priority === 'critical' || a.priority === 'high'),
    ...recommendations.filter((r) => r.priority === 'high'),
  ].slice(0, 4);

  const mediumTerm = recommendations
    .filter((r) => r.priority === 'medium' || r.priority === 'low')
    .slice(0, 4);

  const hasAnalystContent = shortTerm.length > 0 || mediumTerm.length > 0;

  // Generate data-driven fallback if analyst has no recommendations
  const dataDriven = !hasAnalystContent ? generateDataDrivenRecommendations(financial, companyId) : [];
  const shortTermData = dataDriven.filter(r => r.section === 'short');
  const mediumTermData = dataDriven.filter(r => r.section === 'medium');

  const finalShortTerm = hasAnalystContent ? shortTerm : shortTermData;
  const finalMediumTerm = hasAnalystContent ? mediumTerm : mediumTermData;
  const hasContent = finalShortTerm.length > 0 || finalMediumTerm.length > 0;

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
          <div className="text-center py-8 space-y-2">
            <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-emerald-700">Sin alertas activas</p>
            <p className="text-xs text-muted-foreground">
              Los indicadores se encuentran dentro de parámetros normales
            </p>
          </div>
        ) : (
          <>
            {/* Short-term */}
            {finalShortTerm.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Zap className="w-3.5 h-3.5" />
                  Corto Plazo (Inmediato)
                </div>
                <div className="space-y-2">
                  {finalShortTerm.map((item: any, idx: number) => {
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
            {finalMediumTerm.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Mediano Plazo (1-3 meses)
                </div>
                <div className="space-y-2">
                  {finalMediumTerm.map((rec: any, idx: number) => {
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
