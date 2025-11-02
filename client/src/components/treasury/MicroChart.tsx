import { useMemo } from "react";

interface MicroChartProps {
  data: number[];
  color?: string;
  height?: number;
  showAnimation?: boolean;
}

export function MicroChart({ 
  data, 
  color = "hsl(var(--primary))", 
  height = 40,
  showAnimation = false 
}: MicroChartProps) {
  const pathData = useMemo(() => {
    if (!data || data.length === 0) return "";
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    if (data.length === 1) {
      const y = 50;
      return `0,${y} 100,${y}`;
    }
    
    return data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 80; // 80% of height for padding
      return `${x},${y}`;
    }).join(" ");
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>
        Sin datos
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg width="100%" height={height} className="overflow-visible" style={{ marginTop: height * 0.1 }}>
        <defs>
          {showAnimation && (
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.8}>
                <animate
                  attributeName="stopOpacity"
                  values="0.3;0.8;0.3"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor={color} stopOpacity={0.2}>
                <animate
                  attributeName="stopOpacity"
                  values="0.1;0.2;0.1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          )}
        </defs>
        
        {/* Sparkline path */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pathData}
          className={showAnimation ? "animate-breathe" : ""}
        />
        
        {/* Optional gradient fill */}
        {showAnimation && data.length > 0 && pathData && (
          <polygon
            fill="url(#gradient)"
            fillOpacity={0.1}
            points={`0,${height * 0.9} ${pathData} ${(data.length - 1) * (100 / (data.length - 1))},${height * 0.9}`}
          />
        )}
      </svg>
    </div>
  );
}

