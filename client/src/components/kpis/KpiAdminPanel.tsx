/**
 * KpiAdminPanel - Panel de administración de KPIs
 * Solo visible para admin y gerente general (manager)
 * Permite crear, editar, eliminar y transferir KPIs
 */
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Kpi, Area } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Search,
  Target,
  X,
} from 'lucide-react';

interface KpiAdminPanelProps {
  companyId: number;
  onClose: () => void;
}

interface KpiFormData {
  kpiName: string;
  area: string;
  description: string;
  goal: string;
  unit: string;
  frequency: string;
  responsible: string;
  calculationMethod: string;
  source: string;
}

const EMPTY_FORM: KpiFormData = {
  kpiName: '',
  area: '',
  description: '',
  goal: '',
  unit: '',
  frequency: 'monthly',
  responsible: '',
  calculationMethod: '',
  source: '',
};

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
];

const UNIT_OPTIONS = ['%', 'unidades', 'KG', 'días', 'MXN', 'USD', 'horas'];

export function KpiAdminPanel({ companyId, onClose }: KpiAdminPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingKpi, setEditingKpi] = useState<Kpi | null>(null);
  const [deletingKpi, setDeletingKpi] = useState<Kpi | null>(null);
  const [transferringKpi, setTransferringKpi] = useState<Kpi | null>(null);
  const [formData, setFormData] = useState<KpiFormData>(EMPTY_FORM);
  const [transferTo, setTransferTo] = useState('');

  // Data fetching
  const { data: kpis = [], isLoading } = useQuery<Kpi[]>({
    queryKey: ['/api/kpis', { companyId }],
    queryFn: () => fetch(`/api/kpis?companyId=${companyId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => r.json()),
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['/api/areas'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/kpis', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({ title: 'KPI creado', description: 'El KPI se ha creado correctamente.' });
      setShowCreateDialog(false);
      setFormData(EMPTY_FORM);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear el KPI', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PUT', `/api/kpis/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({ title: 'KPI actualizado', description: 'Los cambios se guardaron correctamente.' });
      setEditingKpi(null);
      setFormData(EMPTY_FORM);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el KPI', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/kpis/${id}?companyId=${companyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({ title: 'KPI eliminado', description: 'El KPI ha sido eliminado.' });
      setDeletingKpi(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el KPI', variant: 'destructive' });
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, responsible }: { id: number; responsible: string }) =>
      apiRequest('PATCH', `/api/kpis/${id}/transfer`, { responsible, companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({ title: 'KPI transferido', description: `El KPI se transfirió a ${transferTo}.` });
      setTransferringKpi(null);
      setTransferTo('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo transferir el KPI', variant: 'destructive' });
    },
  });

  // Derived data
  const uniqueAreas = useMemo(() => {
    const areaNames = kpis
      .map((k: any) => k.area || k.areaName)
      .filter((a: string | undefined): a is string => !!a && a.trim() !== '');
    return Array.from(new Set(areaNames)).sort();
  }, [kpis]);

  const uniqueResponsibles = useMemo(() => {
    const names = kpis
      .map((k: any) => k.responsible)
      .filter((r: string | undefined): r is string => !!r && r.trim() !== '');
    return Array.from(new Set(names)).sort();
  }, [kpis]);

  const filteredKpis = useMemo(() => {
    return kpis.filter((kpi: any) => {
      const name = (kpi.kpiName || kpi.name || '').toLowerCase();
      const area = (kpi.area || '').toLowerCase();
      const responsible = (kpi.responsible || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch = !searchTerm ||
        name.includes(search) ||
        area.includes(search) ||
        responsible.includes(search);

      const matchesArea = areaFilter === 'all' || (kpi.area || '') === areaFilter;

      return matchesSearch && matchesArea;
    });
  }, [kpis, searchTerm, areaFilter]);

  // Handlers
  function openCreate() {
    setFormData(EMPTY_FORM);
    setShowCreateDialog(true);
  }

  function openEdit(kpi: Kpi) {
    setFormData({
      kpiName: (kpi as any).kpiName || kpi.name || '',
      area: kpi.area || '',
      description: kpi.description || '',
      goal: kpi.goal || '',
      unit: kpi.unit || '',
      frequency: kpi.frequency || 'monthly',
      responsible: kpi.responsible || '',
      calculationMethod: kpi.calculationMethod || '',
      source: kpi.source || '',
    });
    setEditingKpi(kpi);
  }

  function handleSave() {
    const payload = {
      ...formData,
      companyId,
    };

    if (editingKpi) {
      updateMutation.mutate({ id: editingKpi.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleTransfer() {
    if (!transferringKpi || !transferTo.trim()) return;
    transferMutation.mutate({ id: transferringKpi.id, responsible: transferTo.trim() });
  }

  const companyName = companyId === 1 ? 'Dura' : 'Orsega';
  const isFormValid = formData.kpiName.trim() !== '' && formData.area.trim() !== '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Administrar KPIs - {companyName}</h2>
          <p className="text-sm text-muted-foreground">
            {filteredKpis.length} KPI{filteredKpis.length !== 1 ? 's' : ''} encontrados
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo KPI
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Cerrar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, area o responsable..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las areas</SelectItem>
            {uniqueAreas.map(area => (
              <SelectItem key={area} value={area}>{area}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando KPIs...</div>
      ) : filteredKpis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Target className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No se encontraron KPIs</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Crear primer KPI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Nombre</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKpis.map((kpi: any) => (
                  <TableRow key={`${kpi.id}-${kpi.companyId}`}>
                    <TableCell className="font-medium">
                      {kpi.kpiName || kpi.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {kpi.area || 'Sin area'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {kpi.goal || '-'}{' '}
                        {kpi.unit && <span className="text-muted-foreground">{kpi.unit}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {FREQUENCY_OPTIONS.find(f => f.value === kpi.frequency)?.label || kpi.frequency || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {kpi.responsible || <span className="text-muted-foreground italic">Sin asignar</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar"
                          onClick={() => openEdit(kpi)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Transferir"
                          onClick={() => {
                            setTransferringKpi(kpi);
                            setTransferTo(kpi.responsible || '');
                          }}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Eliminar"
                          onClick={() => setDeletingKpi(kpi)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingKpi}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingKpi(null);
            setFormData(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingKpi ? 'Editar KPI' : 'Nuevo KPI'}
            </DialogTitle>
            <DialogDescription>
              {editingKpi
                ? 'Modifica los datos del KPI. Los cambios se aplican inmediatamente.'
                : `Crea un nuevo KPI para ${companyName}.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Nombre */}
            <div className="grid gap-1.5">
              <Label htmlFor="kpiName">Nombre del KPI *</Label>
              <Input
                id="kpiName"
                placeholder="Ej: Volumen de Ventas"
                value={formData.kpiName}
                onChange={e => setFormData(prev => ({ ...prev, kpiName: e.target.value }))}
              />
            </div>

            {/* Area */}
            <div className="grid gap-1.5">
              <Label htmlFor="area">Area *</Label>
              <Select
                value={formData.area}
                onValueChange={val => setFormData(prev => ({ ...prev, area: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un area" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueAreas.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                  {/* Common areas if none exist yet */}
                  {!uniqueAreas.includes('Ventas') && <SelectItem value="Ventas">Ventas</SelectItem>}
                  {!uniqueAreas.includes('Logística') && <SelectItem value="Logística">Logística</SelectItem>}
                  {!uniqueAreas.includes('Tesorería') && <SelectItem value="Tesorería">Tesorería</SelectItem>}
                  {!uniqueAreas.includes('Calidad') && <SelectItem value="Calidad">Calidad</SelectItem>}
                  {!uniqueAreas.includes('Bodega/Inventario') && <SelectItem value="Bodega/Inventario">Bodega/Inventario</SelectItem>}
                  {!uniqueAreas.includes('Compras') && <SelectItem value="Compras">Compras</SelectItem>}
                  {!uniqueAreas.includes('Dirección') && <SelectItem value="Dirección">Dirección</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Meta + Unidad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="goal">Meta</Label>
                <Input
                  id="goal"
                  placeholder="Ej: 55000"
                  value={formData.goal}
                  onChange={e => setFormData(prev => ({ ...prev, goal: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="unit">Unidad</Label>
                <Select
                  value={formData.unit}
                  onValueChange={val => setFormData(prev => ({ ...prev, unit: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Frecuencia + Responsable */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="frequency">Frecuencia</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={val => setFormData(prev => ({ ...prev, frequency: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="responsible">Responsable</Label>
                <Select
                  value={formData.responsible}
                  onValueChange={val => setFormData(prev => ({ ...prev, responsible: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Show users from the system */}
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                    ))}
                    {/* Fallback to unique responsibles from existing KPIs */}
                    {users.length === 0 && uniqueResponsibles.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descripcion */}
            <div className="grid gap-1.5">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                placeholder="Descripcion breve del KPI..."
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Metodo de calculo */}
            <div className="grid gap-1.5">
              <Label htmlFor="calculationMethod">Metodo de calculo</Label>
              <Input
                id="calculationMethod"
                placeholder="Ej: (Unidades vendidas / Meta) x 100"
                value={formData.calculationMethod}
                onChange={e => setFormData(prev => ({ ...prev, calculationMethod: e.target.value }))}
              />
            </div>

            {/* Fuente */}
            <div className="grid gap-1.5">
              <Label htmlFor="source">Fuente de datos</Label>
              <Input
                id="source"
                placeholder="Ej: Excel IDRALL, Manual, Sistema"
                value={formData.source}
                onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingKpi(null);
                setFormData(EMPTY_FORM);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : editingKpi ? 'Guardar cambios' : 'Crear KPI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingKpi}
        onOpenChange={(open) => { if (!open) setDeletingKpi(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar KPI</AlertDialogTitle>
            <AlertDialogDescription>
              Estas seguro de eliminar el KPI <strong>"{(deletingKpi as any)?.kpiName || deletingKpi?.name}"</strong>?
              Esta accion no se puede deshacer y se eliminaran todos los valores historicos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingKpi && deleteMutation.mutate(deletingKpi.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog
        open={!!transferringKpi}
        onOpenChange={(open) => {
          if (!open) {
            setTransferringKpi(null);
            setTransferTo('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Transferir KPI</DialogTitle>
            <DialogDescription>
              Transfiere <strong>"{(transferringKpi as any)?.kpiName || transferringKpi?.name}"</strong> a otro responsable.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Responsable actual</Label>
              <p className="text-sm text-muted-foreground">
                {transferringKpi?.responsible || 'Sin asignar'}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="transferTo">Nuevo responsable</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar persona" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                  {users.length === 0 && uniqueResponsibles.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferringKpi(null); setTransferTo(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!transferTo.trim() || transferMutation.isPending}
            >
              {transferMutation.isPending ? 'Transfiriendo...' : 'Transferir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
