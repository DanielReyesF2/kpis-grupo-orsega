import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "../feedback/LoadingState";
import { EmptyState } from "../feedback/EmptyState";
import { AlertCircle } from "lucide-react";

export interface FunnelStage {
  stage: string;
  value: number;
  color?: string;
  percentage?: number;
}

export interface FunnelChartProps {
  data: FunnelStage[];
  orientation?: 'vertical' | 'horizontal';
  showPercentages?: boolean;
  onStageClick?: (stage: string) => void;
  formatValue?: (value: number) => string;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function FunnelChart({
  data,
  orientation = 'vertical',
  showPercentages = true,
  onStageClick,
  formatValue,
  isLoading = false,
  error = null,
  className
}: FunnelChartProps) {
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const maxValue = Math.max(...data.map(item => item.value));
    
    return data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const widthPercentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
      
      // Calculate conversion rate from previous stage
      const prevValue = index > 0 ? data[index - 1].value : item.value;
      const conversionRate = prevValue > 0 ? (item.value / prevValue) * 100 : 100;
      
      return {
        ...item,
        percentage,
        widthPercentage,
        conversionRate,
        color: item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`
      };
    });
  }, [data]);

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

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const formattedTotal = formatValue ? formatValue(total) : total.toLocaleString();

  if (orientation === 'horizontal') {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">Total: {formattedTotal}</p>
        </div>
        {processedData.map((item, index) => (
          <motion.div
            key={item.stage}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="cursor-pointer"
            onClick={() => onStageClick?.(item.stage)}
          >
            <div className="flex items-center gap-4 mb-2">
              <div className="w-32 text-sm font-medium text-foreground">
                {item.stage}
              </div>
              <div className="flex-1 relative">
                <div
                  className="h-10 rounded-md transition-all hover:opacity-90"
                  style={{
                    width: `${item.widthPercentage}%`,
                    backgroundColor: item.color
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3 text-sm font-semibold text-white">
                  <span>{formatValue ? formatValue(item.value) : item.value.toLocaleString()}</span>
                  {showPercentages && (
                    <span>{item.percentage.toFixed(1)}%</span>
                  )}
                </div>
              </div>
              {index > 0 && showPercentages && (
                <div className="w-20 text-xs text-muted-foreground text-right">
                  {item.conversionRate.toFixed(1)}%
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Vertical orientation (default)
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">Total: {formattedTotal}</p>
      </div>
      <div className="space-y-2 w-full max-w-md">
        {processedData.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === processedData.length - 1;
          
          // Calculate trapezoid dimensions
          const baseWidth = item.widthPercentage;
          const nextWidth = index < processedData.length - 1 
            ? processedData[index + 1].widthPercentage 
            : baseWidth;
          
          const topWidth = isFirst ? 100 : nextWidth;
          const bottomWidth = isLast ? 0 : baseWidth;
          
          return (
            <motion.div
              key={item.stage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative cursor-pointer group"
              onClick={() => onStageClick?.(item.stage)}
            >
              <svg
                width="100%"
                height="60"
                className="overflow-visible"
                style={{ minHeight: '60px' }}
              >
                <defs>
                  <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={item.color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={item.color} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <polygon
                  points={`
                    ${(100 - topWidth) / 2},0
                    ${(100 + topWidth) / 2},0
                    ${(100 + bottomWidth) / 2},60
                    ${(100 - bottomWidth) / 2},60
                  `}
                  fill={`url(#gradient-${index})`}
                  className="transition-all group-hover:opacity-90"
                />
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-sm font-semibold pointer-events-none"
                >
                  {item.stage}
                </text>
                <text
                  x="50%"
                  y="70%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-xs pointer-events-none"
                >
                  {formatValue ? formatValue(item.value) : item.value.toLocaleString()}
                  {showPercentages && ` (${item.percentage.toFixed(1)}%)`}
                </text>
              </svg>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

