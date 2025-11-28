import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface PendingTodayCardProps {
  count: number; // número de pagos en "En seguimiento REP"
  onViewAll: () => void;
}

export function PendingTodayCard({ count, onViewAll }: PendingTodayCardProps) {
  // Si no hay REPs pendientes, ocultar el indicador
  if (count === 0) {
    return null;
  }

  return (
    <Badge
      onClick={onViewAll}
      className="ml-3 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold cursor-pointer transition-colors shadow-sm hover:shadow-md"
      style={{ fontWeight: 600 }}
    >
      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
      {count} REP{count > 1 ? 's' : ''} pendiente{count > 1 ? 's' : ''}
    </Badge>
  );
}

