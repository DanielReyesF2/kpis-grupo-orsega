import { useState, useMemo } from "react";
import { Search, Filter, X, Calendar, DollarSign, Building2 } from "lucide-react";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PaymentFilters {
  search: string;
  supplierId: number | null;
  status: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  amountMin: number | null;
  amountMax: number | null;
  companyId: number | null;
}

interface PaymentFiltersProps {
  filters: PaymentFilters;
  onFiltersChange: (filters: PaymentFilters) => void;
  suppliers?: Array<{ id: number; name: string }>;
  companies?: Array<{ id: number; name: string }>;
}

const defaultFilters: PaymentFilters = {
  search: "",
  supplierId: null,
  status: null,
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
  companyId: null,
};

export function PaymentFilters({
  filters,
  onFiltersChange,
  suppliers = [],
  companies = [],
}: PaymentFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === "search") return value !== "";
      return value !== null;
    });
  }, [filters]);

  const handleFilterChange = <K extends keyof PaymentFilters>(
    key: K,
    value: PaymentFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Búsqueda */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por proveedor, factura..."
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
                  onClick={clearFilters}
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
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Proveedor */}
            {suppliers.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Proveedor</label>
                <Select
                  value={filters.supplierId?.toString() || ""}
                  onValueChange={(value) =>
                    handleFilterChange("supplierId", value ? parseInt(value) : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los proveedores</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Empresa */}
            {companies.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Empresa</label>
                <Select
                  value={filters.companyId?.toString() || ""}
                  onValueChange={(value) =>
                    handleFilterChange("companyId", value ? parseInt(value) : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

