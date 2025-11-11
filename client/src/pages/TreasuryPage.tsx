import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, DollarSign, TrendingUp, Plus, X, Users, ChevronDown, ChevronUp, FileUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { ExchangeRateCards } from "@/components/dashboard/ExchangeRateCards";
import { ScheduledPaymentsKanban } from "@/components/treasury/ScheduledPaymentsKanban";

type ViewMode = "main" | "upload" | "vouchers" | "payments" | "exchange-rates" | "idrall" | "suppliers";

export default function TreasuryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("main");
  const [showRateForm, setShowRateForm] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCompanyForUpload, setSelectedCompanyForUpload] = useState<number | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

  // Mutación para subir factura directamente
  const uploadInvoiceMutation = useMutation({
    mutationFn: async ({ file, payerCompanyId }: { file: File; payerCompanyId: number }) => {
      try {
        const formData = new FormData();
        formData.append('voucher', file); // El endpoint acepta 'voucher' como nombre del campo
        formData.append('payerCompanyId', payerCompanyId.toString());

        const token = localStorage.getItem("authToken");
        if (!token) {
          throw new Error("No se encontró token de autenticación");
        }

        console.log('📤 [Upload] Iniciando upload de archivo:', file.name, 'para empresa:', payerCompanyId);
        console.log('📤 [Upload] Token presente:', !!token);
        console.log('📤 [Upload] Token (primeros 20 chars):', token.substring(0, 20) + '...');
        
        // ⚠️ IMPORTANTE: Cuando se envía FormData, NO se debe establecer Content-Type manualmente
        // El navegador lo establecerá automáticamente con el boundary correcto
        const res = await fetch("/api/payment-vouchers/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // NO incluir Content-Type - el navegador lo establecerá automáticamente para FormData
          },
          body: formData,
        });

        console.log('📥 [Upload] Respuesta recibida:', res.status, res.statusText);

        // Leer el body de la respuesta una sola vez
        const contentType = res.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        
        let responseData: any;
        const text = await res.text();
        
        if (isJson && text) {
          try {
            responseData = JSON.parse(text);
          } catch (parseError) {
            console.error('❌ [Upload] Error parseando JSON de respuesta:', parseError);
            console.error('❌ [Upload] Texto recibido:', text.substring(0, 500));
            throw new Error(`Error al procesar respuesta del servidor: ${res.status} ${res.statusText}`);
          }
        } else {
          responseData = text ? { message: text } : { message: res.statusText };
        }

        if (!res.ok) {
          // Extraer el mensaje de error de manera más robusta
          let errorMessage = `Error ${res.status}: ${res.statusText}`;
          
          if (responseData) {
            // Intentar extraer el mensaje de diferentes campos posibles
            errorMessage = responseData.details || 
                          responseData.error || 
                          responseData.message || 
                          (typeof responseData === 'string' ? responseData : errorMessage);
            
            // Si es un objeto, intentar stringificarlo
            if (typeof responseData === 'object' && !responseData.details && !responseData.error && !responseData.message) {
              errorMessage = JSON.stringify(responseData);
            }
          }
          
          console.error('❌ [Upload] Error del servidor:', {
            status: res.status,
            statusText: res.statusText,
            response: responseData,
            errorMessage: errorMessage
          });
          
          throw new Error(errorMessage);
        }

        console.log('✅ [Upload] Upload exitoso:', responseData);
        return responseData;
      } catch (error) {
        console.error('❌ [Upload] Error en mutationFn:', error);
        // Si ya es un Error, re-lanzarlo
        if (error instanceof Error) {
          throw error;
        }
        // Si es otro tipo de error, convertirlo a Error
        throw new Error(error?.toString() || "Error desconocido al subir documento");
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      
      if (data.documentType === 'invoice' && data.scheduledPayment) {
        toast({
          title: "✅ Factura procesada exitosamente",
          description: data.message || "La cuenta por pagar ha sido creada automáticamente",
        });
      } else {
        toast({
          title: "✅ Documento procesado",
          description: "El documento ha sido procesado correctamente",
        });
      }
      
      setIsUploadingInvoice(false);
      setShowUploadModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al procesar documento",
        description: error.message || "No se pudo procesar el documento",
        variant: "destructive",
      });
      setIsUploadingInvoice(false);
    },
  });

  const handleDirectFileUpload = async (file: File, companyId: number) => {
    setIsUploadingInvoice(true);
    uploadInvoiceMutation.mutate({ file, payerCompanyId: companyId });
  };

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
        <div className="p-6 max-w-[1400px] mx-auto space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button onClick={() => setViewMode("main")} variant="ghost" size="sm">
              ← Volver
              </Button>
            <h1 className="text-2xl font-bold text-foreground">Tipos de Cambio</h1>
            <div className="w-20" /> {/* Spacer */}
            </div>

          {/* Botón de Actualizar Tipo de Cambio */}
          <Card className="border border-primary/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    Actualiza los tipos de cambio de MONEX, Santander o DOF
                  </p>
                  <p className="text-xs text-muted-foreground">
                    El DOF se actualiza automáticamente, pero puedes registrarlo manualmente si es necesario
                  </p>
                </div>
                <Button
                  onClick={() => setShowRateForm(true)}
                  size="default"
                  className="ml-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Tipo de Cambio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tarjetas Comparativas de Tipos de Cambio */}
          <ExchangeRateCards />

          {/* Gráfica Histórica de Tipos de Cambio */}
          <DofChart />
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
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isKanbanExpanded, setIsKanbanExpanded] = useState(false);

  return (
    <AppLayout title="Tesorería">
      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Acción Principal: Subir Documento - Más compacta */}
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
            setShowUploadModal(true);
          }}
          onClick={() => setShowUploadModal(true)}
          className={`relative border-2 border-dashed transition-all cursor-pointer ${
            dragOverUpload 
              ? "border-primary bg-primary/10 scale-[1.002] shadow-lg" 
              : "border-primary/30 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-all ${
                  dragOverUpload ? "bg-primary text-primary-foreground scale-110" : "bg-primary/10 text-primary"
                }`}>
                  <FileUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {dragOverUpload ? "Suelta aquí tus archivos" : "Subir Factura o Documento"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Facturas (PDF, XML, JPG, PNG, JPEG) o Archivos Idrall (PDF, ZIP)
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="ml-4">
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumen Semanal - Compacto y Colapsable */}
        <Collapsible open={isSummaryExpanded} onOpenChange={setIsSummaryExpanded}>
          <Card className="border border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Resumen Semanal
                  </CardTitle>
                  {isSummaryExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pagos Semana Actual */}
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {paymentsThisWeek.length}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      Pagos Semana Actual
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {format(weekStart, "dd MMM", { locale: es })} - {format(weekEnd, "dd MMM", { locale: es })}
                    </div>
                    <div className="text-base font-bold text-blue-700 dark:text-blue-500">
                      ${totalThisWeek.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  
                  {/* Pagos Siguiente Semana */}
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                      {paymentsNextWeek.length}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      Pagos Siguiente Semana
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {format(nextWeekStart, "dd MMM", { locale: es })} - {format(nextWeekEnd, "dd MMM", { locale: es })}
                    </div>
                    <div className="text-base font-bold text-green-700 dark:text-green-500">
                      ${totalNextWeek.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  
                  {/* Acciones Rápidas */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setViewMode("exchange-rates")}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Tipos de Cambio
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setViewMode("suppliers")}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Proveedores
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Pendientes del Día - En una sola fila compacta */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-onboarding="pending-cards">
          <PaymentsDueCard onViewAll={() => setViewMode("payments")} />
          <PendingTodayCard onViewAll={() => setViewMode("vouchers")} />
        </div>

        {/* Kanban de Cuentas por Pagar - Colapsable */}
        <Collapsible open={isKanbanExpanded} onOpenChange={setIsKanbanExpanded}>
          <Card className="border border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Cuentas por Pagar
                  </CardTitle>
                  {isKanbanExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScheduledPaymentsKanban />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
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
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  const file = files[0];
                  // Verificar si es un archivo Idrall (ZIP) o factura (PDF, XML, JPG, PNG, JPEG)
                  const isIdrall = file.name.toLowerCase().endsWith('.zip');
                  if (isIdrall) {
                    // Si es ZIP, usar el flujo Idrall
                    setSelectedCompanyForUpload(2);
                    setFilesToUpload(files);
                    setViewMode("idrall");
                    setShowUploadModal(false);
                  } else {
                    // Si es factura u otro documento, subir directamente
                    await handleDirectFileUpload(file, 2);
                  }
                }
              }}
              onClick={() => {
                setSelectedCompanyForUpload(2); // Grupo Orsega
                setShowUploadModal(false);
                // Abrir selector de archivo
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.xml,.jpg,.jpeg,.png,.zip';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const isIdrall = file.name.toLowerCase().endsWith('.zip');
                    if (isIdrall) {
                      setFilesToUpload([file]);
                      setViewMode("idrall");
                    } else {
                      await handleDirectFileUpload(file, 2);
                    }
                  }
                };
                input.click();
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
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  const file = files[0];
                  const isIdrall = file.name.toLowerCase().endsWith('.zip');
                  if (isIdrall) {
                    setSelectedCompanyForUpload(1);
                    setFilesToUpload(files);
                    setViewMode("idrall");
                    setShowUploadModal(false);
                  } else {
                    await handleDirectFileUpload(file, 1);
                  }
                }
              }}
              onClick={() => {
                setSelectedCompanyForUpload(1); // Dura International
                setShowUploadModal(false);
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.xml,.jpg,.jpeg,.png,.zip';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const isIdrall = file.name.toLowerCase().endsWith('.zip');
                    if (isIdrall) {
                      setFilesToUpload([file]);
                      setViewMode("idrall");
                    } else {
                      await handleDirectFileUpload(file, 1);
                    }
                  }
                };
                input.click();
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
