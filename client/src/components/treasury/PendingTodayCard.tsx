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
    const isPending = v.status === "factura_pagada" || 
                     v.status === "pendiente_complemento";
    
    return isToday && isPending;
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "factura_pagada":
        return {
          label: "Factura Pagada",
          icon: Clock,
          color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300",
        };
      case "pendiente_complemento":
        return {
          label: "Complemento",
          icon: AlertTriangle,
          color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300",
        };
      case "complemento_recibido":
        return {
          label: "Complemento Recibido",
          icon: FileText,
          color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300",
        };
      case "cierre_contable":
        return {
          label: "Cierre Contable",
          icon: CheckCircle,
          color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300",
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
    <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            REPs Pendientes
          </CardTitle>
          <Badge variant="outline" className="text-xs px-2 py-0.5">
            {pendingToday.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : pendingToday.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm font-semibold text-foreground mb-1">
              ¡Todo al día!
            </p>
            <p className="text-xs text-muted-foreground">
              No hay comprobantes pendientes para hoy
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pendingToday.slice(0, 4).map((voucher) => {
                const statusInfo = getStatusInfo(voucher.status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    key={voucher.id}
                    className="p-3 border rounded-lg bg-card hover:border-primary/40 transition-all cursor-pointer"
                    onClick={onViewAll}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon className="h-4 w-4 text-orange-600 flex-shrink-0" />
                          <p className="text-sm font-semibold text-foreground truncate">
                            {voucher.clientName}
                          </p>
                        </div>
                        {voucher.extractedAmount && (
                          <p className="text-base font-bold text-orange-700 dark:text-orange-400">
                            {voucher.extractedCurrency || "MXN"} ${voucher.extractedAmount.toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(voucher.createdAt), "HH:mm", { locale: es })}
                        </p>
                      </div>
                      <Badge className={`${statusInfo.color} text-xs`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            {pendingToday.length > 4 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-center text-muted-foreground">
                  Y {pendingToday.length - 4} más...
                </p>
              </div>
            )}
            <button
              onClick={onViewAll}
              className="w-full py-2 px-3 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 transition-all"
            >
              Ver Todos los Comprobantes
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

