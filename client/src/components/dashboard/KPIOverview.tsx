import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingUp, TrendingDown, Clock, Search, Filter, Eye, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KPIHistoryModal } from "./KPIHistoryModal";

interface KPIOverviewItem {
  userId: number;
  userName: string;
  userEmail: string;
  areaName: string;
  companyName: string;
  kpiId: number;
  kpiName: string;
  kpiValue: string;
  kpiTarget: string;
  kpiFrequency: string;
  lastUpdate: Date;
  status: 'compliant' | 'alert' | 'non-compliant';
  trend: 'up' | 'down' | 'stable';
}

interface KPIOverviewProps {
  selectedCompany: number;
}

export function KPIOverview({ selectedCompany }: KPIOverviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPerson, setSelectedPerson] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedKPI, setSelectedKPI] = useState<KPIOverviewItem | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const { data: kpiOverview, isLoading } = useQuery<KPIOverviewItem[]>({
    queryKey: ['/api/kpi-overview'],
  });

  const { data: companies } = useQuery({
    queryKey: ['/api/companies'],
  });

  const { data: areas } = useQuery({
    queryKey: ['/api/areas'],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800 border-green-300';
      case 'alert': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'non-compliant': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <TrendingUp className="h-4 w-4" />;
      case 'alert': return <AlertCircle className="h-4 w-4" />;
      case 'non-compliant': return <TrendingDown className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'compliant': return 'Cumple';
      case 'alert': return 'Alerta';
      case 'non-compliant': return 'No Cumple';
      default: return 'Sin datos';
    }
  };

  const calculateKPIProgress = (kpiValue: string, kpiTarget: string, kpiName: string) => {
    if (!kpiValue || !kpiTarget) return 0;
    
    // Extraer números de los valores
    const valueNum = parseFloat(kpiValue.replace(/[^0-9.-]+/g, ''));
    const targetNum = parseFloat(kpiTarget.replace(/[^0-9.-]+/g, ''));
    
    if (isNaN(valueNum) || isNaN(targetNum) || targetNum === 0) {
      return 0;
    }
    
    // Determinar si es una métrica invertida (menor es mejor)
    const isLowerBetter = [
      'días de cobro',
      'días de pago', 
      'tiempo de entrega',
      'huella de carbono',
      'costos',
      'gastos',
      'tiempo de respuesta',
      'defectos',
      'errores',
      'quejas',
      'devoluciones',
      'rotación',
      'tiempo de inactividad'
    ].some(pattern => kpiName.toLowerCase().includes(pattern));
    
    let progress;
    if (isLowerBetter) {
      // Para métricas donde menor es mejor
      progress = Math.min((targetNum / valueNum) * 100, 100);
    } else {
      // Para métricas donde mayor es mejor
      progress = Math.min((valueNum / targetNum) * 100, 100);
    }
    
    return Math.round(progress);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 70) return 'bg-yellow-500';
    if (progress >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Filtrar por empresa seleccionada
  const companyName = companies?.find((c: any) => c.id === selectedCompany)?.name || '';
  
  const filteredKPIs = kpiOverview?.filter(kpi => {
    const matchesCompany = kpi.companyName === companyName;
    const matchesSearch = kpi.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kpi.kpiName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = selectedArea === "all" || kpi.areaName === selectedArea;
    const matchesStatus = selectedStatus === "all" || kpi.status === selectedStatus;
    const matchesPerson = selectedPerson === "all" || kpi.userName === selectedPerson;
    const matchesTab = activeTab === "all" || kpi.status === activeTab;

    return matchesCompany && matchesSearch && matchesArea && matchesStatus && matchesPerson && matchesTab;
  }) || [];

  // Obtener áreas únicas para el filtro
  const uniqueAreas = [...new Set(kpiOverview?.filter(kpi => kpi.companyName === companyName).map(kpi => kpi.areaName) || [])];
  
  // Obtener personas únicas para el filtro
  const uniquePersons = [...new Set(kpiOverview?.filter(kpi => kpi.companyName === companyName).map(kpi => kpi.userName) || [])];

  const groupedByArea = filteredKPIs.reduce((acc, kpi) => {
    if (!acc[kpi.areaName]) {
      acc[kpi.areaName] = [];
    }
    acc[kpi.areaName].push(kpi);
    return acc;
  }, {} as Record<string, KPIOverviewItem[]>);

  const criticalKPIs = filteredKPIs.filter(kpi => kpi.status === 'non-compliant');
  const alertKPIs = filteredKPIs.filter(kpi => kpi.status === 'alert');
  const compliantKPIs = filteredKPIs.filter(kpi => kpi.status === 'compliant');

  const handleViewHistory = (kpi: KPIOverviewItem) => {
    setSelectedKPI(kpi);
    setIsHistoryModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Vista General de KPIs</h2>
        <Badge variant="outline" className="ml-2">
          {companyName}
        </Badge>
      </div>

      {/* Métricas Rápidas mejoradas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticos</p>
                <p className="text-2xl font-bold text-red-600">{criticalKPIs.length}</p>
                <p className="text-xs text-muted-foreground">Requieren atención</p>
              </div>
              <div className="p-2 bg-red-100 rounded-full">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Alerta</p>
                <p className="text-2xl font-bold text-yellow-600">{alertKPIs.length}</p>
                <p className="text-xs text-muted-foreground">Monitoreando</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-full">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Cumplimiento</p>
                <p className="text-2xl font-bold text-green-600">{compliantKPIs.length}</p>
                <p className="text-xs text-muted-foreground">Objetivo logrado</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total KPIs</p>
                <p className="text-2xl font-bold text-blue-600">{filteredKPIs.length}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros mejorados */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Filter className="h-4 w-4 text-gray-600" />
            </div>
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o KPI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger className="bg-white border-gray-300 focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="📊 Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📊 Todas las áreas</SelectItem>
                {uniqueAreas.map((areaName: string) => (
                  <SelectItem key={areaName} value={areaName}>
                    {areaName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger className="bg-white border-gray-300 focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="👤 Todas las personas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">👤 Todas las personas</SelectItem>
                {uniquePersons.map((personName: string) => (
                  <SelectItem key={personName} value={personName}>
                    {personName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="bg-white border-gray-300 focus:ring-2 focus:ring-blue-500">
                <SelectValue placeholder="🔍 Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🔍 Todos los estados</SelectItem>
                <SelectItem value="non-compliant">🔴 No cumple</SelectItem>
                <SelectItem value="alert">🟡 Alerta</SelectItem>
                <SelectItem value="compliant">🟢 Cumple</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>



      {/* Tabs por Estado mejoradas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📊 Todos ({filteredKPIs.length})
          </TabsTrigger>
          <TabsTrigger value="non-compliant" className="text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
            🔴 Críticos ({criticalKPIs.length})
          </TabsTrigger>
          <TabsTrigger value="alert" className="text-yellow-600 data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700">
            🟡 Alertas ({alertKPIs.length})
          </TabsTrigger>
          <TabsTrigger value="compliant" className="text-green-600 data-[state=active]:bg-green-50 data-[state=active]:text-green-700">
            🟢 Cumplimiento ({compliantKPIs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Agrupación por Área */}
          {Object.entries(groupedByArea).map(([areaName, kpis]) => (
            <Card key={areaName}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{areaName}</span>
                  <Badge variant="outline">{kpis.length} KPIs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {kpis.map((kpi) => {
                    const progress = calculateKPIProgress(kpi.kpiValue, kpi.kpiTarget, kpi.kpiName);
                    const progressColor = getProgressColor(progress);
                    
                    return (
                      <Card key={`${kpi.userId}-${kpi.kpiId}`} className="hover:shadow-md transition-shadow border-l-4 border-l-gray-300 hover:border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                  {kpi.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{kpi.userName}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {kpi.userEmail.split('@')[0]}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium text-gray-700">{kpi.kpiName}</p>
                                <p className="text-xs text-gray-500">{kpi.kpiFrequency}</p>
                                
                                {/* Barra de progreso individual */}
                                <div className="mt-2 w-full max-w-xs">
                                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>Progreso</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
                                      style={{ width: `${progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900">{kpi.kpiValue}</p>
                                <p className="text-sm text-gray-500">Meta: {kpi.kpiTarget}</p>
                              </div>
                              
                              <div className="flex flex-col items-center space-y-2">
                                <Badge className={`${getStatusColor(kpi.status)} px-3 py-1`}>
                                  {getStatusIcon(kpi.status)}
                                  <span className="ml-1 font-medium">{getStatusText(kpi.status)}</span>
                                </Badge>
                                
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  {kpi.lastUpdate && format(new Date(kpi.lastUpdate), 'dd/MM', { locale: es })}
                                </div>
                              </div>
                              
                              <Button size="sm" variant="outline" onClick={() => handleViewHistory(kpi)} className="flex-shrink-0">
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {filteredKPIs.length === 0 && (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-8 text-center">
            <div className="p-4 bg-white rounded-full w-fit mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron KPIs</h3>
            <p className="text-gray-600 mb-4">
              No hay KPIs que coincidan con los filtros seleccionados
            </p>
            <div className="text-sm text-gray-500">
              <p>Intenta:</p>
              <ul className="mt-2 space-y-1">
                <li>• Cambiar el área seleccionada</li>
                <li>• Modificar el estado de los KPIs</li>
                <li>• Limpiar el término de búsqueda</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de historial */}
      {selectedKPI && (
        <KPIHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          kpiId={selectedKPI.kpiId}
          kpiName={selectedKPI.kpiName}
          kpiTarget={selectedKPI.kpiTarget}
          userName={selectedKPI.userName}
          areaName={selectedKPI.areaName}
          companyName={selectedKPI.companyName}
        />
      )}
    </div>
  );
}