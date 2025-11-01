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
              margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
            >
              <defs>
                <linearGradient id="kpiValueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="fecha" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value, name) => {
                  // Mostrar el valor original con formato
                  const dataPoint = chartData.find(d => d.valor === value);
                  return [dataPoint?.original || value, "Valor"];
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="valor"
                name="Valor"
                stroke="#2563eb"
                activeDot={{ r: 6 }}
                strokeWidth={3}
                dot={false}
              />
              {/* Línea de objetivo */}
              <Line
                type="monotone"
                dataKey={() => targetNumeric}
                name="Objetivo"
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeWidth={2}
                strokeOpacity={0.6}
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