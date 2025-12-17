import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  BarChart3,
  Package,
  ArrowLeft,
  Sparkles,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
  UserMinus,
  DollarSign,
  RefreshCw
} from "lucide-react";
import type { SalesMetrics } from "@/types/sales";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { AccionesTable } from "@/components/sales/AccionesTable";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";

type ViewMode = "overview" | "upload" | "comparison" | "alerts" | "acciones";

export default function SalesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detectar ruta actual y establecer viewMode inicial
  useEffect(() => {
    if (location === "/sales/dura") {
      setSelectedCompany(1);
    } else if (location === "/sales/orsega") {
      setSelectedCompany(2);
    }
  }, [location]);

  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedCompany, setSelectedCompany] = useState<number>(user?.companyId || 1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Determinar qué empresas puede ver el usuario
  const canViewDura = user?.role === 'admin' || user?.companyId === 1;
  const canViewOrsega = user?.role === 'admin' || user?.companyId === 2;

  // Query para estadísticas generales (ahora incluye todas las nuevas métricas)
  const { data: stats, isLoading: isLoadingStats } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales-stats', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-stats?companyId=${selectedCompany}`);
      return await res.json();
    },
    enabled: !!user,
    refetchInterval: 30000 // Refrescar cada 30 segundos
  });

  // Query para alertas activas
  const { data: alerts, isLoading: isLoadingAlerts } = useQuery({
    queryKey: ['/api/sales-alerts', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-alerts?companyId=${selectedCompany}`);
      return await res.json();
    },
    enabled: !!user && viewMode === 'alerts',
    refetchInterval: 60000
  });

  // Query para comparativo
  const { data: comparison, isLoading: isLoadingComparison } = useQuery({
    queryKey: ['/api/sales-comparison', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-comparison?companyId=${selectedCompany}`);
      return await res.json();
    },
    enabled: !!user && viewMode === 'comparison',
    refetchInterval: 60000
  });

  // Query para tendencias mensuales (para gráficos)
  const { data: monthlyTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['/api/sales-monthly-trends', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-monthly-trends?companyId=${selectedCompany}&months=12`);
      return await res.json();
    },
    enabled: !!user && viewMode === 'overview',
    refetchInterval: 60000
  });

  // Query para top clientes
  const { data: topClients, isLoading: isLoadingTopClients } = useQuery({
    queryKey: ['/api/sales-top-clients', selectedCompany],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-top-clients?companyId=${selectedCompany}&limit=5`);
      return await res.json();
    },
    enabled: !!user && viewMode === 'overview',
    refetchInterval: 60000
  });

  // Mutación para subir archivo Excel
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', selectedCompany.toString());

      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No se encontró token de autenticación");
      }

      const res = await fetch("/api/sales/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.details || errorData.error || 'Error al subir el archivo');
      }

      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Archivo procesado exitosamente",
        description: `Se procesaron ${data.recordsProcessed} registros y se crearon ${data.accionesCreadas || 0} acciones`,
        variant: "default",
      });

      // Limpiar archivo seleccionado
      setSelectedFile(null);

      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ['/api/sales-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comparison'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-monthly-trends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-top-clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/acciones'] });

      // Volver a overview después de 2 segundos
      setTimeout(() => {
        setViewMode("overview");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al subir archivo",
        description: error.message || "Ocurrió un error al procesar el archivo",
        variant: "destructive",
      });
    },
  });

  // Handlers para drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Formato no válido",
          description: "Solo se permiten archivos Excel (.xlsx, .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Formato no válido",
          description: "Solo se permiten archivos Excel (.xlsx, .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleUpload = useCallback(() => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Selecciona un archivo antes de subirlo",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(selectedFile);
  }, [selectedFile, uploadMutation, toast]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Módulo de Ventas
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Análisis comparativo y seguimiento de clientes
              </p>
            </div>

            <Button
              onClick={() => setViewMode("upload")}
              className="bg-primary text-white hover:bg-primary/90"
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir Excel Semanal
            </Button>
          </div>

          {/* Tabs de empresa */}
          {user?.role === 'admin' && (
            <Tabs value={selectedCompany.toString()} onValueChange={(value) => setSelectedCompany(Number(value))}>
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="1">Dura International</TabsTrigger>
                <TabsTrigger value="2">Grupo Orsega</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* Vista según modo seleccionado */}
        {viewMode === "overview" && (
          <div className="space-y-6">
            {/* KPIs Overview - Mejorado con gradientes y animaciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 dark:bg-blue-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clientes Activos
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-4xl font-bold text-blue-900 dark:text-blue-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-16 bg-blue-200 dark:bg-blue-800 rounded animate-pulse"></div>
                      ) : (
                        stats?.activeClients || 0
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-blue-200 dark:bg-blue-800">
                      <Users className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                  </div>
                  {monthlyTrends && monthlyTrends.length > 0 && (
                    <div className="h-16 -mb-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyTrends.slice(-6)}>
                          <Line 
                            type="monotone" 
                            dataKey="clients" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Este mes: {stats?.activeClientsMetrics?.thisMonth || 0}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-500 font-medium">
                      Últimos 3 meses: {stats?.activeClientsMetrics?.last3Months || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-200 dark:bg-green-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Volumen del Mes
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-24 bg-green-200 dark:bg-green-800 rounded animate-pulse"></div>
                      ) : (
                        (stats?.currentVolume?.toLocaleString('es-MX') || 0)
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-green-200 dark:bg-green-800">
                      <Package className="h-6 w-6 text-green-600 dark:text-green-300" />
                    </div>
                  </div>
                  {monthlyTrends && monthlyTrends.length > 0 && (
                    <div className="h-16 -mb-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyTrends.slice(-6)}>
                          <Bar 
                            dataKey="volume" 
                            fill="#10b981"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                    {stats?.unit || (selectedCompany === 1 ? 'KG' : 'Unidades')}
                  </p>
                </CardContent>
              </Card>

              <Card className={`relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 ${
                stats?.growth >= 0 
                  ? 'bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900' 
                  : 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-900'
              }`}>
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-20 ${
                  stats?.growth >= 0 
                    ? 'bg-emerald-200 dark:bg-emerald-800' 
                    : 'bg-red-200 dark:bg-red-800'
                }`}></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${
                    stats?.growth >= 0 
                      ? 'text-emerald-700 dark:text-emerald-300' 
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    <Activity className="h-4 w-4" />
                    Crecimiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`text-4xl font-bold ${
                        stats?.growth >= 0 
                          ? 'text-emerald-900 dark:text-emerald-100' 
                          : 'text-red-900 dark:text-red-100'
                      }`}>
                        {isLoadingStats ? (
                          <div className={`h-10 w-20 rounded animate-pulse ${
                            stats?.growth >= 0 ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-red-200 dark:bg-red-800'
                          }`}></div>
                        ) : (
                          `${stats?.growth >= 0 ? '+' : ''}${stats?.growth || 0}%`
                        )}
                      </div>
                      {stats?.growth >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className={`p-3 rounded-full ${
                      stats?.growth >= 0 
                        ? 'bg-emerald-200 dark:bg-emerald-800' 
                        : 'bg-red-200 dark:bg-red-800'
                    }`}>
                      <BarChart3 className={`h-6 w-6 ${
                        stats?.growth >= 0 
                          ? 'text-emerald-600 dark:text-emerald-300' 
                          : 'text-red-600 dark:text-red-300'
                      }`} />
                    </div>
                  </div>
                  <p className={`text-xs mt-2 font-medium ${
                    stats?.growth >= 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    Mismo período 2024
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950 dark:to-yellow-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200 dark:bg-amber-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alertas Activas
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-bold text-amber-900 dark:text-amber-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-16 bg-amber-200 dark:bg-amber-800 rounded animate-pulse"></div>
                      ) : (
                        stats?.activeAlerts || 0
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800 animate-pulse">
                      <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    Requieren atención
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Botón para mostrar/ocultar métricas avanzadas */}
            {!showAdvancedMetrics && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAdvancedMetrics(true)}
                  className="text-sm"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Ver métricas avanzadas
                </Button>
              </div>
            )}

            {/* Nuevas Métricas - Segunda fila (colapsable) */}
            {showAdvancedMetrics && (
              <>
                <div className="flex justify-between items-center mt-6 mb-2">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Métricas Avanzadas
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedMetrics(false)}
                    className="text-xs"
                  >
                    Ocultar
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tasa de Retención */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 dark:bg-purple-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tasa de Retención
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-4xl font-bold text-purple-900 dark:text-purple-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-20 bg-purple-200 dark:bg-purple-800 rounded animate-pulse"></div>
                      ) : (
                        `${stats?.retentionRate?.rate.toFixed(1) || 0}%`
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-purple-200 dark:bg-purple-800">
                      <RefreshCw className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Retenidos: {stats?.retentionRate?.retainedClients || 0}
                    </p>
                    <p className="text-xs text-purple-500 dark:text-purple-500">
                      Período actual: {stats?.retentionRate?.currentPeriodClients || 0} clientes
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Nuevos Clientes */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950 dark:to-teal-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200 dark:bg-emerald-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Nuevos Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-4xl font-bold text-emerald-900 dark:text-emerald-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-16 bg-emerald-200 dark:bg-emerald-800 rounded animate-pulse"></div>
                      ) : (
                        stats?.newClients?.count || 0
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                      <UserPlus className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                    Primera compra este mes
                  </p>
                </CardContent>
              </Card>

              {/* Valor Promedio por Orden */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-cyan-950 dark:to-blue-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-200 dark:bg-cyan-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Valor Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl font-bold text-cyan-900 dark:text-cyan-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-24 bg-cyan-200 dark:bg-cyan-800 rounded animate-pulse"></div>
                      ) : (
                        `$${stats?.avgOrderValue?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                      <DollarSign className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                    </div>
                  </div>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2 font-medium">
                    Por orden/transacción
                  </p>
                </CardContent>
              </Card>

              {/* Clientes Perdidos (Churn) */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-rose-50 to-red-100 dark:from-rose-950 dark:to-red-900 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200 dark:bg-rose-800 rounded-full -mr-16 -mt-16 opacity-20"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="text-sm font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <UserMinus className="h-4 w-4" />
                    Clientes Perdidos
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-4xl font-bold text-rose-900 dark:text-rose-100">
                      {isLoadingStats ? (
                        <div className="h-10 w-20 bg-rose-200 dark:bg-rose-800 rounded animate-pulse"></div>
                      ) : (
                        `${stats?.clientChurn?.count || 0}`
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-rose-200 dark:bg-rose-800">
                      <UserMinus className="h-6 w-6 text-rose-600 dark:text-rose-300" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      Tasa de churn: {stats?.clientChurn?.rate.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-rose-500 dark:text-rose-500">
                      Inactivos este mes
                    </p>
                  </div>
                </CardContent>
              </Card>
                </div>
              </>
            )}

            {/* Sección de acciones rápidas - Mejorada */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="cursor-pointer group relative overflow-hidden border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-blue-950"
                onClick={() => setViewMode("comparison")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-500/10 transition-all duration-300"></div>
                <CardHeader className="relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        Análisis Comparativo
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">
                        Año actual vs anterior
                      </CardDescription>
                    </div>
                    <Sparkles className="h-5 w-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Ver diferencial por cliente y detectar oportunidades de crecimiento
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer group relative overflow-hidden border-2 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-amber-50 dark:from-gray-900 dark:to-amber-950"
                onClick={() => setViewMode("alerts")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-amber-500/10 transition-all duration-300"></div>
                <CardHeader className="relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg group-hover:scale-110 transition-transform duration-300 animate-pulse">
                      <AlertTriangle className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        Alertas y Seguimiento
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">
                        Clientes que requieren atención
                      </CardDescription>
                    </div>
                    <Sparkles className="h-5 w-5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Clientes inactivos y con diferencial negativo significativo
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer group relative overflow-hidden border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-green-50 dark:from-gray-900 dark:to-green-950"
                onClick={() => setViewMode("upload")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/0 group-hover:from-green-500/5 group-hover:to-green-500/10 transition-all duration-300"></div>
                <CardHeader className="relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <FileSpreadsheet className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        Cargar Datos
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">
                        Excel semanal de ventas
                      </CardDescription>
                    </div>
                    <Sparkles className="h-5 w-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Subir el reporte semanal de Mario para actualizar el análisis
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer group relative overflow-hidden border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950"
                onClick={() => setViewMode("acciones")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-purple-500/10 transition-all duration-300"></div>
                <CardHeader className="relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle2 className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        Acciones Estratégicas
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">
                        Gestión de tareas de ventas
                      </CardDescription>
                    </div>
                    <Sparkles className="h-5 w-5 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Ver y gestionar acciones estratégicas por cliente y responsable
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Dashboard Visual - Gráficos y Visualizaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Tendencias Mensuales */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Tendencias Mensuales
                  </CardTitle>
                  <CardDescription>
                    Evolución del volumen de ventas últimos 12 meses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTrends ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-pulse text-gray-400">Cargando gráfico...</div>
                    </div>
                  ) : !monthlyTrends || monthlyTrends.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                      <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500">No hay datos disponibles</p>
                      <Button
                        onClick={() => setViewMode("upload")}
                        className="mt-4"
                        size="sm"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Subir Datos
                      </Button>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px'
                            }}
                            formatter={(value: any) => `${value.toLocaleString('es-MX')} ${stats?.unit || ''}`}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="volume" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Volumen"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="clients" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ fill: '#10b981', r: 3 }}
                            name="Clientes Activos"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico de Volumen Mensual (Barras) */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    Volumen Mensual
                  </CardTitle>
                  <CardDescription>
                    Comparación de volumen por mes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTrends ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-pulse text-gray-400">Cargando gráfico...</div>
                    </div>
                  ) : !monthlyTrends || monthlyTrends.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                      <Package className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px'
                            }}
                            formatter={(value: any) => `${value.toLocaleString('es-MX')} ${stats?.unit || ''}`}
                          />
                          <Bar 
                            dataKey="volume" 
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                            name="Volumen"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Clientes - Gráfico de Pastel */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    Top Clientes del Mes
                  </CardTitle>
                  <CardDescription>
                    Distribución de volumen por cliente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTopClients ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-pulse text-gray-400">Cargando gráfico...</div>
                    </div>
                  ) : !topClients || topClients.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                      <Users className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500">No hay datos de clientes disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={topClients}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name.substring(0, 15)}${name.length > 15 ? '...' : ''} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="volume"
                            >
                              {topClients.map((entry: any, index: number) => {
                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => `${value.toLocaleString('es-MX')} ${topClients[0]?.unit || ''}`}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {topClients.map((client: any, index: number) => {
                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                          return (
                            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: colors[index % colors.length] }}
                                ></div>
                                <span className="text-sm font-medium">{client.name}</span>
                              </div>
                              <span className="text-sm font-semibold">
                                {client.volume.toLocaleString('es-MX')} {client.unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen de Actividad */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-amber-500" />
                    Resumen de Actividad
                  </CardTitle>
                  <CardDescription>
                    Métricas clave del período actual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingStats || isLoadingTrends ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-pulse text-gray-400">Cargando datos...</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Promedio Mensual</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {monthlyTrends && monthlyTrends.length > 0
                              ? (monthlyTrends.reduce((acc: number, item: any) => acc + item.volume, 0) / monthlyTrends.length).toLocaleString('es-MX', { maximumFractionDigits: 0 })
                              : '0'}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{stats?.unit || ''}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-600 dark:text-green-400 mb-1">Mejor Mes</p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {monthlyTrends && monthlyTrends.length > 0
                              ? Math.max(...monthlyTrends.map((item: any) => item.volume)).toLocaleString('es-MX', { maximumFractionDigits: 0 })
                              : '0'}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">{stats?.unit || ''}</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Total de Meses con Datos</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {monthlyTrends?.length || 0}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Últimos 12 meses</p>
                      </div>
                      <Button
                        onClick={() => setViewMode("upload")}
                        className="w-full bg-primary hover:bg-primary/90 text-white"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Subir Nuevos Datos
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {viewMode === "upload" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Upload className="h-6 w-6" />
                  Subir Excel Semanal
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Arrastra y suelta o haz clic para seleccionar el archivo
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setViewMode("overview");
                  setSelectedFile(null);
                }}
                className="flex items-center gap-2"
                disabled={uploadMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </div>

            {!selectedFile ? (
              <Card 
                className={`shadow-lg border-2 border-dashed transition-all duration-300 ${
                  isDragging 
                    ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-primary'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <CardContent className="pt-12 pb-12">
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-2xl"></div>
                      <div className="relative p-8 rounded-full bg-gradient-to-br from-primary/10 to-primary/5">
                        <Upload className="h-20 w-20 text-primary mx-auto" />
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        Arrastra tu archivo aquí o haz clic para seleccionar
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Formatos soportados: .xlsx, .xls (máximo 20MB)
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button 
                        size="lg" 
                        className="bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                        asChild
                      >
                        <span>
                          <FileSpreadsheet className="mr-2 h-5 w-5" />
                          Seleccionar Archivo
                        </span>
                      </Button>
                    </label>

                    <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md">
                      <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
                        <strong>Nota:</strong> El sistema procesará automáticamente los datos y generará alertas. 
                        Asegúrate de que el archivo tenga columnas: Cliente, Producto, Cantidad, Fecha.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                          <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        disabled={uploadMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white"
                        size="lg"
                      >
                        {uploadMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Subir y Procesar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleRemoveFile}
                        disabled={uploadMutation.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>

                    {uploadMutation.isError && (
                      <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-800 dark:text-red-200">
                          <strong>Error:</strong> {uploadMutation.error?.message || 'Error desconocido'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {viewMode === "comparison" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="h-6 w-6" />
                  Análisis Comparativo
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Comparación año actual vs año anterior por cliente
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setViewMode("overview")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </div>

            <Card className="shadow-lg">
              <CardContent className="pt-6">
                {isLoadingComparison ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Cargando datos comparativos...
                    </p>
                  </div>
                ) : !comparison || comparison.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                      No hay datos disponibles aún
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Sube el primer archivo Excel para comenzar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Gráfico de barras comparativo */}
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={comparison.slice(0, 10).map((item: any) => ({
                            name: item.client_name.length > 15 
                              ? item.client_name.substring(0, 15) + '...' 
                              : item.client_name,
                            'Año Anterior': parseFloat(item.previous_year_total),
                            'Año Actual': parseFloat(item.current_year_total),
                            fullName: item.client_name
                          }))}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px'
                            }}
                            formatter={(value: any) => `${value.toLocaleString('es-MX')} ${comparison[0]?.unit || ''}`}
                            labelFormatter={(label) => `Cliente: ${label}`}
                          />
                          <Legend />
                          <Bar 
                            dataKey="Año Anterior" 
                            fill="#94a3b8" 
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            dataKey="Año Actual" 
                            fill="#3b82f6" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Tabla detallada */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                            <tr>
                              <th className="px-6 py-4 text-left font-bold text-gray-900 dark:text-white">Cliente</th>
                              <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">Año Anterior</th>
                              <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">Año Actual</th>
                              <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">Diferencial</th>
                              <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">% Cambio</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {comparison.map((item: any, index: number) => {
                              const isDanger = item.differential < 0;
                              const isWarning = item.differential >= 0 && item.differential < (item.previous_year_total * 0.1);
                              const isSuccess = item.differential > (item.previous_year_total * 0.1);

                              return (
                                <tr 
                                  key={item.client_id} 
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                  style={{ animationDelay: `${index * 50}ms` }}
                                >
                                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                                    {item.client_name}
                                  </td>
                                  <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300">
                                    {parseFloat(item.previous_year_total).toLocaleString('es-MX')} {item.unit}
                                  </td>
                                  <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                                    {parseFloat(item.current_year_total).toLocaleString('es-MX')} {item.unit}
                                  </td>
                                  <td className={`px-6 py-4 text-right font-bold ${
                                    isDanger ? 'text-red-600 dark:text-red-400' : 
                                    isWarning ? 'text-amber-600 dark:text-amber-400' : 
                                    'text-green-600 dark:text-green-400'
                                  }`}>
                                    <div className="flex items-center justify-end gap-2">
                                      {item.differential >= 0 ? (
                                        <TrendingUp className="h-4 w-4" />
                                      ) : (
                                        <TrendingDown className="h-4 w-4" />
                                      )}
                                      {item.differential >= 0 ? '+' : ''}{parseFloat(item.differential).toLocaleString('es-MX')} {item.unit}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {item.percent_change !== null ? (
                                      <Badge 
                                        variant={isDanger ? 'destructive' : isSuccess ? 'default' : 'secondary'}
                                        className="font-semibold"
                                      >
                                        {item.percent_change >= 0 ? '+' : ''}{item.percent_change}%
                                      </Badge>
                                    ) : (
                                      <span className="text-gray-400">N/A</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === "alerts" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  Alertas Activas
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Clientes que requieren seguimiento
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setViewMode("overview")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </div>

            <Card className="shadow-lg">
              <CardContent className="pt-6">
                {isLoadingAlerts ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Cargando alertas...
                    </p>
                  </div>
                ) : !alerts || alerts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                      <AlertTriangle className="h-10 w-10 text-green-500" />
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No hay alertas activas
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Las alertas se generan automáticamente al subir datos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alerts.map((alert: any, index: number) => {
                      const severityColors = {
                        critical: {
                          border: 'border-red-500',
                          bg: 'bg-red-50 dark:bg-red-950',
                          icon: 'text-red-500',
                          badge: 'destructive'
                        },
                        warning: {
                          border: 'border-amber-500',
                          bg: 'bg-amber-50 dark:bg-amber-950',
                          icon: 'text-amber-500',
                          badge: 'secondary'
                        },
                        default: {
                          border: 'border-blue-500',
                          bg: 'bg-blue-50 dark:bg-blue-950',
                          icon: 'text-blue-500',
                          badge: 'default'
                        }
                      };

                      const colors = severityColors[alert.severity as keyof typeof severityColors] || severityColors.default;

                      return (
                        <Card 
                          key={alert.id} 
                          className={`border-l-4 ${colors.border} ${colors.bg} shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]`}
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${colors.bg} border-2 ${colors.border}`}>
                                  <AlertTriangle className={`h-6 w-6 ${colors.icon} animate-pulse`} />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                    {alert.title}
                                  </CardTitle>
                                  <CardDescription className="text-sm text-gray-700 dark:text-gray-300">
                                    {alert.description}
                                  </CardDescription>
                                </div>
                              </div>
                              <Badge 
                                variant={colors.badge as any}
                                className="font-semibold"
                              >
                                {alert.alert_type === 'inactive_client' ? 'Cliente Inactivo' :
                                 alert.alert_type === 'negative_differential' ? 'Diferencial Negativo' :
                                 alert.alert_type}
                              </Badge>
                            </div>
                          </CardHeader>
                          {alert.client_name && (
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <Users className="h-4 w-4 text-gray-500" />
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  <span className="font-semibold">Cliente:</span> {alert.client_name}
                                </p>
                              </div>
                              {alert.data && (
                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    {JSON.stringify(alert.data, null, 2)}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === "acciones" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-purple-500" />
                  Acciones Estratégicas
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Gestión de acciones por cliente y responsable
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setViewMode("overview")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </div>

            <AccionesTable companyId={selectedCompany} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
