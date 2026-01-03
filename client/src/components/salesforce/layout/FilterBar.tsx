import { useState, useMemo, useEffect } from "react";
import { X, Filter, ChevronDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'date-range';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  defaultValue?: string;
}

export interface FilterBarProps {
  quickFilters: FilterOption[];
  advancedFilters?: FilterOption[];
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onSaveView?: (name: string) => void;
  savedViews?: Array<{ id: string; name: string; filters: Record<string, any> }>;
  onLoadView?: (viewId: string) => void;
  resultCount?: number;
  className?: string;
  syncWithURL?: boolean;
}

export function FilterBar({
  quickFilters,
  advancedFilters = [],
  filters,
  onFiltersChange,
  onSaveView,
  savedViews = [],
  onLoadView,
  resultCount,
  className,
  syncWithURL = true
}: FilterBarProps) {
  const [location, setLocation] = useLocation();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState('');

  // Sync filters with URL
  useEffect(() => {
    if (syncWithURL) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      const newSearch = params.toString();
      const newLocation = location.split('?')[0] + (newSearch ? `?${newSearch}` : '');
      if (newLocation !== location) {
        setLocation(newLocation);
      }
    }
  }, [filters, syncWithURL, location, setLocation]);

  // Load filters from URL on mount
  useEffect(() => {
    if (syncWithURL) {
      const params = new URLSearchParams(window.location.search);
      const urlFilters: Record<string, any> = {};
      params.forEach((value, key) => {
        urlFilters[key] = value;
      });
      if (Object.keys(urlFilters).length > 0) {
        onFiltersChange({ ...filters, ...urlFilters });
      }
    }
  }, []);

  const activeFilters = useMemo(() => {
    return Object.entries(filters).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    );
  }, [filters]);

  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleRemoveFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    onFiltersChange({});
  };

  const handleSaveView = () => {
    if (viewName.trim() && onSaveView) {
      onSaveView(viewName.trim());
      setViewName('');
      setShowSaveDialog(false);
    }
  };

  const renderFilterInput = (filter: FilterOption) => {
    const value = filters[filter.key] || filter.defaultValue || '';

    switch (filter.type) {
      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) => handleFilterChange(filter.key, val)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={filter.placeholder || `Seleccionar ${filter.label}`} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'text':
        return (
          <Input
            placeholder={filter.placeholder || `Buscar ${filter.label}`}
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            className="w-[200px]"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            className="w-[180px]"
          />
        );

      case 'date-range':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              placeholder="Desde"
              value={filters[`${filter.key}_from`] || ''}
              onChange={(e) => handleFilterChange(`${filter.key}_from`, e.target.value)}
              className="w-[150px]"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              placeholder="Hasta"
              value={filters[`${filter.key}_to`] || ''}
              onChange={(e) => handleFilterChange(`${filter.key}_to`, e.target.value)}
              className="w-[150px]"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Quick Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {quickFilters.map((filter) => (
          <div key={filter.key} className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              {filter.label}:
            </Label>
            {renderFilterInput(filter)}
          </div>
        ))}

        {/* More Filters Dropdown */}
        {advancedFilters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Más filtros
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtros avanzados</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {advancedFilters.map((filter) => (
                <div key={filter.key} className="p-2">
                  <Label className="text-xs mb-1 block">{filter.label}</Label>
                  {renderFilterInput(filter)}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Saved Views */}
        {savedViews.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Vistas guardadas
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Vistas guardadas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => onLoadView?.(view.id)}
                >
                  {view.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Save View */}
        {onSaveView && activeFilters.length > 0 && (
          <DropdownMenu open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Guardar vista
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Guardar vista</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2 space-y-2">
                <Input
                  placeholder="Nombre de la vista"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveView();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleSaveView}
                  disabled={!viewName.trim()}
                >
                  Guardar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Active Filters Pills */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            Filtros activos:
          </span>
          {activeFilters.map(([key, value]) => {
            const filter = [...quickFilters, ...advancedFilters].find(f => f.key === key);
            const label = filter?.label || key;
            return (
              <Badge
                key={key}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {label}: {String(value)}
                <button
                  onClick={() => handleRemoveFilter(key)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-6 text-xs"
          >
            Limpiar todo
          </Button>
        </div>
      )}

      {/* Result Count */}
      {resultCount !== undefined && (
        <div className="text-sm text-muted-foreground">
          {resultCount.toLocaleString()} resultado{resultCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

