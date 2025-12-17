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
import { TrendingUp, TrendingDown, Minus, FileSpreadsheet, Target, Calendar, Award, AlertTriangle, UserMinus, Users } from "lucide-react";

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

// Clientes Perdidos (Churn) - DURA
const DURA_CHURN_CLIENTS = [
  { cliente: "DURA CHEMICALS", volumen2024: 19000, ultimaCompra: "Jul 2024", productos: "Meko" },
  { cliente: "PINTURAS AXEL", volumen2024: 6848, ultimaCompra: "Sep 2024", productos: "Meko, Co 12, Zr 24%" },
  { cliente: "BARENTZ HONDURAS", volumen2024: 3582, ultimaCompra: "Feb 2024", productos: "Meko, Ca 10%, Zr 24%" },
  { cliente: "SEGUQUIM", volumen2024: 1300, ultimaCompra: "Jul 2024", productos: "Acetato de Zinc" },
  { cliente: "CASMAN", volumen2024: 1156, ultimaCompra: "Abr 2024", productos: "Zn 14.5%" },
  { cliente: "NASEDA", volumen2024: 962, ultimaCompra: "Jul 2024", productos: "Mn 9%" },
  { cliente: "RAQUEL LOPEZ", volumen2024: 900, ultimaCompra: "Sep 2024", productos: "Co 6%" },
];

