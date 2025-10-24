import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingUp, TrendingDown, Clock, Search, Filter, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

export function KPIOverviewPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

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

  const filteredKPIs = kpiOverview?.filter(kpi => {
    const matchesSearch = kpi.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kpi.kpiName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompany === "all" || kpi.companyName === selectedCompany;
    const matchesArea = selectedArea === "all" || kpi.areaName === selectedArea;
    const matchesStatus = selectedStatus === "all" || kpi.status === selectedStatus;
    const matchesTab = activeTab === "all" || kpi.status === activeTab;

    return matchesSearch && matchesCompany && matchesArea && matchesStatus && matchesTab;
  }) || [];

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vista General de KPIs</h1>
          <p className="text-muted-foreground">
            Monitoreo consolidado de todos los indicadores por colaborador
          </p>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div>
                <p className="text-sm text-muted-foreground">Críticos</p>
                <p className="text-2xl font-bold text-red-600">{criticalKPIs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div>
                <p className="text-sm text-muted-foreground">En Alerta</p>
                <p className="text-2xl font-bold text-yellow-600">{alertKPIs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm text-muted-foreground">En Cumplimiento</p>
                <p className="text-2xl font-bold text-green-600">{compliantKPIs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <div>
                <p className="text-sm text-muted-foreground">Total KPIs</p>
                <p className="text-2xl font-bold">{filteredKPIs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
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
                className="pl-10"
              />
            </div>

            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                {companies?.map((company: any) => (
                  <SelectItem key={company.id} value={company.name}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas?.map((area: any) => (
                  <SelectItem key={area.id} value={area.name}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="non-compliant">No cumple</SelectItem>
                <SelectItem value="alert">Alerta</SelectItem>
                <SelectItem value="compliant">Cumple</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por Estado */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todos ({filteredKPIs.length})</TabsTrigger>
          <TabsTrigger value="non-compliant" className="text-red-600">
            Críticos ({criticalKPIs.length})
          </TabsTrigger>
          <TabsTrigger value="alert" className="text-yellow-600">
            Alertas ({alertKPIs.length})
          </TabsTrigger>
          <TabsTrigger value="compliant" className="text-green-600">
            Cumplimiento ({compliantKPIs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Colaborador</th>
                        <th className="text-left p-3">Empresa</th>
                        <th className="text-left p-3">KPI</th>
                        <th className="text-left p-3">Valor Actual</th>
                        <th className="text-left p-3">Meta</th>
                        <th className="text-left p-3">Estado</th>
                        <th className="text-left p-3">Última Actualización</th>
                        <th className="text-left p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.map((kpi) => (
                        <tr key={`${kpi.userId}-${kpi.kpiId}`} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{kpi.userName}</p>
                              <p className="text-sm text-muted-foreground">{kpi.userEmail}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{kpi.companyName}</Badge>
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{kpi.kpiName}</p>
                              <p className="text-sm text-muted-foreground">{kpi.kpiFrequency}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-mono">{kpi.kpiValue}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono">{kpi.kpiTarget}</span>
                          </td>
                          <td className="p-3">
                            <Badge className={getStatusColor(kpi.status)}>
                              {getStatusIcon(kpi.status)}
                              <span className="ml-1">{getStatusText(kpi.status)}</span>
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {format(new Date(kpi.lastUpdate), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Historial
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {filteredKPIs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No se encontraron KPIs</p>
            <p className="text-muted-foreground">
              Ajusta los filtros para ver más resultados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}