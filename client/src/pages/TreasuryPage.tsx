import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, History, FileText, DollarSign } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { es } from "date-fns/locale";


// Core components
import { VoucherKanbanBoard } from "@/components/treasury/vouchers/VoucherKanbanBoard";
import { PaymentHistory } from "@/components/treasury/PaymentHistory";
import { ManageSuppliersFlow } from "@/components/treasury/flows/ManageSuppliersFlow";
import { ExchangeRateDashboard } from "@/components/treasury/ExchangeRateDashboard";

type ViewMode = "main" | "suppliers" | "history" | "exchange-rates";

export default function TreasuryPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Detectar vista basada en URL
  const getInitialView = (): ViewMode => {
    if (location.includes("/exchange-rates")) return "exchange-rates";
    if (location.includes("/vouchers")) return "main";
    return "main";
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialView);

  // Sincronizar viewMode con URL
  useEffect(() => {
    setViewMode(getInitialView());
  }, [location]);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);

  // Función para actualizar tipos de cambio
  const handleRefreshExchangeRates = async () => {
    setIsRefreshingRates(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/treasury/exchange-rates/refresh-dof", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Error al actualizar tipos de cambio");
      }

      const data = await response.json();
      toast({
        title: "✅ Tipos de cambio actualizados",
        description: data.message || "Se actualizaron los tipos de cambio del DOF",
      });

      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/exchange-rates"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron actualizar los tipos de cambio",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingRates(false);
    }
  };

  // Obtener comprobantes
  const { data: vouchers = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-vouchers"],
    staleTime: 30000,
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/payment-vouchers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch vouchers');
      return await response.json();
    },
  });

  // Obtener pagos
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/treasury/payments"],
    staleTime: 0,
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/treasury/payments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();

      return data.map((payment: any) => ({
        ...payment,
        companyId: payment.company_id || payment.companyId,
        supplierId: payment.supplier_id || payment.supplierId,
        supplierName: payment.supplier_name || payment.supplierName,
        dueDate: payment.due_date || payment.dueDate,
        paymentDate: payment.payment_date || payment.paymentDate,
        voucherId: payment.voucher_id || payment.voucherId,
        createdAt: payment.created_at || payment.createdAt,
      }));
    },
  });

  // Calcular estadísticas de la semana
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

  // Estados sincronizados con ScheduledPaymentsKanban
  const PENDING_STATUSES = ['idrall_imported', 'pending_approval', 'approved', 'payment_scheduled', 'payment_pending', 'pago_programado', 'pending'];
  // Los pagos con voucher ya subido no deben mostrarse en las tarjetas de semana
  // porque ya aparecen en el Kanban en "Pendiente REP" o "Cierre Contable"

  const paymentsThisWeek = payments.filter((p) => {
    // Solo mostrar pagos que están pendientes de pagar (sin voucher aún)
    if (!PENDING_STATUSES.includes(p.status)) return false;
    const dateStr = p.paymentDate || p.dueDate;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date >= weekStart && date <= weekEnd;
  });

  const paymentsNextWeek = payments.filter((p) => {
    // Solo mostrar pagos que están pendientes de pagar (sin voucher aún)
    if (!PENDING_STATUSES.includes(p.status)) return false;
    const dateStr = p.paymentDate || p.dueDate;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date >= nextWeekStart && date <= nextWeekEnd;
  });

  const totalThisWeek = paymentsThisWeek.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalNextWeek = paymentsNextWeek.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Vista de Proveedores
  if (viewMode === "suppliers") {
    return (
      <AppLayout title="Tesorería - Proveedores">
        <ManageSuppliersFlow onBack={() => { setViewMode("main"); setLocation("/treasury"); }} />
      </AppLayout>
    );
  }

  // Vista de Historial
  if (viewMode === "history") {
    return (
      <AppLayout title="Tesorería - Historial de Pagos">
        <div className="p-6 max-w-[1400px] mx-auto space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Historial de Pagos</h1>
              <p className="text-sm text-muted-foreground">
                Consulta todos los pagos completados y sus documentos
              </p>
            </div>
            <Button variant="outline" onClick={() => { setViewMode("main"); setLocation("/treasury"); }}>
              ← Volver
            </Button>
          </div>
          <PaymentHistory />
        </div>
      </AppLayout>
    );
  }

  // Vista de Tipos de Cambio
  if (viewMode === "exchange-rates") {
    return (
      <AppLayout title="Tesorería - Tipos de Cambio">
        <div className="p-6 max-w-[1400px] mx-auto space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tipos de Cambio</h1>
              <p className="text-sm text-muted-foreground">
                USD/MXN - Actualización diaria
              </p>
            </div>
            <Button variant="outline" onClick={() => { setViewMode("main"); setLocation("/treasury"); }}>
              ← Volver
            </Button>
          </div>
          <ExchangeRateDashboard
            onRefreshDOF={handleRefreshExchangeRates}
            isRefreshingDOF={isRefreshingRates}
          />
        </div>
      </AppLayout>
    );
  }

  // Vista Principal
  return (
    <AppLayout title="Tesorería">
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Acciones de página */}
        <div className="flex justify-end gap-2">
            <Button variant="default" size="sm" onClick={() => setViewMode("suppliers")}>
              <Users className="h-4 w-4 mr-2" />
              Proveedores
            </Button>
            <Button variant="default" size="sm" onClick={() => setViewMode("history")}>
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
        </div>

        {/* Resumen Semanal con lista de pagos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Semana Actual */}
          <Card className="bg-white border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">
                    Semana Actual ({format(weekStart, "dd MMM", { locale: es })} - {format(weekEnd, "dd MMM", { locale: es })})
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-slate-900">
                      {paymentsThisWeek.length} pagos
                    </p>
                    <p className="text-sm font-medium text-emerald-600">
                      ${totalThisWeek.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
              {/* Lista de pagos */}
              {paymentsThisWeek.length > 0 ? (
                <div className="space-y-2">
                  {paymentsThisWeek.slice(0, 5).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{payment.supplierName}</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(payment.paymentDate || payment.dueDate), "dd MMM", { locale: es })}
                        </p>
                      </div>
                      <p className="font-bold text-slate-800">
                        ${(payment.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {paymentsThisWeek.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      Ver {paymentsThisWeek.length - 5} más →
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No hay pagos esta semana</p>
              )}
            </CardContent>
          </Card>

          {/* Siguiente Semana */}
          <Card className="bg-white border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">
                    Siguiente Semana ({format(nextWeekStart, "dd MMM", { locale: es })} - {format(nextWeekEnd, "dd MMM", { locale: es })})
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-slate-900">
                      {paymentsNextWeek.length} pagos
                    </p>
                    <p className="text-sm font-medium text-blue-600">
                      ${totalNextWeek.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
              {/* Lista de pagos */}
              {paymentsNextWeek.length > 0 ? (
                <div className="space-y-2">
                  {paymentsNextWeek.slice(0, 5).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{payment.supplierName}</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(payment.paymentDate || payment.dueDate), "dd MMM", { locale: es })}
                        </p>
                      </div>
                      <p className="font-bold text-slate-800">
                        ${(payment.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {paymentsNextWeek.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                      Ver {paymentsNextWeek.length - 5} más →
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No hay pagos la próxima semana</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kanban de Comprobantes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Comprobantes de Pago</h2>
          </div>
          <VoucherKanbanBoard
            vouchers={vouchers.map((v: any) => ({
              id: v.id,
              companyId: v.companyId || v.company_id,
              payerCompanyId: v.payerCompanyId || v.payer_company_id,
              clientId: v.clientId || v.client_id,
              clientName: v.clientName || v.client_name,
              status: v.status || 'factura_pagada',
              voucherFileUrl: v.voucherFileUrl || v.voucher_file_url,
              voucherFileName: v.voucherFileName || v.voucher_file_name,
              extractedAmount: v.extractedAmount || v.extracted_amount,
              extractedDate: v.extractedDate || v.extracted_date,
              extractedBank: v.extractedBank || v.extracted_bank,
              extractedReference: v.extractedReference || v.extracted_reference,
              extractedCurrency: v.extractedCurrency || v.extracted_currency,
              extractedBeneficiaryName: v.extractedBeneficiaryName || v.extracted_beneficiary_name,
              ocrConfidence: v.ocrConfidence || v.ocr_confidence,
              notes: v.notes,
              createdAt: v.createdAt || v.created_at,
            }))}
          />
        </div>
      </div>

    </AppLayout>
  );
}
