/**
 * ========================================================================
 * COMPONENTE TEMPORAL - PARA PRESENTACIÓN
 * TODO: ELIMINAR ESTE ARCHIVO CUANDO SE ARREGLE LA FUNCIÓN DE ACTUALIZAR VENTAS
 * ========================================================================
 *
 * Este componente muestra una tabla comparativa tipo Excel con datos
 * hardcodeados de ventas 2024 vs 2025 para DURA y ORSEGA.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, FileSpreadsheet } from "lucide-react";

interface SalesYearlyComparisonTableProps {
  companyId: number; // 1 = DURA (KG), 2 = ORSEGA (Unidades)
}

// Datos hardcodeados de DURA (Kilogramos)
const DURA_DATA = [
  { mes: "Enero", kg2024: 46407.17, kg2025: 59453.54 },
  { mes: "Febrero", kg2024: 54955.17, kg2025: 46450.80 },
  { mes: "Marzo", kg2024: 58170.41, kg2025: 43602.24 },
  { mes: "Abril", kg2024: 51814.50, kg2025: 55972.80 },
  { mes: "Mayo", kg2024: 56757.88, kg2025: 36358.64 },
  { mes: "Junio", kg2024: 45015.50, kg2025: 51156.50 },
  { mes: "Julio", kg2024: 67090.00, kg2025: 52999.54 },
  { mes: "Agosto", kg2024: 36533.20, kg2025: 44381.30 },
  { mes: "Septiembre", kg2024: 57676.50, kg2025: 56763.54 },
  { mes: "Octubre", kg2024: 70538.00, kg2025: 42939.20 },
  { mes: "Noviembre", kg2024: 40676.04, kg2025: 44222.00 },
  { mes: "Diciembre", kg2024: 54120.30, kg2025: 34645.00 },
];

// Datos hardcodeados de ORSEGA (Unidades) con presupuesto
const ORSEGA_DATA = [
  { mes: "Enero", unidades2024: 871883.98, unidades2025: 1056748.00, presupuesto2025: 941634.70 },
  { mes: "Febrero", unidades2024: 471429.00, unidades2025: 986581.00, presupuesto2025: 509143.32 },
  { mes: "Marzo", unidades2024: 983893.00, unidades2025: 1319150.00, presupuesto2025: 1062604.44 },
  { mes: "Abril", unidades2024: 659319.00, unidades2025: 555894.00, presupuesto2025: 712064.52 },
  { mes: "Mayo", unidades2024: 983283.00, unidades2025: 1062785.00, presupuesto2025: 1061945.64 },
  { mes: "Junio", unidades2024: 702502.00, unidades2025: 1084950.00, presupuesto2025: 758702.16 },
  { mes: "Julio", unidades2024: 674186.00, unidades2025: 1169659.00, presupuesto2025: 728120.88 },
  { mes: "Agosto", unidades2024: 528870.00, unidades2025: 558525.00, presupuesto2025: 571179.60 },
  { mes: "Septiembre", unidades2024: 871278.00, unidades2025: 404786.00, presupuesto2025: 940980.24 },
  { mes: "Octubre", unidades2024: 727375.00, unidades2025: 583234.00, presupuesto2025: 785565.00 },
  { mes: "Noviembre", unidades2024: 1312541.00, unidades2025: 425631.00, presupuesto2025: 1417544.28 },
  { mes: "Diciembre", unidades2024: 750918.00, unidades2025: 480458.00, presupuesto2025: 810991.44 },
];

const OBJETIVO_MENSUAL_ORSEGA = 858373.02;

export function SalesYearlyComparisonTable({ companyId }: SalesYearlyComparisonTableProps) {
  const formatNumber = (num: number) => new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);

  const formatPercent = (num: number) => {
    const formatted = num.toFixed(2);
    return num >= 0 ? `${formatted}%` : `${formatted}%`;
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-green-600 dark:text-green-400";
    if (percent >= 85) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getChangeColor = (percent: number) => {
    if (percent > 0) return "text-green-600 dark:text-green-400";
    if (percent < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getChangeIcon = (percent: number) => {
    if (percent > 0) return <TrendingUp className="h-4 w-4 inline mr-1" />;
    if (percent < 0) return <TrendingDown className="h-4 w-4 inline mr-1" />;
    return <Minus className="h-4 w-4 inline mr-1" />;
  };

  // Calcular totales para DURA
  const duraTotals = {
    kg2024: DURA_DATA.reduce((sum, row) => sum + row.kg2024, 0),
    kg2025: DURA_DATA.reduce((sum, row) => sum + row.kg2025, 0),
  };

  // Calcular totales para ORSEGA
  const orsegaTotals = {
    unidades2024: ORSEGA_DATA.reduce((sum, row) => sum + row.unidades2024, 0),
    unidades2025: ORSEGA_DATA.reduce((sum, row) => sum + row.unidades2025, 0),
    presupuesto2025: ORSEGA_DATA.reduce((sum, row) => sum + row.presupuesto2025, 0),
  };

  if (companyId === 1) {
    // TABLA DURA - Kilogramos
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Comparativo Anual - DURA International</CardTitle>
              <CardDescription>Kilogramos totales por mes | 2024 vs 2025</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  <TableHead className="font-bold text-center w-28">Mes</TableHead>
                  <TableHead className="font-bold text-right">2024 (KG)</TableHead>
                  <TableHead className="font-bold text-right">2025 (KG)</TableHead>
                  <TableHead className="font-bold text-right">Diferencia</TableHead>
                  <TableHead className="font-bold text-center">% 2024/2025</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DURA_DATA.map((row, index) => {
                  const diff = row.kg2025 - row.kg2024;
                  const percentChange = ((row.kg2025 / row.kg2024) - 1) * 100;
                  const percentOf2024 = (row.kg2025 / row.kg2024) * 100;

                  return (
                    <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-semibold text-center">{row.mes}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(row.kg2024)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatNumber(row.kg2025)}</TableCell>
                      <TableCell className={`text-right font-mono ${getChangeColor(diff)}`}>
                        {getChangeIcon(diff)}
                        {diff >= 0 ? '+' : ''}{formatNumber(diff)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={percentOf2024 >= 100 ? "default" : "destructive"}
                          className={percentOf2024 >= 100 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}
                        >
                          {formatPercent(percentOf2024)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Fila de totales */}
                <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 font-bold border-t-2">
                  <TableCell className="text-center font-bold">TOTAL</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatNumber(duraTotals.kg2024)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatNumber(duraTotals.kg2025)}</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${getChangeColor(duraTotals.kg2025 - duraTotals.kg2024)}`}>
                    {getChangeIcon(duraTotals.kg2025 - duraTotals.kg2024)}
                    {duraTotals.kg2025 - duraTotals.kg2024 >= 0 ? '+' : ''}{formatNumber(duraTotals.kg2025 - duraTotals.kg2024)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-bold"
                    >
                      {formatPercent((duraTotals.kg2025 / duraTotals.kg2024) * 100)}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            * Datos temporales para presentación - Meta anual: 667,449 KG
          </p>
        </CardContent>
      </Card>
    );
  }

  // TABLA ORSEGA - Unidades con Presupuesto y Cumplimiento
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <FileSpreadsheet className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-xl">Comparativo Anual - Grupo ORSEGA</CardTitle>
            <CardDescription>Unidades por mes | 2024 vs 2025 | Objetivo mensual: {formatNumber(OBJETIVO_MENSUAL_ORSEGA)}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <TableHead className="font-bold text-center w-28">Mes</TableHead>
                <TableHead className="font-bold text-right">2024</TableHead>
                <TableHead className="font-bold text-right">2025</TableHead>
                <TableHead className="font-bold text-right">Presupuesto 2025</TableHead>
                <TableHead className="font-bold text-center">% vs Presupuesto</TableHead>
                <TableHead className="font-bold text-center">% vs Objetivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORSEGA_DATA.map((row, index) => {
                const percentVsPresupuesto = (row.unidades2025 / row.presupuesto2025) * 100;
                const percentVsObjetivo = ((row.unidades2025 - OBJETIVO_MENSUAL_ORSEGA) / OBJETIVO_MENSUAL_ORSEGA) * 100;

                return (
                  <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <TableCell className="font-semibold text-center">{row.mes}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatNumber(row.unidades2024)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatNumber(row.unidades2025)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatNumber(row.presupuesto2025)}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={percentVsPresupuesto >= 100 ? "default" : "destructive"}
                        className={percentVsPresupuesto >= 100 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}
                      >
                        {formatPercent(percentVsPresupuesto)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${getChangeColor(percentVsObjetivo)}`}>
                        {getChangeIcon(percentVsObjetivo)}
                        {percentVsObjetivo >= 0 ? '+' : ''}{percentVsObjetivo.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Fila de totales */}
              <TableRow className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 font-bold border-t-2">
                <TableCell className="text-center font-bold">TOTAL</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatNumber(orsegaTotals.unidades2024)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatNumber(orsegaTotals.unidades2025)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-muted-foreground">{formatNumber(orsegaTotals.presupuesto2025)}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 font-bold"
                  >
                    {formatPercent((orsegaTotals.unidades2025 / orsegaTotals.presupuesto2025) * 100)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-bold text-muted-foreground">—</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          * Datos temporales para presentación - Meta anual: 10,300,476 unidades
        </p>
      </CardContent>
    </Card>
  );
}
