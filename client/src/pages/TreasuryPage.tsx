import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { PendingTodayCard } from "@/components/treasury/PendingTodayCard";
import { PaymentsDueCard } from "@/components/treasury/PaymentsDueCard";
import { UploadVoucherFlow } from "@/components/treasury/flows/UploadVoucherFlow";
import { ManageVouchersFlow } from "@/components/treasury/flows/ManageVouchersFlow";
import { PaymentsFlow } from "@/components/treasury/flows/PaymentsFlow";

type ViewMode = "main" | "upload" | "vouchers" | "payments";

export default function TreasuryPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("main");

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

  // Si estamos en un modo específico, mostrar ese flujo
  if (viewMode === "upload") {
    return (
      <AppLayout title="Tesorería - Subir Comprobante">
        <UploadVoucherFlow onBack={() => setViewMode("main")} />
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

  // Vista principal
  return (
    <AppLayout title="Tesorería">
      <div className="p-6 max-w-[1400px] mx-auto space-y-8">
        {/* Header de Bienvenida */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Hola {user?.name?.split(" ")[0] || "Lolita"}
          </h1>
          <p className="text-lg text-muted-foreground">
            Centro de trabajo de Tesorería
          </p>
              </div>

        {/* Sección 1: Pendientes del Día */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingTodayCard onViewAll={() => setViewMode("vouchers")} />
          <PaymentsDueCard onViewAll={() => setViewMode("payments")} />
            </div>

        {/* Sección 2: Acciones Rápidas */}
        <Card className="border-2 border-primary/20 shadow-lg">
              <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground">
              Acciones Rápidas
                </CardTitle>
              </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button
                onClick={() => setViewMode("upload")}
                  size="lg"
                className="h-20 text-lg font-semibold flex flex-col items-center justify-center gap-2 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-primary/10 rounded-lg border-2 border-primary/20">
                <div className="text-4xl font-bold text-primary mb-2">
                  {totalVouchers}
                        </div>
                <div className="text-base font-semibold text-foreground">
                  Comprobantes
                        </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Este mes
                      </div>
                        </div>
              <div className="text-center p-6 bg-green-100 dark:bg-green-900/20 rounded-lg border-2 border-green-300 dark:border-green-700">
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {completedVouchers}
                        </div>
                <div className="text-base font-semibold text-foreground">
                  Completados
                      </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {totalVouchers > 0
                    ? Math.round((completedVouchers / totalVouchers) * 100)
                    : 0}%
                        </div>
                        </div>
              <div className="text-center p-6 bg-blue-100 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {totalPayments}
                      </div>
                <div className="text-base font-semibold text-foreground">
                  Pagos Programados
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Este mes
                  </div>
                  </div>
              <div className="text-center p-6 bg-purple-100 dark:bg-purple-900/20 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  {paidPayments}
                </div>
                <div className="text-base font-semibold text-foreground">
                  Pagos Realizados
                    </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {totalPayments > 0
                    ? Math.round((paidPayments / totalPayments) * 100)
                    : 0}%
                    </div>
                              </div>
                  </div>
                </CardContent>
              </Card>
      </div>
    </AppLayout>
  );
}
