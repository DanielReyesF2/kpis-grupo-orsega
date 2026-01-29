import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import type { Company, Area, Kpi, KpiValue, User as UserType } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EnhancedKpiDashboard } from '@/components/kpis/EnhancedKpiDashboard';
import { EnhancedKpiCard } from '@/components/kpis/EnhancedKpiCard';
import { type CollaboratorScore } from '@/components/kpis/CollaboratorCard';
import { TremorKpiDashboard, TremorKpiUpdateModal, type TremorCollaboratorData } from '@/components/tremor';
import { KpiAdminPanel } from '@/components/kpis/KpiAdminPanel';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { 
  TrendingUp, 
  Building, 
  Target, 
  Calendar,
  User,
  MapPin,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Mail,
  BarChart3,
  Award,
  Activity,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  Clock,
  ChevronDown,
  Eye,
  ChevronUp,
  FolderTree,
  Search,
  Settings
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from 'recharts';

// Componente para mostrar el historial de KPIs de un usuario
function UserHistoryView({ userId, months, users }: { userId: number; months: number; users: UserType[] }) {
  const [showAllKpis, setShowAllKpis] = useState(false);
  
  const { data: userHistory, isLoading } = useQuery<any[]>({
    queryKey: [`/api/user-kpi-history/${userId}`, { months }],
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-spin" />
        <p>Cargando historial del usuario...</p>
      </div>
    );
  }

  if (!userHistory || userHistory.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No hay datos históricos disponibles para este usuario</p>
      </div>
    );
  }

  const selectedUser = users.find(u => u.id === userId);
  
  // Agrupar datos por KPI
  const kpiGroups = userHistory.reduce((acc, record) => {
    if (!acc[record.kpiId]) {
      acc[record.kpiId] = {
        kpiId: record.kpiId,
        kpiName: record.kpiName,
        kpiTarget: record.kpiTarget,
        kpiUnit: record.kpiUnit,
        companyName: record.companyName,
        areaName: record.areaName,
        values: []
      };
    }
    acc[record.kpiId].values.push(record);
    return acc;
  }, {} as Record<number, any>);

  const kpiList = Object.values(kpiGroups);
  
  // KPIs principales que se muestran automáticamente
  const primaryKpiNames = [
    'Porcentaje de crecimiento en ventas',
    'Nuevos clientes adquiridos', 
    'Tasa de retención de clientes'
  ];
  
  // Construir lista de KPIs principales garantizando exactamente 3 (o menos si no hay suficientes)
  let primaryKpis: any[] = [];
  
  // Primero intentar encontrar KPIs que coincidan con los nombres principales (máximo 1 de cada)
  primaryKpiNames.forEach(primaryName => {
    if (primaryKpis.length < 3) {
      const match = kpiList.find((kpi: any) => 
        kpi.kpiName.toLowerCase().includes(primaryName.toLowerCase()) &&
        !primaryKpis.some((p: any) => p.kpiId === kpi.kpiId)
      );
      if (match) {
        primaryKpis.push(match);
      }
    }
  });
  
  // Si tenemos menos de 3, rellenar con otros KPIs disponibles
  if (primaryKpis.length < 3) {
    const remainingKpis = kpiList.filter((kpi: any) => 
      !primaryKpis.some((p: any) => p.kpiId === kpi.kpiId)
    );
    const needed = 3 - primaryKpis.length;
    primaryKpis = [...primaryKpis, ...remainingKpis.slice(0, needed)];
  }
  
  const secondaryKpis = kpiList.filter((kpi: any) => 
    !primaryKpis.some((pKpi: any) => pKpi.kpiId === kpi.kpiId)
  );
  
  // KPIs a mostrar según el estado
  const displayKpis = showAllKpis ? kpiList : primaryKpis;

  // Calcular métricas de resumen
  const totalKpis = kpiList.length;
  const totalRecords = userHistory.length;
  const compliantRecords = userHistory.filter(r => r.status === 'complies').length;
  const avgCompliance = totalRecords > 0 
    ? (compliantRecords / totalRecords * 100).toFixed(1)
    : '0';

  // Mejor y peor KPI (basado en último valor de compliance)
  const kpisWithLatestCompliance = kpiList.map((kpi: any) => {
    // Ordenar valores por fecha ascendente y tomar el último (más reciente)
    const sortedValues = [...kpi.values].sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const latestValue = sortedValues[sortedValues.length - 1];
    return {
      name: kpi.kpiName,
      compliance: latestValue.compliancePercentage ? parseFloat(latestValue.compliancePercentage) : 0,
      status: latestValue.status
    };
  }).filter((k: any) => k.compliance > 0);

  const bestKpi = kpisWithLatestCompliance.length > 0
    ? kpisWithLatestCompliance.reduce((max, kpi) => kpi.compliance > max.compliance ? kpi : max)
    : null;

  const worstKpi = kpisWithLatestCompliance.length > 0
    ? kpisWithLatestCompliance.reduce((min, kpi) => kpi.compliance < min.compliance ? kpi : min)
    : null;

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Target className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold">{totalKpis}</div>
              <div className="text-sm text-gray-600">KPIs Asignados</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold">{avgCompliance}%</div>
              <div className="text-sm text-gray-600">Cumplimiento Promedio</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Award className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
              <div className="text-sm font-semibold truncate" title={bestKpi?.name}>
                {bestKpi ? bestKpi.name : 'N/A'}
              </div>
              <div className="text-xs text-gray-600">Mejor KPI</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-red-600 mb-2" />
              <div className="text-sm font-semibold truncate" title={worstKpi?.name}>
                {worstKpi ? worstKpi.name : 'N/A'}
              </div>
              <div className="text-xs text-gray-600">Área de Mejora</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas de evolución por KPI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Evolución Temporal por KPI - {selectedUser?.name}
            </div>
            {secondaryKpis.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAllKpis(!showAllKpis)}
                className="gap-2"
                data-testid="button-toggle-all-kpis"
              >
                {showAllKpis ? (
                  <>
                    <Minus className="h-4 w-4" />
                    Ver menos
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    Ver más ({secondaryKpis.length} KPIs adicionales)
                  </>
                )}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {displayKpis.map((kpi) => {
            // Ordenar por fecha ascendente para gráficas correctas
            const sortedValues = [...kpi.values].sort((a: any, b: any) => 
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            
            const chartData = sortedValues.map((v: any) => ({
              period: v.period,
              value: parseFloat(v.value) || 0,
              compliance: parseFloat(v.compliancePercentage) || 0,
            }));

            // Si el KPI tiene 2 o menos puntos de datos, mostrar como número simple
            const hasLimitedData = sortedValues.length <= 2;
            const latestValue = sortedValues[sortedValues.length - 1];

            return (
              <div key={kpi.kpiId} className="border-t pt-4 first:border-t-0 first:pt-0">
                <div className="mb-4">
                  <h4 className="font-semibold text-lg">{kpi.kpiName}</h4>
                  <div className="text-sm text-gray-600">
                    {kpi.companyName} • {kpi.areaName} • Meta: {kpi.kpiTarget}
                  </div>
                </div>
                
                {hasLimitedData ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                    <div className="text-center space-y-4">
                      <div>
                        <div className="text-4xl font-bold text-blue-600">
                          {latestValue?.value || 'N/A'} {kpi.kpiUnit}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {latestValue?.period || 'Sin datos'}
                        </div>
                      </div>
                      {latestValue?.compliancePercentage && (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-sm text-gray-600">Cumplimiento:</span>
                          <Badge className={
                            latestValue.status === 'complies' ? 'bg-green-500' :
                            latestValue.status === 'alert' ? 'bg-yellow-500' : 'bg-red-500'
                          }>
                            {latestValue.compliancePercentage}%
                          </Badge>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        Datos insuficientes para mostrar gráfica ({sortedValues.length} registro{sortedValues.length !== 1 ? 's' : ''})
                      </div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        name={`Valor (${kpi.kpiUnit})`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="compliance" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Cumplimiento (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Historial detallado con collapsibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Historial Detallado por KPI
          </CardTitle>
          <CardDescription>
            Expande cada KPI para ver su historial completo de valores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {kpiList.map((kpi: any) => {
              const sortedValues = [...kpi.values].sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
              );
              const latestValue = sortedValues[0];
              
              return (
                <Collapsible key={kpi.kpiId} className="border rounded-lg">
                  <CollapsibleTrigger className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{kpi.kpiName}</div>
                        <div className="text-sm text-gray-500">
                          {kpi.companyName} • {kpi.areaName}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-mono">
                            {latestValue?.value} {kpi.kpiUnit}
                          </div>
                          <div className="text-xs text-gray-500">{latestValue?.period}</div>
                        </div>
                        {latestValue?.status && (
                          <Badge className={
                            latestValue.status === 'complies' ? 'bg-green-500' :
                            latestValue.status === 'alert' ? 'bg-yellow-500' : 'bg-red-500'
                          }>
                            {latestValue.status === 'complies' ? 'Cumple' : 
                             latestValue.status === 'alert' ? 'Alerta' : 'No Cumple'}
                          </Badge>
                        )}
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-gray-50 dark:bg-gray-900">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-700 text-white">
                            <tr className="text-xs">
                              <th className="text-left p-2">Período</th>
                              <th className="text-right p-2">Valor</th>
                              <th className="text-right p-2">Meta</th>
                              <th className="text-right p-2">Cumplimiento</th>
                              <th className="text-center p-2">Estado</th>
                              <th className="text-center p-2">Tendencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedValues.map((record: any, index: number) => {
                              const prevRecord = sortedValues[index - 1];
                              const trend = prevRecord 
                                ? parseFloat(record.value) - parseFloat(prevRecord.value)
                                : 0;
                              
                              return (
                                <tr key={record.valueId} className="border-b text-sm hover:bg-white dark:hover:bg-gray-800">
                                  <td className="p-2">{record.period}</td>
                                  <td className="p-2 text-right font-mono">
                                    {record.value} {record.kpiUnit}
                                  </td>
                                  <td className="p-2 text-right text-gray-600">
                                    {record.kpiTarget}
                                  </td>
                                  <td className="p-2 text-right font-semibold">
                                    {record.compliancePercentage ? `${record.compliancePercentage}%` : 'N/A'}
                                  </td>
                                  <td className="p-2 text-center">
                                    {record.status === 'complies' && (
                                      <Badge className="bg-green-500 text-xs">Cumple</Badge>
                                    )}
                                    {record.status === 'alert' && (
                                      <Badge className="bg-yellow-500 text-xs">Alerta</Badge>
                                    )}
                                    {record.status === 'not_compliant' && (
                                      <Badge className="bg-red-500 text-xs">No Cumple</Badge>
                                    )}
                                    {!record.status && <span className="text-gray-400 text-xs">N/A</span>}
                                  </td>
                                  <td className="p-2 text-center">
                                    {trend > 0 ? (
                                      <ArrowUp className="h-4 w-4 text-green-600 inline" />
                                    ) : trend < 0 ? (
                                      <ArrowDown className="h-4 w-4 text-red-600 inline" />
                                    ) : (
                                      <Minus className="h-4 w-4 text-gray-400 inline" />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function KpiControlCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin, isMarioOrAdmin } = useAuth();
  const [location] = useLocation();
  
  // Estados para KPIs - 🔧 FORZAR Grupo Orsega por defecto
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(2);
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all'); // Nuevo filtro por responsable
  const [companyFilter, setCompanyFilter] = useState<string>('all'); // Nuevo filtro por empresa
  const [viewType, setViewType] = useState<'dashboard' | 'kpis'>('dashboard'); // Toggle entre Dashboard y vista por KPI
  
  // Estados para vistas históricas (nueva funcionalidad)
  const [selectedUserIdForHistory, setSelectedUserIdForHistory] = useState<number | null>(null);
  const [historicalMonths, setHistoricalMonths] = useState<number>(12); // Meses a mostrar por defecto
  
  // Estados para Vista General mejorada
  const [showAllKpis, setShowAllKpis] = useState(false);
  const [showAllCharts, setShowAllCharts] = useState(false);

  // Estado para panel de administración de KPIs
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  


  // Obtener empresas
  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    staleTime: 5 * 60 * 1000, // Los datos son válidos por 5 minutos
  });

  // Obtener áreas
  const { data: areas } = useQuery<Area[]>({
    queryKey: ['/api/areas'],
    staleTime: 5 * 60 * 1000, // Los datos son válidos por 5 minutos
  });

  // Obtener todos los KPIs (con actualización optimizada)
  const { data: kpis = [], isLoading: kpisLoading } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId: selectedCompanyId || null }],
    staleTime: 2 * 60 * 1000, // Los datos son válidos por 2 minutos
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Obtener valores de KPIs (con actualización balanceada)
  const { data: kpiValues = [], isSuccess: kpiValuesSuccess } = useQuery<KpiValue[]>({
    queryKey: ['/api/kpi-values', { companyId: selectedCompanyId || null }],
    staleTime: 1 * 60 * 1000, // Los datos son válidos por 1 minuto
    refetchInterval: 15000, // Actualizar cada 15 segundos (más crítico)
  });

  // Obtener rendimiento de colaboradores
  interface CollaboratorsResponse {
    collaborators: CollaboratorScore[];
    teamAverage: number;
    teamTrend: number | null;
    teamTrendDirection: 'up' | 'down' | 'stable' | null;
    teamTrendPeriod: string | null;
  }

  const { data: collaboratorsData, isLoading: collaboratorsLoading, error: collaboratorsError } = useQuery<CollaboratorsResponse>({
    queryKey: ['/api/collaborators-performance', { companyId: selectedCompanyId || null }],
    staleTime: 2 * 60 * 1000, // Los datos son válidos por 2 minutos
    refetchInterval: 30000, // Actualizar cada 30 segundos
    enabled: !!user,
    retry: 1, // Solo 1 reintento
    retryDelay: 1000,
    refetchOnWindowFocus: false, // No refetch al cambiar de ventana
  });

  const collaborators = collaboratorsData?.collaborators || [];
  const teamMetrics = collaboratorsData ? {
    average: collaboratorsData.teamAverage,
    trend: collaboratorsData.teamTrend,
    trendDirection: collaboratorsData.teamTrendDirection,
    trendPeriod: collaboratorsData.teamTrendPeriod
  } : null;


  // Queries adicionales para Gestión del Equipo y Vista Histórica
  // Cargar usuarios siempre para que estén disponibles en la vista histórica
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    staleTime: 10 * 60 * 1000, // Los datos son válidos por 10 minutos
    enabled: !!user, // Disponible para todos los usuarios logueados
  });

  // Inicializar empresa: admin ve todas, el resto Grupo Orsega por defecto
  useEffect(() => {
    if (!companies || companies.length === 0) return;

    // Admin: iniciar viendo todas las empresas
    if (isAdmin) {
      setSelectedCompanyId(null);
      localStorage.removeItem('selectedCompanyId');
      return;
    }

    // Resto de usuarios: forzar Grupo Orsega (ID=2)
    localStorage.removeItem('selectedCompanyId');
    const orsega = companies.find((c: Company) => c.id === 2);
    if (orsega) {
      setSelectedCompanyId(2);
      localStorage.setItem('selectedCompanyId', '2');
    } else {
      setSelectedCompanyId(companies[0]?.id || 1);
    }
  }, [companies, isAdmin]);

  // Guardar empresa seleccionada
  const handleCompanyChange = (companyId: string) => {
    if (companyId === 'all') {
      setSelectedCompanyId(null);
      localStorage.removeItem('selectedCompanyId');
    } else {
      const id = parseInt(companyId);
      setSelectedCompanyId(id);
      localStorage.setItem('selectedCompanyId', id.toString());
    }
  };

  // Obtener área del usuario
  const userArea = useMemo(() => {
    if (!user?.areaId || !areas) return null;
    return areas.find((area: Area) => area.id === user.areaId);
  }, [user, areas]);

  // Obtener empresa seleccionada
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId || !companies) return null;
    return companies.find((company: Company) => company.id === selectedCompanyId);
  }, [selectedCompanyId, companies]);

  // Procesar KPIs con sus valores más recientes
  const processedKpis = useMemo(() => {
    if (!kpis || !kpiValues || !areas) return [];

    // Los KPIs ya vienen filtrados por companyId desde el backend, solo mapearlos
    return kpis.map((kpi: any) => {
      // La estructura nueva tiene kpiName en lugar de name
      const kpiId = kpi.id;
      const kpiName = kpi.kpiName || kpi.name;
      
      // Encontrar valores para este KPI
      const values = kpiValues.filter((value: KpiValue) => value.kpiId === kpiId);
      
      if (!values || values.length === 0) {
        return {
          ...kpi,
          value: null,
          status: 'not_compliant' as const,
          visualStatus: 'critical' as const,
          compliancePercentage: 0,
          date: null,
          comments: 'No hay valores registrados',
          historicalData: []
        };
      }

      // Obtener el valor más reciente
      const latestValue = values.sort((a: KpiValue, b: KpiValue) => 
        new Date(b.date!).getTime() - new Date(a.date!).getTime()
      )[0];

      // Los datos históricos completos se cargarán desde el endpoint cuando se expanda la tarjeta
      // Por ahora, usar los valores disponibles de kpiValues para el mini gráfico
      const historicalData = values
        .sort((a: KpiValue, b: KpiValue) => 
          new Date(a.date!).getTime() - new Date(b.date!).getTime()
        )
        .map((v: KpiValue) => ({
          value: parseFloat(v.value?.toString() || '0'),
          recordedAt: v.date || new Date().toISOString(),
          period: v.period || ''
        }));

      // Calcular área del KPI (nueva estructura usa 'area' como string)
      const areaName = kpi.area || 'Sin área';

      // Convertir compliancePercentage a número
      const complianceNum = parseFloat(latestValue.compliancePercentage?.toString().replace('%', '') || '0');

      // Determinar status visual basado en los umbrales centralizados (kpi-utils.ts)
      // >= 100% = excellent, >= 95% = good, >= 90% = warning, < 90% = critical
      let visualStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
      if (complianceNum >= 100) visualStatus = 'excellent';
      else if (complianceNum >= 95) visualStatus = 'good';
      else if (complianceNum >= 90) visualStatus = 'warning';
      else visualStatus = 'critical';

      return {
        ...kpi,
        id: kpiId,
        name: kpiName,
        value: parseFloat(latestValue.value?.toString() || '0'),
        status: latestValue.status as 'complies' | 'alert' | 'not_compliant',
        visualStatus,
        compliancePercentage: complianceNum,
        date: latestValue.date,
        comments: latestValue.comments || undefined,
        period: latestValue.period,
        historicalData,
        areaName: areaName,
        responsible: kpi.responsible,
        company: kpi.company || (selectedCompanyId === 2 ? 'Orsega' : selectedCompanyId === 1 ? 'Dura' : undefined)
      };
    });
  }, [kpis, kpiValues, areas, selectedCompanyId]);

  // Extraer responsables únicos de los KPIs
  const uniqueResponsibles = useMemo(() => {
    if (!processedKpis) return [];
    const responsibles = processedKpis
      .map((kpi: any) => kpi.responsible)
      .filter((r: string | undefined): r is string => !!r && r.trim() !== '');
    return Array.from(new Set(responsibles)).sort();
  }, [processedKpis]);

  // Extraer empresas únicas de los KPIs
  const uniqueCompanies = useMemo(() => {
    if (!processedKpis) return [];
    const companiesList = processedKpis
      .map((kpi: any) => kpi.company)
      .filter((c: string | undefined): c is string => !!c && c.trim() !== '');
    return Array.from(new Set(companiesList)).sort();
  }, [processedKpis]);

  // Filtrar KPIs por estado, responsable y empresa
  const filteredKpis = useMemo(() => {
    let filtered = processedKpis;

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter((kpi: any) => kpi.status === statusFilter);
    }

    // Filtro por responsable
    if (responsibleFilter !== 'all') {
      filtered = filtered.filter((kpi: any) => kpi.responsible === responsibleFilter);
    }

    // Filtro por empresa
    if (companyFilter !== 'all') {
      filtered = filtered.filter((kpi: any) => kpi.company === companyFilter);
    }

    return filtered;
  }, [processedKpis, statusFilter, responsibleFilter, companyFilter]);

  // Estadísticas de KPIs
  const kpiStats = useMemo(() => {
    const stats = {
      total: processedKpis.length,
      complies: 0,
      alert: 0,
      not_compliant: 0
    };

    processedKpis.forEach((kpi: any) => {
      if (kpi.status === 'complies') stats.complies++;
      else if (kpi.status === 'alert') stats.alert++;
      else if (kpi.status === 'not_compliant') stats.not_compliant++;
    });

    return stats;
  }, [processedKpis]);

  // Calculate top performers from available data
  const topPerformers = useMemo(() => {
    if (!areas || !filteredKpis || areas.length === 0 || filteredKpis.length === 0) return [];
    
    // Calculate performance by area
    const areaPerformance = areas.map(area => {
      const areaKpis = filteredKpis.filter(kpi => kpi.areaId === area.id);
      const compliantKpis = areaKpis.filter(kpi => kpi.status === 'complies').length;
      const totalKpis = areaKpis.length;
      const compliancePercentage = totalKpis > 0 ? Math.round((compliantKpis / totalKpis) * 100) : 0;
      
      return {
        area_id: area.id,
        area_name: area.name,
        compliant_kpis: compliantKpis,
        total_kpis: totalKpis,
        compliance_percentage: compliancePercentage
      };
    }).filter(area => area.total_kpis > 0) // Solo áreas con KPIs
      .sort((a, b) => b.compliance_percentage - a.compliance_percentage); // Ordenar por mayor compliance
    
    return areaPerformance;
  }, [areas, filteredKpis]);
  
  const loadingTopPerformers = false; // Ya no es una query externa

  // KPIs ordenados por fecha de actualización para Vista General (después de aplicar filtros)
  const sortedKpis = useMemo(() => {
    if (!filteredKpis) return [];
    return [...filteredKpis].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Más recientes primero
    });
  }, [filteredKpis]);

  // KPIs a mostrar en Vista General (limitados o todos)
  const displayedKpis = useMemo(() => {
    const limit = 6; // Mostrar solo 6 KPIs inicialmente
    return showAllKpis ? sortedKpis : sortedKpis.slice(0, limit);
  }, [sortedKpis, showAllKpis]);

  // Datos para gráfica de rendimiento en Vista General
  const performanceData = useMemo(() => {
    if (!processedKpis) return [];
    const excellent = processedKpis.filter((k: any) => parseFloat(k.compliancePercentage || '0') >= 90).length;
    const good = processedKpis.filter((k: any) => {
      const comp = parseFloat(k.compliancePercentage || '0');
      return comp >= 70 && comp < 90;
    }).length;
    const needsImprovement = processedKpis.filter((k: any) => parseFloat(k.compliancePercentage || '0') < 70).length;

    return [
      { name: 'Excelente (90%+)', value: excellent, color: '#10b981' },
      { name: 'Bueno (70-89%)', value: good, color: '#f59e0b' },
      { name: 'Mejorar (<70%)', value: needsImprovement, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [processedKpis]);

  // Función para obtener color del estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complies': return 'bg-green-100 text-green-800 border-green-200';
      case 'alert': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'not_compliant': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Función para obtener texto del estado
  const getStatusText = (status: string) => {
    switch (status) {
      case 'complies': return 'Cumple';
      case 'alert': return 'Alerta';
      case 'not_compliant': return 'No Cumple';
      default: return 'Sin Estado';
    }
  };

  // Función para obtener ícono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complies': return <CheckCircle className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'not_compliant': return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const handleUpdateKpi = (kpiId: number) => {
    setSelectedKpiId(kpiId);
    setIsUpdateModalOpen(true);
  };



  if (companiesLoading || kpisLoading) {
    return (
      <AppLayout title="Centro de Control">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando centro de control...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Centro de Control KPIs">
      <div className="space-y-8">
        {/* Vista General de KPIs */}
          <div className="space-y-6">
            {/* KPIs Recientes Agrupados - Nueva implementación mejorada */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      📊 KPIs Actualizados Recientemente
                      <Badge variant="outline" className="ml-2">
                        {viewType === 'dashboard'
                          ? `${collaborators?.length || 0} colaboradores`
                          : `${displayedKpis.length} de ${sortedKpis.length} KPIs`
                        }
                      </Badge>
                    </CardTitle>
                    {/* Toggle entre vistas */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={viewType === 'dashboard' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewType('dashboard')}
                        className="flex items-center gap-2"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                      </Button>
                      <Button
                        variant={viewType === 'kpis' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewType('kpis')}
                        className="flex items-center gap-2"
                      >
                        <Target className="h-4 w-4" />
                        Tarjetas KPI
                      </Button>
                      {isMarioOrAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAdminPanel(true)}
                          className="flex items-center gap-2 ml-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          <Settings className="h-4 w-4" />
                          Administrar KPIs
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Filtros - Visibles en todas las vistas */}
                  <div className="flex flex-wrap items-center gap-3 pb-2 border-b">
                    <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">👤 Todos los colaboradores</SelectItem>
                        {uniqueResponsibles.map((responsible) => (
                          <SelectItem key={responsible} value={responsible}>
                            {responsible}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los Estados</SelectItem>
                        <SelectItem value="complies">✅ Cumpliendo</SelectItem>
                        <SelectItem value="alert">⚠️ En Alerta</SelectItem>
                        <SelectItem value="not_compliant">❌ No Cumpliendo</SelectItem>
                      </SelectContent>
                    </Select>
                    {(responsibleFilter !== 'all' || statusFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResponsibleFilter('all');
                          setStatusFilter('all');
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Filter className="h-4 w-4 mr-1" />
                        Limpiar
                      </Button>
                    )}
                    {responsibleFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Filtrando: {responsibleFilter}
                      </Badge>
                    )}
                  </div>

                  {/* Selector de Empresa movido aquí */}
                  <div className="flex items-center gap-4 pb-2 border-b">
                    <Building className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <Select value={selectedCompanyId?.toString() || 'all'} onValueChange={handleCompanyChange}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {isAdmin && (
                          <SelectItem value="all">Todas las empresas</SelectItem>
                        )}
                        {companies?.map((company: Company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCompany ? (
                      <span className="text-sm text-gray-600">
                        Monitoreando: <span className="font-semibold text-blue-600">{selectedCompany.name}</span>
                      </span>
                    ) : isAdmin && !selectedCompanyId && (
                      <span className="text-sm text-gray-600">
                        Monitoreando: <span className="font-semibold text-purple-600">Todas las empresas</span>
                      </span>
                    )}
                  </div>
                  
                  {/* Botón Ver más para vista "Tarjetas KPI" */}
                  {viewType === 'kpis' && sortedKpis.length > 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllKpis(!showAllKpis)}
                      className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {showAllKpis ? 'Ver menos' : `Ver todos (${sortedKpis.length})`}
                      <Activity className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Vista Tremor Dashboard */}
                {viewType === 'dashboard' && (
                  <>
                    {collaboratorsLoading && (
                      <div className="text-center py-8">
                        <Activity className="h-8 w-8 mx-auto mb-4 text-gray-300 animate-spin" />
                        <p className="text-gray-500">Cargando dashboard...</p>
                      </div>
                    )}
                    {!collaboratorsLoading && collaborators && (
                      <TremorKpiDashboard
                        collaborators={collaborators.map((c): TremorCollaboratorData => ({
                          name: c.name,
                          score: c.score,
                          status: c.status,
                          averageCompliance: c.averageCompliance,
                          compliantKpis: c.compliantKpis,
                          alertKpis: c.alertKpis,
                          notCompliantKpis: c.notCompliantKpis,
                          totalKpis: c.totalKpis,
                          lastUpdate: c.lastUpdate,
                          scoreChange: c.scoreChange,
                          trendDirection: c.trendDirection,
                          kpis: c.kpis.map(k => ({
                            id: k.id,
                            name: k.name || (k as any).kpiName || 'KPI',
                            compliance: k.compliance,
                            complianceChange: k.complianceChange,
                            trendDirection: k.trendDirection,
                            status: k.status,
                            target: (k as any).target,
                            unit: (k as any).unit,
                            latestValue: (k as any).latestValue,
                          })),
                        }))}
                        metrics={{
                          totalKpis: kpiStats.total,
                          compliantKpis: kpiStats.complies,
                          alertKpis: kpiStats.alert,
                          criticalKpis: kpiStats.not_compliant,
                          averageCompliance: processedKpis.length > 0
                            ? processedKpis.reduce((sum: number, k: any) => sum + (k.compliancePercentage || 0), 0) / processedKpis.length
                            : 0,
                          previousAverageCompliance: teamMetrics?.trend ? teamMetrics.average - teamMetrics.trend : undefined,
                        }}
                        onViewKpiDetails={handleUpdateKpi}
                        onUpdateKpi={handleUpdateKpi}
                        title={`KPIs ${selectedCompany?.name || ''}`}
                        subtitle={`Monitoreo de indicadores - ${responsibleFilter === 'all' ? `${collaborators.length} colaboradores` : responsibleFilter}`}
                        selectedCollaborator={responsibleFilter}
                        statusFilter={statusFilter}
                      />
                    )}
                  </>
                )}

                {/* Vista Tarjetas KPI */}
                {viewType === 'kpis' && (
                  <>
                    {kpisLoading && (
                      <div className="text-center py-8">
                        <Activity className="h-8 w-8 mx-auto mb-4 text-gray-300 animate-spin" />
                        <p className="text-gray-500">Cargando KPIs...</p>
                      </div>
                    )}
                    {!kpisLoading && displayedKpis.length === 0 && (
                      <div className="text-center py-8">
                        <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No hay KPIs para mostrar</p>
                        <p className="text-sm text-gray-400 mt-2">
                          {processedKpis.length === 0 
                            ? 'No se encontraron KPIs para esta empresa'
                            : 'No hay KPIs que coincidan con los filtros seleccionados'}
                        </p>
                      </div>
                    )}
                    {!kpisLoading && displayedKpis.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayedKpis.map((kpi: any, index: number) => (
                          <EnhancedKpiCard
                            key={kpi.id}
                            kpi={{
                              id: kpi.id,
                              name: kpi.name,
                              value: kpi.value,
                              target: kpi.target,
                              unit: kpi.unit,
                              compliancePercentage: kpi.compliancePercentage,
                              status: kpi.visualStatus || 'warning',
                              areaName: kpi.areaName,
                              responsible: kpi.responsible,
                              historicalData: kpi.historicalData,
                              company: kpi.company || (selectedCompanyId === 2 ? 'Orsega' : selectedCompanyId === 1 ? 'Dura' : undefined)
                            }}
                            onClick={() => handleUpdateKpi(kpi.id)}
                            delay={index * 0.05}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
                
              </CardContent>
            </Card>


                  </div>



        {/* Panel de Administración de KPIs (solo gerente/admin) */}
        {showAdminPanel && isMarioOrAdmin && (
          <KpiAdminPanel
            companyId={selectedCompanyId || 2}
            onClose={() => setShowAdminPanel(false)}
          />
        )}

        {/* Modal de Actualización KPI */}
        <TremorKpiUpdateModal
          kpiId={selectedKpiId || 0}
          isOpen={isUpdateModalOpen}
          onClose={() => {
            setIsUpdateModalOpen(false);
            setSelectedKpiId(null);
          }}
        />



      </div>
    </AppLayout>
  );
}

