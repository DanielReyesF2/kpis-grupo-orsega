import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface KPIHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiId: number | null;
  kpiName: string;
  kpiTarget: string;
  userName: string;
  areaName: string;
  companyName: string;
}

interface KPIHistoryItem {
  value: string;
  date: Date;
  updatedBy: number;
}

export function KPIHistoryModal({ 
  isOpen, 
  onClose, 
  kpiId, 
  kpiName, 
  kpiTarget, 
  userName, 
  areaName, 
  companyName 
}: KPIHistoryModalProps) {
  const [months, setMonths] = useState(12);

  const { data: kpiHistory, isLoading } = useQuery<KPIHistoryItem[]>({
    queryKey: ['/api/kpi-history', kpiId, months],
    enabled: kpiId !== null && isOpen,
  });

  const processChartData = () => {
    if (!kpiHistory || kpiHistory.length === 0) return [];

    return kpiHistory
      .map(item => ({
        date: format(new Date(item.date), 'MMM yyyy', { locale: es }),
        value: parseFloat(item.value.replace('%', '')),
        target: parseFloat(kpiTarget.replace('%', '')),
        rawDate: new Date(item.date)
      }))
      .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
      .slice(-months);
  };

  const chartData = processChartData();

  const calculateTrend = () => {
    if (chartData.length < 2) return 'stable';
    
    const recent = chartData.slice(-3);
    const average = recent.reduce((sum, item) => sum + item.value, 0) / recent.length;
    const previous = chartData.slice(-6, -3);
    const previousAverage = previous.reduce((sum, item) => sum + item.value, 0) / previous.length;
    
    if (average > previousAverage * 1.05) return 'up';
    if (average < previousAverage * 0.95) return 'down';
    return 'stable';
  };

  const trend = calculateTrend();
  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const targetValue = parseFloat(kpiTarget.replace('%', ''));

  const getPerformanceStatus = () => {
    if (currentValue >= targetValue * 0.95) return 'compliant';
    if (currentValue >= targetValue * 0.8) return 'alert';
    return 'non-compliant';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800 border-green-300';
      case 'alert': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'non-compliant': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Fecha', 'Valor', 'Meta'],
      ...chartData.map(item => [item.date, `${item.value}%`, `${item.target}%`])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kpiName}-historial-${userName}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de KPI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header con información del KPI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{kpiName}</h3>
                  <p className="text-sm text-muted-foreground">{userName} - {areaName}</p>
                </div>
                <Badge variant="outline">{companyName}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentValue.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Valor Actual</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{targetValue}%</p>
                  <p className="text-sm text-muted-foreground">Meta</p>
                </div>
                <div className="text-center">
                  <Badge className={getStatusColor(getPerformanceStatus())}>
                    {getStatusText(getPerformanceStatus())}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">Estado</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {getTrendIcon()}
                    <span className="font-medium capitalize">{trend === 'up' ? 'Subiendo' : trend === 'down' ? 'Bajando' : 'Estable'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Tendencia</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Período:</span>
                <Select value={months.toString()} onValueChange={(value) => setMonths(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                    <SelectItem value="18">18 meses</SelectItem>
                    <SelectItem value="24">24 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button onClick={exportData} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Gráfico de líneas */}
          <Card>
            <CardHeader>
              <CardTitle>Tendencia Histórica</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-80">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value}%`, 
                        name === 'value' ? 'Valor Real' : 'Meta'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                      name="value"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="target" 
                      stroke="#dc2626" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={{ fill: '#dc2626', strokeWidth: 2, r: 3 }}
                      name="target"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay datos históricos disponibles</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de barras comparativo */}
          <Card>
            <CardHeader>
              <CardTitle>Comparativo Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, 'Valor']}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <p>No hay datos disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabla de datos */}
          <Card>
            <CardHeader>
              <CardTitle>Datos Detallados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-left p-2">Valor</th>
                      <th className="text-left p-2">Meta</th>
                      <th className="text-left p-2">Diferencia</th>
                      <th className="text-left p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((item, index) => {
                      const difference = item.value - item.target;
                      const status = item.value >= item.target * 0.95 ? 'compliant' : 
                                   item.value >= item.target * 0.8 ? 'alert' : 'non-compliant';
                      
                      return (
                        <tr key={index} className="border-b">
                          <td className="p-2">{item.date}</td>
                          <td className="p-2 font-mono">{item.value}%</td>
                          <td className="p-2 font-mono">{item.target}%</td>
                          <td className={`p-2 font-mono ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{difference.toFixed(1)}%
                          </td>
                          <td className="p-2">
                            <Badge className={getStatusColor(status)}>
                              {getStatusText(status)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}