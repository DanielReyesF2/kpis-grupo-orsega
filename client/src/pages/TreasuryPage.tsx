import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useCompanyFilter } from "@/hooks/use-company-filter";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Users, History, Upload } from "lucide-react";

// Core components
import { VoucherKanbanBoard } from "@/components/treasury/vouchers/VoucherKanbanBoard";
import { PaymentCalendar } from "@/components/treasury/payments/PaymentCalendar";
import { PaymentHistory } from "@/components/treasury/PaymentHistory";
import { ManageSuppliersFlow } from "@/components/treasury/flows/ManageSuppliersFlow";
import { UploadInvoiceFlow } from "@/components/treasury/flows/UploadInvoiceFlow";
import { ExchangeRateDashboard } from "@/components/treasury/ExchangeRateDashboard";

type ViewMode = "main" | "suppliers" | "history" | "exchange-rates" | "upload";

export default function TreasuryPage() {
  const { toast } = useToast();
  const { selectedCompany } = useCompanyFilter();
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

  // Obtener comprobantes filtrados por empresa
  const { data: vouchers = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-vouchers", selectedCompany],
    staleTime: 30000,
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/payment-vouchers?companyId=${selectedCompany}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch vouchers');
      return await response.json();
    },
  });

  // Obtener pagos filtrados por empresa
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/treasury/payments", selectedCompany],
    staleTime: 0,
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/treasury/payments?companyId=${selectedCompany}`, {
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
            <Button variant="default" onClick={() => { setViewMode("main"); setLocation("/treasury"); }}>
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
          <div className="flex justify-end mb-4">
            <Button variant="default" onClick={() => { setViewMode("main"); setLocation("/treasury"); }}>
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

  // Vista de Subir Factura
  if (viewMode === "upload") {
    return (
      <AppLayout title="Tesorería - Registrar Factura">
        <UploadInvoiceFlow
          onBack={() => { setViewMode("main"); setLocation("/treasury"); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
          }}
        />
      </AppLayout>
    );
  }

  // Vista Principal
  return (
    <AppLayout title="Tesorería">
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Acciones de página */}
        <div className="flex justify-end gap-2">
            <Button variant="default" size="sm" onClick={() => setViewMode("upload")} className="bg-emerald-600 hover:bg-emerald-700">
              <Upload className="h-4 w-4 mr-2" />
              Subir Factura
            </Button>
            <Button variant="default" size="sm" onClick={() => setViewMode("suppliers")} className="bg-slate-700 hover:bg-slate-800">
              <Users className="h-4 w-4 mr-2" />
              Proveedores
            </Button>
            <Button variant="default" size="sm" onClick={() => setViewMode("history")} className="bg-slate-600 hover:bg-slate-700">
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
        </div>

        {/* Calendario de Pagos */}
        <PaymentCalendar payments={payments} />

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
