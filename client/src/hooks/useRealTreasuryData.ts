import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface PaymentVoucher {
  id: number;
  status: string;
  clientName: string;
  voucherFileName?: string;
  companyId?: number;
  clientId?: number;
  extractedAmount?: number;
  extractedCurrency?: string;
  extractedDate?: string;
  extractedReference?: string;
  extractedBank?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExchangeRate {
  id: number;
  buy_rate: number;
  sell_rate: number;
  source: string;
  date: string;
}

export interface Payment {
  id: number;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string;
  paidDate?: string;
  companyId?: number;
  clientId?: number;
}

export function useRealTreasuryData(companyId?: number) {
  // Fetch payment vouchers
  const { data: vouchers, isLoading: isLoadingVouchers, error: vouchersError } = useQuery<PaymentVoucher[]>({
    queryKey: ['/api/payment-vouchers', { companyId }],
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Fetch exchange rates
  const { data: exchangeRates, isLoading: isLoadingRates, error: ratesError } = useQuery<ExchangeRate[]>({
    queryKey: ['/api/treasury/exchange-rates', { companyId }],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Fetch payments
  const { data: payments, isLoading: isLoadingPayments, error: paymentsError } = useQuery<Payment[]>({
    queryKey: ['/api/payments', { companyId }],
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!vouchers) return null;

    return {
      total: vouchers.length,
      byStatus: vouchers.reduce((acc, v) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalAmount: vouchers.reduce((sum, v) => sum + (v.extractedAmount || 0), 0),
      byCurrency: vouchers.reduce((acc, v) => {
        const currency = v.extractedCurrency || 'Unknown';
        acc[currency] = (acc[currency] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [vouchers]);

  return {
    vouchers: vouchers || [],
    exchangeRates: exchangeRates || [],
    payments: payments || [],
    stats,
    isLoading: isLoadingVouchers || isLoadingRates || isLoadingPayments,
    error: vouchersError || ratesError || paymentsError,
  };
}

