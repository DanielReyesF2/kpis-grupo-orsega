/**
 * Card reutilizable para mostrar información de una oportunidad de producto
 */

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Users, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/sales-utils";
import type { ProductOpportunity } from "@shared/sales-analyst-types";

interface ProductOpportunityCardProps {
  product: ProductOpportunity;
}

export function ProductOpportunityCard({ product }: ProductOpportunityCardProps) {
  const categoryConfig = useMemo(() => {
    switch (product.category) {
      case 'star':
        return {
          border: 'border-emerald-200',
          bg: 'bg-emerald-50/50',
          badge: 'default',
          icon: Star,
          iconColor: 'text-emerald-600'
        };
      case 'declining':
        return {
          border: 'border-red-200',
          bg: 'bg-red-50/50',
          badge: 'destructive',
          icon: TrendingDown,
          iconColor: 'text-red-600'
        };
      case 'crossSell':
        return {
          border: 'border-blue-200',
          bg: 'bg-blue-50/50',
          badge: 'secondary',
          icon: TrendingUp,
          iconColor: 'text-blue-600'
        };
    }
  }, [product.category]);

  const Icon = categoryConfig.icon;
  const isPositive = product.growthRate > 0;

  return (
    <Card className={cn("border-2 transition-all hover:shadow-md", categoryConfig.border, categoryConfig.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("h-4 w-4 flex-shrink-0", categoryConfig.iconColor)} />
              <h4 className="font-semibold text-sm truncate">{product.name}</h4>
              <Badge variant={categoryConfig.badge as any} className="text-xs">
                {product.category === 'star' ? 'Estrella' : 
                 product.category === 'declining' ? 'Declive' : 
                 'Cross-Sell'}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={cn(
                  "font-medium",
                  isPositive ? "text-emerald-600" : "text-red-600"
                )}>
                  {isPositive ? '+' : ''}{product.growthRate.toFixed(1)}% crecimiento
                </span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{product.uniqueClients} clientes únicos</span>
              </div>

              <div className="pt-1 border-t border-border/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volumen actual:</span>
                  <span className="font-medium">
                    {formatNumber(product.currentVolume)} {product.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rentabilidad:</span>
                  <span className="font-medium">{product.profitability.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {product.recommendedFocus && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">Recomendación:</p>
            <p className="text-xs text-muted-foreground">{product.recommendedFocus}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

