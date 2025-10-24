import { useState } from 'react';
import { 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  LineChart, Line, 
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface KpiChartsProps {
  kpis: Array<{
    id: number;
    name: string;
    status: string;
    value?: string;
    target?: string;
    compliancePercentage?: string;
  }>;
  kpiValues: Array<{
    kpiId: number;
    value: string;
    period: string;
    status: string;
    date: string;
  }>;
  companies: Array<{
    id: number;
    name: string;
  }>;
}

export function KpiCharts({ kpis, kpiValues, companies }: KpiChartsProps) {
  const [activeTab, setActiveTab] = useState("performance");
  
  // Excluir los KPIs de "Satisfacción interdepartamental" (IDs 19 y 20)
  const filteredKpis = kpis.filter(kpi => kpi.id !== 19 && kpi.id !== 20);
  const filteredKpiValues = kpiValues.filter(value => value.kpiId !== 19 && value.kpiId !== 20);

  // Procesamos los datos para generar gráficos
  const getStatusCount = () => {
    const counts = { complies: 0, alert: 0, not_compliant: 0 };
    
    filteredKpis.forEach(kpi => {
      if (kpi.status === 'complies') counts.complies++;
      else if (kpi.status === 'alert') counts.alert++;
      else if (kpi.status === 'not_compliant') counts.not_compliant++;
    });
    
    return [
      { name: 'Cumple', value: counts.complies, color: '#10b981' },
      { name: 'Alerta', value: counts.alert, color: '#f59e0b' },
      { name: 'No Cumple', value: counts.not_compliant, color: '#ef4444' }
    ];
  };

  const getKpisByCompany = () => {
    const companyData = companies.map(company => {
      // Filtramos KPIs por compañía (asumiendo que hay un campo companyId en los KPIs)
      const companyKpis = filteredKpis.filter(kpi => {
        // Temporal: asignar arbitrariamente a las compañías
        return kpi.id % 2 === 0 ? company.id === 1 : company.id === 2;
      });
      
      // Contamos los KPIs por estado
      const compliesCount = companyKpis.filter(kpi => kpi.status === 'complies').length;
      const alertCount = companyKpis.filter(kpi => kpi.status === 'alert').length;
      const notCompliantCount = companyKpis.filter(kpi => kpi.status === 'not_compliant').length;
      
      return {
        name: company.name,
        cumple: compliesCount,
        alerta: alertCount,
        noCumple: notCompliantCount
      };
    });
    
    return companyData;
  };

  const getTrendData = () => {
    // Generar períodos dinámicamente basados en el año actual y anterior
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Crear períodos dinámicos para los últimos 2 años
    const periods = [
      `Q1 ${previousYear}`, `Q2 ${previousYear}`, `Q3 ${previousYear}`, `Q4 ${previousYear}`,
      `Q1 ${currentYear}`, `Q2 ${currentYear}`, `Q3 ${currentYear}`, `Q4 ${currentYear}`
    ];
    
    // Agrupar por periodo para ver la tendencia
    const periodData: Record<string, { complies: number, alert: number, not_compliant: number }> = {};
    
    // Inicializamos contadores para cada periodo
    periods.forEach(period => {
      periodData[period] = { complies: 0, alert: 0, not_compliant: 0 };
    });
    
    // Contamos KPIs por status y periodo usando datos reales
    filteredKpiValues.forEach(value => {
      let period = value.period;
      
      // Si el período no está en nuestra lista de períodos válidos, intentar extraerlo de la fecha
      if (!periods.includes(period) && value.date) {
        const date = new Date(value.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // getMonth() retorna 0-11
        
        // Determinar trimestre basado en el mes
        let quarter = '';
        if (month <= 3) quarter = 'Q1';
        else if (month <= 6) quarter = 'Q2';
        else if (month <= 9) quarter = 'Q3';
        else quarter = 'Q4';
        
        period = `${quarter} ${year}`;
      }
      
      // Solo procesar si el período está en nuestra lista
      if (periods.includes(period)) {
        if (value.status === 'complies') periodData[period].complies++;
        else if (value.status === 'alert') periodData[period].alert++;
        else if (value.status === 'not_compliant') periodData[period].not_compliant++;
      }
    });
    
    // Filtrar solo los períodos que tienen datos o mostrar los últimos 4 trimestres
    const recentPeriods = periods.slice(-4); // Últimos 4 trimestres
    
    // Convertimos a formato para gráfico
    return recentPeriods.map(period => ({
      name: period,
      cumple: periodData[period].complies,
      alerta: periodData[period].alert,
      noCumple: periodData[period].not_compliant
    }));
  };

  // Datos para gráficos
  const statusData = getStatusCount();
  const companyData = getKpisByCompany();
  const trendData = getTrendData();

  // Datos de ventas reales basados en KPIs de ventas
  const getSalesData = () => {
    // Buscar KPIs relacionados con ventas
    const salesKpis = filteredKpis.filter(kpi => 
      kpi.name.toLowerCase().includes('ventas') || 
      kpi.name.toLowerCase().includes('volumen')
    );
    
    // Si hay KPIs de ventas, usar sus valores
    if (salesKpis.length > 0) {
      const salesByMonth: Record<string, number> = {};
      
      // Agrupar valores de ventas por mes
      filteredKpiValues.forEach(value => {
        const kpi = salesKpis.find(k => k.id === value.kpiId);
        if (kpi && value.date) {
          const date = new Date(value.date);
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const monthKey = monthNames[date.getMonth()];
          
          // Convertir valor a número
          const numericValue = parseFloat(value.value.replace(/[^0-9.-]/g, ''));
          if (!isNaN(numericValue)) {
            salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + numericValue;
          }
        }
      });
      
      // Convertir a formato de gráfico
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return months.map(month => ({
        name: month,
        ventas: salesByMonth[month] || 0
      }));
    }
    
    // Fallback: datos vacíos si no hay KPIs de ventas
    return [
      { name: 'Ene', ventas: 0 }, { name: 'Feb', ventas: 0 }, { name: 'Mar', ventas: 0 },
      { name: 'Abr', ventas: 0 }, { name: 'May', ventas: 0 }, { name: 'Jun', ventas: 0 },
      { name: 'Jul', ventas: 0 }, { name: 'Ago', ventas: 0 }, { name: 'Sep', ventas: 0 },
      { name: 'Oct', ventas: 0 }, { name: 'Nov', ventas: 0 }, { name: 'Dic', ventas: 0 }
    ];
  };
  
  const salesData = getSalesData();

  return (
    <div className="space-y-6">
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Desempeño</TabsTrigger>
          <TabsTrigger value="companies">Por Empresa</TabsTrigger>
          <TabsTrigger value="trend">Tendencia</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Estado de KPIs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center space-x-4 mt-4">
                  <Badge className="bg-[#10b981] hover:bg-[#10b981]/80">
                    Cumple: {statusData[0].value}
                  </Badge>
                  <Badge className="bg-[#f59e0b] hover:bg-[#f59e0b]/80">
                    Alerta: {statusData[1].value}
                  </Badge>
                  <Badge className="bg-[#ef4444] hover:bg-[#ef4444]/80">
                    No Cumple: {statusData[2].value}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  KPIs por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      width={500}
                      height={300}
                      data={[
                        { name: 'Financieros', value: Math.floor(filteredKpis.length * 0.3) },
                        { name: 'Ventas', value: Math.floor(filteredKpis.length * 0.25) },
                        { name: 'Operaciones', value: Math.floor(filteredKpis.length * 0.2) },
                        { name: 'RRHH', value: Math.floor(filteredKpis.length * 0.15) },
                        { name: 'Otros', value: filteredKpis.length - Math.floor(filteredKpis.length * 0.9) }
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#273949" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                KPIs por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    width={500}
                    height={300}
                    data={companyData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cumple" stackId="a" fill="#10b981" name="Cumple" />
                    <Bar dataKey="alerta" stackId="a" fill="#f59e0b" name="Alerta" />
                    <Bar dataKey="noCumple" stackId="a" fill="#ef4444" name="No Cumple" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                Tendencia de KPIs por Periodo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    width={500}
                    height={300}
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cumple" stroke="#10b981" name="Cumple" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="alerta" stroke="#f59e0b" name="Alerta" />
                    <Line type="monotone" dataKey="noCumple" stroke="#ef4444" name="No Cumple" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                Ventas Totales 2024
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    width={500}
                    height={300}
                    data={salesData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="ventas" stroke="#273949" fill="#273949" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}