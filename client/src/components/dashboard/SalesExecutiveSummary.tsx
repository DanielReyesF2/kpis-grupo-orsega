/**
 * Resumen Ejecutivo de Ventas
 * Muestra un resumen conciso del análisis profundo antes de las tablas de detalle
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  ArrowRight,
  Lightbulb
} from "lucide-react";

interface SalesExecutiveSummaryProps {
  companyId: number; // 1 = DURA, 2 = ORSEGA
}

export function SalesExecutiveSummary({ companyId }: SalesExecutiveSummaryProps) {
  // Datos de resumen para DURA
  const duraResumen = {
    status: "critical" as const,
    cambioAnual: -12.2,
    kgPerdidos: 70109,
    clientesPerdidos: 7,
    clienteConMayorPerdida: "BP International Trading",
    kgPerdidosMayorCliente: 40226,
    mesesPositivos: 5,
    accionPrioritaria: "Reunión urgente con BP International Trading",
    oportunidad: "Recuperar 40,226 kg perdidos con plan de acción específico"
  };

  // Datos de resumen para ORSEGA
  const orsegaResumen = {
    status: "positive" as const,
    cambioAnual: 8.1,
    unidadesGanadas: 761956,
    mesesSobrePresupuesto: 7,
    mejorMes: "Marzo",
    unidadesMejorMes: 1319150,
    desafio: "Segundo semestre con 4 meses bajo presupuesto",
    accionPrioritaria: "Analizar causas de caída Sep-Nov",
    oportunidad: "Mantener momentum del primer semestre"
  };

  const resumen = companyId === 1 ? duraResumen : orsegaResumen;
  const isDura = companyId === 1;
  const isPositive = resumen.status === "positive";

  const formatNumber = (num: number) => new Intl.NumberFormat('es-MX').format(num);

  return (
    <Card className="shadow-lg border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Resumen Ejecutivo - {isDura ? 'DURA International' : 'Grupo ORSEGA'}</CardTitle>
              <p className="text-sm text-muted-foreground">Análisis comparativo 2024 vs 2025</p>
            </div>
          </div>
          <Badge variant={isPositive ? "default" : "destructive"} className="text-sm px-3 py-1">
            {isPositive ? (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> En Crecimiento</>
            ) : (
              <><AlertTriangle className="h-4 w-4 mr-1" /> Requiere Atención</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Columna 1: Situación Actual */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Target className="h-4 w-4" /> Situación Actual
            </h4>
            <div className={`p-3 rounded-lg ${isPositive ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{resumen.cambioAnual.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground">vs 2024</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isDura ? (
                  <>{formatNumber(duraResumen.kgPerdidos)} KG {isPositive ? 'ganados' : 'perdidos'}</>
                ) : (
                  <>{formatNumber(orsegaResumen.unidadesGanadas)} unidades ganadas</>
                )}
              </p>
            </div>
            {isDura && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-orange-500" />
                <span><strong>{duraResumen.clientesPerdidos}</strong> clientes perdidos (churn)</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                <strong>{isDura ? duraResumen.mesesPositivos : orsegaResumen.mesesSobrePresupuesto}</strong> de 12 meses
                {isDura ? ' superan 2024' : ' sobre presupuesto'}
              </span>
            </div>
          </div>

          {/* Columna 2: Punto Crítico / Destacado */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {isDura ? 'Punto Crítico' : 'Punto Destacado'}
            </h4>
            <div className={`p-3 rounded-lg border ${isDura ? 'border-red-200 dark:border-red-900' : 'border-green-200 dark:border-green-900'}`}>
              {isDura ? (
                <>
                  <p className="font-medium text-foreground">{duraResumen.clienteConMayorPerdida}</p>
                  <p className="text-sm text-red-600 font-semibold">
                    -{formatNumber(duraResumen.kgPerdidosMayorCliente)} KG
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mayor pérdida individual del año
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">Mejor mes: {orsegaResumen.mejorMes}</p>
                  <p className="text-sm text-green-600 font-semibold">
                    {formatNumber(orsegaResumen.unidadesMejorMes)} unidades
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Récord del año en ventas
                  </p>
                </>
              )}
            </div>
            {!isDura && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{orsegaResumen.desafio}</span>
              </div>
            )}
          </div>

          {/* Columna 3: Acción Recomendada */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> Acción Prioritaria
            </h4>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">{resumen.accionPrioritaria}</p>
                  <p className="text-xs text-muted-foreground mt-1">{resumen.oportunidad}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Ver análisis detallado abajo para más información
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
