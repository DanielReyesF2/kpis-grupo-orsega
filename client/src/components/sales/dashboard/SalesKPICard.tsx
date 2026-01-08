/**
 * Card reutilizable para mostrar KPIs de ventas
 */

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";

interface SalesKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function SalesKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: SalesKPICardProps) {
  const variantStyles = {
    default: "border-border bg-card",
    success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20",
    warning: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20",
    danger: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20",
  };

  const iconStyles = {
    default: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <Card className={cn("border-2 transition-all hover:shadow-md", variantStyles[variant], className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold text-foreground mb-2">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.value >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-sm font-semibold",
                    trend.value >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground ml-1">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-lg bg-background", iconStyles[variant])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Re-export for backward compatibility
export { formatCurrency, formatNumber } from "@/lib/sales-utils";

