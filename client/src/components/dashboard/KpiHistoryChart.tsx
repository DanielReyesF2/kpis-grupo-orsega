import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { KpiValue } from '@shared/schema';
import { formatDateAndTime } from '@/utils/dates';

interface KpiHistoryChartProps {
  kpiValues: KpiValue[];
  title: string;
  isInverted?: boolean; // Para KPIs donde valores menores son mejores (ej: rotación de cuentas por cobrar)
  unit?: string;
  target?: string;
}

const getChartColor = (isInverted: boolean, value: number, targetValue: number): string => {
  // Si está invertido, los valores menores son mejores
  const isGood = isInverted 
    ? value <= targetValue
    : value >= targetValue;
  
  return isGood ? '#4ade80' : '#ef4444';
};

const KpiHistoryChart: React.FC<KpiHistoryChartProps> = ({
  kpiValues,
  title,
  isInverted = false,
  unit = '',
  target = '0',
}) => {
  // Procesar datos para la gráfica
  const chartData = useMemo(() => {
    // Ordenar por fecha, más antiguo primero
    const sortedValues = [...kpiValues].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
    
    // Convertir valores a números para la gráfica
    return sortedValues.map(kv => {
      // Limpiar el valor de cualquier texto/unidad, dejando solo el número
      let numericValue = parseFloat(kv.value.replace(/[^\d.-]/g, ''));
      
      return {
        fecha: kv.date ? formatDateAndTime(kv.date) : 'Fecha no disponible',
        valor: numericValue,
        period: kv.period,
        original: kv.value, // Mantener el valor original con formato para el tooltip
      };
    });
  }, [kpiValues]);
  
  // Convertir target a número para comparación
  const targetNumeric = parseFloat(target.replace(/[^\d.-]/g, ''));

  return (
    <Card className="w-full h-full shadow-md">
      <CardHeader>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-gray-500">Tendencia histórica</p>
      </CardHeader>
      <CardContent>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fecha" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  // Mostrar el valor original con formato
                  const dataPoint = chartData.find(d => d.valor === value);
                  return [dataPoint?.original || value, "Valor"];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="valor"
                name="Valor"
                stroke="#273949"
                activeDot={{ r: 8 }}
                strokeWidth={2}
                dot={{ 
                  stroke: '#273949', 
                  strokeWidth: 2,
                  r: 4,
                  fill: '#fff'
                }}
              />
              {/* Línea de objetivo */}
              <Line
                type="monotone"
                dataKey={() => targetNumeric}
                name="Objetivo"
                stroke="#b5e951"
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            {chartData.length === 0 
              ? "No hay datos históricos disponibles"
              : "Se necesitan al menos dos puntos para mostrar la tendencia"}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KpiHistoryChart;