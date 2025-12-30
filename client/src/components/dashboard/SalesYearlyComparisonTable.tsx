/**
 * ========================================================================
 * COMPARATIVO ANUAL DE VENTAS - DATOS DINÁMICOS
 * ========================================================================
 * Muestra tabla comparativa con datos reales de la base de datos.
 * Soporta selección de años para comparar cualquier período histórico.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, FileSpreadsheet, Target, Calendar, Award, AlertTriangle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SalesYearlyComparisonTableProps {
  companyId: number;
}

interface ComparisonRow {
  mes: string;
  monthNum: number;
  qty_diff: number;
  qty_percent: number;
  amt_diff: number;
  amt_percent: number;
  unit: string;
  [key: string]: any;
}

interface ComparisonData {
  companyId: number;
  year1: number;
  year2: number;
  data: ComparisonRow[];
  totals: {
    qty_diff: number;
    qty_percent: number;
    amt_diff: number;
    amt_percent: number;
    [key: string]: number;
  };
  availableYears: number[];
  unit: string;
}

export function SalesYearlyComparisonTable({ companyId }: SalesYearlyComparisonTableProps) {
  const currentYear = new Date().getFullYear();
  const [year1, setYear1] = useState(currentYear - 1);
  const [year2, setYear2] = useState(currentYear);

  const { data, isLoading, error } = useQuery<ComparisonData>({
    queryKey: ['/api/sales-yearly-comparison', companyId, year1, year2],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-yearly-comparison?companyId=${companyId}&year1=${year1}&year2=${year2}`);
      return await res.json();
    },
    enabled: !!companyId,
  });

  const formatNumber = (num: number) => new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);

  const formatPercent = (num: number) => {
    const formatted = Math.abs(num).toFixed(1);
    return `${num >= 0 ? '+' : '-'}${formatted}%`;
  };

  const getChangeColor = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getChangeIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 inline mr-1" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 inline mr-1" />;
    return <Minus className="h-4 w-4 inline mr-1" />;
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <CardTitle>Cargando comparativo...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="shadow-lg border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Error al cargar datos comparativos</p>
        </CardContent>
      </Card>
    );
  }

  const { data: rows, totals, availableYears, unit } = data;
  const companyName = companyId === 1 ? "DURA International" : "Grupo ORSEGA";
  const companyColor = companyId === 1 ? "blue" : "purple";

  // Análisis dinámico
  const monthsPositive = rows.filter(r => r.qty_diff > 0).length;
  const bestMonth = rows.reduce((best, row) => row.qty_diff > best.qty_diff ? row : best, rows[0]);
  const worstMonth = rows.reduce((worst, row) => row.qty_diff < worst.qty_diff ? row : worst, rows[0]);

  return (
    <div className="space-y-4">
      {/* Selector de años */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">Comparar:</span>
            <Select value={year1.toString()} onValueChange={(v) => setYear1(parseInt(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">vs</span>
            <Select value={year2.toString()} onValueChange={(v) => setYear2(parseInt(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de Análisis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={`bg-gradient-to-br from-${companyColor}-50 to-${companyColor}-100/50 dark:from-${companyColor}-950/20 dark:to-${companyColor}-900/10 border-${companyColor}-200/50`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className={`h-4 w-4 text-${companyColor}-600`} />
              <span className={`text-xs font-medium text-${companyColor}-600`}>Total {year2}</span>
            </div>
            <p className={`text-xl font-bold text-${companyColor}-700`}>
              {formatNumber(totals[`qty_${year2}`])} {unit}
            </p>
            <p className={`text-xs mt-1 ${totals.qty_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.qty_percent >= 0 ? '↑' : '↓'} {Math.abs(totals.qty_percent).toFixed(1)}% vs {year1}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Meses Positivos</span>
            </div>
            <p className="text-xl font-bold text-green-700">{monthsPositive}/12</p>
            <p className="text-xs text-muted-foreground mt-1">Superan a {year1}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-600">Mejor Mes</span>
            </div>
            <p className="text-lg font-bold text-emerald-700">{bestMonth?.mes || '-'}</p>
            <p className="text-xs text-emerald-600 mt-1">
              +{formatNumber(bestMonth?.qty_diff || 0)} {unit}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-red-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-600">Mes Crítico</span>
            </div>
            <p className="text-lg font-bold text-red-700">{worstMonth?.mes || '-'}</p>
            <p className="text-xs text-red-600 mt-1">
              {formatNumber(worstMonth?.qty_diff || 0)} {unit}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla Comparativa */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-${companyColor}-100 dark:bg-${companyColor}-900/30 rounded-lg`}>
              <FileSpreadsheet className={`h-6 w-6 text-${companyColor}-600 dark:text-${companyColor}-400`} />
            </div>
            <div>
              <CardTitle className="text-xl">Comparativo Anual - {companyName}</CardTitle>
              <CardDescription>
                {unit} por mes | {year1} vs {year2}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  <TableHead className="font-bold text-center w-28">Mes</TableHead>
                  <TableHead className="font-bold text-right">{year1} ({unit})</TableHead>
                  <TableHead className="font-bold text-right">{year2} ({unit})</TableHead>
                  <TableHead className="font-bold text-right">Diferencia</TableHead>
                  <TableHead className="font-bold text-center">% Cambio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const qty1 = row[`qty_${year1}`] || 0;
                  const qty2 = row[`qty_${year2}`] || 0;
                  const percentOf = qty1 > 0 ? (qty2 / qty1) * 100 : 0;

                  return (
                    <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-semibold text-center">{row.mes}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(qty1)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatNumber(qty2)}</TableCell>
                      <TableCell className={`text-right font-mono ${getChangeColor(row.qty_diff)}`}>
                        {getChangeIcon(row.qty_diff)}
                        {row.qty_diff >= 0 ? '+' : ''}{formatNumber(row.qty_diff)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={percentOf >= 100 ? "default" : "destructive"}
                          className={percentOf >= 100 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}
                        >
                          {percentOf.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Fila de totales */}
                <TableRow className={`bg-gradient-to-r from-${companyColor}-50 to-${companyColor}-100 dark:from-${companyColor}-900/20 dark:to-${companyColor}-800/20 font-bold border-t-2`}>
                  <TableCell className="text-center font-bold">TOTAL</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(totals[`qty_${year1}`])}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(totals[`qty_${year2}`])}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${getChangeColor(totals.qty_diff)}`}>
                    {getChangeIcon(totals.qty_diff)}
                    {totals.qty_diff >= 0 ? '+' : ''}{formatNumber(totals.qty_diff)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`bg-${companyColor}-100 text-${companyColor}-800 dark:bg-${companyColor}-900/30 dark:text-${companyColor}-400 font-bold`}
                    >
                      {totals[`qty_${year1}`] > 0
                        ? ((totals[`qty_${year2}`] / totals[`qty_${year1}`]) * 100).toFixed(1)
                        : '0.0'}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Datos históricos de {availableYears[availableYears.length - 1]} a {availableYears[0]}
          </p>
        </CardContent>
      </Card>

      {/* Resumen de Análisis */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Resumen del Análisis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-4 rounded-lg border ${totals.qty_percent >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : 'bg-red-50 border-red-200 dark:bg-red-950/20'}`}>
            <p className="text-sm leading-relaxed">
              <strong>{companyName}</strong> presenta un{' '}
              <span className={totals.qty_percent >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {totals.qty_percent >= 0 ? 'crecimiento' : 'decrecimiento'} del {Math.abs(totals.qty_percent).toFixed(1)}%
              </span>
              {' '}en {year2} comparado con {year1}.
              Esto representa{' '}
              <span className="font-semibold">
                {totals.qty_diff >= 0 ? '+' : ''}{formatNumber(totals.qty_diff)} {unit}
              </span>
              {' '}de diferencia.
              <br /><br />
              <strong>{monthsPositive} de 12 meses</strong> superan el desempeño del año anterior.
              El mejor mes fue <strong>{bestMonth?.mes}</strong> (+{formatNumber(bestMonth?.qty_diff || 0)} {unit})
              y el mes más crítico fue <strong>{worstMonth?.mes}</strong> ({formatNumber(worstMonth?.qty_diff || 0)} {unit}).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
