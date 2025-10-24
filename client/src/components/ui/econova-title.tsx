import { cn } from "@/lib/utils";

interface EconovaTitleProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function EconovaTitle({ 
  title = "ECONOVA", 
  subtitle = "SISTEMA KPIs", 
  className 
}: EconovaTitleProps) {
  return (
    <div className={cn("flex flex-col items-start py-2", className)}>
      <h1 className="text-3xl font-anton tracking-tight text-primary dark:text-white">{title}</h1>
      {subtitle && (
        <h2 className="text-sm font-ruda font-medium text-secondary-600 dark:text-white/80 tracking-wide">{subtitle}</h2>
      )}
    </div>
  );
}