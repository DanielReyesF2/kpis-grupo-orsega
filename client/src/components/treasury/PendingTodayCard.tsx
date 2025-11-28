import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight, Bell } from "lucide-react";
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
    <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 via-white to-orange-50/50 dark:from-orange-950/20 dark:via-slate-900 dark:to-orange-950/10 shadow-lg hover:shadow-xl transition-all overflow-hidden">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-700 dark:to-orange-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-extrabold text-white" style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800 }}>
                REPs Pendientes
              </CardTitle>
              <p className="text-xs text-orange-100 mt-0.5">
                Requieren atención inmediata
              </p>
            </div>
          </div>
          {pendingToday.length > 0 && (
            <div className="relative">
              <Badge className="bg-white text-orange-600 font-extrabold text-base px-4 py-1.5 rounded-full border-2 border-white/50 shadow-lg">
                {pendingToday.length}
              </Badge>
              {pendingToday.length > 0 && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : pendingToday.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white mb-1" style={{ color: '#111827', fontSize: '18px', fontWeight: 700 }}>
              ¡Todo al día!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No hay comprobantes pendientes para hoy
            </p>
          </div>
        ) : (
          <>
            {/* Lista de REPs pendientes */}
            <div className="space-y-3 mb-4">
              {pendingToday.slice(0, 3).map((voucher) => {
                const statusInfo = getStatusInfo(voucher.status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    key={voucher.id}
                    className="group relative p-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                    onClick={onViewAll}
                  >
                    {/* Efecto de brillo al hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="relative flex items-center justify-between gap-4">
                      {/* Icono y nombre */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                          <StatusIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-extrabold text-gray-900 dark:text-white truncate mb-1" style={{ color: '#111827', fontSize: '16px', fontWeight: 800 }}>
                            {voucher.clientName}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {voucher.extractedAmount && (
                              <span className="text-sm font-bold text-orange-600 dark:text-orange-400" style={{ color: '#ea580c', fontWeight: 700 }}>
                                {voucher.extractedCurrency || "MXN"} ${voucher.extractedAmount.toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(voucher.createdAt), "HH:mm", { locale: es })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Badge de estado y flecha */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`${statusInfo.color} text-xs font-bold px-3 py-1`}>
                          {statusInfo.label}
                        </Badge>
                        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer con botón y contador */}
            <div className="pt-4 border-t border-orange-200 dark:border-orange-800">
              {pendingToday.length > 3 && (
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center mb-3" style={{ color: '#374151', fontWeight: 600 }}>
                  Y {pendingToday.length - 3} más pendiente{pendingToday.length - 3 > 1 ? 's' : ''}
                </p>
              )}
              <Button
                onClick={onViewAll}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                style={{ fontWeight: 700 }}
              >
                <FileText className="h-5 w-5" />
                Ver Todos los Comprobantes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

