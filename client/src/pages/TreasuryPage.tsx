import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, DollarSign, TrendingUp, Plus, X, Users, ChevronDown, ChevronUp, FileUp, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { PendingTodayCard } from "@/components/treasury/PendingTodayCard";
import { UploadVoucherFlow } from "@/components/treasury/flows/UploadVoucherFlow";
import { PaymentsFlow } from "@/components/treasury/flows/PaymentsFlow";
import { IdrallUploadFlow } from "@/components/treasury/flows/IdrallUploadFlow";
import { ManageSuppliersFlow } from "@/components/treasury/flows/ManageSuppliersFlow";
import { ExchangeRateForm } from "@/components/treasury/common/ExchangeRateForm";
import { DofChart } from "@/components/dashboard/DofChart";
import { ExchangeRateCards } from "@/components/dashboard/ExchangeRateCards";
import { ScheduledPaymentsKanban } from "@/components/treasury/ScheduledPaymentsKanban";
import { InvoiceVerificationModal } from "@/components/treasury/modals/InvoiceVerificationModal";
import { InvoiceUploadWizard } from "@/components/treasury/modals/InvoiceUploadWizard";
import { PaymentHistory } from "@/components/treasury/PaymentHistory";

type ViewMode = "main" | "upload" | "vouchers" | "payments" | "exchange-rates" | "idrall" | "suppliers" | "history";

