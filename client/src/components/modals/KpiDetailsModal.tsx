import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils/dates';
import { getStatusText } from '@/lib/utils/kpi-status';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  CalendarDays, 
  CalendarClock, 
  User, 
  FileText, 
  ListTodo, 
  Plus,
  Target,
  Clock,
  TrendingUp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface KpiDetailsModalProps {
  kpiId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Types for API responses
interface KpiDetails {
  id: number;
  name: string;
  target?: string;
  frequency?: string;
  calculationMethod?: string;
  responsible?: string;
  companyId?: number;
  areaId?: number;
}

interface KpiValue {
  id: number;
  date: string;
  value: string;
  period: string;
  status?: string;
  comments?: string;
}

interface ActionPlan {
  id: number;
  title: string;
  status: string;
  dueDate: string;
  assignee?: string;
}

interface CompanyDetails {
  id: number;
  name: string;
}

interface AreaDetails {
  id: number;
  name: string;
}

export function KpiDetailsModal({ kpiId, isOpen, onClose }: KpiDetailsModalProps) {
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Reset comment when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setComment('');
    }
  }, [isOpen]);

  // Fetch KPI details
  const { data: kpi, isLoading: isLoadingKpi } = useQuery<KpiDetails>({
    queryKey: [`/api/kpis/${kpiId}`],
    enabled: !!kpiId && isOpen,
  });

  // Fetch KPI values
  const { data: kpiValues, isLoading: isLoadingValues } = useQuery<KpiValue[]>({
    queryKey: [`/api/kpi-values`, { kpiId }],
    enabled: !!kpiId && isOpen,
  });

  // Fetch company and area details
  const { data: company } = useQuery<CompanyDetails>({
    queryKey: [`/api/companies/${kpi?.companyId}`],
    enabled: !!kpi && isOpen,
  });

  const { data: area } = useQuery<AreaDetails>({
    queryKey: [`/api/areas/${kpi?.areaId}`],
    enabled: !!kpi && isOpen,
  });

  // Fetch action plans
  const { data: actionPlans, isLoading: isLoadingActionPlans } = useQuery<ActionPlan[]>({
    queryKey: [`/api/action-plans`, { kpiId }],
    enabled: !!kpiId && isOpen,
  });

  // Get latest value
  const latestValue = kpiValues && kpiValues.length > 0
    ? [...kpiValues].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Format data for chart
  const chartData = kpiValues
    ? [...kpiValues]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(value => ({
          date: formatDate(new Date(value.date)),
          value: parseFloat(value.value.replace('%', '')),
          period: value.period
        }))
    : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complies':
        return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />;
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />;
      case 'not_compliant':
        return <XCircle className="h-4 w-4 text-red-500 mr-1" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complies':
        return 'bg-green-100 text-green-800';
      case 'alert':
        return 'bg-yellow-100 text-yellow-800';
      case 'not_compliant':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSaveComment = () => {
    if (comment.trim() === '') return;
    
    alert('La funcionalidad para guardar comentarios se implementará en una futura versión.');
    setComment('');
  };

  const handleCreateActionPlan = () => {
    alert('La funcionalidad para crear planes de acción se implementará en una futura versión.');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-secondary-900">
            {isLoadingKpi ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cargando detalles...
              </div>
            ) : (
              <>Detalle de KPI: {kpi?.name}</>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoadingKpi ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="space-y-6">
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview" className="flex items-center space-x-1">
                  <Target className="h-4 w-4" />
                  <span>Información General</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>Historial</span>
                </TabsTrigger>
                <TabsTrigger value="actions" className="flex items-center space-x-1">
                  <ListTodo className="h-4 w-4" />
                  <span>Planes de Acción</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                {/* KPI Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <h3 className="text-xs uppercase text-secondary-500 font-semibold mb-2">Información general</h3>
                    <div className="bg-secondary-50 p-4 rounded-lg space-y-3">
                      <div>
                        <span className="text-sm text-secondary-500">Empresa:</span>
                        <span className="text-sm font-medium ml-2">{company?.name}</span>
                      </div>
                      <div>
                        <span className="text-sm text-secondary-500">Área:</span>
                        <span className="text-sm font-medium ml-2">{area?.name}</span>
                      </div>
                      <div>
                        <span className="text-sm text-secondary-500">Responsable:</span>
                        <span className="text-sm font-medium ml-2">{kpi?.responsible || 'No asignado'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-secondary-500">Frecuencia de medición:</span>
                        <span className="text-sm font-medium ml-2">
                          {kpi?.frequency === 'monthly' 
                            ? 'Mensual' 
                            : kpi?.frequency === 'quarterly' 
                            ? 'Trimestral' 
                            : kpi?.frequency === 'annual' 
                            ? 'Anual' 
                            : kpi?.frequency === 'weekly' 
                            ? 'Semanal' 
                            : kpi?.frequency}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs uppercase text-secondary-500 font-semibold mb-2">Métricas y objetivos</h3>
                    <div className="bg-secondary-50 p-4 rounded-lg space-y-3">
                      <div>
                        <span className="text-sm text-secondary-500">Objetivo actual:</span>
                        <span className="text-sm font-medium ml-2">{kpi?.target}</span>
                      </div>
                      <div>
                        <span className="text-sm text-secondary-500">Valor actual:</span>
                        <span className={`text-sm font-medium ml-2 ${
                          latestValue?.status === 'complies' 
                            ? 'text-green-500' 
                            : latestValue?.status === 'alert' 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                        }`}>{latestValue?.value}</span>
                      </div>
                      <div>
                        <span className="text-sm text-secondary-500">Estado:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 ${getStatusColor(latestValue?.status || '')}`}>
                          {getStatusIcon(latestValue?.status || '')}
                          {getStatusText(latestValue?.status || 'unknown' as any)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-secondary-500">Método de cálculo:</span>
                        <span className="text-sm font-medium ml-2">{kpi?.calculationMethod || 'No especificado'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Historical Data */}
                <div>
                  <h3 className="text-xs uppercase text-secondary-500 font-semibold mb-2">Tendencia histórica</h3>
                  <div className="bg-white border border-secondary-200 rounded-lg p-4 h-64">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="period" 
                            height={60}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#3b82f6" 
                            activeDot={{ r: 8 }} 
                            name="Valor"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-secondary-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-sm">No hay datos históricos disponibles</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Comments */}
                <div>
                  <h3 className="text-xs uppercase text-secondary-500 font-semibold mb-2">Comentarios</h3>
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <div className="space-y-4">
                      {latestValue?.comments ? (
                        <div className="border-b border-secondary-200 pb-3">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{kpi?.responsible || 'Sistema'}</span>
                            <span className="text-xs text-secondary-500">{latestValue?.date ? formatDate(new Date(latestValue.date)) : ''}</span>
                          </div>
                          <p className="text-sm text-secondary-700">{latestValue.comments}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-secondary-500 italic">No hay comentarios registrados.</p>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <Textarea 
                        placeholder="Añadir un comentario..." 
                        className="w-full p-2 border border-secondary-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
                        rows={2}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleSaveComment}
                          disabled={comment.trim() === ''}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="history">
                <div className="space-y-4 mt-4">
                  <h3 className="text-xs uppercase text-secondary-500 font-semibold">Historial de valores</h3>
                  
                  {isLoadingValues ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  ) : kpiValues && kpiValues.length > 0 ? (
                    <div className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-secondary-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 bg-secondary-50 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Periodo</th>
                            <th className="px-6 py-3 bg-secondary-50 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Valor</th>
                            <th className="px-6 py-3 bg-secondary-50 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 bg-secondary-50 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-secondary-200">
                          {[...kpiValues]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((value) => (
                            <tr key={value.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">{value.period}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">{value.value}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value.status || '')}`}>
                                  {getStatusIcon(value.status || '')}
                                  {getStatusText((value.status || '') as any)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{formatDate(new Date(value.date))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white border border-secondary-200 rounded-lg p-8 text-center text-secondary-500">
                      No hay datos históricos disponibles para este KPI.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="actions">
                <div className="space-y-4 mt-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs uppercase text-secondary-500 font-semibold">Planes de acción</h3>
                    <Button size="sm" onClick={handleCreateActionPlan}>
                      <Plus className="h-4 w-4 mr-1" />
                      Crear plan de acción
                    </Button>
                  </div>
                  
                  {isLoadingActionPlans ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  ) : actionPlans && actionPlans.length > 0 ? (
                    <div className="space-y-4">
                      {actionPlans.map((plan: any) => (
                        <div key={plan.id} className="bg-white border border-secondary-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-secondary-900">{plan.problemDescription}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                              ${plan.status === 'completed' 
                                ? 'bg-green-100 text-green-800' 
                                : plan.status === 'in_progress' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-yellow-100 text-yellow-800'}`}
                            >
                              {plan.status === 'completed' 
                                ? <><CheckCircle className="h-3 w-3 mr-1" /> Completado</> 
                                : plan.status === 'in_progress' 
                                ? <><Clock className="h-3 w-3 mr-1" /> En proceso</> 
                                : <><AlertTriangle className="h-3 w-3 mr-1" /> Pendiente</>}
                            </span>
                          </div>
                          <p className="text-sm text-secondary-700 mb-2">{plan.correctiveActions}</p>
                          <div className="grid grid-cols-2 gap-4 text-xs text-secondary-500">
                            <div className="flex items-center">
                              <User className="h-3 w-3 mr-1 text-secondary-400" />
                              <span className="font-medium">Responsable:</span> <span className="ml-1">{plan.responsible}</span>
                            </div>
                            <div className="flex items-center">
                              <CalendarDays className="h-3 w-3 mr-1 text-secondary-400" />
                              <span className="font-medium">Fecha inicio:</span> <span className="ml-1">{formatDate(plan.startDate)}</span>
                            </div>
                            <div className="flex items-center">
                              <CalendarClock className="h-3 w-3 mr-1 text-secondary-400" />
                              <span className="font-medium">Fecha fin prevista:</span> <span className="ml-1">{formatDate(plan.endDate)}</span>
                            </div>
                            {plan.status === 'completed' && plan.results && (
                              <div className="col-span-2 flex items-center">
                                <FileText className="h-3 w-3 mr-1 text-secondary-400" />
                                <span className="font-medium">Resultados:</span> <span className="ml-1">{plan.results}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-secondary-50 p-6 rounded-lg flex flex-col items-center justify-center">
                      <ListTodo className="h-10 w-10 text-secondary-400 mb-2" />
                      <p className="text-sm text-secondary-500 text-center">No hay planes de acción activos para este KPI.</p>
                      <p className="text-xs text-secondary-400 mt-1 text-center">Los planes de acción se crean cuando un KPI está en estado de alerta o no cumple con el objetivo.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
