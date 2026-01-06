/**
 * Sección de Clientes a Enfocar
 * Muestra clientes críticos, en riesgo y oportunidades
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard } from "@/components/salesforce/layout/ChartCard";
import { ClientFocusCard } from "../cards/ClientFocusCard";
import { EmptyState } from "@/components/salesforce/feedback/EmptyState";
import { Users, AlertTriangle, TrendingUp } from "lucide-react";
import type { SalesAnalystInsights } from "@shared/sales-analyst-types";

interface ClientFocusSectionProps {
  insights: SalesAnalystInsights;
}

export function ClientFocusSection({ insights }: ClientFocusSectionProps) {
  const { critical, warning, opportunities } = insights.focusClients;

  return (
    <ChartCard
      title="Clientes a Enfocar"
      subtitle="Análisis de prioridad y recomendaciones"
    >
      <Tabs defaultValue="critical" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="critical" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Críticos ({critical.length})
          </TabsTrigger>
          <TabsTrigger value="warning" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Riesgo ({warning.length})
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Oportunidades ({opportunities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="critical" className="mt-4 space-y-3">
          {critical.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin clientes críticos"
              description="No hay clientes que requieran atención inmediata"
              size="sm"
            />
          ) : (
            critical.slice(0, 10).map((client) => (
              <ClientFocusCard key={client.name} client={client} />
            ))
          )}
        </TabsContent>

        <TabsContent value="warning" className="mt-4 space-y-3">
          {warning.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin clientes en riesgo"
              description="No hay clientes con caída significativa"
              size="sm"
            />
          ) : (
            warning.slice(0, 10).map((client) => (
              <ClientFocusCard key={client.name} client={client} />
            ))
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4 space-y-3">
          {opportunities.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Sin oportunidades identificadas"
              description="No hay clientes con crecimiento significativo"
              size="sm"
            />
          ) : (
            opportunities.slice(0, 10).map((client) => (
              <ClientFocusCard key={client.name} client={client} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </ChartCard>
  );
}

