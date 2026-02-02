/**
 * Primitivos reutilizables para tarjetas KPI.
 * Todas las variantes (Retention, Volume, Default) los componen.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const getCompanyAccent = (companyId?: number) => {
  if (companyId === 1) return { borderLeft: 'border-l-emerald-500', avatarBg: 'bg-emerald-600', badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'DURA' };
  if (companyId === 2) return { borderLeft: 'border-l-purple-500', avatarBg: 'bg-purple-600', badgeBg: 'bg-purple-100 text-purple-700 border-purple-300', label: 'ORSEGA' };
  return { borderLeft: '', avatarBg: 'bg-primary', badgeBg: '', label: '' };
};

export interface KpiCardShellProps {
  companyId?: number;
  responsible?: string;
  title: string;
  subtitle?: string;
  statusBadge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  borderAccent?: string;
}

/** Contenedor común: borde, padding, acento por empresa, responsable y etiqueta. */
export function KpiCardShell({
  companyId,
  responsible,
  title,
  subtitle,
  statusBadge,
  children,
  className = '',
  borderAccent
}: KpiCardShellProps) {
  const accent = getCompanyAccent(companyId);
  const border = borderAccent ?? (accent.borderLeft ? `border-l-4 ${accent.borderLeft}` : '');
  return (
    <Card className={`h-full transition-all duration-200 border-2 hover:shadow-lg ${border} ${className}`} data-onboarding="kpi-card">
      <CardContent className="p-5">
        <div className="space-y-4">
          {responsible && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${accent.avatarBg} text-white text-xs font-bold shadow-md`}>
                {responsible.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{responsible}</p>
                {accent.label && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${accent.badgeBg}`}>
                    {accent.label}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base leading-tight text-gray-900 mb-1">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
            </div>
            {statusBadge && <div className="flex-shrink-0">{statusBadge}</div>}
          </div>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export interface MetricHeroProps {
  /** Número o frase principal (hero) */
  value: string;
  /** Etiqueta opcional encima (ej. "Valor Actual", "Tasa de retención") */
  label?: string;
  /** Contexto debajo (ej. "Meta: 90%") */
  context?: string;
}

/** Bloque métrica principal: número grande + etiqueta opcional. */
export function MetricHero({ value, label, context }: MetricHeroProps) {
  return (
    <div className="space-y-1">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {context && <p className="text-xs text-gray-500">{context}</p>}
    </div>
  );
}

export interface TwoColumnBlockProps {
  leftLabel: string;
  leftValue: string | number;
  rightLabel: string;
  rightValue: string | number;
  /** Subtítulo izquierda (ej. "3–6 meses sin compra") */
  leftSubtitle?: string;
  /** Subtítulo derecha (ej. "6+ meses sin compra") */
  rightSubtitle?: string;
  className?: string;
}

/** Dos columnas (ej. "Clientes en riesgo" | "Clientes críticos"). Mismo estilo que botón "Tarjetas KPI": claro, rounded-md, borde sutil. */
export function TwoColumnBlock({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  leftSubtitle,
  rightSubtitle,
  className = '',
}: TwoColumnBlockProps) {
  return (
    <div className={`flex items-stretch gap-0 rounded-md border border-input bg-white dark:bg-gray-100 overflow-hidden ${className}`}>
      <div className="flex-1 flex flex-col justify-center py-3 px-4 border-r border-input">
        <p className="text-xs font-medium text-muted-foreground">{leftLabel}</p>
        {leftSubtitle && <p className="text-[11px] text-muted-foreground/80">{leftSubtitle}</p>}
        <p className="text-xl font-bold tabular-nums text-amber-600 mt-0.5">{leftValue}</p>
      </div>
      <div className="flex-1 flex flex-col justify-center py-3 px-4">
        <p className="text-xs font-medium text-muted-foreground">{rightLabel}</p>
        {rightSubtitle && <p className="text-[11px] text-muted-foreground/80">{rightSubtitle}</p>}
        <p className="text-xl font-bold tabular-nums text-red-600 mt-0.5">{rightValue}</p>
      </div>
    </div>
  );
}

export interface OptionalBarProps {
  label: string;
  value: number;
  /** Color según cumplimiento (ej. green, amber, red) */
  status: 'excellent' | 'good' | 'warning' | 'critical';
  context?: string;
}

const barColors: Record<OptionalBarProps['status'], string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500'
};

/** Barra de cumplimiento opcional (solo donde aporte y no confunda). */
export function OptionalBar({ label, value, status, context }: OptionalBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold">{Math.min(value, 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColors[status]}`}
          style={{ width: `${Math.min(value, 100)}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      {context && <p className="text-xs text-gray-500">{context}</p>}
    </div>
  );
}
