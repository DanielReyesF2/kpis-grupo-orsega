import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3,
  Building2,
  Target,
  Clock,
  Crown,
  Activity
} from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

export default function ExecutiveDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch data with the same queries but different presentation
  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
    refetchInterval: 30000, // Less frequent for executive view
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

  // Executive analytics calculations
  const getExecutiveMetrics = () => {
    if (!kpiValues || !kpis || !companies) return null;
    if (!Array.isArray(kpis) || !Array.isArray(kpiValues) || !Array.isArray(companies)) return null;

    const totalKpis = kpis.length;
    const compliantKpis = kpiValues.filter((value: any) => value.status === 'complies').length;
    const alertKpis = kpiValues.filter((value: any) => value.status === 'alert').length;
    const nonCompliantKpis = kpiValues.filter((value: any) => value.status === 'not_compliant').length;
    
    const complianceRate = totalKpis > 0 ? Math.round((compliantKpis / totalKpis) * 100) : 0;
    
    return {
      totalKpis,
      compliantKpis,
      alertKpis,
      nonCompliantKpis,
      complianceRate,
      totalCompanies: companies.length,
      activeUsers: Array.isArray(users) ? users.length : 0
    };
  };

  const getCompanyPerformance = () => {
    if (!companies || !kpiValues || !kpis) return [];
    if (!Array.isArray(companies) || !Array.isArray(kpiValues) || !Array.isArray(kpis)) return [];

    return companies.map((company: any) => {
      const companyKpis = kpis.filter((kpi: any) => kpi.companyId === company.id);
      const companyKpiValues = kpiValues.filter((value: any) => 
        companyKpis.some((kpi: any) => kpi.id === value.kpiId)
      );
      
      const compliant = companyKpiValues.filter((value: any) => value.status === 'complies').length;
      const total = companyKpiValues.length;
      const performance = total > 0 ? Math.round((compliant / total) * 100) : 0;
      
      return {
        ...company,
        totalKpis: total,
        compliantKpis: compliant,
        performance
      };
    });
  };

  const getCriticalAlerts = () => {
    if (!kpiValues || !kpis) return [];
    if (!Array.isArray(kpiValues) || !Array.isArray(kpis)) return [];

    return kpiValues
      .filter((value: any) => value.status === 'not_compliant' || value.status === 'alert')
      .map((value: any) => {
        const kpi = kpis.find((k: any) => k.id === value.kpiId);
        const company = Array.isArray(companies) ? companies.find((c: any) => c.id === kpi?.companyId) : null;
        
        return {
          ...value,
          kpiName: kpi?.name,
          companyName: company?.name,
          severity: value.status === 'not_compliant' ? 'high' : 'medium'
        };
      })
      .slice(0, 10); // Top 10 critical alerts
  };

  const metrics = getExecutiveMetrics();
  const companyPerformance = getCompanyPerformance();
  const criticalAlerts = getCriticalAlerts();

  if (!metrics) {
    return (
      <AppLayout title="Panel Ejecutivo">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p>Cargando métricas ejecutivas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Panel Ejecutivo - Mario Reynoso">
      <div className="space-y-6">
        {/* Executive Header */}
        <div className="bg-gradient-to-r from-[#273949] to-[#1a2a36] p-6 rounded-xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="h-8 w-8 text-yellow-400" />
            <div>
              <h1 className="text-2xl font-bold">Panel de Control Ejecutivo</h1>
              <p className="text-white/80">Vista consolidada organizacional</p>
            </div>
          </div>
          
          {/* Key Executive Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-400" />
                <span className="text-sm">Cumplimiento Global</span>
              </div>
              <p className="text-3xl font-bold mt-2">{metrics.complianceRate}%</p>
              <p className="text-xs text-white/70">{metrics.compliantKpis} de {metrics.totalKpis} KPIs</p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                <span className="text-sm">Empresas</span>
              </div>
              <p className="text-3xl font-bold mt-2">{metrics.totalCompanies}</p>
              <p className="text-xs text-white/70">Operaciones activas</p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <span className="text-sm">Alertas Críticas</span>
              </div>
              <p className="text-3xl font-bold mt-2">{metrics.nonCompliantKpis + metrics.alertKpis}</p>
              <p className="text-xs text-white/70">Requieren atención</p>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                <span className="text-sm">Colaboradores</span>
              </div>
              <p className="text-3xl font-bold mt-2">{metrics.activeUsers}</p>
              <p className="text-xs text-white/70">Usuarios activos</p>
            </div>
          </div>
        </div>

        {/* Executive Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="companies">Rendimiento por Empresa</TabsTrigger>
            <TabsTrigger value="alerts">Alertas Críticas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Compliance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Estado de Cumplimiento
                  </CardTitle>
                  <CardDescription>Distribución actual de KPIs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Cumpliendo</span>
                      </div>
                      <span className="font-semibold">{metrics.compliantKpis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span>En Alerta</span>
                      </div>
                      <span className="font-semibold">{metrics.alertKpis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span>No Cumpliendo</span>
                      </div>
                      <span className="font-semibold">{metrics.nonCompliantKpis}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Métricas Operacionales
                  </CardTitle>
                  <CardDescription>Indicadores de gestión</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total KPIs Monitoreados</span>
                      <span className="font-semibold">{metrics.totalKpis}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Empresas Supervisadas</span>
                      <span className="font-semibold">{metrics.totalCompanies}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tasa de Cumplimiento</span>
                      <span className="font-semibold text-green-600">{metrics.complianceRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Última Actualización</span>
                      <span className="text-sm text-gray-500">{formatDate(new Date())}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="companies" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {companyPerformance.map((company: any) => (
                <Card key={company.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{company.name}</span>
                      <Badge variant={company.performance >= 80 ? "default" : company.performance >= 60 ? "secondary" : "destructive"}>
                        {company.performance}%
                      </Badge>
                    </CardTitle>
                    <CardDescription>{company.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>KPIs Totales</span>
                        <span className="font-semibold">{company.totalKpis}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>KPIs Cumpliendo</span>
                        <span className="font-semibold text-green-600">{company.compliantKpis}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${company.performance}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Alertas que Requieren Atención
                </CardTitle>
                <CardDescription>KPIs críticos que necesitan supervisión inmediata</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {criticalAlerts.length > 0 ? (
                    criticalAlerts.map((alert: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            alert.severity === 'high' ? 'bg-red-500' : 'bg-orange-500'
                          }`}></div>
                          <div>
                            <p className="font-medium">{alert.kpiName}</p>
                            <p className="text-sm text-gray-500">{alert.companyName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={alert.severity === 'high' ? "destructive" : "secondary"}>
                            {alert.status === 'not_compliant' ? 'No Cumple' : 'Alerta'}
                          </Badge>
                          <p className="text-sm text-gray-500 mt-1">{alert.value}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium">¡Excelente!</p>
                      <p className="text-gray-500">No hay alertas críticas en este momento</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}