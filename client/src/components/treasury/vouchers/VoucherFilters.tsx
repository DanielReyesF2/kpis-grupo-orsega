import { useState } from "react";
import { Search, Filter, X, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useVoucherFilters, type VoucherFilters as VoucherFiltersType } from "@/hooks/useVoucherFilters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface VoucherFiltersProps {
  onFiltersChange?: (filters: VoucherFiltersType) => void;
}

export function VoucherFilters({ onFiltersChange }: VoucherFiltersProps) {
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  } = useVoucherFilters();

  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = <K extends keyof VoucherFiltersType>(
    key: K,
    value: VoucherFiltersType[K]
  ) => {
    updateFilter(key, value);
    if (onFiltersChange) {
      onFiltersChange({ ...filters, [key]: value });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Búsqueda */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar comprobantes..."
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtros avanzados */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                !
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filtros</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearFilters();
                    if (onFiltersChange) {
                      onFiltersChange({
                        search: "",
                        clientId: null,
                        status: null,
                        dateFrom: null,
                        dateTo: null,
                        amountMin: null,
                        amountMax: null,
                        bank: null,
                        currency: null,
                      });
                    }
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>

            {/* Estado */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Estado</label>
              <Select
                value={filters.status || ""}
                onValueChange={(value) =>
                  handleFilterChange("status", value || null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los estados</SelectItem>
                  <SelectItem value="factura_pagada">Factura Pagada</SelectItem>
                  <SelectItem value="pendiente_complemento">
                    Pendiente Complemento
                  </SelectItem>
                  <SelectItem value="complemento_recibido">
                    Complemento Recibido
                  </SelectItem>
                  <SelectItem value="cierre_contable">Cierre Contable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Moneda */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Moneda</label>
              <Select
                value={filters.currency || ""}
                onValueChange={(value) =>
                  handleFilterChange("currency", value || null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las monedas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las monedas</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rango de fechas */}
            <div className="space-y-2">
              <label className="text-sm font-medium block">Rango de fechas</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="date"
                    value={
                      filters.dateFrom
                        ? format(filters.dateFrom, "yyyy-MM-dd")
                        : ""
                    }
                    onChange={(e) =>
                      handleFilterChange(
                        "dateFrom",
                        e.target.value ? new Date(e.target.value) : null
                      )
                    }
                    className="text-xs"
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    value={
                      filters.dateTo
                        ? format(filters.dateTo, "yyyy-MM-dd")
                        : ""
                    }
                    onChange={(e) =>
                      handleFilterChange(
                        "dateTo",
                        e.target.value ? new Date(e.target.value) : null
                      )
                    }
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Rango de montos */}
            <div className="space-y-2">
              <label className="text-sm font-medium block">Rango de montos</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    placeholder="Mín"
                    value={filters.amountMin || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "amountMin",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="text-xs"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Máx"
                    value={filters.amountMax || ""}
                    onChange={(e) =>
                      handleFilterChange(
                        "amountMax",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

