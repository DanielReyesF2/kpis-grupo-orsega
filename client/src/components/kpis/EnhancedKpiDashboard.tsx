import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Target,
  Activity,
  Award,
  Clock,
  BarChart3,
  Edit3,
  ShieldAlert,
  CircleX,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateAndTime } from '@/utils/dates';

interface KpiData {
  id: number;
  name: string;
  value: string;
  target: string;
  status: 'complies' | 'alert' | 'not_compliant';
  compliancePercentage: string;
  unit?: string;
  frequency?: string;
  date: Date | string | null;
  period?: string;
  comments?: string;
}

interface EnhancedKpiDashboardProps {
  kpis: KpiData[];
  companyName: string;
  areaName: string;
  companyId: number;
  onUpdateKpi?: (kpiId: number) => void;
}

interface TopPerformer {
  area_name: string;
  area_id: number;
  total_kpis: number;
  compliant_kpis: number;
  compliance_percentage: number;
}

const statusColors = {
  complies: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    chart: '#10b981'
  },
  alert: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500',
    chart: '#f59e0b'
  },
  not_compliant: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    chart: '#ef4444'
  }
};

const getStatusIcon = (status: string, animated: boolean = true) => {
  const baseClasses = animated ? "h-6 w-6" : "h-5 w-5";
  
  switch (status) {
    case 'complies':
      return <CheckCircle className={`${baseClasses} text-green-500 ${animated ? 'animate-pulse' : ''}`} />;
    case 'alert':
      return <ShieldAlert className={`${baseClasses} text-amber-500 ${animated ? 'animate-bounce' : ''}`} />;
    case 'not_compliant':
      return <CircleX className={`${baseClasses} text-red-500 ${animated ? 'animate-pulse' : ''}`} />;
    default:
      return <Activity className={`${baseClasses} text-gray-500`} />;
  }
};

const getTrendIcon = (compliance: number, target: number = 100) => {
  if (compliance >= target * 0.95) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  } else if (compliance >= target * 0.8) {
    return <Activity className="h-4 w-4 text-yellow-500" />;
  } else {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
};

