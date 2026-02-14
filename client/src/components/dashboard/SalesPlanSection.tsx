/**
 * SalesPlanSection - Plan de Ventas Accionable
 * Reemplaza los 3 cards anteriores (RiskAlertsCard, AIInsightsWidget, StrategicRecommendationsCard)
 * con un plan de ventas estructurado y accionable para el equipo comercial.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesAnalyst } from '@/hooks/useSalesAnalyst';
import { formatCurrency } from '@/lib/sales-utils';
import {
  ClipboardList,
  Target,
  DollarSign,
  Users,
  AlertTriangle,
  Moon,
  AlertCircle,
} from 'lucide-react';
import { PriorityClientsTable } from './PriorityClientsTable';
import { WeeklyActionsPanel } from './WeeklyActionsPanel';
import { ContactedClientsProvider } from './ContactedClientsContext';

interface SalesPlanSectionProps {
  companyId: number;
  year: number;
  month: number;
}

export function SalesPlanSection({ companyId, year, month }: SalesPlanSectionProps) {
  const { data: insights, isLoading } = useSalesAnalyst(companyId);

  // Get current month name
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const currentMonthName = monthNames[month - 1] || monthNames[new Date().getMonth()];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculate executive summary metrics (4 niveles)
  const revenueAtRisk = insights?.riskAnalysis?.revenueAtRisk ?? 0;
  const dormantClients = insights?.focusClients?.dormant ?? [];
  const criticalClients = insights?.focusClients?.critical ?? [];
  const atRiskClients = insights?.focusClients?.atRisk ?? [];
  const opportunityClients = insights?.focusClients?.opportunities ?? [];
  const churnRisk = insights?.riskAnalysis?.churnRisk ?? 0;

  const dormantCount = dormantClients.length;
  const criticalCount = criticalClients.length;
  const atRiskCount = atRiskClients.length;
  const opportunityCount = opportunityClients.length;
  const totalClientsToContact = dormantCount + criticalCount + atRiskCount;

  // Calculate recovery target (30% of revenue at risk)
  const recoveryTarget = Math.round(revenueAtRisk * 0.3);

  return (
    <ContactedClientsProvider companyId={companyId}>
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="w-6 h-6 text-primary" />
              </div>
              Plan de Ventas - {currentMonthName} {year}
            </CardTitle>
            <Badge
              variant="outline"
              className="text-xs px-3 py-1 border-primary/30 text-primary"
            >
              {totalClientsToContact} clientes por contactar
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top Row: Priority Clients Table + Executive Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Priority Clients Table - 2/3 width */}
            <div className="lg:col-span-2">
              <PriorityClientsTable
                companyId={companyId}
                dormantClients={dormantClients}
                criticalClients={criticalClients}
                atRiskClients={atRiskClients}
                opportunityClients={opportunityClients}
              />
            </div>

            {/* Executive Summary - 1/3 width */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Target className="w-4 h-4" />
                Resumen Ejecutivo
              </h3>

              {/* Revenue at Risk */}
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span>Revenue en Riesgo</span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(revenueAtRisk, companyId)}
                </p>
              </div>

              {/* Client counts by category */}
              <div className="grid grid-cols-2 gap-2">
                {/* Dormant Clients Count */}
                {dormantCount > 0 && (
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Moon className="w-3 h-3 text-purple-600" />
                      <span>Dormidos</span>
                    </div>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {dormantCount}
                    </p>
                  </div>
                )}

                {/* Critical Clients Count */}
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    <span>Criticos</span>
                  </div>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {criticalCount}
                  </p>
                </div>

                {/* At-Risk Clients Count */}
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Users className="w-3 h-3 text-amber-600" />
                    <span>En Riesgo</span>
                  </div>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {atRiskCount}
                  </p>
                </div>

                {/* Opportunities Count */}
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Target className="w-3 h-3 text-emerald-600" />
                    <span>Oportunidades</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {opportunityCount}
                  </p>
                </div>
              </div>

              {/* Recovery Target */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span>Meta Recuperacion</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(recoveryTarget, companyId)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  30% del revenue en riesgo
                </p>
              </div>

              {/* Churn Risk Score */}
              <div className="p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Riesgo de Churn</span>
                  <Badge
                    variant="outline"
                    className={
                      churnRisk >= 70
                        ? 'border-red-300 text-red-700 bg-red-50'
                        : churnRisk >= 40
                        ? 'border-amber-300 text-amber-700 bg-amber-50'
                        : 'border-emerald-300 text-emerald-700 bg-emerald-50'
                    }
                  >
                    {churnRisk >= 70 ? 'Alto' : churnRisk >= 40 ? 'Medio' : 'Bajo'}
                  </Badge>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      churnRisk >= 70
                        ? 'bg-red-500'
                        : churnRisk >= 40
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(churnRisk, 100)}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground mt-1">
                  {churnRisk.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row: Weekly Actions Panel */}
          <WeeklyActionsPanel
            companyId={companyId}
            dormantClients={dormantClients}
            criticalClients={criticalClients}
            atRiskClients={atRiskClients}
            opportunityClients={opportunityClients}
          />
        </CardContent>
      </Card>
    </ContactedClientsProvider>
  );
}
