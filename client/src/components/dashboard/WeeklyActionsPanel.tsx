/**
 * WeeklyActionsPanel - Panel de acciones semanales organizadas por prioridad
 * Categoriza acciones en: Dormidos (reactivacion), Criticos (urgente),
 * En Riesgo (preventivo), y Oportunidades de crecimiento.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Moon,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
  Calendar,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/sales-utils';
import { cn } from '@/lib/utils';
import type { ClientFocus } from '@shared/sales-analyst-types';
import { useContactedClients } from './ContactedClientsContext';

interface WeeklyActionsPanelProps {
  companyId: number;
  dormantClients: ClientFocus[];
  criticalClients: ClientFocus[];
  atRiskClients: ClientFocus[];
  opportunityClients: ClientFocus[];
}

interface ActionItem {
  id: string;
  clientName: string;
  type: 'dormant' | 'critical' | 'at-risk' | 'opportunity';
  title: string;
  description: string;
  potential: number;
  products: string[];
  lastOrderDate: string;
  suggestedAction: string;
}

export function WeeklyActionsPanel({
  companyId,
  dormantClients,
  criticalClients,
  atRiskClients,
  opportunityClients,
}: WeeklyActionsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('dormant');
  const { contactedClients, markAsContacted, isLoading, getRelativeTime } = useContactedClients();

  // Transform clients into action items
  const dormantActions: ActionItem[] = dormantClients.slice(0, 5).map((c, idx) => ({
    id: `dormant-${idx}`,
    clientName: c.name,
    type: 'dormant' as const,
    title: `Reactivar ${c.name}`,
    description: `${c.daysSincePurchase} dias sin compra (4+ meses)`,
    potential: c.previousYearRevenue,
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Campana de reactivacion agresiva con descuento fuerte',
  }));

  const criticalActions: ActionItem[] = criticalClients.slice(0, 5).map((c, idx) => ({
    id: `critical-${idx}`,
    clientName: c.name,
    type: 'critical' as const,
    title: `Llamar a ${c.name}`,
    description: `${c.daysSincePurchase} dias sin compra (3 meses)`,
    potential: c.previousYearRevenue,
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Llamada urgente con oferta especial',
  }));

  const atRiskActions: ActionItem[] = atRiskClients.slice(0, 5).map((c, idx) => ({
    id: `atrisk-${idx}`,
    clientName: c.name,
    type: 'at-risk' as const,
    title: `Dar seguimiento a ${c.name}`,
    description: `${c.daysSincePurchase} dias sin compra (2 meses)`,
    potential: c.previousYearRevenue,
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Contacto preventivo para entender situacion',
  }));

  const opportunityActions: ActionItem[] = opportunityClients.slice(0, 5).map((c, idx) => ({
    id: `opp-${idx}`,
    clientName: c.name,
    type: 'opportunity' as const,
    title: `Crecimiento en ${c.name}`,
    description: `+${c.yoyChange.toFixed(1)}% vs ano anterior`,
    potential: c.currentYearRevenue, // Usar currentYearRevenue para oportunidades
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Ofrecer mayor volumen o productos complementarios',
  }));

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleMarkComplete = async (action: ActionItem) => {
    const client = [...dormantClients, ...criticalClients, ...atRiskClients, ...opportunityClients]
      .find(c => c.name === action.clientName);

    if (client) {
      await markAsContacted(action.clientName, client.clientId);
    }
  };

  const ActionCard = ({ action }: { action: ActionItem }) => {
    const isComplete = contactedClients.has(action.clientName);
    const isActionLoading = isLoading(action.clientName);
    const relativeTime = getRelativeTime(action.clientName);

    return (
      <div
        className={cn(
          'p-4 rounded-lg border transition-all',
          isComplete
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30'
            : 'bg-card hover:border-primary/30'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4
                className={cn(
                  'text-sm font-medium',
                  isComplete && 'line-through text-muted-foreground'
                )}
              >
                {action.title}
              </h4>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(action.potential, companyId)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {action.lastOrderDate}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {action.products.slice(0, 2).join(', ') || 'N/A'}
              </span>
            </div>
            <p className="text-xs text-primary mt-2 font-medium">
              {action.suggestedAction}
            </p>
            {isComplete && relativeTime && (
              <p className="text-xs text-emerald-600 mt-1">{relativeTime}</p>
            )}
          </div>
          <Button
            size="sm"
            variant={isComplete ? 'outline' : 'ghost'}
            className={cn(
              'h-8 w-8 p-0 shrink-0',
              isComplete && 'border-emerald-300 text-emerald-700'
            )}
            onClick={() => !isComplete && !isActionLoading && handleMarkComplete(action)}
            disabled={isComplete || isActionLoading}
          >
            <CheckCircle2
              className={cn(
                'w-4 h-4',
                isComplete ? 'text-emerald-600' : 'text-muted-foreground',
                isActionLoading && 'animate-spin'
              )}
            />
          </Button>
        </div>
      </div>
    );
  };

  const SectionHeader = ({
    icon: Icon,
    title,
    count,
    colorClass,
    section,
    actions,
  }: {
    icon: typeof AlertCircle;
    title: string;
    count: number;
    colorClass: string;
    section: string;
    actions: ActionItem[];
  }) => {
    const isExpanded = expandedSection === section;
    const completedCount = actions.filter((a) => contactedClients.has(a.clientName)).length;

    return (
      <button
        onClick={() => toggleSection(section)}
        className={cn(
          'w-full flex items-center justify-between p-3 rounded-lg transition-colors',
          colorClass
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
          <span className="font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{count}
          </Badge>
        </div>
        <ChevronRight
          className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
        />
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Acciones de la Semana
      </h3>

      <div className="space-y-2">
        {/* DORMANT Section */}
        {dormantActions.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <SectionHeader
              icon={Moon}
              title="DORMIDOS (Reactivar)"
              count={dormantActions.length}
              colorClass="bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800"
              section="dormant"
              actions={dormantActions}
            />
            {expandedSection === 'dormant' && dormantActions.length > 0 && (
              <div className="p-3 space-y-2 bg-card">
                {dormantActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* CRITICAL Section */}
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            icon={AlertCircle}
            title="CRITICOS (Urgente)"
            count={criticalActions.length}
            colorClass="bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/70 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
            section="critical"
            actions={criticalActions}
          />
          {expandedSection === 'critical' && criticalActions.length > 0 && (
            <div className="p-3 space-y-2 bg-card">
              {criticalActions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          )}
          {expandedSection === 'critical' && criticalActions.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay acciones criticas pendientes
            </div>
          )}
        </div>

        {/* AT-RISK Section */}
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            icon={AlertTriangle}
            title="EN RIESGO (Preventivo)"
            count={atRiskActions.length}
            colorClass="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
            section="at-risk"
            actions={atRiskActions}
          />
          {expandedSection === 'at-risk' && atRiskActions.length > 0 && (
            <div className="p-3 space-y-2 bg-card">
              {atRiskActions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          )}
          {expandedSection === 'at-risk' && atRiskActions.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay acciones preventivas pendientes
            </div>
          )}
        </div>

        {/* OPPORTUNITIES Section */}
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            icon={TrendingUp}
            title="OPORTUNIDADES (Crecimiento)"
            count={opportunityActions.length}
            colorClass="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
            section="opportunities"
            actions={opportunityActions}
          />
          {expandedSection === 'opportunities' && opportunityActions.length > 0 && (
            <div className="p-3 space-y-2 bg-card">
              {opportunityActions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          )}
          {expandedSection === 'opportunities' && opportunityActions.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay oportunidades identificadas en este momento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
