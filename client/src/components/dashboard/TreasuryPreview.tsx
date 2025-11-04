import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, TrendingUp, ArrowRight, CheckCircle, Clock, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

interface PaymentVoucher {
  id: number;
  status: string;
  clientName: string;
  voucherFileName?: string;
  companyId?: number;
  clientId?: number;
  createdAt?: string;
}

interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
}

export function TreasuryPreview() {
  const [, navigate] = useLocation();

  // Obtener comprobantes recientes
  const { data: vouchers, isLoading: vouchersLoading } = useQuery<PaymentVoucher[]>({
    queryKey: ['/api/payment-vouchers'],
    staleTime: 1 * 60 * 1000, // 1 minuto
    refetchInterval: 30000, // Refrescar cada 30 segundos
    refetchOnWindowFocus: true,
  });

  // Obtener tipos de cambio recientes
  const { data: exchangeRates, isLoading: ratesLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates'],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Calcular estadísticas de comprobantes
  const voucherStats = vouchers ? {
    total: vouchers.length,
    validado: vouchers.filter(v => v.status === 'factura_pagada').length,
    pendienteComplemento: vouchers.filter(v => v.status === 'pendiente_complemento').length,
    complementoRecibido: vouchers.filter(v => v.status === 'complemento_recibido').length,
    cierreContable: vouchers.filter(v => v.status === 'cierre_contable').length,
  } : {
    total: 0,
    validado: 0,
    pendienteComplemento: 0,
    complementoRecibido: 0,
    cierreContable: 0,
  };

  // Obtener el último tipo de cambio
  const latestRate = exchangeRates && exchangeRates.length > 0 
    ? exchangeRates[0] 
    : null;

  // Obtener comprobantes recientes (últimos 3)
  const recentVouchers = vouchers
    ? vouchers
        .sort((a, b) => {
          const dateA = new Date(a.createdAt || '').getTime();
          const dateB = new Date(b.createdAt || '').getTime();
          return dateB - dateA;
        })
        .slice(0, 3)
    : [];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'factura_pagada':
        return {
          label: 'Validado',
          icon: ClipboardCheck,
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
        };
      case 'pendiente_complemento':
        return {
          label: 'Pendiente Complemento',
          icon: AlertTriangle,
          color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
        };
      case 'complemento_recibido':
        return {
          label: 'Complemento Recibido',
          icon: FileText,
          color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700',
        };
      case 'cierre_contable':
        return {
          label: 'Cierre Contable',
          icon: CheckCircle,
          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
        };
      default:
        return {
          label: status,
          icon: FileText,
          color: 'bg-muted text-muted-foreground border-border/60',
        };
    }
  };

  return (
    <Card className="border border-border/60 bg-card shadow-soft hover:shadow-lg transition-modern">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/15 rounded-lg text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Módulo de Tesorería
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Vista previa de comprobantes y tipo de cambio
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/treasury')}
            className="flex items-center gap-2 hover:bg-primary/10 text-primary transition-modern"
          >
            Ver más
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {vouchersLoading || ratesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Estadísticas de Comprobantes */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border border-border/60 bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs text-muted-foreground mb-1">Validado</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{voucherStats.validado}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-orange-50 dark:bg-orange-950/30 p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs text-muted-foreground mb-1">Pendiente</p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{voucherStats.pendienteComplemento}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-teal-50 dark:bg-teal-950/30 p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <p className="text-xs text-muted-foreground mb-1">Complemento</p>
                <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{voucherStats.complementoRecibido}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-purple-50 dark:bg-purple-950/30 p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs text-muted-foreground mb-1">Cierre</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{voucherStats.cierreContable}</p>
              </div>
            </div>

            {/* Tipo de Cambio */}
            {latestRate && (
              <div className="rounded-xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Tipo de Cambio</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {latestRate.source || 'DOF'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Compra</p>
                    <p className="text-lg font-bold text-foreground">${latestRate.buy_rate.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Venta</p>
                    <p className="text-lg font-bold text-foreground">${latestRate.sell_rate.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Comprobantes Recientes */}
            {recentVouchers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Comprobantes Recientes
                </p>
                {recentVouchers.map((voucher) => {
                  const statusInfo = getStatusInfo(voucher.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={voucher.id}
                      className="group p-3 border border-border/60 rounded-lg bg-card/70 hover:border-primary/40 hover:shadow-md transition-modern cursor-pointer"
                      onClick={() => navigate('/treasury')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className="h-3.5 w-3.5 text-primary" />
                            <span className="text-sm font-semibold text-foreground truncate">
                              {voucher.clientName}
                            </span>
                          </div>
                          {voucher.voucherFileName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {voucher.voucherFileName}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={`${statusInfo.color} font-semibold text-xs px-2 py-0.5 whitespace-nowrap`}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <div className="p-3 bg-primary/15 rounded-full w-fit mx-auto mb-2 text-primary">
                  <FileText className="h-6 w-6 opacity-70" />
                </div>
                <p className="text-sm font-medium mb-1">No hay comprobantes recientes</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Los comprobantes aparecerán aquí cuando se suban
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/treasury')}
                  className="flex items-center gap-2 mx-auto border-primary/40 text-primary hover:bg-primary/10 transition-modern"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Ir al módulo de tesorería
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

