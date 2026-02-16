import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Target,
  Trophy,
  Users,
  DollarSign,
  Percent,
} from "lucide-react";
import {
  useLeadSourcesReport,
  useSalesForecast,
  useWinLossAnalysis,
  useCompetitorAnalysis,
} from "@/hooks/useComercial";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function ComercialReports() {
  const [activeTab, setActiveTab] = useState("sources");

  const { data: leadSources = [], isLoading: sourcesLoading } = useLeadSourcesReport();
  const { data: forecast = [], isLoading: forecastLoading } = useSalesForecast();
  const { data: winLoss, isLoading: winLossLoading } = useWinLossAnalysis();
  const { data: competitors = [], isLoading: competitorsLoading } = useCompetitorAnalysis();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const sourceLabels: Record<string, string> = {
    referido: "Referido",
    web: "Web",
    llamada_fria: "Llamada fria",
    evento: "Evento",
    linkedin: "LinkedIn",
    email_marketing: "Email",
    otro: "Otro",
    sin_fuente: "Sin fuente",
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="sources">Fuentes</TabsTrigger>
          <TabsTrigger value="forecast">Proyeccion</TabsTrigger>
          <TabsTrigger value="winloss">Resultados</TabsTrigger>
          <TabsTrigger value="competitors">Competencia</TabsTrigger>
        </TabsList>

        {/* Lead Sources */}
        <TabsContent value="sources" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Leads</p>
                    <p className="text-2xl font-bold">
                      {leadSources.reduce((sum, s) => sum + s.totalLeads, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Convertidos</p>
                    <p className="text-2xl font-bold">
                      {leadSources.reduce((sum, s) => sum + s.convertedLeads, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Percent className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tasa Conversion</p>
                    <p className="text-2xl font-bold">
                      {leadSources.length > 0
                        ? (
                            (leadSources.reduce((sum, s) => sum + s.convertedLeads, 0) /
                              leadSources.reduce((sum, s) => sum + s.totalLeads, 0)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leads por Fuente</CardTitle>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={leadSources.map((s) => ({
                        ...s,
                        name: sourceLabels[s.source] || s.source,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="totalLeads" fill="#3b82f6" name="Total" />
                      <Bar dataKey="convertedLeads" fill="#10b981" name="Convertidos" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tasa de Conversion por Fuente</CardTitle>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={leadSources
                          .filter((s) => s.totalLeads > 0)
                          .map((s) => ({
                            name: sourceLabels[s.source] || s.source,
                            value: s.totalLeads,
                          }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {leadSources.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Forecast */}
        <TabsContent value="forecast" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Oportunidades</p>
                    <p className="text-2xl font-bold">
                      {forecast.reduce((sum, f) => sum + f.count, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(forecast.reduce((sum, f) => sum + f.totalValue, 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Ponderado</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(forecast.reduce((sum, f) => sum + f.weightedValue, 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proyeccion de Cierre por Mes</CardTitle>
            </CardHeader>
            <CardContent>
              {forecastLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : forecast.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No hay datos de proyeccion
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={forecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(value)}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalValue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Valor Total"
                    />
                    <Line
                      type="monotone"
                      dataKey="weightedValue"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Valor Ponderado"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Win/Loss Analysis */}
        <TabsContent value="winloss" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Trophy className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {winLoss?.winRate.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ganados</p>
                    <p className="text-2xl font-bold">
                      {winLoss?.wins.reduce((sum, w) => sum + w.count, 0) || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Target className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Perdidos</p>
                    <p className="text-2xl font-bold">
                      {winLoss?.losses.reduce((sum, l) => sum + l.count, 0) || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Razones de Perdida</CardTitle>
            </CardHeader>
            <CardContent>
              {winLossLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : !winLoss || winLoss.losses.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No hay datos de perdidas
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={winLoss.losses}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="reason" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" name="Cantidad" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitor Analysis */}
        <TabsContent value="competitors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analisis de Competencia</CardTitle>
            </CardHeader>
            <CardContent>
              {competitorsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : competitors.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No hay datos de competidores
                </div>
              ) : (
                <div className="space-y-4">
                  {competitors.map((comp) => (
                    <div
                      key={comp.competitor}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{comp.competitor}</p>
                        <p className="text-sm text-muted-foreground">
                          {comp.mentions} menciones
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">{comp.wins}</p>
                          <p className="text-xs text-muted-foreground">Ganados</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{comp.losses}</p>
                          <p className="text-xs text-muted-foreground">Perdidos</p>
                        </div>
                        <Badge
                          variant={comp.winRate >= 50 ? "default" : "secondary"}
                          className={
                            comp.winRate >= 50
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {comp.winRate.toFixed(0)}% Win Rate
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
