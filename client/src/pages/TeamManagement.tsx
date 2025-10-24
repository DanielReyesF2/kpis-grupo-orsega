import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  CheckCircle, 
  Building2,
  Target,
  Clock,
  Search,
  Filter,
  Activity,
  BarChart3,
  Crown,
  Award,
  Star,
  ArrowUpRight,
  MinusCircle,
  User,
  Eye,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TeamManagement() {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Fetch data
  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
    refetchInterval: 30000,
  });

  const { data: kpis } = useQuery({
    queryKey: ['/api/kpis'],
    refetchInterval: 30000,
  });

  const { data: kpiValues } = useQuery({
    queryKey: ['/api/kpi-values'],
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    refetchInterval: 60000,
  });

  // Enhanced user performance calculation
  const getUserEnhancedPerformance = () => {
    if (!users || !Array.isArray(users)) return [];

    return users.map((user: any) => {
      // ✅ ACCESO UNIVERSAL DE LECTURA: Todos ven todos los KPIs
      const userKpis = kpis || [];
      const userKpiValues = kpiValues?.filter((value: any) => 
        userKpis.some((kpi: any) => kpi.id === value.kpiId) && value.updatedBy === user.id
      ) || [];

      const totalKpis = userKpis.length;
      const completedKpis = userKpiValues.length;
      const completionRate = totalKpis > 0 ? (completedKpis / totalKpis) * 100 : 0;

      // Calculate performance score
      const compliantKpis = userKpiValues.filter(v => v.status === 'compliant' || v.status === 'complies').length;
      const performanceScore = completedKpis > 0 ? (compliantKpis / completedKpis) * 100 : 0;

      // Last activity
      const lastActivity = userKpiValues.length > 0 ? 
        Math.max(...userKpiValues.map(v => new Date(v.date).getTime())) : 
        (user.lastLogin ? new Date(user.lastLogin).getTime() : 0);

      const daysSinceActivity = lastActivity > 0 ? 
        Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24)) : 999;

      // Status determination
      let status = 'needs_attention';
      if (performanceScore >= 85 && daysSinceActivity <= 7) status = 'excellent';
      else if (performanceScore >= 70 && daysSinceActivity <= 14) status = 'good';

      return {
        ...user,
        totalKpis,
        completedKpis,
        completionRate: Math.round(completionRate),
        performanceScore: Math.round(performanceScore),
        lastActivity: lastActivity > 0 ? new Date(lastActivity) : null,
        daysSinceActivity,
        status,
        company: companies?.find(c => c.id === user.companyId)
      };
    });
  };

  const enhancedUsers = getUserEnhancedPerformance();

  // Team metrics
  const teamMetrics = {
    totalUsers: enhancedUsers.length,
    activeUsers: enhancedUsers.filter(u => u.daysSinceActivity <= 7).length,
    excellentPerformers: enhancedUsers.filter(u => u.status === 'excellent').length,
    needsAttention: enhancedUsers.filter(u => u.status === 'needs_attention').length,
    avgPerformance: enhancedUsers.length > 0 ? 
      Math.round(enhancedUsers.reduce((sum, u) => sum + u.performanceScore, 0) / enhancedUsers.length) : 0,
    avgCompletion: enhancedUsers.length > 0 ? 
      Math.round(enhancedUsers.reduce((sum, u) => sum + u.completionRate, 0) / enhancedUsers.length) : 0
  };

  // Filter users
  const filteredUsers = enhancedUsers.filter((user: any) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = companyFilter === 'all' || user.companyId?.toString() === companyFilter;
    const matchesPerformance = performanceFilter === 'all' || user.status === performanceFilter;
    
    return matchesSearch && matchesCompany && matchesPerformance;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'good': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'needs_attention': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <Award className="h-4 w-4" />;
      case 'good': return <TrendingUp className="h-4 w-4" />;
      case 'needs_attention': return <AlertTriangle className="h-4 w-4" />;
      default: return <MinusCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'excellent': return 'Excelente';
      case 'good': return 'Bueno';
      case 'needs_attention': return 'Necesita Atención';
      default: return 'Sin Datos';
    }
  };

  const UserDetailDialog = ({ user, onClose }: { user: any, onClose: () => void }) => {
    // Get user's KPIs with targets
    const userKpis = user ? kpis?.filter((kpi: any) => kpi.companyId === user.companyId) || [] : [];
    const userKpiValues = user ? kpiValues?.filter((value: any) => 
      userKpis.some((kpi: any) => kpi.id === value.kpiId) && value.updatedBy === user.id
    ) || [] : [];

    // Combine KPIs with their latest values
    const userKpiDetails = userKpis.map((kpi: any) => {
      const latestValue = userKpiValues
        .filter(v => v.kpiId === kpi.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      return {
        ...kpi,
        value: latestValue?.value || 'Sin datos',
        status: latestValue?.status || 'pending',
        period: latestValue?.period || 'Sin período',
        date: latestValue?.date || null
      };
    });

    return (
      <Dialog open={!!user} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                  {user?.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl font-semibold">{user?.name}</div>
                <div className="text-sm text-gray-500">{user?.email}</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {user && (
            <div className="space-y-6 mt-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{user.completionRate}%</div>
                  <div className="text-sm text-blue-600">Completitud KPIs</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{user.performanceScore}%</div>
                  <div className="text-sm text-green-600">Rendimiento</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{user.completedKpis}</div>
                  <div className="text-sm text-purple-600">KPIs Completados</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{user.daysSinceActivity}</div>
                  <div className="text-sm text-orange-600">Días desde actividad</div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Empresa:</span>
                  <span className="font-medium">{user.company?.name || 'Sin asignar'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Rol:</span>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Estado:</span>
                  <Badge className={getStatusColor(user.status)}>
                    {getStatusIcon(user.status)}
                    <span className="ml-1">{getStatusText(user.status)}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Última actividad:</span>
                  <span className="text-sm">
                    {user.lastActivity ? format(user.lastActivity, 'dd/MM/yyyy HH:mm', { locale: es }) : 'Sin actividad'}
                  </span>
                </div>
              </div>

              {/* Performance Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progreso de rendimiento</span>
                  <span className="font-medium">{user.performanceScore}%</span>
                </div>
                <Progress value={user.performanceScore} className="h-2" />
              </div>

              {/* KPIs Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  KPIs del Usuario
                </h3>
                
                {userKpiDetails.length > 0 ? (
                  <div className="space-y-3">
                    {userKpiDetails.map((kpi: any) => (
                      <div key={kpi.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{kpi.name}</h4>
                            <p className="text-sm text-gray-500">{kpi.description}</p>
                          </div>
                          <Badge 
                            className={
                              kpi.status === 'compliant' || kpi.status === 'complies' 
                                ? 'bg-green-100 text-green-800' 
                                : kpi.status === 'alert' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                            }
                          >
                            {kpi.status === 'compliant' || kpi.status === 'complies' ? 'Cumple' : 
                             kpi.status === 'alert' ? 'Alerta' : 'No cumple'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Valor Actual:</span>
                            <p className="font-medium">{kpi.value}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Objetivo:</span>
                            <p className="font-medium text-blue-600">{kpi.target || 'Sin objetivo'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Frecuencia:</span>
                            <p className="font-medium">{kpi.frequency || 'Sin definir'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Período:</span>
                            <p className="font-medium">{kpi.period}</p>
                          </div>
                        </div>
                        
                        {kpi.date && (
                          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                            Última actualización: {format(new Date(kpi.date), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay KPIs asignados para este usuario</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium">
                  Panel de Control Ejecutivo
                </p>
                <h1 className="text-2xl font-bold">
                  Administra usuarios, roles y permisos del sistema
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                variant="outline"
              >
                <User className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
              <div className="text-right">
                <div className="font-semibold">Mario Reynoso</div>
                <div className="text-sm text-blue-100">Gerente General</div>
              </div>
              <div className="p-2 bg-yellow-400/20 rounded-lg">
                <Crown className="h-6 w-6 text-yellow-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-bl-3xl" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{teamMetrics.totalUsers}</div>
                  <div className="text-sm text-gray-600">Total Colaboradores</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-gray-600">Activos en plataforma</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-bl-3xl" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{teamMetrics.activeUsers}</div>
                  <div className="text-sm text-gray-600">Usuarios Activos</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-gray-600">Últimos 7 días</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-bl-3xl" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{teamMetrics.avgPerformance}%</div>
                  <div className="text-sm text-gray-600">Rendimiento Promedio</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span className="text-gray-600">Basado en KPIs</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-bl-3xl" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{teamMetrics.needsAttention}</div>
                  <div className="text-sm text-gray-600">Requieren Atención</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-gray-600">Bajo rendimiento</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-xl">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <Users className="h-4 w-4 mr-2" />
              Equipo
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <Target className="h-4 w-4 mr-2" />
              Rendimiento
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {enhancedUsers
                      .filter(u => u.status === 'excellent')
                      .slice(0, 5)
                      .map((user: any, index: number) => (
                        <div key={user.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">#{index + 1}</span>
                            </div>
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                              {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.company?.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">{user.performanceScore}%</div>
                            <div className="text-xs text-gray-500">rendimiento</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Needs Attention */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Requieren Atención
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {enhancedUsers
                      .filter(u => u.status === 'needs_attention')
                      .slice(0, 5)
                      .map((user: any) => (
                        <div key={user.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold">
                              {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.company?.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-amber-600">{user.performanceScore}%</div>
                            <div className="text-xs text-gray-500">
                              {user.daysSinceActivity} días
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            {/* Enhanced Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros del Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar colaborador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Todas las empresas" />
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
                  <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="excellent">Excelente</SelectItem>
                      <SelectItem value="good">Bueno</SelectItem>
                      <SelectItem value="needs_attention">Necesita Atención</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Team Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredUsers.map((user: any) => (
                <Card key={user.id} className="group hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={() => setSelectedUser(user)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                          {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-semibold group-hover:text-blue-600 transition-colors">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500">{user.company?.name}</div>
                      </div>
                      <Badge className={getStatusColor(user.status)}>
                        {getStatusIcon(user.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Rendimiento</span>
                        <span className="font-semibold">{user.performanceScore}%</span>
                      </div>
                      <Progress value={user.performanceScore} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Completitud</span>
                        <span className="font-semibold">{user.completionRate}%</span>
                      </div>
                      <Progress value={user.completionRate} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>Última actividad</span>
                      </div>
                      <span className="text-gray-700">
                        {user.daysSinceActivity === 0 ? 'Hoy' : 
                         user.daysSinceActivity === 1 ? 'Ayer' : 
                         `${user.daysSinceActivity} días`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Rendimiento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-emerald-500 rounded-full" />
                        <span>Excelente (85%+)</span>
                      </div>
                      <span className="font-semibold">{teamMetrics.excellentPerformers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full" />
                        <span>Bueno (70-84%)</span>
                      </div>
                      <span className="font-semibold">
                        {enhancedUsers.filter(u => u.status === 'good').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-amber-500 rounded-full" />
                        <span>Necesita Atención (&lt;70%)</span>
                      </div>
                      <span className="font-semibold">{teamMetrics.needsAttention}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Company Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Rendimiento por Empresa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {companies?.map((company: any) => {
                      const companyUsers = enhancedUsers.filter(u => u.companyId === company.id);
                      const avgPerformance = companyUsers.length > 0 ? 
                        Math.round(companyUsers.reduce((sum, u) => sum + u.performanceScore, 0) / companyUsers.length) : 0;
                      
                      return (
                        <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{company.name}</div>
                            <div className="text-sm text-gray-500">{companyUsers.length} colaboradores</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{avgPerformance}%</div>
                            <div className="text-sm text-gray-500">promedio</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* User Detail Modal */}
        {selectedUser && (
          <UserDetailDialog 
            user={selectedUser} 
            onClose={() => setSelectedUser(null)} 
          />
        )}
      </div>
    </AppLayout>
  );
}