export function EnhancedKpiDashboard({ kpis, companyName, areaName, companyId, onUpdateKpi }: EnhancedKpiDashboardProps) {
  // Estado para controlar expansión de KPIs
  const [showAllKpis, setShowAllKpis] = useState(false);
  const [showAllCharts, setShowAllCharts] = useState(false);

  // Consulta para obtener top performers
  const { data: topPerformers = [], isLoading: loadingTopPerformers } = useQuery<TopPerformer[]>({
    queryKey: ['/api/top-performers', companyId],
    enabled: !!companyId,
  });

  const stats = useMemo(() => {
    const total = kpis.length;
    const complies = kpis.filter(k => k.status === 'complies').length;
    const alert = kpis.filter(k => k.status === 'alert').length;
    const not_compliant = kpis.filter(k => k.status === 'not_compliant').length;

    // ✅ FIX CRÍTICO: Filtrar valores válidos antes de calcular promedio
    const validComplianceValues = kpis
      .map(k => parseFloat(k.compliancePercentage || '0'))
      .filter(v => !isNaN(v) && isFinite(v));

    const avgCompliance = validComplianceValues.length > 0
      ? validComplianceValues.reduce((acc, v) => acc + v, 0) / validComplianceValues.length
      : 0;

    return { total, complies, alert, not_compliant, avgCompliance };
  }, [kpis]);

  const pieData = [
    { name: 'Cumpliendo', value: stats.complies, color: statusColors.complies.chart },
    { name: 'En Alerta', value: stats.alert, color: statusColors.alert.chart },
    { name: 'No Cumpliendo', value: stats.not_compliant, color: statusColors.not_compliant.chart }
  ].filter(item => item.value > 0);

  const recentPerformance = useMemo(() => {
    return kpis.slice(0, 6).map(kpi => ({
      name: kpi.name.substring(0, 20) + '...',
      compliance: parseFloat(kpi.compliancePercentage || '0'),
      target: 100,
      status: kpi.status
    }));
  }, [kpis]);

  // KPIs ordenados por fecha de actualización (más recientes primero)
  const sortedKpis = useMemo(() => {
    return [...kpis].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Más recientes primero
    });
  }, [kpis]);

  // KPIs a mostrar basado en el estado showAllKpis
  const displayedKpis = useMemo(() => {
    const limit = 6; // Mostrar solo 6 KPIs inicialmente
    return showAllKpis ? sortedKpis : sortedKpis.slice(0, limit);
  }, [sortedKpis, showAllKpis]);

  // KPIs por categoría de rendimiento para gráficas
  const performanceData = useMemo(() => {
    const excellent = kpis.filter(k => parseFloat(k.compliancePercentage || '0') >= 90).length;
    const good = kpis.filter(k => {
      const comp = parseFloat(k.compliancePercentage || '0');
      return comp >= 70 && comp < 90;
    }).length;
    const needsImprovement = kpis.filter(k => parseFloat(k.compliancePercentage || '0') < 70).length;

    return [
      { name: 'Excelente (90%+)', value: excellent, color: '#10b981' },
      { name: 'Bueno (70-89%)', value: good, color: '#f59e0b' },
      { name: 'Mejorar (<70%)', value: needsImprovement, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [kpis]);

  return (
    <div className="space-y-6">
      {/* Header con información contextual */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                Dashboard de KPIs
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {companyName} - {areaName}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {stats.avgCompliance.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cumplimiento Promedio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total KPIs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500 animate-spin-slow" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-green-50 dark:bg-green-900/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cumpliendo</p>
                <p className="text-2xl font-bold text-green-600">{stats.complies}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? ((stats.complies / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 border-l-yellow-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${stats.alert > 0 ? 'bg-amber-50 dark:bg-amber-900/10 ring-2 ring-amber-300 ring-opacity-50 animate-pulse' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">En Alerta</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.alert}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? ((stats.alert / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <ShieldAlert className={`h-8 w-8 text-yellow-500 ${stats.alert > 0 ? 'animate-bounce' : ''}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 border-l-red-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${stats.not_compliant > 0 ? 'bg-red-50 dark:bg-red-900/10 ring-2 ring-red-300 ring-opacity-50' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No Cumpliendo</p>
                <p className="text-2xl font-bold text-red-600">{stats.not_compliant}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? ((stats.not_compliant / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <CircleX className={`h-8 w-8 text-red-500 ${stats.not_compliant > 0 ? 'animate-pulse' : ''}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performer Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Award className="h-6 w-6" />
            🏆 Top Performers por Área
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTopPerformers ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : topPerformers.length > 0 ? (
            <div className="space-y-3">
              {topPerformers.map((performer: TopPerformer, index: number) => {
                const isWinner = index === 0;
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                
                return (
                  <div 
                    key={performer.area_id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-300 ${
                      isWinner 
                        ? 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-300 dark:border-yellow-700 ring-2 ring-yellow-400 ring-opacity-50 animate-pulse' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{medal}</span>
                      <div>
                        <h3 className={`font-semibold ${isWinner ? 'text-yellow-800 dark:text-yellow-200' : 'text-gray-900 dark:text-gray-100'}`}>
                          {performer.area_name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {performer.compliant_kpis}/{performer.total_kpis} KPIs cumpliendo
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        performer.compliance_percentage >= 90 ? 'text-green-600' :
                        performer.compliance_percentage >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {performer.compliance_percentage}%
                      </div>
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            performer.compliance_percentage >= 90 ? 'bg-green-500' :
                            performer.compliance_percentage >= 70 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${performer.compliance_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay datos de top performers disponibles</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análisis de Rendimiento - Nueva sección mejorada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfica de Rendimiento por Categorías */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              📈 Análisis de Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={performanceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {performanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} KPIs`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Sin datos para mostrar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers simplificado para Vista General */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-600" />
              🏆 Top 3 Áreas con Mejor Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTopPerformers ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : topPerformers.length > 0 ? (
              <div className="space-y-3">
                {topPerformers.slice(0, 3).map((performer: TopPerformer, index: number) => {
                  const isWinner = index === 0;
                  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                  
                  return (
                    <div 
                      key={performer.area_id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                        isWinner 
                          ? 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-300 dark:border-yellow-700 ring-1 ring-yellow-400 ring-opacity-50' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{medal}</span>
                        <div>
                          <h3 className={`font-semibold ${isWinner ? 'text-yellow-800 dark:text-yellow-200' : 'text-gray-900 dark:text-gray-100'}`}>
                            {performer.area_name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {performer.compliant_kpis}/{performer.total_kpis} KPIs
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${
                          performer.compliance_percentage >= 90 ? 'text-green-600' :
                          performer.compliance_percentage >= 70 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {performer.compliance_percentage}%
                        </div>
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              performer.compliance_percentage >= 90 ? 'bg-green-500' :
                              performer.compliance_percentage >= 70 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${performer.compliance_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay datos de rendimiento disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos detallados - Sección expandible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de Estados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Distribución de Estados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">No hay datos para mostrar</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rendimiento por KPI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Rendimiento por KPI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {recentPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar 
                      dataKey="compliance" 
                      fill="#8884d8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos para mostrar
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista detallada de KPIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              📊 KPIs Actualizados Recientemente
              <Badge variant="outline" className="ml-2">
                {displayedKpis.length} de {sortedKpis.length}
              </Badge>
            </div>
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayedKpis.map((kpi) => {
              const compliance = parseFloat(kpi.compliancePercentage || '0');
              
              // Mapa simple de normalización de estados
              const statusMap: Record<string, keyof typeof statusColors> = {
                'complies': 'complies',
                'compliant': 'complies',
                'alert': 'alert',
                'not_complies': 'not_compliant',
                'no_complies': 'not_compliant',
                'non-compliant': 'not_compliant',
                'not_compliant': 'not_compliant'
              };
              
              // Obtener status normalizado con fallback
              const normalizedStatus = statusMap[kpi.status] || 'not_compliant';
              const colors = statusColors[normalizedStatus];
              
              return (
                <div key={kpi.id} className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={colors.icon}>
                          {getStatusIcon(kpi.status)}
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {kpi.name}
                        </h4>
                        <Badge variant="outline" className={`${colors.text} ${colors.border}`}>
                          {kpi.status === 'complies' ? 'Cumple' : 
                           kpi.status === 'alert' ? 'Alerta' : 'No Cumple'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Valor Actual:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{kpi.value} {kpi.unit}</p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Objetivo:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{kpi.target} {kpi.unit}</p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Cumplimiento:</span>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{kpi.compliancePercentage}%</p>
                            {getTrendIcon(compliance)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Última Actualización:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {kpi.date ? formatDateAndTime(kpi.date) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Progreso</span>
                          <span className="font-medium">{compliance}%</span>
                        </div>
                        <Progress 
                          value={Math.min(compliance, 100)} 
                          className="h-2"
                        />
                      </div>
                      
                      {kpi.comments && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <p className="text-sm text-gray-700 dark:text-gray-300">{kpi.comments}</p>
                        </div>
                      )}
                    </div>
                    
                    {onUpdateKpi && (
                      <Button 
                        onClick={() => onUpdateKpi(kpi.id)}
                        size="sm"
                        className="ml-4"
                        data-testid={`button-edit-kpi-${kpi.id}`}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Actualizar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {kpis.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay KPIs disponibles para mostrar</p>
                <p className="text-sm">Selecciona una empresa para ver sus KPIs</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}