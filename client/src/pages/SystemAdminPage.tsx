import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { Users, BarChart3, Plus, Edit, Trash2, UserPlus, Building, Settings, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { apiRequest } from '@/lib/queryClient';

export default function SystemAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showKpiDialog, setShowKpiDialog] = useState(false);
  const [showUserKpisDialog, setShowUserKpisDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingKpi, setEditingKpi] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedArea, setSelectedArea] = useState('all');


  // Queries
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/companies'],
  });

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['/api/areas'],
  });

  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/kpis'],
  });

  const { data: kpiValues = [] } = useQuery({
    queryKey: ['/api/kpi-values'],
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (userData: any) => apiRequest('POST', '/api/users', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowUserDialog(false);
      setEditingUser(null);
      toast({ title: 'Usuario creado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al crear usuario', description: error.message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...userData }: any) => apiRequest('PUT', `/api/users/${id}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowUserDialog(false);
      setEditingUser(null);
      toast({ title: 'Usuario actualizado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al actualizar usuario', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'Usuario eliminado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al eliminar usuario', description: error.message, variant: 'destructive' });
    },
  });

  const createKpiMutation = useMutation({
    mutationFn: (kpiData: any) => apiRequest('POST', '/api/kpis', kpiData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      setShowKpiDialog(false);
      setEditingKpi(null);
      toast({ title: 'KPI creado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al crear KPI', description: error.message, variant: 'destructive' });
    },
  });

  const updateKpiMutation = useMutation({
    mutationFn: ({ id, ...kpiData }: any) => apiRequest('PUT', `/api/kpis/${id}`, kpiData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      setShowKpiDialog(false);
      setEditingKpi(null);
      toast({ title: 'KPI actualizado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al actualizar KPI', description: error.message, variant: 'destructive' });
    },
  });

  const deleteKpiMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/kpis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      toast({ title: 'KPI eliminado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al eliminar KPI', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserKpiMutation = useMutation({
    mutationFn: (kpiId: number) => apiRequest('DELETE', `/api/user-kpis/${kpiId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
      toast({ title: 'KPI eliminado del usuario exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al eliminar KPI del usuario', description: error.message, variant: 'destructive' });
    },
  });

  const seedFxRatesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/seed-fx-rates', {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/exchange-rates'] });
      toast({ 
        title: '✅ Importación exitosa', 
        description: `${data.imported} tipos de cambio nuevos importados de Banxico (${data.skipped} ya existían)`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: '❌ Error al importar datos', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });


  // Event handlers
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const userData = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
      companyId: formData.get('companyId') === 'none' ? null : parseInt(formData.get('companyId') as string),
      areaId: formData.get('areaId') === 'none' ? null : parseInt(formData.get('areaId') as string),
    };

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, ...userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const handleKpiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    // Fix: Mapear "objective" a "goal" y "target" para que se guarde correctamente
    const objectiveValue = formData.get('objective') as string;

    const kpiData = {
      name: formData.get('name'),
      description: formData.get('description'),
      unit: formData.get('unit'),
      companyId: parseInt(formData.get('companyId') as string),
      areaId: parseInt(formData.get('areaId') as string),
      goal: objectiveValue,      // Mapear objective → goal
      target: objectiveValue,    // Mapear objective → target
      frequency: formData.get('frequency'),
    };

    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, ...kpiData });
    } else {
      createKpiMutation.mutate(kpiData);
    }
  };



  // Filter functions
  const filteredAreas = selectedCompany === 'all' 
    ? areas 
    : areas.filter(area => area.companyId === parseInt(selectedCompany));

  const filteredKpis = kpis.filter(kpi => {
    const companyMatch = selectedCompany === 'all' || kpi.companyId === parseInt(selectedCompany);
    const areaMatch = selectedArea === 'all' || kpi.areaId === parseInt(selectedArea);
    return companyMatch && areaMatch;
  });

  // Helper functions
  const getCompanyName = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Sin empresa';
  };

  const getAreaName = (areaId: number) => {
    const area = areas.find(a => a.id === areaId);
    return area?.name || 'Sin área';
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'manager': return 'bg-blue-500';
      case 'collaborator': return 'bg-green-500';
      case 'viewer': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getUserKpis = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return [];
    
    // ✅ ACCESO UNIVERSAL DE LECTURA: Todos los usuarios ven todos los KPIs
    return kpis || [];
  };

  if (kpisLoading || companiesLoading || areasLoading || usersLoading) {
    return (
      <AppLayout title="Administración del Sistema">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando administración del sistema...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Administración del Sistema">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Gestión del Equipo</h1>
        </div>

        {/* Herramientas de Administración */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Settings className="h-5 w-5" />
              Herramientas de Administración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="border-blue-300 hover:bg-blue-100"
                    disabled={seedFxRatesMutation.isPending}
                    data-testid="button-seed-fx-rates"
                  >
                    {seedFxRatesMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Importando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Importar Tipos de Cambio (Banxico)
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Importar Tipos de Cambio de Banxico</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción importará los tipos de cambio históricos (Sept-Oct 2025) desde la API de Banxico a la base de datos de producción.
                      <br /><br />
                      • Los registros que ya existan no se duplicarán<br />
                      • El proceso puede tardar ~30 segundos<br />
                      • Solo se importan datos que no están en la base de datos
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => seedFxRatesMutation.mutate()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Confirmar Importación
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <p className="text-sm text-gray-600">
                Importa datos históricos de tipos de cambio desde Banco de México
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="w-full">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gestión del Equipo
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Administra usuarios, roles y permisos del sistema
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setEditingUser(null)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Nuevo Usuario
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleUserSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Nombre Completo</Label>
                            <Input
                              id="name"
                              name="name"
                              defaultValue={editingUser?.name || ''}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              defaultValue={editingUser?.email || ''}
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="password">
                            {editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                          </Label>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            required={!editingUser}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="role">Rol</Label>
                            <Select name="role" defaultValue={editingUser?.role || ''} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar rol" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="manager">Gerente</SelectItem>
                                <SelectItem value="collaborator">Colaborador</SelectItem>
                                <SelectItem value="viewer">Observador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="companyId">Empresa</Label>
                            <Select name="companyId" defaultValue={editingUser?.companyId?.toString() || 'none'} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar empresa" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin empresa</SelectItem>
                                {companies.map(company => (
                                  <SelectItem key={company.id} value={company.id.toString()}>
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="areaId">Área</Label>
                            <Select name="areaId" defaultValue={editingUser?.areaId?.toString() || 'none'} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar área" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin área</SelectItem>
                                {areas.map(area => (
                                  <SelectItem key={area.id} value={area.id.toString()}>
                                    {area.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                            {editingUser ? 'Actualizar' : 'Crear'} Usuario
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => (
                  <Card key={user.id} className="group hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">{user.name}</h3>
                              <Badge className={`${getRoleBadgeColor(user.role)} text-white text-xs`}>
                                {user.role === 'admin' ? 'Administrador' : 
                                 user.role === 'manager' ? 'Gerente' : 
                                 user.role === 'collaborator' ? 'Colaborador' : 'Observador'}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="truncate">{user.email}</span>
                            </div>
                            {user.companyId && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Building className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{getCompanyName(user.companyId)}</span>
                              </div>
                            )}
                            {user.areaId && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Settings className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{getAreaName(user.areaId)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 hover:bg-blue-50 hover:text-blue-600"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserKpisDialog(true);
                            }}
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Ver KPIs ({getUserKpis(user.id).length})
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-green-50 hover:text-green-600"
                            onClick={() => {
                              setEditingUser(user);
                              setShowUserDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar Usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente
                                  el usuario "{user.name}" y todos sus datos asociados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User KPIs Dialog */}
        <Dialog open={showUserKpisDialog} onOpenChange={setShowUserKpisDialog}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                KPIs de {selectedUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    setEditingKpi(null);
                    setShowKpiDialog(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo KPI
                </Button>
                <div className="flex items-center gap-2">
                  <Label htmlFor="company-filter">Empresa:</Label>
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="area-filter">Área:</Label>
                  <Select value={selectedArea} onValueChange={setSelectedArea}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {filteredAreas.map(area => (
                        <SelectItem key={area.id} value={area.id.toString()}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getUserKpis(selectedUser?.id).map((kpi) => (
                  <Card key={kpi.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm mb-1">{kpi.name}</h4>
                          <div className="text-xs text-gray-500 space-y-1">
                            <span className="block">{getCompanyName(kpi.companyId)}</span>
                            <span className="block">{getAreaName(kpi.areaId)}</span>
                            <span className="block">
                              Objetivo mensual: {kpi.goal || kpi.objective || 'No definido'}
                            </span>
                            <span className="block">Frecuencia: {kpi.frequency}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingKpi(kpi);
                              setShowKpiDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar KPI?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente
                                  el KPI "{kpi.name}" y todos sus datos asociados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserKpiMutation.mutate(kpi.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {selectedUser && getUserKpis(selectedUser.id).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay KPIs asignados a este usuario</p>
                    <p className="text-sm">Haz clic en "Nuevo KPI" para agregar uno</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* KPI Dialog */}
        <Dialog open={showKpiDialog} onOpenChange={setShowKpiDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingKpi ? 'Editar KPI' : 'Crear Nuevo KPI'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleKpiSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre del KPI</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingKpi?.name || ''}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unidad</Label>
                  <Input
                    id="unit"
                    name="unit"
                    defaultValue={editingKpi?.unit || ''}
                    placeholder="ej: %, unidades, pesos"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingKpi?.description || ''}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyId">Empresa</Label>
                  <Select name="companyId" defaultValue={editingKpi?.companyId?.toString() || ''} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="areaId">Área</Label>
                  <Select name="areaId" defaultValue={editingKpi?.areaId?.toString() || ''} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map(area => (
                        <SelectItem key={area.id} value={area.id.toString()}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="objective">
                    Objetivo Mensual
                    <span className="text-xs text-gray-500 ml-1">(goal)</span>
                  </Label>
                  <Input
                    id="objective"
                    name="objective"
                    type="number"
                    step="0.01"
                    defaultValue={editingKpi?.goal || editingKpi?.objective || ''}
                    placeholder="ej: 858373 (solo número)"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ingresa solo el número sin formato. Ejemplo: para Orsega Volumen de Ventas, ingresa 858373
                  </p>
                </div>
                <div>
                  <Label htmlFor="frequency">Frecuencia</Label>
                  <Select name="frequency" defaultValue={editingKpi?.frequency || ''} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar frecuencia" />
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
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowKpiDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createKpiMutation.isPending || updateKpiMutation.isPending}>
                  {editingKpi ? 'Actualizar' : 'Crear'} KPI
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}