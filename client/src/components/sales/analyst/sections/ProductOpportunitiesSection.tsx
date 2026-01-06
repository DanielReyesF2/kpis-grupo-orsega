/**
 * Sección de Oportunidades de Productos
 * Muestra productos estrella, en declive y oportunidades de cross-selling
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { ProductOpportunityCard } from "../cards/ProductOpportunityCard";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { Star, TrendingDown, ShoppingCart } from "lucide-react";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

interface ProductOpportunitiesSectionProps {
  insights: SalesAnalystInsights;
}

export function ProductOpportunitiesSection({ insights }: ProductOpportunitiesSectionProps) {
  const { stars, declining, crossSell } = insights.productOpportunities;

  return (
    <ChartCard
      title="Oportunidades de Productos"
      subtitle="Análisis de productos y recomendaciones"
    >
      <Tabs defaultValue="stars" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stars" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Estrella ({stars.length})
          </TabsTrigger>
          <TabsTrigger value="declining" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Declive ({declining.length})
          </TabsTrigger>
          <TabsTrigger value="crossSell" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Cross-Sell ({crossSell.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stars" className="mt-4 space-y-3">
          {stars.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Sin productos estrella"
              description="No hay productos con alto crecimiento identificados"
              size="sm"
            />
          ) : (
            stars.slice(0, 10).map((product) => (
              <ProductOpportunityCard key={product.name} product={product} />
            ))
          )}
        </TabsContent>

        <TabsContent value="declining" className="mt-4 space-y-3">
          {declining.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="Sin productos en declive"
              description="No hay productos que requieran atención"
              size="sm"
            />
          ) : (
            declining.slice(0, 10).map((product) => (
              <ProductOpportunityCard key={product.name} product={product} />
            ))
          )}
        </TabsContent>

        <TabsContent value="crossSell" className="mt-4 space-y-3">
          {crossSell.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Sin oportunidades de cross-selling"
              description="No hay productos identificados para cross-selling"
              size="sm"
            />
          ) : (
            crossSell.slice(0, 10).map((product) => (
              <ProductOpportunityCard key={product.name} product={product} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </ChartCard>
  );
}

