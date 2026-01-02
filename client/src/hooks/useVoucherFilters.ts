import { useState, useMemo, useCallback } from "react";

export interface VoucherFilters {
  search: string;
  clientId: number | null;
  status: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  amountMin: number | null;
  amountMax: number | null;
  bank: string | null;
  currency: string | null;
}

export interface VoucherSort {
  field: "date" | "amount" | "client" | "status";
  direction: "asc" | "desc";
}

const defaultFilters: VoucherFilters = {
  search: "",
  clientId: null,
  status: null,
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
  bank: null,
  currency: null,
};

export function useVoucherFilters() {
  const [filters, setFilters] = useState<VoucherFilters>(defaultFilters);
  const [sort, setSort] = useState<VoucherSort>({
    field: "date",
    direction: "desc",
  });

  const updateFilter = useCallback(<K extends keyof VoucherFilters>(
    key: K,
    value: VoucherFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === "search") return value !== "";
      return value !== null;
    });
  }, [filters]);

  return {
    filters,
    sort,
    updateFilter,
    setSort,
    clearFilters,
    hasActiveFilters,
  };
}

