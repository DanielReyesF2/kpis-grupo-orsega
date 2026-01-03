import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "../feedback/LoadingState";
import { EmptyState } from "../feedback/EmptyState";
import { AlertCircle } from "lucide-react";

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

export interface EnhancedDonutChartProps {
  data: DonutSegment[];
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  legendPosition?: 'right' | 'bottom';
  onSegmentClick?: (segment: DonutSegment) => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  innerRadius?: number;
  outerRadius?: number;
}

const RADIAN = Math.PI / 180;

export function EnhancedDonutChart({
  data,
  centerLabel,
  centerValue,
  showLegend = true,
  legendPosition = 'right',
  onSegmentClick,
  isLoading = false,
  error = null,
  className,
  innerRadius = 60,
  outerRadius = 100
}: EnhancedDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  const processedData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0
    }));
  }, [data, total]);

  const displayCenterValue = useMemo(() => {
    if (centerValue !== undefined) {
      return typeof centerValue === 'number' 
        ? centerValue.toLocaleString() 
        : centerValue;
    }
    return total.toLocaleString();
  }, [centerValue, total]);

  const handleSegmentClick = (data: any, index: number) => {
    setActiveIndex(index);
    if (onSegmentClick && processedData[index]) {
      onSegmentClick(processedData[index]);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Valor: {data.value.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Porcentaje: {((data.value / total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (entry: any) => {
    const percentage = ((entry.value / total) * 100).toFixed(1);
    return `${percentage}%`;
  };

  if (isLoading) {
    return <ChartSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8", className)}>
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sin datos"
        description="No hay datos disponibles para mostrar"
        size="sm"
        className={className}
      />
    );
  }

  return (
    <div className={cn(
      "flex",
      legendPosition === 'right' ? "flex-row gap-6" : "flex-col gap-4",
      className
    )}>
      <div className={cn(
        "relative",
        legendPosition === 'right' ? "flex-1" : "w-full"
      )}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              fill="#8884d8"
              dataKey="value"
              onClick={handleSegmentClick}
              activeIndex={activeIndex}
              activeShape={{
                outerRadius: outerRadius + 5,
                innerRadius: innerRadius - 5
              }}
            >
              {processedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  className={cn(
                    "cursor-pointer transition-all",
                    activeIndex === index ? "opacity-100" : "opacity-90 hover:opacity-100"
                  )}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && (
            <p className="text-sm text-muted-foreground mb-1">{centerLabel}</p>
          )}
          <motion.p
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-2xl font-bold text-foreground"
          >
            {displayCenterValue}
          </motion.p>
        </div>
      </div>

      {showLegend && (
        <div className={cn(
          "flex",
          legendPosition === 'right' ? "flex-col gap-2" : "flex-row flex-wrap gap-4 justify-center"
        )}>
          {processedData.map((entry, index) => (
            <div
              key={entry.name}
              className={cn(
                "flex items-center gap-2 cursor-pointer transition-opacity",
                activeIndex === index ? "opacity-100" : "opacity-70 hover:opacity-100"
              )}
              onClick={() => handleSegmentClick(null, index)}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-foreground">{entry.name}</span>
              <span className="text-xs text-muted-foreground">
                ({entry.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

