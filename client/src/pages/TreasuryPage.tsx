import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, DollarSign, TrendingUp, BarChart3, RefreshCw, Plus, FolderOpen, X, Users } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { PendingTodayCard } from "@/components/treasury/PendingTodayCard";
import { PaymentsDueCard } from "@/components/treasury/PaymentsDueCard";
import { UploadVoucherFlow } from "@/components/treasury/flows/UploadVoucherFlow";
import { ManageVouchersFlow } from "@/components/treasury/flows/ManageVouchersFlow";
import { PaymentsFlow } from "@/components/treasury/flows/PaymentsFlow";
import { IdrallUploadFlow } from "@/components/treasury/flows/IdrallUploadFlow";
import { ManageSuppliersFlow } from "@/components/treasury/flows/ManageSuppliersFlow";
import { ExchangeRateForm } from "@/components/treasury/common/ExchangeRateForm";
import { DofChart } from "@/components/dashboard/DofChart";

type ViewMode = "main" | "upload" | "vouchers" | "payments" | "exchange-rates" | "idrall" | "suppliers";

export default function TreasuryPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [showRateForm, setShowRateForm] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCompanyForUpload, setSelectedCompanyForUpload] = useState<number | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  // Estadísticas del mes
  const { data: vouchers = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-vouchers"],
    staleTime: 30000,
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/treasury/payments"],
    staleTime: 30000,
  });

  // Calcular estadísticas del mes
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const vouchersThisMonth = vouchers.filter((v) => {
    const date = new Date(v.createdAt);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const paymentsThisMonth = payments.filter((p) => {
    const date = new Date(p.createdAt || p.created_at || p.dueDate || p.due_date || new Date());
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const totalVouchers = vouchersThisMonth.length;
  const completedVouchers = vouchersThisMonth.filter(
    (v) => v.status === "cierre_contable" || v.status === "factura_pagada"
  ).length;
  const totalPayments = paymentsThisMonth.length;
  const paidPayments = paymentsThisMonth.filter((p) => p.status === "paid").length;

  // Calcular pagos para semana actual
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  
  const paymentsThisWeek = payments.filter((p) => {
    if (p.status === "paid" || p.status === "cancelled") return false;
    const dueDateStr = p.due_date || p.dueDate;
    if (!dueDateStr) return false;
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate >= weekStart && dueDate <= weekEnd;
  });
  
  const totalThisWeek = paymentsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calcular pagos para siguiente semana
  const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  
  const paymentsNextWeek = payments.filter((p) => {
    if (p.status === "paid" || p.status === "cancelled") return false;
    const dueDateStr = p.due_date || p.dueDate;
    if (!dueDateStr) return false;
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
  });
  
  const totalNextWeek = paymentsNextWeek.reduce((sum, p) => sum + (p.amount || 0), 0);

  // REPs pendientes del día
  const pendingREPs = vouchers.filter((v) => {
    const voucherDate = new Date(v.createdAt);
    voucherDate.setHours(0, 0, 0, 0);
    const isToday = voucherDate.getTime() === today.getTime();
    const isPending = v.status === "pendiente_validacion" || 
                     v.status === "pendiente_complemento" ||
                     v.status === "pendiente_asociacion";
    return isToday && isPending;
  });

  // Si estamos en un modo específico, mostrar ese flujo
  if (viewMode === "upload") {
    return (
      <AppLayout title="Tesorería - Subir Comprobante">
        <UploadVoucherFlow 
          onBack={() => {
            setViewMode("main");
            setSelectedCompanyForUpload(null);
          }}
          preselectedCompanyId={selectedCompanyForUpload}
        />
      </AppLayout>
    );
  }

  if (viewMode === "vouchers") {
    return (
      <AppLayout title="Tesorería - Comprobantes">
        <ManageVouchersFlow onBack={() => setViewMode("main")} />
      </AppLayout>
    );
  }

  if (viewMode === "payments") {
        return (
      <AppLayout title="Tesorería - Pagos">
        <PaymentsFlow onBack={() => setViewMode("main")} />
      </AppLayout>
    );
  }

  if (viewMode === "idrall") {
    return (
      <AppLayout title="Tesorería - Importar desde Idrall">
        <IdrallUploadFlow 
          onBack={() => {
            setViewMode("main");
            setSelectedCompanyForUpload(null);
            setFilesToUpload([]);
          }}
          preselectedCompanyId={selectedCompanyForUpload}
          preselectedFiles={filesToUpload}
        />
      </AppLayout>
    );
  }

  if (viewMode === "suppliers") {
    return (
      <AppLayout title="Tesorería - Proveedores">
        <ManageSuppliersFlow onBack={() => setViewMode("main")} />
      </AppLayout>
    );
  }

  if (viewMode === "exchange-rates") {
  return (
      <AppLayout title="Tesorería - Tipos de Cambio">
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button onClick={() => setViewMode("main")} variant="ghost" size="lg">
              ← Volver
              </Button>
            <h1 className="text-3xl font-bold text-foreground">Tipos de Cambio</h1>
            <div className="w-24" /> {/* Spacer */}
            </div>

          {/* Comparativa de Tipos de Cambio */}
          <DofChart />

          <Card className="border-2 border-primary/20 shadow-lg">
              <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                Registrar Nuevo Tipo de Cambio
                </CardTitle>
              </CardHeader>
            <CardContent>
              <p className="text-base text-muted-foreground mb-6">
                Actualiza los tipos de cambio de MONEX, Santander o DOF. El DOF se actualiza automáticamente, pero puedes registrarlo manualmente si es necesario.
              </p>
                <Button
                onClick={() => setShowRateForm(true)}
                  size="lg"
                className="h-16 text-lg font-semibold"
              >
                <Plus className="h-6 w-6 mr-2" />
                Registrar Tipo de Cambio
                </Button>
              </CardContent>
            </Card>
                </div>

        {/* Modal de formulario para actualizar tipo de cambio */}
        <ExchangeRateForm
          isOpen={showRateForm}
          onClose={() => setShowRateForm(false)}
        />
      </AppLayout>
    );
  }

  // Vista principal
                        return (
    <AppLayout title="Tesorería">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Área de Drag & Drop para Cuentas por Pagar (Idrall) - Paso 1 */}
        <Card 
          data-onboarding="create-cxp"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverUpload(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverUpload(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverUpload(false);
            // No procesar archivos aquí, solo abrir el modal para seleccionar empresa
            setShowUploadModal(true);
          }}
          onClick={() => setShowUploadModal(true)}
          className={`relative border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
            dragOverUpload 
              ? "border-primary bg-primary/10 scale-[1.005] shadow-lg" 
              : "border-primary/30 hover:border-primary/50 hover:bg-primary/5 shadow-sm hover:shadow-md"
          }`}
        >
          {/* Badge de número */}
          <div className="absolute top-4 left-4 bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-md">
            1
          </div>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <Upload className={`h-12 w-12 transition-all ${
                dragOverUpload ? "text-primary scale-105" : "text-primary/70"
              }`} />
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">
                  {dragOverUpload ? "Suelta aquí tus archivos" : "Crear Cuentas por Pagar"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Archivos Idrall (PDF, ZIP) para crear CxP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sección 1: Pendientes del Día */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-onboarding="pending-cards">
          <PaymentsDueCard onViewAll={() => setViewMode("payments")} />
          <PendingTodayCard onViewAll={() => setViewMode("vouchers")} />
        </div>

        {/* Sección 2: Acciones Rápidas */}
        <Card className="border-2 border-primary/20 shadow-lg" data-onboarding="quick-actions">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-foreground">
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Button
                onClick={() => setViewMode("upload")}
                  size="lg"
                className="h-20 text-lg font-semibold flex flex-col items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Upload className="h-8 w-8" />
                Subir Comprobante
                    </Button>
                    <Button
                onClick={() => setViewMode("vouchers")}
                size="lg"
                                variant="outline"
                className="h-20 text-lg font-semibold flex flex-col items-center justify-center gap-2 border-2 hover:bg-primary/10 transition-all"
              >
                <FileText className="h-8 w-8" />
                Ver Comprobantes
                    </Button>
                <Button
                onClick={() => setViewMode("payments")}
                size="lg"
                                variant="outline"
                className="h-20 text-lg font-semibold flex flex-col items-center justify-center gap-2 border-2 hover:bg-primary/10 transition-all"
                  >
                <DollarSign className="h-8 w-8" />
                Ver Pagos
                </Button>
                <Button
                onClick={() => setViewMode("exchange-rates")}
                size="lg"
                                variant="outline"
                className="h-20 text-lg font-semibold flex flex-col items-center justify-center gap-2 border-2 hover:bg-primary/10 transition-all"
              >
                <TrendingUp className="h-8 w-8" />
                Tipo de Cambio
              </Button>
                <Button
                onClick={() => setViewMode("suppliers")}
                size="lg"
                                variant="outline"
                className="h-20 text-lg font-semibold flex flex-col items-center justify-center gap-2 border-2 hover:bg-primary/10 transition-all"
              >
                <Users className="h-8 w-8" />
                Proveedores
              </Button>
                </div>
              </CardContent>
            </Card>

        {/* Sección 3: Resumen del Mes */}
        <Card className="border-2 border-primary/20 shadow-lg">
                <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Resumen del Mes
                      </CardTitle>
                </CardHeader>
                <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Pagos Semana Actual */}
              <div className="relative text-center p-6 bg-blue-100 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700 shadow-sm hover:shadow-md transition-all">
                <div className="absolute top-3 left-3 bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold shadow-sm z-10">
                  1
                </div>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2 pt-6">
                  {paymentsThisWeek.length}
                </div>
                <div className="text-base font-semibold text-foreground">
                  Pagos Semana Actual
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(weekStart, "dd MMM", { locale: es })} - {format(weekEnd, "dd MMM", { locale: es })}
                </div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-500 mt-2">
                  ${totalThisWeek.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              
              {/* Pagos Siguiente Semana */}
              <div className="relative text-center p-6 bg-green-100 dark:bg-green-900/20 rounded-lg border-2 border-green-300 dark:border-green-700 shadow-sm hover:shadow-md transition-all">
                <div className="absolute top-3 left-3 bg-green-600 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold shadow-sm z-10">
                  2
                </div>
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2 pt-6">
                  {paymentsNextWeek.length}
                </div>
                <div className="text-base font-semibold text-foreground">
                  Pagos Siguiente Semana
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(nextWeekStart, "dd MMM", { locale: es })} - {format(nextWeekEnd, "dd MMM", { locale: es })}
                </div>
                <div className="text-lg font-bold text-green-700 dark:text-green-500 mt-2">
                  ${totalNextWeek.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              
              {/* REPs Pendientes */}
              <div className="relative text-center p-6 bg-orange-100 dark:bg-orange-900/20 rounded-lg border-2 border-orange-300 dark:border-orange-700 shadow-sm hover:shadow-md transition-all">
                <div className="absolute top-3 left-3 bg-orange-600 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold shadow-sm z-10">
                  3
                </div>
                <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2 pt-6">
                  {pendingREPs.length}
                </div>
                <div className="text-base font-semibold text-foreground">
                  REPs Pendientes
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Del día de hoy
                </div>
              </div>
                          </div>
                        </CardContent>
                      </Card>
                  </div>

      {/* Modal de formulario para actualizar tipo de cambio */}
      <ExchangeRateForm
        isOpen={showRateForm}
        onClose={() => setShowRateForm(false)}
      />

      {/* Modal de Upload por Empresa */}
      <Dialog open={showUploadModal} onOpenChange={(open) => setShowUploadModal(open)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground text-center">
              Selecciona la empresa
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Grupo Orsega */}
            <Card
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  setSelectedCompanyForUpload(2); // Grupo Orsega
                  setFilesToUpload(files);
                  setViewMode("idrall");
                  setShowUploadModal(false);
                }
              }}
              onClick={() => {
                setSelectedCompanyForUpload(2); // Grupo Orsega
                setViewMode("idrall");
                setShowUploadModal(false);
              }}
              className="relative border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
            >
              <CardContent className="p-0">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <img 
                      src="/logo orsega.jpg" 
                      alt="Grupo Orsega Logo" 
                      className="h-20 w-auto object-contain"
                      style={{ maxWidth: '150px' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      Grupo Orsega
                    </h3>
                    <p className="text-base text-muted-foreground mb-3 font-semibold">
                      Suelta aquí tus archivos
                    </p>
                    <Upload className="h-10 w-10 mx-auto text-blue-500" />
                </div>
              </div>
                </CardContent>
              </Card>

            {/* Dura International */}
            <Card
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  setSelectedCompanyForUpload(1); // Dura International
                  setFilesToUpload(files);
                  setViewMode("idrall");
                  setShowUploadModal(false);
                }
              }}
              onClick={() => {
                setSelectedCompanyForUpload(1); // Dura International
                setViewMode("idrall");
                setShowUploadModal(false);
              }}
              className="relative border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all"
            >
              <CardContent className="p-0">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <img 
                      src="/logodura.jpg" 
                      alt="Dura International Logo" 
                      className="h-20 w-auto object-contain"
                      style={{ maxWidth: '150px' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                                </div>
                                <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      Dura International
                    </h3>
                    <p className="text-base text-muted-foreground mb-3 font-semibold">
                      Suelta aquí tus archivos
                    </p>
                    <Upload className="h-10 w-10 mx-auto text-green-500" />
                                  </div>
                  </div>
                </CardContent>
              </Card>
                </div>
              </DialogContent>
            </Dialog>

    </AppLayout>
  );
}
