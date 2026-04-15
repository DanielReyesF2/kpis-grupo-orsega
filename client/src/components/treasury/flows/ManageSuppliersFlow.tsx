import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, Edit, Trash2, Building2 } from "lucide-react";
import { SupplierForm } from "@/components/treasury/common/SupplierForm";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  code?: string;
  email?: string;
  rfc?: string;
  razon_social?: string;
  street_address?: string;
  colonia?: string;
  municipality?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  num_exterior?: string;
  num_interior?: string;
  entre_calle?: string;
  phone?: string;
  contact_name?: string;
  condicion_dias?: string;
  moneda?: string;
  currency?: string;
  tipo_proveedor?: string;
  es_nacional?: boolean;
  location?: string;
  requires_rep?: boolean;
  rep_frequency?: number;
  company_id?: number;
  company_name?: string;
  is_active?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface ManageSuppliersFlowProps {
  onBack: () => void;
}

export function ManageSuppliersFlow({ onBack }: ManageSuppliersFlowProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [repFilter, setRepFilter] = useState<boolean | null>(null);

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers", selectedCompany],
    queryFn: async () => {
      const url = selectedCompany ? `/api/suppliers?companyId=${selectedCompany}` : "/api/suppliers";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/suppliers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (selectedCompany && supplier.company_id !== selectedCompany) return false;
    if (repFilter !== null && supplier.requires_rep !== repFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      supplier.name?.toLowerCase().includes(q) ||
      supplier.short_name?.toLowerCase().includes(q) ||
      supplier.rfc?.toLowerCase().includes(q) ||
      supplier.city?.toLowerCase().includes(q) ||
      supplier.state?.toLowerCase().includes(q) ||
      supplier.razon_social?.toLowerCase().includes(q) ||
      supplier.condicion_dias?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: suppliers.length,
    withRep: suppliers.filter((s) => s.requires_rep).length,
    withoutRep: suppliers.filter((s) => !s.requires_rep).length,
    dura: suppliers.filter((s) => s.company_id === 1).length,
    orsega: suppliers.filter((s) => s.company_id === 2).length,
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="default" size="lg" className="h-12 text-lg bg-slate-700 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Gestión de Proveedores</h1>
        <Button onClick={() => { setEditingSupplier(null); setShowForm(true); }} size="lg" className="h-12 text-lg font-semibold">
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Total</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-500/20 cursor-pointer hover:shadow-md" onClick={() => setRepFilter(repFilter === true ? null : true)}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.withRep}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">REP SI</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-400/20 cursor-pointer hover:shadow-md" onClick={() => setRepFilter(repFilter === false ? null : false)}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-gray-600">{stats.withoutRep}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">REP NO</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.dura}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Dura</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">{stats.orsega}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Orsega</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, RFC, ciudad, condición de pago..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button variant={selectedCompany === null ? "default" : "outline"} onClick={() => setSelectedCompany(null)} className="h-12">
                Todas
              </Button>
              <Button variant={selectedCompany === 1 ? "default" : "outline"} onClick={() => setSelectedCompany(1)} className={`h-12 ${selectedCompany === 1 ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
                Dura
              </Button>
              <Button variant={selectedCompany === 2 ? "default" : "outline"} onClick={() => setSelectedCompany(2)} className={`h-12 ${selectedCompany === 2 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                Orsega
              </Button>
            </div>
          </div>
          {repFilter !== null && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                Filtro: REP {repFilter ? 'SI' : 'NO'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setRepFilter(null)} className="h-6 text-xs">
                Quitar filtro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">
            Proveedores ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando proveedores...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">No se encontraron proveedores</p>
              <p className="text-muted-foreground">
                {searchTerm || selectedCompany || repFilter !== null
                  ? "Intenta con otros filtros"
                  : "Comienza agregando tu primer proveedor"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left p-3 font-bold">Proveedor</th>
                    <th className="text-left p-3 font-bold">RFC</th>
                    <th className="text-left p-3 font-bold">Ubicación</th>
                    <th className="text-left p-3 font-bold">Condición</th>
                    <th className="text-left p-3 font-bold">Moneda</th>
                    <th className="text-center p-3 font-bold">REP</th>
                    <th className="text-right p-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b hover:bg-muted/50 transition-colors">
                      {/* Name + Company */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold">{supplier.short_name || supplier.name}</div>
                            {supplier.short_name && supplier.razon_social && supplier.razon_social !== supplier.short_name && (
                              <div className="text-xs text-muted-foreground truncate max-w-[250px]" title={supplier.razon_social}>
                                {supplier.razon_social}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${
                            supplier.company_id === 1
                              ? 'border-blue-500 text-blue-700'
                              : 'border-emerald-500 text-emerald-700'
                          }`}>
                            {supplier.company_id === 1 ? 'DURA' : 'ORS'}
                          </Badge>
                        </div>
                      </td>

                      {/* RFC */}
                      <td className="p-3">
                        <span className="font-mono text-xs">{supplier.rfc || '-'}</span>
                      </td>

                      {/* Location */}
                      <td className="p-3">
                        <div className="text-xs">
                          {supplier.city || supplier.state ? (
                            <span>{[supplier.city, supplier.state].filter(Boolean).join(', ')}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {supplier.es_nacional === false && (
                            <Badge variant="outline" className="ml-1 text-[9px] border-orange-400 text-orange-600">EXT</Badge>
                          )}
                        </div>
                      </td>

                      {/* Payment terms */}
                      <td className="p-3">
                        <span className="text-xs">{supplier.condicion_dias || '-'}</span>
                      </td>

                      {/* Currency */}
                      <td className="p-3">
                        {supplier.currency ? (
                          <Badge variant="outline" className={`text-[10px] ${
                            supplier.currency === 'USD' ? 'border-green-500 text-green-700' : 'border-gray-400 text-gray-600'
                          }`}>
                            {supplier.currency}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-gray-400 text-gray-600">
                            MXN
                          </Badge>
                        )}
                      </td>

                      {/* REP */}
                      <td className="p-3 text-center">
                        <Badge className={`text-xs ${
                          supplier.requires_rep
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}>
                          {supplier.requires_rep ? 'SI' : 'NO'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingSupplier(supplier); setShowForm(true); }} className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`¿Eliminar a ${supplier.short_name || supplier.name}?`)) {
                                deleteMutation.mutate(supplier.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <SupplierForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingSupplier(null); }}
        supplier={editingSupplier || undefined}
      />
    </div>
  );
}
