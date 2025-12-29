import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Check, Mail, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
  company_id: number;
  requires_rep?: boolean;
  rep_frequency?: number;
  location?: string;
  is_active?: boolean;
}

interface ProviderAutocompleteProps {
  companyId: number | null;
  selectedSupplierId: number | null;
  onSelect: (supplier: Supplier) => void;
}

export function ProviderAutocomplete({
  companyId,
  selectedSupplierId,
  onSelect,
}: ProviderAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: true, // Cargar siempre, luego filtrar por companyId
    staleTime: 60000,
  });

  // Filtrar proveedores por empresa y búsqueda
  const filteredSuppliers = suppliers.filter((supplier: Supplier) => {
    // Filtrar solo activos
    if (!supplier.is_active) return false;
    // Filtrar por empresa si está seleccionada
    if (companyId && supplier.company_id !== companyId) return false;
    // Filtrar por término de búsqueda
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(search) ||
      supplier.short_name?.toLowerCase().includes(search) ||
      supplier.email?.toLowerCase().includes(search)
    );
  });

  const selectedSupplier = suppliers.find((s: Supplier) => s.id === selectedSupplierId);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-foreground mb-4">
        Selecciona el proveedor o cliente
      </h3>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-10 h-12 text-base"
            disabled={!companyId}
          />
        </div>

        {!companyId && (
          <p className="text-sm text-muted-foreground mt-2">
            Primero selecciona la empresa pagadora
          </p>
        )}

        {isOpen && companyId && (
          <Card className="absolute z-10 w-full mt-2 max-h-64 overflow-y-auto border-2 shadow-lg">
            <div className="p-2">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Cargando...
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {companyId ? "No se encontraron proveedores para esta empresa" : "Selecciona primero la empresa"}
                </div>
              ) : (
                filteredSuppliers.slice(0, 10).map((supplier: Supplier) => (
                  <Button
                    key={supplier.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 hover:bg-primary/10"
                    onClick={() => {
                      onSelect(supplier);
                      setIsOpen(false);
                      setSearchTerm(supplier.name);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-base">{supplier.name}</p>
                          {supplier.requires_rep && (
                            <Badge variant="outline" className="text-xs">
                              REP
                            </Badge>
                          )}
                        </div>
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{supplier.email}</span>
                          </div>
                        )}
                        {supplier.requires_rep && supplier.rep_frequency && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>Cada {supplier.rep_frequency} días</span>
                          </div>
                        )}
                      </div>
                      {selectedSupplierId === supplier.id && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </Button>
                ))
              )}
            </div>
          </Card>
        )}
      </div>

      {selectedSupplier && (
        <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm text-muted-foreground">Seleccionado:</p>
            {selectedSupplier.requires_rep && (
              <Badge variant="outline" className="text-xs">
                REP
              </Badge>
            )}
          </div>
          <p className="text-lg font-semibold text-foreground">
            {selectedSupplier.name}
          </p>
          {selectedSupplier.short_name && (
            <p className="text-sm text-muted-foreground">
              {selectedSupplier.short_name}
            </p>
          )}
          {selectedSupplier.email && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Mail className="h-3 w-3" />
              <span>{selectedSupplier.email}</span>
            </div>
          )}
          {selectedSupplier.requires_rep && selectedSupplier.rep_frequency && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              <span>Recordatorio cada {selectedSupplier.rep_frequency} días</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

