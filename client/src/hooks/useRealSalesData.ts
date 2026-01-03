import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface SalesData {
  id: number;
  companyId: number;
  clientId?: number;
  productId?: number;
  quantity: number;
  amount: number;
  date: string;
  month?: number;
  year?: number;
  currency?: string;
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
  // Fetch sales data
  const { data: salesData, isLoading: isLoadingSales, error: salesError } = useQuery<SalesData[]>({
    queryKey: ['/api/sales-data', { companyId, ...filters }],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Fetch clients
  const { data: clients, isLoading: isLoadingClients, error: clientsError } = useQuery<Client[]>({
    queryKey: ['/api/clients', { companyId }],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch products
  const { data: products, isLoading: isLoadingProducts, error: productsError } = useQuery<Product[]>({
    queryKey: ['/api/products', { companyId }],
    staleTime: 10 * 60 * 1000,
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