// Clientes con Mayor Caída - DURA
const DURA_DECLINING_CLIENTS = [
  { cliente: "BP INTERNATIONAL TRADING", kg2024: 66513, kg2025: 15202, perdida: -40226 },
  { cliente: "INDUSTRIAL DE PINTURAS ECATEPEC", kg2024: 35472, kg2025: 12076, perdida: -17483 },
  { cliente: "DURA CHEMICALS", kg2024: 19000, kg2025: 0, perdida: -15833 },
  { cliente: "PINTURAS BEREL", kg2024: 61524, kg2025: 43500, perdida: -7770 },
  { cliente: "PINTURAS AXEL", kg2024: 6848, kg2025: 0, perdida: -5707 },
  { cliente: "PLACOSA", kg2024: 36720, kg2025: 25501, perdida: -5099 },
  { cliente: "BARENTZ GUATEMALA", kg2024: 5130, kg2025: 1078, perdida: -3198 },
  { cliente: "BARENTZ HONDURAS", kg2024: 3582, kg2025: 0, perdida: -2985 },
  { cliente: "INDUSTRIAL TECNICA", kg2024: 55284, kg2025: 43650, perdida: -2421 },
  { cliente: "SANCHEZ", kg2024: 2326, kg2025: 16, perdida: -1922 },
];

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

  // Análisis para DURA
  const duraAnalysis = {
    totalChange: duraTotals.kg2025 - duraTotals.kg2024,
    percentChange: ((duraTotals.kg2025 / duraTotals.kg2024) - 1) * 100,
    monthsAbove2024: DURA_DATA.filter(row => row.kg2025 >= row.kg2024).length,
    bestMonth: DURA_DATA.reduce((best, row) => {
      const currentDiff = row.kg2025 - row.kg2024;
      const bestDiff = best.kg2025 - best.kg2024;
      return currentDiff > bestDiff ? row : best;
    }),
    worstMonth: DURA_DATA.reduce((worst, row) => {
      const currentDiff = row.kg2025 - row.kg2024;
      const worstDiff = worst.kg2025 - worst.kg2024;
      return currentDiff < worstDiff ? row : worst;
    }),
  };

  // Análisis para ORSEGA
  const orsegaAnalysis = {
    totalChange: orsegaTotals.unidades2025 - orsegaTotals.unidades2024,
    percentChange: ((orsegaTotals.unidades2025 / orsegaTotals.unidades2024) - 1) * 100,
    monthsAboveBudget: ORSEGA_DATA.filter(row => row.unidades2025 >= row.presupuesto2025).length,
    monthsAboveTarget: ORSEGA_DATA.filter(row => row.unidades2025 >= OBJETIVO_MENSUAL_ORSEGA).length,
    bestMonth: ORSEGA_DATA.reduce((best, row) => {
      return row.unidades2025 > best.unidades2025 ? row : best;
    }),
    worstMonth: ORSEGA_DATA.reduce((worst, row) => {
      return row.unidades2025 < worst.unidades2025 ? row : worst;
    }),
  };

  if (companyId === 1) {
    // TABLA DURA - Kilogramos
    return (
      <div className="space-y-4">
        {/* Tarjetas de Análisis DURA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Total 2025</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{formatNumber(duraTotals.kg2025)} KG</p>
              <p className={`text-xs mt-1 ${duraAnalysis.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {duraAnalysis.percentChange >= 0 ? '↑' : '↓'} {Math.abs(duraAnalysis.percentChange).toFixed(1)}% vs 2024
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-600">Meses Positivos</span>
              </div>
              <p className="text-xl font-bold text-green-700">{duraAnalysis.monthsAbove2024}/12</p>
              <p className="text-xs text-muted-foreground mt-1">Superan a 2024</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600">Mejor Mes</span>
              </div>
              <p className="text-lg font-bold text-emerald-700">{duraAnalysis.bestMonth.mes}</p>
              <p className="text-xs text-emerald-600 mt-1">
                +{formatNumber(duraAnalysis.bestMonth.kg2025 - duraAnalysis.bestMonth.kg2024)} KG
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-red-200/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-600">Mes Crítico</span>
              </div>
              <p className="text-lg font-bold text-red-700">{duraAnalysis.worstMonth.mes}</p>
              <p className="text-xs text-red-600 mt-1">
                {formatNumber(duraAnalysis.worstMonth.kg2025 - duraAnalysis.worstMonth.kg2024)} KG
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla DURA */}
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

        {/* Tabla Clientes con Mayor Caída - DURA */}
        <Card className="shadow-lg border-l-4 border-l-red-500">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Clientes con Mayor Caída - DI</CardTitle>
                <CardDescription>Los 10 clientes que más volumen perdieron</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
                    <TableHead className="font-bold">Cliente</TableHead>
                    <TableHead className="font-bold text-right">2024 (kg)</TableHead>
                    <TableHead className="font-bold text-right">2025 (kg)</TableHead>
                    <TableHead className="font-bold text-right">Pérdida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DURA_DECLINING_CLIENTS.map((row, index) => (
                    <TableRow key={index} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                      <TableCell className="font-semibold">{row.cliente}</TableCell>
                      <TableCell className="text-right font-mono">{row.kg2024.toLocaleString('es-MX')}</TableCell>
                      <TableCell className="text-right font-mono">{row.kg2025.toLocaleString('es-MX')}</TableCell>
                      <TableCell className="text-right font-mono text-red-600 font-bold">
                        {row.perdida.toLocaleString('es-MX')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>📊 Análisis:</strong> Solo estos 10 clientes representan <strong>102,644 kg de pérdida</strong>.
                BP International y Industrial de Pinturas Ecatepec juntos suman casi 60,000 kg de caída.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabla Clientes Perdidos (Churn) - DURA */}
        <Card className="shadow-lg border-l-4 border-l-amber-500">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <UserMinus className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Clientes Perdidos (Churn)</CardTitle>
                <CardDescription>9 clientes que compraron en 2024 y no han comprado nada en 2025</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
                    <TableHead className="font-bold">Cliente</TableHead>
                    <TableHead className="font-bold text-right">Volumen 2024</TableHead>
                    <TableHead className="font-bold text-center">Última compra</TableHead>
                    <TableHead className="font-bold">Productos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DURA_CHURN_CLIENTS.map((row, index) => (
                    <TableRow key={index} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                      <TableCell className="font-semibold">{row.cliente}</TableCell>
                      <TableCell className="text-right font-mono">{row.volumen2024.toLocaleString('es-MX')} kg</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          {row.ultimaCompra}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.productos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>⚠️ Alerta:</strong> Volumen total perdido por churn: <strong>33,947 kg</strong>.
                DURA CHEMICALS era cliente nuevo, compró fuerte y desapareció. CASMAN era cliente de 3 años.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // TABLA ORSEGA - Unidades con Presupuesto y Cumplimiento
  return (
    <div className="space-y-4">
      {/* Tarjetas de Análisis ORSEGA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Total 2025</span>
            </div>
            <p className="text-lg font-bold text-purple-700">{formatNumber(orsegaTotals.unidades2025)}</p>
            <p className={`text-xs mt-1 ${orsegaAnalysis.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {orsegaAnalysis.percentChange >= 0 ? '↑' : '↓'} {Math.abs(orsegaAnalysis.percentChange).toFixed(1)}% vs 2024
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Cumplen Presupuesto</span>
            </div>
            <p className="text-xl font-bold text-green-700">{orsegaAnalysis.monthsAboveBudget}/12</p>
            <p className="text-xs text-muted-foreground mt-1">Meses en meta</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-600">Mejor Mes</span>
            </div>
            <p className="text-lg font-bold text-emerald-700">{orsegaAnalysis.bestMonth.mes}</p>
            <p className="text-xs text-emerald-600 mt-1">
              {formatNumber(orsegaAnalysis.bestMonth.unidades2025)} uds
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Mes Bajo</span>
            </div>
            <p className="text-lg font-bold text-amber-700">{orsegaAnalysis.worstMonth.mes}</p>
            <p className="text-xs text-amber-600 mt-1">
              {formatNumber(orsegaAnalysis.worstMonth.unidades2025)} uds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla ORSEGA */}
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
    </div>
  );
}
