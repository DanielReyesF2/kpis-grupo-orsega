import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import type { Company, Area, Kpi, KpiValue, User as UserType } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { KpiUpdateModal } from '@/components/kpis/KpiUpdateModal';
import { KpiExtendedDetailsModal } from '@/components/kpis/KpiExtendedDetailsModal';
import { EnhancedKpiDashboard } from '@/components/kpis/EnhancedKpiDashboard';
import { EnhancedKpiCard } from '@/components/kpis/EnhancedKpiCard';
import SalesWeeklyUpdateForm from '@/components/kpis/SalesWeeklyUpdateForm';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation } from 'wouter';
import { 
  TrendingUp, 
  Building, 
  Target, 
  Calendar,
  User,
  MapPin,
  Filter,
  Edit3,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  Settings,
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
  Crown,
  Star,
  Eye,
  ChevronUp,
  FolderTree,
  Search
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
                          <thead className="bg-gray-100 dark:bg-gray-800">
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
  const { user, isMarioOrAdmin } = useAuth();
  const [location] = useLocation();
  
  // Estados para KPIs - 🔧 FORZAR Grupo Orsega por defecto
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(2);
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isExtendedDetailsModalOpen, setIsExtendedDetailsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all'); // Nuevo filtro por responsable
  const [companyFilter, setCompanyFilter] = useState<string>('all'); // Nuevo filtro por empresa
  const [viewMode, setViewMode] = useState<'overview' | 'team'>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Detectar si viene de la ruta de team-management
  useEffect(() => {
    if (location === '/team-management' && isMarioOrAdmin) {
      setViewMode('team');
    }
  }, [location, isMarioOrAdmin]);
  
  // Estados para vistas históricas (nueva funcionalidad)
  const [selectedUserIdForHistory, setSelectedUserIdForHistory] = useState<number | null>(null);
  const [historicalMonths, setHistoricalMonths] = useState<number>(12); // Meses a mostrar por defecto
  
  // Estados para Vista General mejorada
  const [showAllKpis, setShowAllKpis] = useState(false);
  const [showAllCharts, setShowAllCharts] = useState(false);
  
  // Estados para gestión de equipo
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [teamCompanyFilter, setTeamCompanyFilter] = useState('all');
  const [teamPerformanceFilter, setTeamPerformanceFilter] = useState('all');
  const [selectedTeamUser, setSelectedTeamUser] = useState<any>(null);
  
  // Estados para edición de KPIs desde modal de usuario
  const [showEditKpiDialog, setShowEditKpiDialog] = useState(false);
  const [editingUserKpi, setEditingUserKpi] = useState<Kpi | null>(null);
  
  // Estados para Gestión del Equipo
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showKpiDialog, setShowKpiDialog] = useState(false);
  const [showUserKpisDialog, setShowUserKpisDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingKpi, setEditingKpi] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');


  // Obtener empresas
  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    staleTime: 5 * 60 * 1000, // Los datos son válidos por 5 minutos
    enabled: !!user,
  });

  // Obtener áreas
  const { data: areas } = useQuery<Area[]>({
    queryKey: ['/api/areas'],
    staleTime: 5 * 60 * 1000, // Los datos son válidos por 5 minutos
    enabled: !!user,
  });

  // Obtener todos los KPIs (con actualización optimizada)
  const { data: kpis, isLoading: kpisLoading } = useQuery<any[]>({
    queryKey: ['/api/kpis', { companyId: selectedCompanyId || null }],
    staleTime: 2 * 60 * 1000, // Los datos son válidos por 2 minutos
    refetchInterval: 30000, // Actualizar cada 30 segundos
    enabled: !!user,
  });

  // Obtener valores de KPIs (con actualización balanceada)
  const { data: kpiValues, isSuccess: kpiValuesSuccess } = useQuery<KpiValue[]>({
    queryKey: ['/api/kpi-values'],
    staleTime: 1 * 60 * 1000, // Los datos son válidos por 1 minuto
    refetchInterval: 15000, // Actualizar cada 15 segundos (más crítico)
    enabled: !!user,
  });

  // Actualizar timestamp cuando hay nuevos datos
  useEffect(() => {
    if (kpiValuesSuccess) {
      setLastUpdated(new Date());
    }
  }, [kpiValuesSuccess]);

  // Queries adicionales para Gestión del Equipo y Vista Histórica
  // Cargar usuarios siempre para que estén disponibles en la vista histórica
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    staleTime: 10 * 60 * 1000, // Los datos son válidos por 10 minutos
    enabled: !!user, // Disponible para todos los usuarios logueados
  });

  // 🔧 SIMPLIFIED: Siempre mostrar datos, empresa es solo visual
  useEffect(() => {
    console.log('🚨 DEBUG useEffect ejecutándose, companies:', companies?.length);
    if (!companies || companies.length === 0) {
      console.log('🚨 No hay companies, saliendo...');
      return;
    }
    
    console.log('🚨 Companies encontradas:', companies.map(c => `${c.id}:${c.name}`));
    
    // Limpiar localStorage anterior y forzar Grupo Orsega (ID=2) 
    localStorage.removeItem('selectedCompanyId');
    const orsega = companies.find((c: Company) => c.id === 2);
    if (orsega) {
      console.log('✅ ENCONTRÉ Grupo Orsega:', orsega.name);
      setSelectedCompanyId(2);
      localStorage.setItem('selectedCompanyId', '2');
    } else {
      console.log('🚨 No se encontró Grupo Orsega, usando:', companies[0]?.name);
      setSelectedCompanyId(companies[0]?.id || 1);
    }
  }, [companies]);

  // Guardar empresa seleccionada
  const handleCompanyChange = (companyId: string) => {
    const id = parseInt(companyId);
    setSelectedCompanyId(id);
    localStorage.setItem('selectedCompanyId', id.toString());
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
          value: 'Sin datos',
          status: 'not_compliant' as const,
          compliancePercentage: '0%',
          date: null,
          comments: 'No hay valores registrados'
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

      // Determinar status visual mejorado
      let visualStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'warning';
      if (complianceNum >= 90) visualStatus = 'excellent';
      else if (complianceNum >= 70) visualStatus = 'good';
      else if (complianceNum >= 50) visualStatus = 'warning';
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

  const handleViewExtendedDetails = (kpiId: number) => {
    setSelectedKpiId(kpiId);
    setIsExtendedDetailsModalOpen(true);
  };

  // Mutaciones para edición de KPIs
  const updateKpiMutation = useMutation({
    mutationFn: ({ id, ...kpiData }: { id: number } & Partial<Kpi>) => 
      apiRequest('PUT', `/api/kpis/${id}`, kpiData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
      setShowEditKpiDialog(false);
      setEditingUserKpi(null);
      toast({ title: 'KPI actualizado exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al actualizar KPI', description: error.message, variant: 'destructive' });
    },
  });

  // Mutaciones para Gestión del Equipo
  const createUserMutation = useMutation({
    mutationFn: (userData: Partial<UserType>) => apiRequest('POST', '/api/users', userData),
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
    mutationFn: ({ id, ...userData }: { id: number } & Partial<UserType>) => apiRequest('PUT', `/api/users/${id}`, userData),
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

  const sendMessageMutation = useMutation({
    mutationFn: (messageData: { title: string; message: string; type: string; priority: string; toUserId: number; fromUserId: number }) => apiRequest('POST', '/api/notifications', messageData),
    onSuccess: () => {
      setShowMessageDialog(false);
      setSelectedUser(null);
      toast({ title: 'Mensaje enviado por email exitosamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error al enviar mensaje', description: error.message, variant: 'destructive' });
    },
  });

  // Funciones de gestión del equipo
  const handleCreateUser = () => {
    setEditingUser(null);
    setShowUserDialog(true);
  };

  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    setShowUserDialog(true);
  };

  const handleDeleteUser = (id: number) => {
    deleteUserMutation.mutate(id);
  };

  const handleViewUserKpis = (user: UserType) => {
    setSelectedUser(user);
    setShowUserKpisDialog(true);
  };

  const handleSendMessage = (user: UserType) => {
    setSelectedUser(user);
    setShowMessageDialog(true);
  };

  // Función para editar KPI
  const handleEditKpi = (kpi: Kpi) => {
    setEditingUserKpi(kpi);
    setShowEditKpiDialog(true);
  };

  // Función para obtener KPIs de un usuario específico
  const getUserKpis = (userId: number) => {
    const foundUser = users.find((u: UserType) => u.id === userId);
    const user = foundUser;
    if (!user || !kpis) return [];
    
    // ✅ ACCESO UNIVERSAL DE LECTURA: Todos los usuarios ven todos los KPIs
    return kpis || [];
  };

  // Función para calcular rendimiento del equipo
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
        completionRate,
        performanceScore,
        daysSinceActivity,
        status,
        compliantKpis
      };
    });
  };

  // Métricas del equipo
  const teamMetrics = useMemo(() => {
    const enhancedUsers = getUserEnhancedPerformance();
    const totalUsers = enhancedUsers.length;
    const activeUsers = enhancedUsers.filter(u => u.daysSinceActivity <= 7).length;
    const avgPerformance = enhancedUsers.length > 0 
      ? enhancedUsers.reduce((sum, u) => sum + u.performanceScore, 0) / enhancedUsers.length 
      : 0;
    const needsAttention = enhancedUsers.filter(u => u.status === 'needs_attention').length;

    return {
      totalUsers,
      activeUsers,
      avgPerformance: Math.round(avgPerformance),
      needsAttention
    };
  }, [users, kpis, kpiValues]);

  // Filtrar usuarios para gestión de equipo
  const filteredTeamUsers = useMemo(() => {
    const enhancedUsers = getUserEnhancedPerformance();
    
    return enhancedUsers.filter((user: any) => {
      const matchesSearch = teamSearchTerm === '' || 
        user.name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(teamSearchTerm.toLowerCase());
      
      const matchesCompany = teamCompanyFilter === 'all' || user.companyId === parseInt(teamCompanyFilter);
      
      const matchesPerformance = teamPerformanceFilter === 'all' || 
        (teamPerformanceFilter === 'excellent' && user.status === 'excellent') ||
        (teamPerformanceFilter === 'good' && user.status === 'good') ||
        (teamPerformanceFilter === 'needs_attention' && user.status === 'needs_attention');
      
      return matchesSearch && matchesCompany && matchesPerformance;
    });
  }, [users, kpis, kpiValues, teamSearchTerm, teamCompanyFilter, teamPerformanceFilter]);

  // Filtrar usuarios por empresa y área
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    return users.filter((user: UserType) => {
      const matchesCompany = selectedCompanyFilter === 'all' || user.companyId === parseInt(selectedCompanyFilter);
      const matchesArea = selectedAreaFilter === 'all' || user.areaId === parseInt(selectedAreaFilter);
      return matchesCompany && matchesArea;
    });
  }, [users, selectedCompanyFilter, selectedAreaFilter]);

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
        {/* Header Dinámico */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                Centro de Control KPIs
              </h1>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {user?.name}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {userArea?.name || 'Sin área'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date().toLocaleDateString('es-MX')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{kpiStats.total}</div>
              <div className="text-blue-100">KPIs Monitoreados</div>
              <div className="text-sm text-blue-200 mt-1">
                Actualizado: {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Selector de Vista */}
        <div className="flex items-center gap-4 bg-white rounded-lg p-1 shadow-sm border">
          <Button
            variant={viewMode === 'overview' ? 'default' : 'ghost'}
            onClick={() => setViewMode('overview')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Vista General
          </Button>
          {isMarioOrAdmin && (
            <Button
              variant={viewMode === 'team' ? 'default' : 'ghost'}
              onClick={() => setViewMode('team')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Gestión del Equipo
            </Button>
          )}
        </div>

        {/* Selector de Empresa */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Building className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <Select value={selectedCompanyId?.toString() || ''} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company: Company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCompany && (
                <span className="text-sm text-gray-600">
                  Monitoreando: <span className="font-semibold text-blue-600">{selectedCompany.name}</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contenido Dinámico según Vista Seleccionada */}
        {viewMode === 'overview' && (
          <div className="space-y-6">
            {/* Actualización de Ventas Mensuales - Formulario prominente */}
            <Card className="relative border-0 shadow-xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/30 overflow-hidden">
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
              
              <CardHeader className="relative pb-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">
                      ✨ Actualizar Ventas Mensuales
                    </CardTitle>
                    <CardDescription className="text-blue-100 mt-1">
                      Selecciona el período (mes y año) y registra las ventas. Los datos se actualizarán automáticamente en el dashboard.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative pt-6 bg-transparent">
                <SalesWeeklyUpdateForm showHeader={false} />
              </CardContent>
            </Card>

            {/* Panel de métricas en tiempo real */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-800">{kpiStats.complies}</div>
                      <div className="text-sm text-green-600">Cumpliendo</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                    <div>
                      <div className="text-2xl font-bold text-yellow-800">{kpiStats.alert}</div>
                      <div className="text-sm text-yellow-600">En Alerta</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <div className="text-2xl font-bold text-red-800">{kpiStats.not_compliant}</div>
                      <div className="text-sm text-red-600">No Cumple</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Target className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-800">{kpiStats.total}</div>
                      <div className="text-sm text-blue-600">Total KPIs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KPIs Recientes Agrupados - Nueva implementación mejorada */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    📊 KPIs Actualizados Recientemente
                    <Badge variant="outline" className="ml-2">
                      {displayedKpis.length} de {sortedKpis.length} {filteredKpis.length < processedKpis.length ? `(${filteredKpis.length} filtrados)` : ''}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-3">
                    {sortedKpis.length > 6 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowAllKpis(!showAllKpis)}
                        className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        {showAllKpis ? 'Ver menos' : 'Ver más'}
                        <Activity className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Filtros */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Todos los responsables" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">👤 Todos los responsables</SelectItem>
                          {uniqueResponsibles.map((responsible) => (
                            <SelectItem key={responsible} value={responsible}>
                              {responsible}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={companyFilter} onValueChange={setCompanyFilter}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Todas las empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas las empresas</SelectItem>
                          {uniqueCompanies.map((company) => (
                            <SelectItem key={company} value={company}>
                              {company}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Todos los estados" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los Estados</SelectItem>
                          <SelectItem value="complies">✅ Solo Cumpliendo</SelectItem>
                          <SelectItem value="alert">⚠️ Solo en Alerta</SelectItem>
                          <SelectItem value="not_compliant">❌ Solo No Cumpliendo</SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Botón para limpiar filtros */}
                      {(responsibleFilter !== 'all' || companyFilter !== 'all' || statusFilter !== 'all') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResponsibleFilter('all');
                            setCompanyFilter('all');
                            setStatusFilter('all');
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Filter className="h-4 w-4 mr-1" />
                          Limpiar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                      onViewDetails={() => handleViewExtendedDetails(kpi.id)}
                      delay={index * 0.05}
                    />
                  ))}
                </div>
                
                {!showAllKpis && sortedKpis.length > 6 && (
                  <div className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <p className="text-sm text-gray-500 mb-2">
                      Se muestran los {displayedKpis.length} KPIs más recientes de {sortedKpis.length} total
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowAllKpis(true)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      Ver todos los {sortedKpis.length} KPIs →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPIs que Requieren Atención - Versión Simplificada */}
            {(() => {
              const criticalKpis = processedKpis
                .filter((kpi: any) => kpi.status === 'alert' || kpi.status === 'not_compliant')
                .sort((a: any, b: any) => parseFloat(a.compliancePercentage || '0') - parseFloat(b.compliancePercentage || '0'))
                .slice(0, 3);
              
              if (criticalKpis.length === 0) return null;
                      
                      return (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      {criticalKpis.length} {criticalKpis.length === 1 ? 'KPI requiere atención' : 'KPIs requieren atención'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {criticalKpis.map((kpi: any) => (
                      <div 
                        key={kpi.id}
                        className="flex items-center justify-between text-sm cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/20 rounded px-2 py-1 transition-colors"
                        onClick={() => handleUpdateKpi(kpi.id)}
                      >
                        <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{kpi.name}</span>
                        <span className={`font-semibold ml-2 ${
                          kpi.status === 'not_compliant' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {kpi.compliancePercentage}%
                        </span>
                          </div>
                    ))}
                          </div>
                        </div>
                      );
            })()}

            {/* Resumen por Área - Versión Compacta */}
                          {(() => {
              if (!areas || areas.length === 0) return null;
              
              const areaStats = areas.map((area: Area) => {
                const areaKpis = processedKpis.filter((kpi: any) => kpi.areaId === area.id);
                const compliant = areaKpis.filter((k: any) => k.status === 'complies').length;
                const total = areaKpis.length;
                const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;
                
                return {
                  areaId: area.id,
                  areaName: area.name,
                  total,
                  compliant,
                  complianceRate,
                  kpis: areaKpis
                };
              }).filter(stat => stat.total > 0).sort((a, b) => b.complianceRate - a.complianceRate).slice(0, 4);
              
              if (areaStats.length === 0) return null;
                            
                            return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {areaStats.map((stat) => (
                    <div key={stat.areaId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 mb-1 truncate">{stat.areaName}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.complianceRate}%</span>
                        <span className="text-xs text-gray-500">{stat.compliant}/{stat.total}</span>
                                  </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                        <div 
                          className={`h-1.5 rounded-full ${
                            stat.complianceRate >= 90 ? 'bg-green-500' :
                            stat.complianceRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${stat.complianceRate}%` }}
                        />
                                  </div>
                                </div>
                  ))}
                </div>
                            );
                          })()}
          </div>
        )}


        {viewMode === 'team' && isMarioOrAdmin && (
          <div className="space-y-6">
            {/* Executive Header */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] p-6 rounded-xl text-white shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Crown className="h-8 w-8 text-yellow-400" />
                <div>
                  <h1 className="text-2xl font-bold">Panel de Control Ejecutivo</h1>
                  <p className="text-white/80">Administra usuarios, roles y permisos del sistema</p>
                </div>
              </div>

              {/* Key Executive Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-300" />
                    <span className="text-sm">Total Colaboradores</span>
              </div>
                  <p className="text-3xl font-bold mt-2">{teamMetrics.totalUsers}</p>
                  <p className="text-xs text-white/70">Activos en plataforma</p>
                </div>

                <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#0080ff]" />
                    <span className="text-sm">Usuarios Activos</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">{teamMetrics.activeUsers}</p>
                  <p className="text-xs text-white/70">Últimos 7 días</p>
                </div>

                <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#0080ff]" />
                    <span className="text-sm">Rendimiento Promedio</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">{teamMetrics.avgPerformance}%</p>
                  <p className="text-xs text-white/70">Basado en KPIs</p>
                </div>

                <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-300" />
                    <span className="text-sm">Requieren Atención</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">{teamMetrics.needsAttention}</p>
                  <p className="text-xs text-white/70">Bajo rendimiento</p>
                </div>
              </div>
            </div>

            {/* Executive Tabs */}
            <Tabs value="dashboard" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="equipo">Equipo</TabsTrigger>
                <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-6">
                {/* Top Performers y Requieren Atención */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Performers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500" />
                        Top Performers
                      </CardTitle>
                      <CardDescription>Usuarios con mejor rendimiento</CardDescription>
            </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredTeamUsers
                          .filter((user: any) => user.status === 'excellent')
                          .slice(0, 5)
                          .map((user: any) => (
                            <div key={user.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold">
                                  {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-semibold">{user.name}</p>
                                <p className="text-sm text-gray-600">{user.email}</p>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">{user.performanceScore}%</div>
                                <div className="text-xs text-gray-500">{user.daysSinceActivity} días</div>
                              </div>
                            </div>
                          ))}
                        {filteredTeamUsers.filter((user: any) => user.status === 'excellent').length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No hay top performers en este momento</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Requieren Atención */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Requieren Atención
                      </CardTitle>
                      <CardDescription>Usuarios que necesitan supervisión</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredTeamUsers
                          .filter((user: any) => user.status === 'needs_attention')
                          .slice(0, 5)
                          .map((user: any) => (
                            <div key={user.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-gradient-to-br from-[#1e3a5f] to-[#0080ff] text-white font-bold">
                                  {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                <div className="flex-1">
                                <p className="font-semibold">{user.name}</p>
                                <p className="text-sm text-gray-600">{user.email}</p>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-[#0080ff]">{user.performanceScore}%</div>
                                <div className="text-xs text-gray-500">{user.daysSinceActivity} días</div>
                              </div>
                            </div>
                          ))}
                        {filteredTeamUsers.filter((user: any) => user.status === 'needs_attention').length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                            <p>¡Excelente! Todos los usuarios están funcionando bien</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="equipo" className="space-y-6">
                {/* Filtros */}
                <Card>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="search">Buscar</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="search"
                            placeholder="Buscar por nombre o email..."
                            value={teamSearchTerm}
                            onChange={(e) => setTeamSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="company-filter">Empresa</Label>
                        <Select value={teamCompanyFilter} onValueChange={setTeamCompanyFilter}>
                          <SelectTrigger>
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
                </div>
                
                      <div>
                        <Label htmlFor="performance-filter">Rendimiento</Label>
                        <Select value={teamPerformanceFilter} onValueChange={setTeamPerformanceFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los niveles" />
                    </SelectTrigger>
                    <SelectContent>
                            <SelectItem value="all">Todos los niveles</SelectItem>
                            <SelectItem value="excellent">Excelente</SelectItem>
                            <SelectItem value="good">Bueno</SelectItem>
                            <SelectItem value="needs_attention">Requiere atención</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
                  </CardContent>
                </Card>

              {/* Lista de usuarios */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTeamUsers.map((user: any) => {
                    const userCompany = companies?.find((c: any) => c.id === user.companyId);
                    const userArea = areas?.find((a: any) => a.id === user.areaId);
                    
                    return (
                      <Card key={user.id} className="border border-gray-200 hover:border-blue-300 transition-colors">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="h-4 w-4 text-blue-600" />
                              {user.name}
                            </CardTitle>
                            <Badge variant={
                              user.status === 'excellent' ? 'default' : 
                              user.status === 'good' ? 'secondary' : 
                              'destructive'
                            }>
                              {user.status === 'excellent' ? 'Excelente' : 
                               user.status === 'good' ? 'Bueno' : 'Requiere atención'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {userCompany?.name || 'Sin empresa'}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {userArea?.name || 'Sin área'}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Target className="h-3 w-3" />
                              {user.completedKpis} de {user.totalKpis} KPIs completados
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Rendimiento</span>
                              <span className="font-semibold">{user.performanceScore}%</span>
                            </div>
                            <Progress value={user.performanceScore} className="h-2" />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Última actividad</span>
                            <span>{user.daysSinceActivity} días</span>
                          </div>
                          
                          {/* Acciones */}
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedTeamUser(user)}
                              data-testid="button-view-user-details"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditUser(user)}
                              data-testid="button-edit-user"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="rendimiento" className="space-y-6">
                {/* Gráficos de rendimiento */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Distribución de Rendimiento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Excelente</span>
                          </div>
                          <span className="font-semibold">
                            {filteredTeamUsers.filter((u: any) => u.status === 'excellent').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span>Bueno</span>
                          </div>
                          <span className="font-semibold">
                            {filteredTeamUsers.filter((u: any) => u.status === 'good').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span>Requiere Atención</span>
                          </div>
                          <span className="font-semibold">
                            {filteredTeamUsers.filter((u: any) => u.status === 'needs_attention').length}
                          </span>
                        </div>
                      </div>
            </CardContent>
          </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Actividad Reciente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span>Usuarios activos (7 días)</span>
                          <span className="font-semibold">{teamMetrics.activeUsers}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Rendimiento promedio</span>
                          <span className="font-semibold">{teamMetrics.avgPerformance}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total colaboradores</span>
                          <span className="font-semibold">{teamMetrics.totalUsers}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Modal de Actualización KPI */}
        {selectedKpiId && (
          <KpiUpdateModal
            kpiId={selectedKpiId}
            isOpen={isUpdateModalOpen}
            onClose={() => {
              setIsUpdateModalOpen(false);
              setSelectedKpiId(null);
            }}
          />
        )}

        {/* Modal de Detalles Extendidos (12 atributos) */}
        {selectedKpiId && (
          <KpiExtendedDetailsModal
            kpiId={selectedKpiId}
            isOpen={isExtendedDetailsModalOpen}
            onClose={() => {
              setIsExtendedDetailsModalOpen(false);
              setSelectedKpiId(null);
            }}
          />
        )}

        {/* Modal de Usuario (Team Management) */}
        <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </DialogTitle>
            </DialogHeader>
            <UserForm
              user={editingUser}
              companies={companies}
              areas={areas}
              onSubmit={(userData: Partial<UserType>) => {
                if (editingUser) {
                  updateUserMutation.mutate({ id: editingUser.id, ...userData });
                } else {
                  createUserMutation.mutate(userData);
                }
              }}
              onCancel={() => setShowUserDialog(false)}
              isLoading={createUserMutation.isPending || updateUserMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Modal de KPIs del Usuario */}
        <Dialog open={showUserKpisDialog} onOpenChange={setShowUserKpisDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                KPIs de {selectedUser?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedUser && getUserKpis(selectedUser.id).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getUserKpis(selectedUser.id).map((kpi: Kpi) => (
                    <Card key={kpi.id} className="border">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <h3 className="font-medium text-gray-900">{kpi.name}</h3>
                          <p className="text-sm text-gray-600">{kpi.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Empresa:</span>
                              <div>{companies?.find((c: Company) => c.id === kpi.companyId)?.name}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Área:</span>
                              <div>{areas?.find((a: Area) => a.id === kpi.areaId)?.name}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Unidad:</span>
                              <div>{kpi.unit}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Meta:</span>
                              <div>{kpi.target || 'Sin meta'}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Frecuencia:</span>
                              <div>{kpi.frequency}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Responsable:</span>
                              <div>{kpi.responsible}</div>
                            </div>
                          </div>
                          
                          {/* Botón para editar KPI */}
                          {isMarioOrAdmin && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditKpi(kpi)}
                                className="w-full"
                                data-testid="button-edit-kpi"
                              >
                                <Settings className="h-3 w-3 mr-1" />
                                Editar Meta
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay KPIs asignados a este usuario</p>
                  <p className="text-sm">Los KPIs se asignan según la empresa y área del usuario</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Enviar Mensaje */}
        <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Enviar Mensaje por Email
              </DialogTitle>
            </DialogHeader>
            <MessageForm
              user={selectedUser}
              onSubmit={(messageData: { title: string; message: string; type: string; priority: string; fromUserId: number }) => {
                sendMessageMutation.mutate({
                  toUserId: selectedUser.id,
                  ...messageData
                });
              }}
              onCancel={() => {
                setShowMessageDialog(false);
                setSelectedUser(null);
              }}
              isLoading={sendMessageMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Modal de Edición de KPI */}
        <Dialog open={showEditKpiDialog} onOpenChange={setShowEditKpiDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Editar KPI: {editingUserKpi?.name}
              </DialogTitle>
            </DialogHeader>
            
            {editingUserKpi && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const updateData = {
                    id: editingUserKpi.id,
                    name: formData.get('name') as string,
                    description: formData.get('description') as string,
                    target: formData.get('target') as string,
                    unit: formData.get('unit') as string,
                    frequency: formData.get('frequency') as string,
                    responsible: formData.get('responsible') as string,
                  };
                  updateKpiMutation.mutate(updateData);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre del KPI</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editingUserKpi.name}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unidad de Medida</Label>
                    <Input
                      id="unit"
                      name="unit"
                      defaultValue={editingUserKpi.unit}
                      placeholder="%, días, unidades, kg, etc."
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingUserKpi.description || ''}
                    rows={3}
                    placeholder="Describe el objetivo y metodología del KPI"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="target">🎯 Meta/Objetivo</Label>
                    <Input
                      id="target"
                      name="target"
                      defaultValue={editingUserKpi.target}
                      placeholder="100%, 50, 2.5, etc."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="frequency">Frecuencia</Label>
                    <Select name="frequency" defaultValue={editingUserKpi.frequency}>
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
                </div>

                <div>
                  <Label htmlFor="responsible">Responsable</Label>
                  <Input
                    id="responsible"
                    name="responsible"
                    defaultValue={editingUserKpi.responsible || ''}
                    placeholder="Nombre del responsable o cargo"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditKpiDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateKpiMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {updateKpiMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// Componente de formulario de usuario
interface UserFormProps {
  user?: UserType | null;
  companies?: Company[];
  areas?: Area[];
  onSubmit: (userData: Partial<UserType>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function UserForm({ user, companies, areas, onSubmit, onCancel, isLoading }: UserFormProps) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'collaborator',
    companyId: user?.companyId || '',
    areaId: user?.areaId || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      companyId: formData.companyId ? parseInt(formData.companyId.toString()) : null,
      areaId: formData.areaId ? parseInt(formData.areaId.toString()) : null
    };
    if (user && !submitData.password) {
      delete (submitData as any).password; // No actualizar password si está vacío en edición
    }
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
          data-testid="input-user-name"
        />
      </div>
      
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
          data-testid="input-user-email"
        />
      </div>
      
      <div>
        <Label htmlFor="password">
          Contraseña {user ? '(dejar vacío para mantener actual)' : ''}
        </Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          required={!user}
          data-testid="input-user-password"
        />
      </div>
      
      <div>
        <Label htmlFor="role">Rol</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
          <SelectTrigger data-testid="select-user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="manager">Gerente</SelectItem>
            <SelectItem value="collaborator">Colaborador</SelectItem>
            <SelectItem value="viewer">Visualizador</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="company">Empresa</Label>
        <Select value={formData.companyId.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: parseInt(value) }))}>
          <SelectTrigger data-testid="select-user-company">
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
      
      <div>
        <Label htmlFor="area">Área</Label>
        <Select value={formData.areaId.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, areaId: parseInt(value) }))}>
          <SelectTrigger data-testid="select-user-area">
            <SelectValue placeholder="Seleccionar área" />
          </SelectTrigger>
          <SelectContent>
            {areas?.map((area: any) => (
              <SelectItem key={area.id} value={area.id.toString()}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading} data-testid="button-submit-user">
          {isLoading ? 'Guardando...' : (user ? 'Actualizar' : 'Crear')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-user">
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// Componente de formulario de mensaje
interface MessageFormProps {
  user?: UserType | null;
  onSubmit: (messageData: { title: string; message: string; type: string; priority: string; fromUserId: number }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function MessageForm({ user, onSubmit, onCancel, isLoading }: MessageFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'normal'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, fromUserId: user!.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <strong>Destinatario:</strong> {user?.name} ({user?.email})
        </p>
        <p className="text-xs text-gray-500 mt-1">
          El mensaje se enviará por correo electrónico usando SendGrid
        </p>
      </div>
      
      <div>
        <Label htmlFor="title">Asunto</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Escribe el asunto del mensaje"
          required
          data-testid="input-message-title"
        />
      </div>
      
      <div>
        <Label htmlFor="message">Mensaje</Label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          placeholder="Escribe tu mensaje aquí..."
          rows={5}
          required
          data-testid="textarea-message-content"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Tipo</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
            <SelectTrigger data-testid="select-message-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Información</SelectItem>
              <SelectItem value="success">Éxito</SelectItem>
              <SelectItem value="warning">Advertencia</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="priority">Prioridad</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
            <SelectTrigger data-testid="select-message-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isLoading} data-testid="button-send-message">
          <Mail className="h-4 w-4 mr-2" />
          {isLoading ? 'Enviando...' : 'Enviar por Email'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-message">
          Cancelar
        </Button>
      </div>
    </form>
  );
}