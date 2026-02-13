/**
 * WeeklyActionsPanel - Panel de acciones semanales organizadas por prioridad
 * Categoriza acciones en: Urgente (esta semana), Seguimiento (proximas 2 semanas),
 * y Oportunidades de crecimiento.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  Calendar,
  Package,
  CheckCircle2
} from "lucide-react";
import { formatCurrency } from "@/lib/sales-utils";
import { cn } from "@/lib/utils";
import type { ClientFocus } from "@shared/sales-analyst-types";

interface WeeklyActionsPanelProps {
  companyId: number;
  criticalClients: ClientFocus[];
  warningClients: ClientFocus[];
  opportunityClients: ClientFocus[];
}

interface ActionItem {
  id: string;
  clientName: string;
  type: 'urgent' | 'follow-up' | 'opportunity';
  title: string;
  description: string;
  potential: number;
  products: string[];
  lastOrderDate: string;
  suggestedAction: string;
}

export function WeeklyActionsPanel({
  companyId,
  criticalClients,
  warningClients,
  opportunityClients,
}: WeeklyActionsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('urgent');
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  // Transform clients into action items
  const urgentActions: ActionItem[] = criticalClients.slice(0, 5).map((c, idx) => ({
    id: `urgent-${idx}`,
    clientName: c.name,
    type: 'urgent' as const,
    title: `Llamar a ${c.name}`,
    description: `${c.daysSincePurchase} dias sin compra`,
    potential: c.previousYearRevenue,
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Ofrecer descuento de reactivacion',
  }));

  const followUpActions: ActionItem[] = warningClients.slice(0, 5).map((c, idx) => ({
    id: `followup-${idx}`,
    clientName: c.name,
    type: 'follow-up' as const,
    title: `Dar seguimiento a ${c.name}`,
    description: `${c.daysSincePurchase} dias sin compra`,
    potential: c.previousYearRevenue,
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Contactar para entender situacion',
  }));

  const opportunityActions: ActionItem[] = opportunityClients.slice(0, 5).map((c, idx) => ({
    id: `opp-${idx}`,
    clientName: c.name,
    type: 'opportunity' as const,
    title: `Crecimiento en ${c.name}`,
    description: `+${c.yoyChange.toFixed(1)}% vs ano anterior`,
    potential: c.currentYearRevenue,
    products: c.topProducts || [],
    lastOrderDate: c.lastOrderDateFormatted || c.lastPurchaseDate,
    suggestedAction: c.suggestedAction || 'Ofrecer mayor volumen o productos complementarios',
  }));

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const markComplete = (actionId: string) => {
    setCompletedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  const ActionCard = ({ action }: { action: ActionItem }) => {
    const isComplete = completedActions.has(action.id);

    return (
      <div
        className={cn(
          "p-4 rounded-lg border transition-all",
          isComplete
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30"
            : "bg-card hover:border-primary/30"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={cn(
                "text-sm font-medium",
                isComplete && "line-through text-muted-foreground"
              )}>
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
          </div>
          <Button
            size="sm"
            variant={isComplete ? "outline" : "ghost"}
            className={cn(
              "h-8 w-8 p-0 shrink-0",
              isComplete && "border-emerald-300 text-emerald-700"
            )}
            onClick={() => markComplete(action.id)}
          >
            <CheckCircle2 className={cn(
              "w-4 h-4",
              isComplete ? "text-emerald-600" : "text-muted-foreground"
            )} />
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
  }: {
    icon: typeof AlertCircle;
    title: string;
    count: number;
    colorClass: string;
    section: string;
  }) => {
    const isExpanded = expandedSection === section;
    const completedCount = (
      section === 'urgent' ? urgentActions :
      section === 'follow-up' ? followUpActions :
      opportunityActions
    ).filter(a => completedActions.has(a.id)).length;

    return (
      <button
        onClick={() => toggleSection(section)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
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
        <ChevronRight className={cn(
          "w-4 h-4 transition-transform",
          isExpanded && "rotate-90"
        )} />
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Acciones de la Semana
      </h3>

      <div className="space-y-2">
        {/* URGENT Section */}
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            icon={AlertCircle}
            title="URGENTE (Esta semana)"
            count={urgentActions.length}
            colorClass="bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-700 dark:text-red-300"
            section="urgent"
          />
          {expandedSection === 'urgent' && urgentActions.length > 0 && (
            <div className="p-3 space-y-2 bg-card">
              {urgentActions.map(action => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          )}
          {expandedSection === 'urgent' && urgentActions.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay acciones urgentes pendientes
            </div>
          )}
        </div>

        {/* FOLLOW-UP Section */}
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            icon={Clock}
            title="SEGUIMIENTO (Proximas 2 semanas)"
            count={followUpActions.length}
            colorClass="bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300"
            section="follow-up"
          />
          {expandedSection === 'follow-up' && followUpActions.length > 0 && (
            <div className="p-3 space-y-2 bg-card">
              {followUpActions.map(action => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          )}
          {expandedSection === 'follow-up' && followUpActions.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay acciones de seguimiento pendientes
            </div>
          )}
        </div>

        {/* OPPORTUNITIES Section */}
        <div className="rounded-lg border overflow-hidden">
          <SectionHeader
            icon={TrendingUp}
            title="OPORTUNIDADES DE CRECIMIENTO"
            count={opportunityActions.length}
            colorClass="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
            section="opportunities"
          />
          {expandedSection === 'opportunities' && opportunityActions.length > 0 && (
            <div className="p-3 space-y-2 bg-card">
              {opportunityActions.map(action => (
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
