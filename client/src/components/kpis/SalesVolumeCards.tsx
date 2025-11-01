import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface MonthData {
  month: string;
  value: number;
  percentChange: number;
  status: string;
  unit: string;
}

/**
 * Componente que muestra tarjetas de resumen de ventas
 * Carga datos dinámicamente desde la base de datos (últimos 12 meses)
 */
export function SalesVolumeCards({
  companyId,
  title = "Volumen de Ventas",
  subtitle = "Resumen mensual de ventas",
}: {
  companyId: number;
  title?: string;
  subtitle?: string;
}) {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  
  // KPI IDs para volumen de ventas
  const kpiId = companyId === 1 ? 39 : 10; // 39=Dura, 10=Orsega
  const unit = companyId === 1 ? 'KG' : 'unidades';
  
  // Meta mensual según la empresa
  const monthlyTarget = companyId === 1 ? 55620 : 858373;

  // Cargar datos históricos desde la API
  const { data: kpiHistory } = useQuery<any[]>({
    queryKey: [`/api/kpi-history/${kpiId}`, { months: 12 }],
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Procesar datos cuando llegan de la API
  useEffect(() => {
    if (kpiHistory && kpiHistory.length > 0) {
      // Definir orden de meses
      const monthOrder: { [key: string]: number } = {
        'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
        'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
        'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
      };
      
      // Ordenar por nombre del mes extraído del período
      const sortedHistory = [...kpiHistory].sort((a: any, b: any) => {
        const monthA = (a.period || '').split(' ')[0];
        const monthB = (b.period || '').split(' ')[0];
        return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
      });
      
      const processedData: MonthData[] = sortedHistory.map((item: any, index: number) => {
        const value = parseFloat(item.value) || 0;
        
        // Calcular porcentaje de cambio respecto a la meta mensual
        let percentChange = 0;
        if (monthlyTarget > 0) {
          percentChange = ((value - monthlyTarget) / monthlyTarget) * 100;
          percentChange = Math.round(percentChange * 10) / 10;
        }

        // Determinar status basado en el cumplimiento de la meta
        let status = 'success';
        if (percentChange < -20) status = 'danger';
        else if (percentChange < 0) status = 'warning';

        return {
          month: item.period || 'Sin período',
          value,
          percentChange,
          status,
          unit
        };
      });

      setMonthsData(processedData);
    }
  }, [kpiHistory, unit, monthlyTarget]);

  // Formatear números con separadores de miles
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-MX').format(num);
  };

  return (
    <>
      {/* Título */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          Datos mensuales de ventas • {monthsData.length} meses
        </p>
      </div>
      
      {/* Tarjetas de Ventas Mensuales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {monthsData.map((month, index) => (
          <Card key={index} className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-0 shadow-md">
            {/* Indicador de color superior */}
            <div className={`h-1 w-full ${
              month.percentChange > 0 ? 'bg-green-500' : 
              month.percentChange < 0 ? 'bg-red-500' : 'bg-blue-500'
            }`} />
            
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <span>{month.month.replace(' 2025', '')}</span>
                <span className="text-xs font-normal text-muted-foreground">2025</span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0 pb-4">
              <div className="space-y-4">
                {/* Volumen principal */}
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1">
                    {formatNumber(month.value)}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {month.unit}
                  </div>
                </div>
                
                {/* Comparación con meta mensual */}
                <div className="flex items-center justify-center">
                  <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    month.percentChange > 0 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                      : month.percentChange < 0 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                  }`}>
                    {month.percentChange > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : month.percentChange < 0 ? (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    ) : null}
                    <span>
                      {month.percentChange > 0 ? '+' : ''}{month.percentChange}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
