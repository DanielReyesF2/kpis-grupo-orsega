import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PaymentSummary {
  period: string;
  count: number;
  total: number;
  currency?: string;
  trend?: "up" | "down" | "neutral";
  trendPercentage?: number;
  status?: "pending" | "completed" | "overdue";
}

interface PaymentSummaryCardsProps {
  currentWeek: PaymentSummary;
  nextWeek: PaymentSummary;
  onViewHistory?: () => void;
  className?: string;
}

export function PaymentSummaryCards({
  currentWeek,
  nextWeek,
  onViewHistory,
  className,
}: PaymentSummaryCardsProps) {
  const getTrendIcon = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "overdue":
        return (
          <Badge variant="destructive" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Vencidos
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="text-xs bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completados
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {/* Semana Actual */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="relative overflow-hidden border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 hover:shadow-lg transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/20 rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Semana Actual
                  </h3>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                  {currentWeek.period}
                </p>
              </div>
              {getStatusBadge(currentWeek.status)}
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-blue-900 dark:text-blue-50">
                  {currentWeek.count}
                </span>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  pago{currentWeek.count !== 1 ? "s" : ""}
                </span>
                {currentWeek.trend && (
                  <div className="flex items-center gap-1 ml-auto">
                    {getTrendIcon(currentWeek.trend)}
                    {currentWeek.trendPercentage && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          currentWeek.trend === "up"
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {currentWeek.trendPercentage > 0 ? "+" : ""}
                        {currentWeek.trendPercentage}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-2xl font-bold text-blue-900 dark:text-blue-50">
                  {currentWeek.currency || "MXN"} $
                  {currentWeek.total.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Siguiente Semana */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="relative overflow-hidden border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 hover:shadow-lg transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 dark:bg-emerald-800/20 rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    Siguiente Semana
                  </h3>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-3">
                  {nextWeek.period}
                </p>
              </div>
              {getStatusBadge(nextWeek.status)}
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-emerald-900 dark:text-emerald-50">
                  {nextWeek.count}
                </span>
                <span className="text-sm text-emerald-700 dark:text-emerald-300">
                  pago{nextWeek.count !== 1 ? "s" : ""}
                </span>
                {nextWeek.trend && (
                  <div className="flex items-center gap-1 ml-auto">
                    {getTrendIcon(nextWeek.trend)}
                    {nextWeek.trendPercentage && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          nextWeek.trend === "up"
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {nextWeek.trendPercentage > 0 ? "+" : ""}
                        {nextWeek.trendPercentage}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-50">
                  {nextWeek.currency || "MXN"} $
                  {nextWeek.total.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Botón de historial */}
      {onViewHistory && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="md:col-span-2"
        >
          <Button
            variant="outline"
            className="w-full"
            onClick={onViewHistory}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Ver Historial Completo de Pagos
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

