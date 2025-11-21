import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Package
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type ViewMode = "overview" | "upload" | "comparison" | "alerts";

export default function SalesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

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

  // Determinar qué empresas puede ver el usuario
  const canViewDura = user?.role === 'admin' || user?.companyId === 1;
  const canViewOrsega = user?.role === 'admin' || user?.companyId === 2;

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
            {/* KPIs Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Clientes Activos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">0</div>
                    <Users className="h-8 w-8 text-blue-500 opacity-20" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Con compras este mes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Volumen del Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">0</div>
                    <Package className="h-8 w-8 text-green-500 opacity-20" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCompany === 1 ? 'KG' : 'Unidades'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Crecimiento vs Año Anterior
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold">0%</div>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <BarChart3 className="h-8 w-8 text-emerald-500 opacity-20" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Mismo período 2024
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Alertas Activas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-amber-600">0</div>
                    <AlertTriangle className="h-8 w-8 text-amber-500 opacity-20" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Requieren atención
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sección de acciones rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-blue-200 hover:border-blue-300"
                onClick={() => setViewMode("comparison")}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-100">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Análisis Comparativo</CardTitle>
                      <CardDescription>Año actual vs anterior</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ver diferencial por cliente y detectar oportunidades de crecimiento
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-amber-200 hover:border-amber-300"
                onClick={() => setViewMode("alerts")}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-amber-100">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Alertas y Seguimiento</CardTitle>
                      <CardDescription>Clientes que requieren atención</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Clientes inactivos y con diferencial negativo significativo
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-200 hover:border-green-300"
                onClick={() => setViewMode("upload")}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-green-100">
                      <FileSpreadsheet className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Cargar Datos</CardTitle>
                      <CardDescription>Excel semanal de ventas</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Subir el reporte semanal de Mario para actualizar el análisis
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Placeholder para datos históricos disponibles */}
            <Card>
              <CardHeader>
                <CardTitle>Datos Históricos Disponibles</CardTitle>
                <CardDescription>
                  Información de ventas desde enero 2022
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Sube tu primer archivo Excel para comenzar
                  </p>
                  <p className="text-sm text-gray-500">
                    El sistema procesará automáticamente los datos y generará alertas
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Subir Excel Semanal</CardTitle>
              <CardDescription>
                Arrastra y suelta o haz clic para seleccionar el archivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Arrastra tu archivo aquí o haz clic para seleccionar
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Formatos soportados: .xlsx, .xls
                </p>
                <Button variant="outline">
                  Seleccionar Archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === "comparison" && (
          <Card>
            <CardHeader>
              <CardTitle>Análisis Comparativo</CardTitle>
              <CardDescription>
                Comparación año actual vs año anterior por cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No hay datos disponibles aún
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === "alerts" && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas Activas</CardTitle>
              <CardDescription>
                Clientes que requieren seguimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No hay alertas activas
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
