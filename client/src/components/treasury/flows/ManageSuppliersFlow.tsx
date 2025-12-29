import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, Edit, Trash2, Mail, Building2, MapPin, Calendar, FileText } from "lucide-react";
import { SupplierForm } from "@/components/treasury/common/SupplierForm";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
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

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/suppliers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Éxito", description: "Proveedor eliminado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al eliminar proveedor", variant: "destructive" });
    },
  });

  // Filtrar proveedores
  const filteredSuppliers = suppliers.filter((supplier: Supplier) => {
    // Filtrar por empresa
    if (selectedCompany && supplier.company_id !== selectedCompany) return false;
    // Filtrar por búsqueda
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(search) ||
      supplier.short_name?.toLowerCase().includes(search) ||
      supplier.email?.toLowerCase().includes(search) ||
      supplier.location?.toLowerCase().includes(search)
    );
  });

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleDelete = (supplier: Supplier) => {
    if (confirm(`¿Estás seguro de eliminar a ${supplier.name}?`)) {
      deleteMutation.mutate(supplier.id);
    }
  };

  const handleNewSupplier = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s: Supplier) => s.is_active).length,
    withRep: suppliers.filter((s: Supplier) => s.requires_rep).length,
    dura: suppliers.filter((s: Supplier) => s.company_id === 1).length,
    orsega: suppliers.filter((s: Supplier) => s.company_id === 2).length,
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="ghost" size="lg" className="h-12 text-lg">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Gestión de Proveedores</h1>
        <Button onClick={handleNewSupplier} size="lg" className="h-12 text-lg font-semibold">
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Total</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Activos</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.withRep}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Con REP</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.dura}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Dura</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{stats.orsega}</div>
            <div className="text-sm font-semibold text-muted-foreground mt-1">Orsega</div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda y Filtros */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email, ubicación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCompany === null ? "default" : "outline"}
                onClick={() => setSelectedCompany(null)}
                className="h-12 text-base"
              >
                Todas
              </Button>
              <Button
                variant={selectedCompany === 1 ? "default" : "outline"}
                onClick={() => setSelectedCompany(1)}
                className="h-12 text-base"
              >
                Dura
              </Button>
              <Button
                variant={selectedCompany === 2 ? "default" : "outline"}
                onClick={() => setSelectedCompany(2)}
                className="h-12 text-base"
              >
                Orsega
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Proveedores */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">
            Proveedores ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-lg">
              Cargando proveedores...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground mb-2">
                No se encontraron proveedores
              </p>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCompany
                  ? "Intenta con otros filtros de búsqueda"
                  : "Comienza agregando tu primer proveedor"}
              </p>
              {!searchTerm && !selectedCompany && (
                <Button onClick={handleNewSupplier} size="lg" className="h-12 text-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Agregar Proveedor
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-primary/20">
                    <th className="text-left p-4 text-base font-bold text-foreground">Proveedor</th>
                    <th className="text-left p-4 text-base font-bold text-foreground">Empresa</th>
                    <th className="text-left p-4 text-base font-bold text-foreground">Contacto</th>
                    <th className="text-left p-4 text-base font-bold text-foreground">Ubicación</th>
                    <th className="text-left p-4 text-base font-bold text-foreground">REP</th>
                    <th className="text-left p-4 text-base font-bold text-foreground">Estado</th>
                    <th className="text-right p-4 text-base font-bold text-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier: Supplier) => (
                    <tr
                      key={supplier.id}
                      className="border-b border-primary/10 hover:bg-primary/5 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <div className="text-base font-semibold text-foreground">
                            {supplier.name}
                          </div>
                          {supplier.short_name && (
                            <div className="text-sm text-muted-foreground">
                              {supplier.short_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className={
                            supplier.company_id === 1
                              ? "border-green-500 text-green-700 dark:text-green-400"
                              : supplier.company_id === 2
                              ? "border-blue-500 text-blue-700 dark:text-blue-400"
                              : ""
                          }
                        >
                          {supplier.company_name || (supplier.company_id === 1 ? "Dura" : supplier.company_id === 2 ? "Orsega" : "N/A")}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {supplier.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-base text-foreground">{supplier.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin email</span>
                        )}
                      </td>
                      <td className="p-4">
                        {supplier.location ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-base text-foreground">{supplier.location}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {supplier.requires_rep ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-green-500 text-white">Sí</Badge>
                            {supplier.rep_frequency && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Cada {supplier.rep_frequency} días
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge
                          className={
                            supplier.is_active
                              ? "bg-green-500 text-white"
                              : "bg-gray-500 text-white"
                          }
                        >
                          {supplier.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
                            className="h-10 w-10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(supplier)}
                            className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
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

      {/* Modal de Formulario */}
      <SupplierForm
        isOpen={showForm}
        onClose={handleFormClose}
        supplier={editingSupplier || undefined}
      />
    </div>
  );
}

