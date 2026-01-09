/**
 * Dashboard de Ventas - Rediseñado completamente con datos reales
 */

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Users, Target, X, Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Salesforce components
import { PageHeader } from "@/components/salesforce/layout/PageHeader";
import { LoadingState } from "@/components/salesforce/feedback/LoadingState";
import { ErrorState } from "@/components/salesforce/feedback/ErrorState";

// New components
import { SalesKPICard } from "./SalesKPICard";
import { formatCurrency, formatNumber } from "@/lib/sales-utils";
import { MonthlyTrendsChart } from "./MonthlyTrendsChart";
import { TopClientsTable } from "./TopClientsTable";
import { TopProductsTable } from "./TopProductsTable";
import { YearlyComparisonChart } from "./YearlyComparisonChart";
import { ClientTrendsTable } from "./ClientTrendsTable";

// KPIS Modal
import { SalesAnalyst } from "../analyst/SalesAnalyst";

interface SalesDashboardProps {
  companyId?: number;
}

export function SalesDashboard({ companyId }: SalesDashboardProps) {
  // Usar directamente companyId del prop (viene del contexto/URL)
  const resolvedCompanyId = companyId || 1;

  // Hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para el modal de KPIS
  const [showKPIsModal, setShowKPIsModal] = useState(false);

  // Estado para el modal de Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch sales stats for KPIs
  const { data: salesStats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['/api/sales-stats', resolvedCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-stats?companyId=${resolvedCompanyId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch sales stats: ${res.statusText}`);
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch monthly trends to calculate total revenue
  const { data: monthlyTrends } = useQuery({
    queryKey: ['/api/sales-monthly-trends', resolvedCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sales-monthly-trends?companyId=${resolvedCompanyId}`);
      if (!res.ok) {
        return [];
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate total revenue from monthly trends
  const totalRevenue = monthlyTrends?.reduce((sum: number, month: any) => sum + (month.amount || 0), 0) || 0;

  // Calculate growth percentage
  const growthPercent = salesStats?.growth || 0;

  // Mutación para subir archivo Excel
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', resolvedCompanyId.toString());

      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No se encontró token de autenticación");
      }

      const res = await fetch("/api/sales/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.details || errorData.error || 'Error al subir el archivo');
      }

      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Archivo procesado exitosamente",
        description: `Se procesaron ${data.recordsProcessed} registros de ventas`,
        variant: "default",
      });

      // Limpiar archivo seleccionado
      setSelectedFile(null);

      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ['/api/sales-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comparison'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-monthly-trends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-top-clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-alerts'] });

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        setShowUploadModal(false);
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al subir archivo",
        description: error.message || "Ocurrió un error al procesar el archivo",
        variant: "destructive",
      });
    },
  });

  // Handlers para drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Formato no válido",
          description: "Solo se permiten archivos Excel (.xlsx, .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Formato no válido",
          description: "Solo se permiten archivos Excel (.xlsx, .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleUpload = useCallback(() => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Selecciona un archivo antes de subirlo",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(selectedFile);
  }, [selectedFile, uploadMutation, toast]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        objectIcon={TrendingUp}
        title="Dashboard de Ventas"
        subtitle="Vista general de pipeline, objetivos y distribución de ventas"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/sales' },
          { label: 'Dashboard' },
        ]}
        actions={[
          {
            label: "Actualizar Ventas",
            onClick: () => {
              setShowUploadModal(true);
            },
            variant: "outline" as const,
            icon: Upload,
            primary: false
          },
          {
            label: "KPIS",
            onClick: () => {
              setShowKPIsModal(true);
            },
            variant: "default" as const,
            icon: Target,
            primary: true
          }
        ]}
      />

      {/* KPIs Principales - Grid 4 columnas */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : statsError ? (
        <ErrorState variant="page" message="Error al cargar métricas de ventas" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SalesKPICard
            title="Revenue Total"
            value={formatCurrency(totalRevenue, resolvedCompanyId)}
            subtitle={`${formatNumber(salesStats?.currentVolume || 0)} ${salesStats?.unit || 'KG'} vendidos`}
            icon={DollarSign}
            trend={growthPercent !== undefined ? {
              value: growthPercent,
              label: "vs período anterior"
            } : undefined}
            variant="success"
          />
          <SalesKPICard
            title="Clientes Activos"
            value={salesStats?.activeClients || 0}
            subtitle={`${salesStats?.activeClientsMetrics?.last3Months || 0} últimos 3 meses`}
            icon={Users}
            variant="default"
          />
          <SalesKPICard
            title="Crecimiento"
            value={`${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%`}
            subtitle="vs período anterior"
            icon={TrendingUp}
            variant={growthPercent >= 0 ? "success" : "danger"}
          />
          <SalesKPICard
            title="Retención"
            value={`${(salesStats?.retentionRate?.rate || 0).toFixed(1)}%`}
            subtitle={`${salesStats?.retentionRate?.retainedClients || 0} clientes retenidos`}
            icon={Target}
            variant="default"
          />
        </div>
      )}

      {/* Comparativo Anual */}
      <YearlyComparisonChart companyId={resolvedCompanyId} />

      {/* Top Clientes y Top Productos - Grid 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopClientsTable companyId={resolvedCompanyId} limit={10} period="year" />
        <TopProductsTable companyId={resolvedCompanyId} limit={10} period="year" />
      </div>

      {/* Tendencias Mensuales */}
      <MonthlyTrendsChart companyId={resolvedCompanyId} />

      {/* Tendencias de Clientes */}
      <ClientTrendsTable companyId={resolvedCompanyId} limit={10} />

      {/* Modal de KPIS - Pantalla completa */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ease-out ${
          showKPIsModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Pantalla completa */}
        <div
          className={`absolute inset-0 bg-slate-50 overflow-y-auto transition-all duration-300 ease-out ${
            showKPIsModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          {/* Header fijo */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">KPIs de Ventas</h1>
                <p className="text-sm text-slate-500">Análisis estratégico 2024-2025</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowKPIsModal(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cerrar
            </Button>
          </div>

          {/* Contenido del modal */}
          <div className="p-6 max-w-7xl mx-auto">
            {showKPIsModal && <SalesAnalyst companyId={resolvedCompanyId} embedded={true} />}
          </div>
        </div>
      </div>

      {/* Modal de Upload - Actualizar Ventas */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ease-out ${
          showUploadModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            showUploadModal ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => {
            if (!uploadMutation.isPending) {
              setShowUploadModal(false);
              setSelectedFile(null);
            }
          }}
        />

        {/* Panel central - Modal de Upload */}
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
            showUploadModal ? '-translate-y-1/2 opacity-100' : '-translate-y-1/2 opacity-0 scale-95'
          }`}
        >
          {/* Header */}
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Actualizar Ventas</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Sube el reporte de IDRALL</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!uploadMutation.isPending) {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }
              }}
              disabled={uploadMutation.isPending}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Contenido del modal - Dropzone */}
          <div className="p-6">
            {/* Input oculto para selección de archivo */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Área de Drag & Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-all duration-200 ease-out
                ${isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : selectedFile
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }
                ${uploadMutation.isPending ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              {uploadMutation.isPending ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                    Procesando archivo...
                  </p>
                  <p className="text-sm text-slate-500">
                    Esto puede tomar unos segundos
                  </p>
                </div>
              ) : uploadMutation.isSuccess ? (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="text-lg font-medium text-green-700 dark:text-green-400">
                    ¡Archivo procesado exitosamente!
                  </p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="h-12 w-12 text-green-500" />
                  <div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="text-slate-500 hover:text-red-500"
                  >
                    Cambiar archivo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className={`h-12 w-12 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                      {isDragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo Excel aquí'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      o haz clic para seleccionar
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Formatos aceptados: .xlsx, .xls (máx 20MB)
                  </p>
                </div>
              )}
            </div>

            {/* Botones de acción */}
            {!uploadMutation.isSuccess && (
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  disabled={uploadMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Archivo
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Información adicional */}
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Instrucciones:
              </h4>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Descarga el reporte de ventas desde el CRM IDRALL</li>
                <li>• Asegúrate de que el archivo esté en formato Excel (.xlsx)</li>
                <li>• El sistema procesará automáticamente los datos</li>
                <li>• Los dashboards se actualizarán inmediatamente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
