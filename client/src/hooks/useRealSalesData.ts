import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface SalesData {
  id: number;
  companyId: number;
  clientId?: number;
  productId?: number;
  clientName?: string;
  productName?: string;
  quantity: number;
  amount: number;
  unitPrice?: number;
  date: string;
  month?: number;
  year?: number;
  currency?: string;
  unit?: string;
  invoiceNumber?: string;
}

export interface Client {
  id: number;
  name: string;
  companyId?: number;
  email?: string;
  phone?: string;
}

export interface Product {
  id: number;
  name: string;
  companyId?: number;
  unit?: string;
}

export function useRealSalesData(companyId?: number, filters?: {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  productId?: number;
}) {
  // Build query params for sales data
  const salesParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (companyId) params.companyId = String(companyId);
    if (filters?.clientId) params.clientId = String(filters.clientId);
    if (filters?.productId) params.productId = String(filters.productId);
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    return params;
  }, [companyId, filters]);

  // Fetch sales data
  const { data: salesData, isLoading: isLoadingSales, error: salesError } = useQuery<SalesData[]>({
    queryKey: ['/api/sales-data', salesParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(salesParams).toString();
      const res = await apiRequest('GET', `/api/sales-data?${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch sales data: ${res.statusText}`);
      }
      const data = await res.json();
      // Map backend fields to frontend interface
      return data.map((item: any) => ({
        id: item.id,
        companyId: item.company_id || companyId || 0,
        clientId: item.client_id || undefined,
        productId: item.product_id || undefined,
        clientName: item.client_name,
        productName: item.product_name,
        quantity: parseFloat(item.quantity || 0),
        amount: parseFloat(item.total_amount || item.amount || 0),
        unitPrice: item.unit_price ? parseFloat(item.unit_price) : undefined,
        date: item.sale_date || item.date,
        month: item.sale_month || item.month,
        year: item.sale_year || item.year,
        unit: item.unit,
        invoiceNumber: item.invoice_number,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    enabled: !!companyId,
  });

  // Fetch clients
  const { data: clients, isLoading: isLoadingClients, error: clientsError } = useQuery<Client[]>({
    queryKey: ['/api/clients', { companyId }],
    queryFn: async () => {
      const queryString = companyId ? `?companyId=${companyId}` : '';
      const res = await apiRequest('GET', `/api/clients${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch clients: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!companyId,
  });

  // Fetch products
  const { data: products, isLoading: isLoadingProducts, error: productsError } = useQuery<Product[]>({
    queryKey: ['/api/products', { companyId }],
    queryFn: async () => {
      const queryString = companyId ? `?companyId=${companyId}` : '';
      const res = await apiRequest('GET', `/api/products${queryString}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!salesData) return null;

    const totalAmount = salesData.reduce((sum, s) => sum + s.amount, 0);
    const totalQuantity = salesData.reduce((sum, s) => sum + s.quantity, 0);
    const uniqueClients = new Set(salesData.map(s => s.clientId).filter(Boolean)).size;
    const uniqueProducts = new Set(salesData.map(s => s.productId).filter(Boolean)).size;

    // Group by month
    const byMonth = salesData.reduce((acc, s) => {
      const month = s.month || new Date(s.date).getMonth() + 1;
      const year = s.year || new Date(s.date).getFullYear();
      const key = `${year}-${month}`;
      if (!acc[key]) {
        acc[key] = { amount: 0, quantity: 0, count: 0 };
      }
      acc[key].amount += s.amount;
      acc[key].quantity += s.quantity;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; quantity: number; count: number }>);

    // Group by client
    const byClient = salesData.reduce((acc, s) => {
      if (!s.clientId) return acc;
      const clientId = s.clientId;
      if (!acc[clientId]) {
        acc[clientId] = { amount: 0, quantity: 0, count: 0 };
      }
      acc[clientId].amount += s.amount;
      acc[clientId].quantity += s.quantity;
      acc[clientId].count += 1;
      return acc;
    }, {} as Record<number, { amount: number; quantity: number; count: number }>);

    // Group by product
    const byProduct = salesData.reduce((acc, s) => {
      if (!s.productId) return acc;
      const productId = s.productId;
      if (!acc[productId]) {
        acc[productId] = { amount: 0, quantity: 0, count: 0 };
      }
      acc[productId].amount += s.amount;
      acc[productId].quantity += s.quantity;
      acc[productId].count += 1;
      return acc;
    }, {} as Record<number, { amount: number; quantity: number; count: number }>);

    return {
      totalAmount,
      totalQuantity,
      uniqueClients,
      uniqueProducts,
      totalRecords: salesData.length,
      byMonth,
      byClient,
      byProduct,
    };
  }, [salesData]);

  return {
    salesData: salesData || [],
    clients: clients || [],
    products: products || [],
    stats,
    isLoading: isLoadingSales || isLoadingClients || isLoadingProducts,
    error: salesError || clientsError || productsError,
  };
}

