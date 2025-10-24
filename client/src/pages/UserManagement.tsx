import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';


export default function UserManagement() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Fetch data
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    refetchInterval: 30000,
  });

  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
  });

  const { data: kpis } = useQuery({
    queryKey: ['/api/kpis'],
  });

  const { data: kpiValues } = useQuery({
    queryKey: ['/api/kpi-values'],
  });



  // Calcular métricas de usuarios
  const getUserMetrics = () => {
    if (!users || !kpis || !kpiValues) return [];
    if (!Array.isArray(users) || !Array.isArray(kpis) || !Array.isArray(kpiValues)) return [];

    // Filtrar solo usuarios válidos (con email completo y role correcto)
    const validUsers = users.filter((user: any) => 
      user.email && 
      user.email.includes('@') && 
      (user.role === 'admin' || user.role === 'collaborator')
    );

    console.log('Total usuarios recibidos:', users.length);
    console.log('Usuarios válidos después de filtro:', validUsers.length);
    console.log('Usuarios válidos:', validUsers.map(u => ({ name: u.name, email: u.email, role: u.role })));

    return validUsers.map((user: any) => {
      // ✅ ACCESO UNIVERSAL DE LECTURA: Todos ven todos los KPIs
      let userKpis = kpis || [];

      // Calcular cumplimiento
      let compliantKpis = 0;
      let totalKpis = userKpis.length;
      let lastUpdate = null;

      if (Array.isArray(kpiValues) && userKpis.length > 0) {
        const userKpiIds = userKpis.map((kpi: any) => kpi.id);
        const userKpiValues = kpiValues.filter((value: any) => userKpiIds.includes(value.kpiId));
        
        compliantKpis = userKpiValues.filter((value: any) => value.status === 'complies').length;
        
        // Encontrar la última actualización
        const sortedValues = userKpiValues.sort((a: any, b: any) => 
          new Date(b.createdAt || b.period).getTime() - new Date(a.createdAt || a.period).getTime()
        );
        if (sortedValues.length > 0) {
          lastUpdate = sortedValues[0].createdAt || sortedValues[0].period;
        }
      }

      const complianceRate = totalKpis > 0 ? Math.round((compliantKpis / totalKpis) * 100) : 0;
      const company = Array.isArray(companies) ? companies.find((c: any) => c.id === user.companyId) : null;

      return {
        ...user,
        complianceRate,
        totalKpis,
        compliantKpis,
        lastUpdate,
        companyName: company?.name || 'Sin asignar'
      };
    });
  };

  const userMetrics = getUserMetrics();
  const filteredUsers = userMetrics.filter((user: any) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Funciones auxiliares
  const getComplianceStatus = (rate: number) => {
    if (rate >= 80) return { label: 'Excelente', color: 'bg-green-500', variant: 'default' as const };
    if (rate >= 60) return { label: 'Bueno', color: 'bg-yellow-500', variant: 'secondary' as const };
    return { label: 'Requiere Atención', color: 'bg-red-500', variant: 'destructive' as const };
  };

  const getDaysFromLastUpdate = (lastUpdate: string | null) => {
    if (!lastUpdate) return null;
    const diff = Date.now() - new Date(lastUpdate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };


  if (!users || !Array.isArray(users)) {
    return (
      <AppLayout title="Gestión de Colaboradores">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p>Cargando información de colaboradores...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const overallCompliance = userMetrics.length > 0 
    ? Math.round(userMetrics.reduce((acc, user) => acc + user.complianceRate, 0) / userMetrics.length)
    : 0;

  const usersNeedingAttention = userMetrics.filter(user => user.complianceRate < 60).length;
  const recentUpdates = userMetrics.filter(user => {
    const days = getDaysFromLastUpdate(user.lastUpdate);
    return days !== null && days <= 7;
  }).length;

  return (
    <AppLayout title="Gestión de Colaboradores">
      <div className="space-y-6">
        {/* Header con métricas generales */}
        <div className="bg-gradient-to-r from-[#273949] to-[#1a2a36] p-6 rounded-xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-8 w-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Gestión de Colaboradores</h1>
              <p className="text-white/80">Supervisión y seguimiento de equipos</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="text-sm">Total Colaboradores</span>
              </div>
              <p className="text-3xl font-bold mt-2">{userMetrics.length}</p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span className="text-sm">Cumplimiento Promedio</span>
              </div>
              <p className="text-3xl font-bold mt-2">{overallCompliance}%</p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-400" />
                <span className="text-sm">Requieren Atención</span>
              </div>
              <p className="text-3xl font-bold mt-2">{usersNeedingAttention}</p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-400" />
                <span className="text-sm">Actualizaciones Recientes</span>
              </div>
              <p className="text-3xl font-bold mt-2">{recentUpdates}</p>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, email o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs de contenido */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="performance">Rendimiento Detallado</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((user: any) => {
                const status = getComplianceStatus(user.complianceRate);
                const daysSinceUpdate = getDaysFromLastUpdate(user.lastUpdate);
                
                return (
                  <Card key={user.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{user.name}</CardTitle>
                            <CardDescription>{user.companyName}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Cumplimiento KPIs</span>
                          <span className="font-semibold">{user.complianceRate}%</span>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${status.color}`}
                            style={{ width: `${user.complianceRate}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>{user.compliantKpis} de {user.totalKpis} KPIs</span>
                          {daysSinceUpdate !== null && (
                            <span className={daysSinceUpdate > 14 ? 'text-red-600' : 'text-green-600'}>
                              {daysSinceUpdate === 0 ? 'Hoy' : `${daysSinceUpdate}d`}
                            </span>
                          )}
                        </div>
                        
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento Detallado por Usuario</CardTitle>
                <CardDescription>Análisis completo del cumplimiento de KPIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user: any) => {
                    const status = getComplianceStatus(user.complianceRate);
                    const daysSinceUpdate = getDaysFromLastUpdate(user.lastUpdate);
                    
                    return (
                      <div key={user.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-lg">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{user.name}</h3>
                              <p className="text-gray-600">{user.email}</p>
                              <p className="text-sm text-gray-500">{user.companyName}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Badge variant={status.variant} className="mb-2">{user.complianceRate}%</Badge>
                            <p className="text-sm text-gray-600">{user.compliantKpis}/{user.totalKpis} KPIs</p>
                            {daysSinceUpdate !== null && (
                              <p className={`text-sm ${daysSinceUpdate > 14 ? 'text-red-600' : 'text-green-600'}`}>
                                Última actualización: {daysSinceUpdate === 0 ? 'Hoy' : `hace ${daysSinceUpdate} días`}
                              </p>
                            )}
                          </div>
                        </div>
                        
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </AppLayout>
  );
}