export default function TreasuryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Detectar ruta actual y establecer viewMode inicial
  useEffect(() => {
    if (location === "/treasury/exchange-rates") {
      setViewMode("exchange-rates");
    } else if (location === "/treasury") {
      // Redirigir /treasury a /treasury/vouchers por defecto
      setLocation("/treasury/vouchers");
      setViewMode("vouchers");
    } else if (location === "/treasury/vouchers") {
      setViewMode("vouchers");
    }
    // No cambiar viewMode si ya está en otro modo (upload, etc.)
  }, [location, setLocation]);
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Inicializar según la ruta actual
    if (location === "/treasury/exchange-rates") return "exchange-rates";
    if (location === "/treasury/vouchers" || location === "/treasury") return "vouchers";
    return "main";
  });
  const [showRateForm, setShowRateForm] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCompanyForUpload, setSelectedCompanyForUpload] = useState<number | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [showInvoiceVerificationModal, setShowInvoiceVerificationModal] = useState(false);
  const [invoiceVerificationData, setInvoiceVerificationData] = useState<any>(null);
  const [isKanbanExpanded, setIsKanbanExpanded] = useState(true);
  const [formSource, setFormSource] = useState<string | undefined>(undefined); // Para pre-seleccionar fuente desde tarjetas
  const [showInvoiceWizard, setShowInvoiceWizard] = useState(false); // Wizard de subida de facturas con selección de proveedor

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
      // Si la factura requiere verificación, abrir el modal
      if (data.requiresVerification && data.documentType === 'invoice') {
        console.log('📋 [Upload] Factura requiere verificación, abriendo modal...');
        console.log('📋 [Upload] Datos recibidos del servidor:', JSON.stringify({
          extractedSupplierName: data.analysis?.extractedSupplierName,
          extractedAmount: data.analysis?.extractedAmount,
          extractedCurrency: data.analysis?.extractedCurrency,
          extractedDueDate: data.analysis?.extractedDueDate,
          extractedDate: data.analysis?.extractedDate,
          extractedInvoiceNumber: data.analysis?.extractedInvoiceNumber,
          extractedTaxId: data.analysis?.extractedTaxId,
          supplierName: data.supplier?.name,
          supplierId: data.supplier?.id
        }, null, 2));
        setInvoiceVerificationData(data);
        setShowInvoiceVerificationModal(true);
        setIsUploadingInvoice(false);
        setShowUploadModal(false);
        return;
      }
      
      // Para otros tipos de documentos, comportamiento normal
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
      console.error('❌ [Upload] Error completo:', error);
      
      // Extraer mensaje de error más descriptivo
      let errorMessage = "No se pudo procesar el documento";
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Error al procesar documento",
        description: errorMessage,
        variant: "destructive",
        duration: 5000, // Mostrar por más tiempo
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
    staleTime: 0, // Refetch después de invalidación
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/treasury/payments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      
      // Normalizar datos: convertir snake_case a camelCase
      const normalizedData = data.map((payment: any) => ({
        ...payment,
        companyId: payment.company_id || payment.companyId,
        supplierId: payment.supplier_id || payment.supplierId,
        supplierName: payment.supplier_name || payment.supplierName,
        dueDate: payment.due_date || payment.dueDate,
        paymentDate: payment.payment_date || payment.paymentDate, // ✅ IMPORTANTE: paymentDate
        voucherId: payment.voucher_id || payment.voucherId,
        hydralFileUrl: payment.hydral_file_url || payment.hydralFileUrl,
        hydralFileName: payment.hydral_file_name || payment.hydralFileName,
        createdAt: payment.created_at || payment.createdAt,
        updatedAt: payment.updated_at || payment.updatedAt,
      }));
      
      console.log(`📊 [TreasuryPage] Payments normalizados: ${normalizedData.length}`, normalizedData);
      return normalizedData;
    },
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

  // Calcular pagos para semana actual (usando paymentDate, no dueDate)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  weekEnd.setHours(23, 59, 59, 999);
  
  const paymentsThisWeek = payments.filter((p) => {
    if (p.status === "paid" || p.status === "cancelled" || p.status === "payment_completed" || p.status === "closed") return false;
    
    // ✅ USAR paymentDate para organizar por semana, no dueDate
    const paymentDateStr = p.paymentDate || p.payment_date;
    if (!paymentDateStr) {
      // Si no hay paymentDate, usar dueDate como fallback (para pagos antiguos)
      const dueDateStr = p.dueDate || p.due_date;
      if (!dueDateStr) return false;
      const dueDate = new Date(dueDateStr);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= weekStart && dueDate <= weekEnd;
    }
    
    const paymentDate = new Date(paymentDateStr);
    if (isNaN(paymentDate.getTime())) {
      return false;
    }
    paymentDate.setHours(0, 0, 0, 0);
    return paymentDate >= weekStart && paymentDate <= weekEnd;
  });
  
  const totalThisWeek = paymentsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calcular conteo de REPs pendientes (misma lógica que el Kanban)
  const repsPendingCount = payments.filter((p) => 
    p.voucherId && p.status === 'voucher_uploaded'
  ).length;

  // Calcular pagos para siguiente semana (usando paymentDate)
  const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  nextWeekStart.setHours(0, 0, 0, 0);
  const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  nextWeekEnd.setHours(23, 59, 59, 999);
  
  const paymentsNextWeek = payments.filter((p) => {
    if (p.status === "paid" || p.status === "cancelled" || p.status === "payment_completed" || p.status === "closed") return false;
    
    // ✅ USAR paymentDate para organizar por semana
    const paymentDateStr = p.paymentDate || p.payment_date;
    if (!paymentDateStr) {
      // Si no hay paymentDate, usar dueDate como fallback
      const dueDateStr = p.dueDate || p.due_date;
      if (!dueDateStr) return false;
      const dueDate = new Date(dueDateStr);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
    }
    
    const paymentDate = new Date(paymentDateStr);
    if (isNaN(paymentDate.getTime())) return false;
    paymentDate.setHours(0, 0, 0, 0);
    return paymentDate >= nextWeekStart && paymentDate <= nextWeekEnd;
  });
  
  const totalNextWeek = paymentsNextWeek.reduce((sum, p) => sum + (p.amount || 0), 0);

  // REPs pendientes del día
  const pendingREPs = vouchers.filter((v) => {
    const voucherDate = new Date(v.createdAt);
    voucherDate.setHours(0, 0, 0, 0);
    const isToday = voucherDate.getTime() === today.getTime();
    const isPending = v.status === "factura_pagada" || 
                     v.status === "pendiente_complemento";
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
          {/* Header con botón volver */}
          <div className="flex items-center justify-start mb-2">
            <Button 
              onClick={() => {
                setLocation("/treasury/vouchers");
              }} 
              variant="ghost" 
              size="sm"
            >
              ← Volver a Comprobantes
            </Button>
          </div>

          {/* Tarjetas Comparativas de Tipos de Cambio */}
          <ExchangeRateCards 
            onUpdateRate={(source) => {
              setFormSource(source);
              setShowRateForm(true);
            }}
          />

          {/* Gráfica Histórica de Tipos de Cambio */}
          <DofChart />
        </div>

        {/* Modal de formulario para actualizar tipo de cambio - ÚNICO PUNTO DE ACCESO */}
        <ExchangeRateForm
          isOpen={showRateForm}
          onClose={() => {
            setShowRateForm(false);
            setFormSource(undefined);
          }}
          source={formSource}
        />
      </AppLayout>
    );
  }

  // Vista de Historial de Pagos
  if (viewMode === "history") {
    return (
      <AppLayout title="Tesorería - Historial de Pagos">
        <div className="p-6 max-w-[1400px] mx-auto space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2" style={{ color: '#111827', fontSize: '30px', fontWeight: 800 }}>Historial de Pagos</h1>
              <p className="text-base font-medium text-gray-700 dark:text-gray-300" style={{ color: '#374151' }}>
                Consulta todos los pagos completados y sus documentos
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setViewMode("vouchers")}
              className="font-semibold"
            >
              Volver a Cuentas por Pagar
            </Button>
          </div>
          <PaymentHistory />
        </div>
      </AppLayout>
    );
  }

  // Si estamos en /treasury o /treasury/vouchers, mostrar vista completa de comprobantes
  if (location === "/treasury" || location === "/treasury/vouchers" || viewMode === "vouchers") {
    return (
      <AppLayout title="Tesorería - Comprobantes de Pago">
        <div className="p-6 max-w-[1400px] mx-auto space-y-4">
          {/* Acción Principal: Subir Documento */}
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
              setShowInvoiceWizard(true); // Abrir wizard en lugar de modal directo
            }}
            onClick={() => setShowInvoiceWizard(true)}
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

          {/* Resumen Semanal - Tarjetas de Pagos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pagos Semana Actual */}
            <Card className="border border-border/50">
              <CardContent className="p-4">
                <div className="text-center">
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
              </CardContent>
            </Card>
            
            {/* Pagos Siguiente Semana */}
            <Card className="border border-border/50">
              <CardContent className="p-4">
                <div className="text-center">
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
              </CardContent>
            </Card>
          </div>

          {/* Kanban de Cuentas por Pagar - ÚNICO KANBAN */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-foreground">Cuentas por Pagar</h2>
                <PendingTodayCard 
                  count={repsPendingCount}
                  onViewAll={() => {
                    // Ya estamos en vouchers, el click puede hacer scroll o highlight la columna
                  }} 
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setViewMode("history")}
                className="font-semibold"
              >
                Ver Historial de Pagos
              </Button>
            </div>
            <ScheduledPaymentsKanban />
          </div>
        </div>

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
                    const isIdrall = file.name.toLowerCase().endsWith('.zip');
                    if (isIdrall) {
                      setSelectedCompanyForUpload(2);
                      setFilesToUpload(files);
                      setViewMode("idrall");
                      setShowUploadModal(false);
                    } else {
                      await handleDirectFileUpload(file, 2);
                    }
                  }
                }}
                onClick={() => {
                  setSelectedCompanyForUpload(2);
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
                      <h3 className="text-lg font-bold text-foreground mb-1">Grupo Orsega</h3>
                      <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir</p>
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
                  setSelectedCompanyForUpload(1);
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
                        src="/logo dura.jpg" 
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
                      <h3 className="text-lg font-bold text-foreground mb-1">Dura International</h3>
                      <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Analizando Factura */}
        <Dialog open={isUploadingInvoice || uploadInvoiceMutation.isPending} onOpenChange={(open) => {
          if (!open && (isUploadingInvoice || uploadInvoiceMutation.isPending)) {
            return;
          }
        }}>
          <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground text-center">
                Analizando Factura con IA
              </DialogTitle>
              <DialogDescription className="text-center">
                Por favor espera mientras procesamos el documento con OpenAI. Esto puede tomar unos segundos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-foreground">
                  Procesando documento con OpenAI...
                </p>
                <p className="text-sm text-muted-foreground">
                  Estamos extrayendo los datos de la factura (proveedor, monto, fechas, etc.).
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Esto puede tomar 10-30 segundos dependiendo del tamaño del archivo.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Verificación de Factura */}
        {showInvoiceVerificationModal && invoiceVerificationData && (
          <InvoiceVerificationModal
            isOpen={showInvoiceVerificationModal}
            onClose={() => {
              setShowInvoiceVerificationModal(false);
              setInvoiceVerificationData(null);
            }}
            invoiceData={invoiceVerificationData}
          />
        )}

        {/* Wizard de Subida de Facturas con selección de proveedor */}
        <InvoiceUploadWizard
          isOpen={showInvoiceWizard}
          onClose={() => setShowInvoiceWizard(false)}
          onUploadComplete={(data) => {
            if (data.requiresVerification) {
              setInvoiceVerificationData(data);
              setShowInvoiceVerificationModal(true);
            }
          }}
        />
      </AppLayout>
    );
  }

  // Vista principal (solo se usa si hay rutas adicionales)
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
            setShowInvoiceWizard(true); // Abrir wizard en lugar de modal directo
          }}
          onClick={() => setShowInvoiceWizard(true)}
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

        {/* Resumen Semanal - Solo mostrar estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pagos Semana Actual */}
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <div className="text-center">
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
            </CardContent>
          </Card>
          
          {/* Pagos Siguiente Semana */}
          <Card className="border border-border/50">
            <CardContent className="p-4">
              <div className="text-center">
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
            </CardContent>
          </Card>
        </div>

        {/* Otras Acciones Rápidas */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setViewMode("suppliers")}
          >
            <Users className="h-4 w-4 mr-2" />
            Proveedores
          </Button>
        </div>

        {/* Kanban de Cuentas por Pagar - Colapsable */}
        <Collapsible open={isKanbanExpanded} onOpenChange={setIsKanbanExpanded}>
          <Card className="border border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Cuentas por Pagar
                    </CardTitle>
                    <PendingTodayCard 
                      count={repsPendingCount}
                      onViewAll={() => setViewMode("vouchers")} 
                    />
                  </div>
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

      {/* Modal de Analizando Factura - No se puede cerrar mientras está procesando */}
      <Dialog open={isUploadingInvoice || uploadInvoiceMutation.isPending} onOpenChange={(open) => {
        // No permitir cerrar el modal mientras está procesando
        if (!open && (isUploadingInvoice || uploadInvoiceMutation.isPending)) {
          return;
        }
      }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground text-center">
              Analizando Factura con IA
            </DialogTitle>
            <DialogDescription className="text-center">
              Por favor espera mientras procesamos el documento con OpenAI. Esto puede tomar unos segundos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-foreground">
                Procesando documento con OpenAI...
              </p>
              <p className="text-sm text-muted-foreground">
                Estamos extrayendo los datos de la factura (proveedor, monto, fechas, etc.).
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Esto puede tomar 10-30 segundos dependiendo del tamaño del archivo.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Verificación de Factura */}
      {showInvoiceVerificationModal && invoiceVerificationData && (
        <InvoiceVerificationModal
          isOpen={showInvoiceVerificationModal}
          onClose={() => {
            setShowInvoiceVerificationModal(false);
            setInvoiceVerificationData(null);
          }}
          invoiceData={invoiceVerificationData}
        />
      )}

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

      {/* Wizard de Subida de Facturas con selección de proveedor */}
      <InvoiceUploadWizard
        isOpen={showInvoiceWizard}
        onClose={() => setShowInvoiceWizard(false)}
        onUploadComplete={(data) => {
          if (data.requiresVerification) {
            setInvoiceVerificationData(data);
            setShowInvoiceVerificationModal(true);
          }
        }}
      />
    </AppLayout>
  );
}
