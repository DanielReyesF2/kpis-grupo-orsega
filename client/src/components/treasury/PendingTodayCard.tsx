import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface PaymentVoucher {
  id: number;
  clientName: string;
  status: string;
  extractedAmount: number | null;
  extractedCurrency: string | null;
  createdAt: string;
  payerCompanyId: number;
}

interface PendingTodayCardProps {
  onViewAll: () => void;
}

export function PendingTodayCard({ onViewAll }: PendingTodayCardProps) {
  // Obtener comprobantes pendientes del día
  const { data: vouchers = [], isLoading } = useQuery<PaymentVoucher[]>({
    queryKey: ["/api/payment-vouchers"],
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Refrescar cada minuto
  });

  // Filtrar comprobantes pendientes del día de hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingToday = vouchers.filter((v) => {
    const voucherDate = new Date(v.createdAt);
    voucherDate.setHours(0, 0, 0, 0);
    
    const isToday = voucherDate.getTime() === today.getTime();
    const isPending = v.status === "pendiente_validacion" || 
                     v.status === "pendiente_complemento" ||
                     v.status === "pendiente_asociacion";
    
    return isToday && isPending;
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pendiente_validacion":
        return {
          label: "Validación",
          icon: Clock,
          color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300",
        };
      case "pendiente_complemento":
        return {
          label: "Complemento",
          icon: AlertTriangle,
          color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300",
        };
      case "pendiente_asociacion":
        return {
          label: "Asociación",
          icon: FileText,
          color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300",
        };
      default:
        return {
          label: status,
          icon: FileText,
          color: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-300",
        };
    }
  };

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-foreground">
            Comprobantes Pendientes del Día
          </CardTitle>
          <Badge variant="outline" className="text-base px-3 py-1">
            {pendingToday.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : pendingToday.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-semibold text-foreground mb-2">
              ¡Todo al día!
            </p>
            <p className="text-sm text-muted-foreground">
              No hay comprobantes pendientes para hoy
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pendingToday.slice(0, 5).map((voucher) => {
                const statusInfo = getStatusInfo(voucher.status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    key={voucher.id}
                    className="p-4 border-2 border-border rounded-lg bg-card hover:border-primary/40 transition-all cursor-pointer"
                    onClick={onViewAll}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className="h-5 w-5 text-primary flex-shrink-0" />
                          <p className="text-base font-semibold text-foreground truncate">
                            {voucher.clientName}
                          </p>
                        </div>
                        {voucher.extractedAmount && (
                          <p className="text-lg font-bold text-primary">
                            {voucher.extractedCurrency || "MXN"} ${voucher.extractedAmount.toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(voucher.createdAt), "HH:mm", { locale: es })}
                        </p>
                      </div>
                      <Badge className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            {pendingToday.length > 5 && (
              <div className="pt-2 border-t">
                <p className="text-sm text-center text-muted-foreground">
                  Y {pendingToday.length - 5} más...
                </p>
              </div>
            )}
            <button
              onClick={onViewAll}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-semibold text-base hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
            >
              Ver Todos los Comprobantes
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

