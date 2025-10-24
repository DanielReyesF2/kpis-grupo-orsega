import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Building, Target, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/Sidebar';

interface KPI {
  id: number;
  name: string;
  description?: string;
  target: string;
  unit: string;
  frequency: string;
  areaId: number;
  companyId: number;
  areaName?: string;
  companyName?: string;
}

interface KPIFormData {
  name: string;
  description: string;
  target: string;
  unit: string;
  frequency: string;
  areaId: number;
  companyId: number;
}

export default function KpiAdminPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [formData, setFormData] = useState<KPIFormData>({
    name: '',
    description: '',
    target: '',
    unit: '',
    frequency: 'monthly',
    areaId: 0,
    companyId: 0
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener datos
  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
  });

  const { data: areas } = useQuery({
    queryKey: ['/api/areas'],
  });

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['/api/kpis'],
  });

  // Filtrar áreas por empresa seleccionada
  const filteredAreas = areas?.filter((area: any) => 
    selectedCompany ? area.companyId === selectedCompany : true
  );

  // Procesar KPIs con información adicional
  const processedKpis = kpis?.map((kpi: any) => {
    const area = areas?.find((a: any) => a.id === kpi.areaId);
    const company = companies?.find((c: any) => c.id === kpi.companyId);
    return {
      ...kpi,
      areaName: area?.name,
      companyName: company?.name
    };
  }) || [];

  // Filtrar KPIs por empresa si está seleccionada
  const filteredKpis = selectedCompany 
    ? processedKpis.filter((kpi: KPI) => kpi.companyId === selectedCompany)
    : processedKpis;

  // Mutaciones
  const createKpiMutation = useMutation({
    mutationFn: (data: KPIFormData) => apiRequest('/api/kpis', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "KPI Creado",
        description: "El KPI ha sido creado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el KPI.",
        variant: "destructive",
      });
    }
  });

  const updateKpiMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: KPIFormData }) => 
      apiRequest(`/api/kpis/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      setEditingKpi(null);
      resetForm();
      toast({
        title: "KPI Actualizado",
        description: "El KPI ha sido actualizado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el KPI.",
        variant: "destructive",
      });
    }
  });

  const deleteKpiMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/kpis/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({
        title: "KPI Eliminado",
        description: "El KPI ha sido eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el KPI.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target: '',
      unit: '',
      frequency: 'monthly',
      areaId: 0,
      companyId: 0
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, data: formData });
    } else {
      createKpiMutation.mutate(formData);
    }
  };

  const handleEdit = (kpi: KPI) => {
    setEditingKpi(kpi);
    setFormData({
      name: kpi.name,
      description: kpi.description || '',
      target: kpi.target,
      unit: kpi.unit,
      frequency: kpi.frequency,
      areaId: kpi.areaId,
      companyId: kpi.companyId
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Estás seguro de que deseas eliminar este KPI?')) {
      deleteKpiMutation.mutate(id);
    }
  };

  const KPIForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre del KPI</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="unit">Unidad</Label>
          <Input
            id="unit"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            placeholder="%, kg, horas, días, etc."
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción detallada del KPI"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="target">Objetivo</Label>
          <Input
            id="target"
            value={formData.target}
            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
            placeholder="100%, 50, 2.5, etc."
            required
          />
        </div>

        <div>
          <Label htmlFor="frequency">Frecuencia</Label>
          <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diaria</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="company">Empresa</Label>
          <Select value={formData.companyId.toString()} onValueChange={(value) => setFormData({ ...formData, companyId: parseInt(value), areaId: 0 })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies?.map((company: any) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="area">Área</Label>
        <Select 
          value={formData.areaId.toString()} 
          onValueChange={(value) => setFormData({ ...formData, areaId: parseInt(value) })}
          disabled={!formData.companyId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar área" />
          </SelectTrigger>
          <SelectContent>
            {areas?.filter((area: any) => area.companyId === formData.companyId).map((area: any) => (
              <SelectItem key={area.id} value={area.id.toString()}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => {
          setIsCreateDialogOpen(false);
          setEditingKpi(null);
          resetForm();
        }}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createKpiMutation.isPending || updateKpiMutation.isPending}>
          {editingKpi ? 'Actualizar' : 'Crear'} KPI
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden ml-0 lg:ml-[250px]">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Administración de KPIs
              </h1>
              <p className="text-gray-600">
                Gestiona los KPIs de todas las áreas y empresas
              </p>
            </div>

            {/* Filtros */}
            <div className="mb-6 flex flex-wrap gap-4">
              <div className="w-64">
                <Label htmlFor="company-filter">Filtrar por empresa</Label>
                <Select value={selectedCompany?.toString() || "all"} onValueChange={(value) => setSelectedCompany(value === "all" ? null : parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {companies?.map((company: any) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear KPI
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Crear Nuevo KPI</DialogTitle>
                    </DialogHeader>
                    <KPIForm />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Lista de KPIs */}
            <div className="grid gap-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#273949] mx-auto"></div>
                  <p className="mt-2 text-gray-600">Cargando KPIs...</p>
                </div>
              ) : (
                filteredKpis.map((kpi: KPI) => (
                  <Card key={kpi.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{kpi.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {kpi.description || 'Sin descripción'}
                          </CardDescription>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(kpi)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(kpi.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center">
                          <Target className="w-4 h-4 mr-2 text-green-600" />
                          <span className="font-medium">Objetivo:</span>
                          <span className="ml-1">{kpi.target} {kpi.unit}</span>
                        </div>
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-2 text-blue-600" />
                          <span className="font-medium">Empresa:</span>
                          <span className="ml-1">{kpi.companyName}</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-purple-600" />
                          <span className="font-medium">Área:</span>
                          <span className="ml-1">{kpi.areaName}</span>
                        </div>
                        <div>
                          <Badge variant="outline">
                            {kpi.frequency === 'daily' ? 'Diaria' : 
                             kpi.frequency === 'weekly' ? 'Semanal' :
                             kpi.frequency === 'monthly' ? 'Mensual' :
                             kpi.frequency === 'quarterly' ? 'Trimestral' : 'Anual'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Diálogo de edición */}
            <Dialog open={!!editingKpi} onOpenChange={(open) => !open && setEditingKpi(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Editar KPI</DialogTitle>
                </DialogHeader>
                <KPIForm />
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}