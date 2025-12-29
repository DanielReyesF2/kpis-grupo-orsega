import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface TimelineBadgeProps {
  date: Date;
  status: "upcoming" | "due" | "overdue";
  amount?: number;
  currency?: string;
}

export function TimelineBadge({ date, status, amount, currency = "MXN" }: TimelineBadgeProps) {
  const now = new Date();
  const isPast = date < now;
  const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const getConfig = () => {
    if (status === "overdue" || (isPast && status === "due")) {
      return {
        variant: "destructive" as const,
        icon: AlertCircle,
        className: "bg-red-500/10 text-red-600 border-red-500/20 animate-pulse-glow",
        label: daysDiff === 0 ? "Hoy" : `${Math.abs(daysDiff)}d atrasado`,
      };
    }
    if (daysDiff === 0) {
      return {
        variant: "default" as const,
        icon: Clock,
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        label: "Hoy",
      };
    }
    if (daysDiff === 1) {
      return {
        variant: "secondary" as const,
        icon: Clock,
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        label: "Mañana",
      };
    }
    return {
      variant: "outline" as const,
      icon: CheckCircle2,
      className: "",
      label: `${daysDiff}d`,
    };
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} flex items-center gap-1 text-xs`}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {amount && (
        <span className="ml-1 font-semibold">
          {new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
          }).format(amount)}
        </span>
      )}
    </Badge>
  );
}











