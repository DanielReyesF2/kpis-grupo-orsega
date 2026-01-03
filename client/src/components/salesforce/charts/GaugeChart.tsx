import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "../feedback/LoadingState";
import { EmptyState } from "../feedback/EmptyState";

export interface GaugeChartProps {
  value: number;
  min: number;
  max: number;
  zones: Array<{ min: number; max: number; color: string }>;
  label: string;
  unit?: string;
  formatValue?: (value: number) => string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export function GaugeChart({
  value,
  min,
  max,
  zones,
  label,
  unit = '',
  formatValue,
  size = 'md',
  animated = true,
  isLoading = false,
  error = null
}: GaugeChartProps) {
  const sizeConfig = {
    sm: { width: 200, height: 120, fontSize: 14, centerY: 100 },
    md: { width: 300, height: 180, fontSize: 16, centerY: 150 },
    lg: { width: 400, height: 240, fontSize: 18, centerY: 200 }
  };

  const config = sizeConfig[size];
  const centerX = config.width / 2;
  const radius = config.width * 0.35;
  const startAngle = 180;
  const endAngle = 0;
  const angleRange = endAngle - startAngle;

  // Calculate needle angle
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const needleAngle = startAngle + (percentage / 100) * angleRange;

  // Format value
  const displayValue = formatValue ? formatValue(value) : `${value.toLocaleString()}${unit}`;
  const percentageDisplay = `${Math.round(percentage)}%`;

  // Determine which zone the value is in
  const currentZone = useMemo(() => {
    return zones.find(zone => value >= zone.min && value <= zone.max) || zones[zones.length - 1];
  }, [value, zones]);

  // Generate arc paths for zones
  const zonePaths = useMemo(() => {
    return zones.map((zone, index) => {
      const zoneMin = Math.max(0, Math.min(100, ((zone.min - min) / (max - min)) * 100));
      const zoneMax = Math.max(0, Math.min(100, ((zone.max - min) / (max - min)) * 100));
      const startAngleZone = startAngle + (zoneMin / 100) * angleRange;
      const endAngleZone = startAngle + (zoneMax / 100) * angleRange;
      const angleDiff = endAngleZone - startAngleZone;

      const startX = centerX + radius * Math.cos((startAngleZone * Math.PI) / 180);
      const startY = config.centerY + radius * Math.sin((startAngleZone * Math.PI) / 180);
      const endX = centerX + radius * Math.cos((endAngleZone * Math.PI) / 180);
      const endY = config.centerY + radius * Math.sin((endAngleZone * Math.PI) / 180);

      const largeArcFlag = angleDiff > 180 ? 1 : 0;

      return {
        path: `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        color: zone.color
      };
    });
  }, [zones, min, max, centerX, radius, config.centerY, startAngle, angleRange]);

  // Needle path
  const needleLength = radius * 0.85;
  const needleX = centerX + needleLength * Math.cos((needleAngle * Math.PI) / 180);
  const needleY = config.centerY + needleLength * Math.sin((needleAngle * Math.PI) / 180);

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (value === null || value === undefined || isNaN(value)) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sin datos"
        description="No hay datos disponibles para mostrar"
        size="sm"
      />
    );
  }

  const GaugeContent = (
    <div className={cn("flex flex-col items-center", size === 'sm' ? 'p-4' : size === 'md' ? 'p-6' : 'p-8')}>
      <svg width={config.width} height={config.height} className="overflow-visible">
        {/* Zone arcs */}
        {zonePaths.map((zone, index) => (
          <path
            key={index}
            d={zone.path}
            stroke={zone.color}
            strokeWidth={size === 'sm' ? 12 : size === 'md' ? 16 : 20}
            fill="none"
            strokeLinecap="round"
            opacity={0.3}
          />
        ))}

        {/* Active zone arc (where value is) */}
        {currentZone && (
          <path
            d={zonePaths[zones.indexOf(currentZone)]?.path || ''}
            stroke={currentZone.color}
            strokeWidth={size === 'sm' ? 12 : size === 'md' ? 16 : 20}
            fill="none"
            strokeLinecap="round"
            opacity={1}
          />
        )}

        {/* Needle */}
        <motion.g
          initial={animated ? { rotate: startAngle } : false}
          animate={{ rotate: needleAngle }}
          transition={{ duration: 1, ease: "easeOut" }}
          transform={`rotate(${needleAngle} ${centerX} ${config.centerY})`}
        >
          <line
            x1={centerX}
            y1={config.centerY}
            x2={centerX + needleLength}
            y2={config.centerY}
            stroke="#1A1A1A"
            strokeWidth={size === 'sm' ? 2 : size === 'md' ? 3 : 4}
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={config.centerY}
            r={size === 'sm' ? 4 : size === 'md' ? 6 : 8}
            fill="#1A1A1A"
          />
        </motion.g>

        {/* Center circle */}
        <circle
          cx={centerX}
          cy={config.centerY}
          r={size === 'sm' ? 3 : size === 'md' ? 4 : 5}
          fill="white"
          stroke="#1A1A1A"
          strokeWidth={1}
        />
      </svg>

      {/* Value display */}
      <div className="mt-4 text-center" role="region" aria-label={`Gauge chart: ${label}, Value: ${displayValue}, Percentage: ${percentageDisplay}`}>
        <p className={cn(
          "font-semibold text-foreground",
          size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'
        )}>
          {displayValue}
        </p>
        <p className={cn(
          "text-muted-foreground mt-1",
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {percentageDisplay}
        </p>
        <p className={cn(
          "text-muted-foreground mt-2",
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {label}
        </p>
      </div>
    </div>
  );

  return GaugeContent;
}

