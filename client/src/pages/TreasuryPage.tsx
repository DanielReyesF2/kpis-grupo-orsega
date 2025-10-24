import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, FileText, TrendingUp, Check, Clock, Upload, Send, Download, RefreshCw, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { PaymentVouchersKanban } from "@/components/treasury/PaymentVouchersKanban";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function TreasuryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("payments");
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<number | null>(null);
  const [selectedReceipts, setSelectedReceipts] = useState<number[]>([]);
  const [emailsToSend, setEmailsToSend] = useState("");

  // Estado para formularios
  const [paymentForm, setPaymentForm] = useState({
    companyId: "",
    supplierName: "",
    amount: "",
    currency: "MXN",
    dueDate: "",
    reference: "",
    notes: "",
  });

  const [exchangeRateForm, setExchangeRateForm] = useState({
    buyRate: "",
    sellRate: "",
    source: "",
    notes: "",
  });

  const [complementForm, setComplementForm] = useState({
    companyId: "",
    clientName: "",
    invoiceReference: "",
    amount: "",
    currency: "MXN",
  });

  // Filtros
  const [paymentFilter, setPaymentFilter] = useState("");
  const [complementFilter, setComplementFilter] = useState("");
  const [ratePeriod, setRatePeriod] = useState("today"); // today, week, month, all
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  
  // Filtros de Comprobantes
  const currentDate = new Date();
  const [voucherMonth, setVoucherMonth] = useState((currentDate.getMonth() + 1).toString());
  const [voucherYear, setVoucherYear] = useState(currentDate.getFullYear().toString());
  const [showAllVouchers, setShowAllVouchers] = useState(false);

  // Upload Voucher Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedClientForVoucher, setSelectedClientForVoucher] = useState<number | null>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherNotes, setVoucherNotes] = useState("");
  const [uploadAnalysis, setUploadAnalysis] = useState<any>(null);
  
  // FX Analytics State
  const [fxPeriodDays, setFxPeriodDays] = useState(90);
  const [fxUsdMonthly, setFxUsdMonthly] = useState(25000);
  const [selectedFxSource, setSelectedFxSource] = useState("DOF");
  
  // Comparativa: controlar qué fuentes mostrar
  const [showMonex, setShowMonex] = useState(true);
  const [showSantander, setShowSantander] = useState(true);
  const [showDOF, setShowDOF] = useState(true);

  // Consultas
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ["/api/treasury/payments"],
    enabled: activeTab === "payments",
  });

  const { data: exchangeRates = [], isLoading: ratesLoading } = useQuery<any[]>({
    queryKey: ["/api/treasury/exchange-rates"],
    enabled: activeTab === "exchange-rates",
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<any[]>({
    queryKey: ["/api/treasury/payments", selectedPaymentForReceipt, "receipts"],
    enabled: !!selectedPaymentForReceipt && activeTab === "receipts",
  });

  const { data: complements = [], isLoading: complementsLoading } = useQuery<any[]>({
    queryKey: ["/api/treasury/complements"],
    enabled: activeTab === "complements",
  });

  // Payment Vouchers Query
  const { data: paymentVouchers = [], isLoading: vouchersLoading } = useQuery<any[]>({
    queryKey: ["/api/payment-vouchers"],
    enabled: activeTab === "receipts",
  });

  // Clients Query for Voucher Upload
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients-db"],
    enabled: isUploadModalOpen,
  });

  // FX Analytics Queries
  const { data: fxComparison, isLoading: fxComparisonLoading } = useQuery<any>({
    queryKey: [`/api/fx/compare?days=${fxPeriodDays}&usd_monthly=${fxUsdMonthly}`],
    enabled: activeTab === "exchange-rates",
  });

  const { data: monexSeries, isLoading: monexLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=MONEX&days=${fxPeriodDays}`],
    enabled: activeTab === "exchange-rates",
  });

  const { data: santanderSeries, isLoading: santanderLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=Santander&days=${fxPeriodDays}`],
    enabled: activeTab === "exchange-rates",
  });

  const { data: dofSeries, isLoading: dofLoading } = useQuery<any>({
    queryKey: [`/api/fx/source-series?source=DOF&days=${fxPeriodDays}`],
    enabled: activeTab === "exchange-rates",
  });

  // Mutaciones
  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/treasury/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      toast({ title: "Pago programado creado" });
      setPaymentForm({
        companyId: "",
        supplierName: "",
        amount: "",
        currency: "MXN",
        dueDate: "",
        reference: "",
        notes: "",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await fetch(`/api/treasury/payments/${paymentId}/pay`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as paid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      toast({ title: "Pago marcado como pagado" });
    },
  });

  const createExchangeRateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/treasury/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create exchange rate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/exchange-rates"] });
      toast({ title: "Tipo de cambio registrado" });
      setExchangeRateForm({
        buyRate: "",
        sellRate: "",
        source: "",
        notes: "",
      });
      setIsRateModalOpen(false);
    },
  });

  const handleCreatePayment = () => {
    createPaymentMutation.mutate(paymentForm);
  };

  const handleCreateExchangeRate = () => {
    createExchangeRateMutation.mutate({
      buyRate: parseFloat(exchangeRateForm.buyRate),
      sellRate: parseFloat(exchangeRateForm.sellRate),
      source: exchangeRateForm.source,
      notes: exchangeRateForm.notes,
    });
  };

  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ paymentId, file }: { paymentId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/treasury/payments/${paymentId}/receipts`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload receipt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      toast({ title: "Comprobante subido exitosamente" });
    },
  });

  const sendReceiptsMutation = useMutation({
    mutationFn: async ({ receiptIds, emails }: { receiptIds: number[]; emails: string[] }) => {
      const res = await fetch("/api/treasury/receipts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptIds, emails }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send receipts");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Comprobantes enviados por email" });
      setSelectedReceipts([]);
      setEmailsToSend("");
    },
  });

  const createComplementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/treasury/complements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create complement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/complements"] });
      toast({ title: "Complemento creado" });
      setComplementForm({
        companyId: "",
        clientName: "",
        invoiceReference: "",
        amount: "",
        currency: "MXN",
      });
    },
  });

  const handleFileUpload = (paymentId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadReceiptMutation.mutate({ paymentId, file });
    }
  };

  const handleSendReceipts = () => {
    if (selectedReceipts.length === 0 || !emailsToSend) {
      toast({ title: "Error", description: "Selecciona comprobantes y emails", variant: "destructive" });
      return;
    }
    const emails = emailsToSend.split(',').map(e => e.trim());
    sendReceiptsMutation.mutate({ receiptIds: selectedReceipts, emails });
  };

  const handleCreateComplement = () => {
    createComplementMutation.mutate({
      ...complementForm,
      companyId: parseInt(complementForm.companyId),
      amount: parseFloat(complementForm.amount),
    });
  };

  // Upload Payment Voucher Mutation
  const uploadVoucherMutation = useMutation({
    mutationFn: async ({ file, clientId, notes }: { file: File; clientId: number; notes: string }) => {
      // Validar que el usuario tenga companyId asignado
      if (!user?.companyId) {
        throw new Error("Usuario sin compañía asignada. Contacte al administrador.");
      }

      const formData = new FormData();
      formData.append('voucher', file);
      formData.append('companyId', user.companyId.toString());
      formData.append('clientId', clientId.toString());
      if (notes) formData.append('notes', notes);

      const res = await fetch("/api/payment-vouchers/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload voucher");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setUploadAnalysis(data);
      toast({ 
        title: "Comprobante analizado", 
        description: `Estado inicial: ${data.autoStatus === 'factura_pagada' ? 'Factura Pagada' : 'Pendiente Complemento'}` 
      });
      // Reset form
      setSelectedClientForVoucher(null);
      setVoucherFile(null);
      setVoucherNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error al subir comprobante",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUploadVoucher = () => {
    // Validar que el usuario tenga companyId
    if (!user?.companyId) {
      toast({ 
        title: "Error de configuración", 
        description: "Tu usuario no tiene compañía asignada. Contacta al administrador.", 
        variant: "destructive" 
      });
      return;
    }

    if (!voucherFile || !selectedClientForVoucher) {
      toast({ 
        title: "Error", 
        description: "Selecciona un cliente y un archivo", 
        variant: "destructive" 
      });
      return;
    }

    uploadVoucherMutation.mutate({
      file: voucherFile,
      clientId: selectedClientForVoucher,
      notes: voucherNotes,
    });
  };

  const handleVoucherFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de archivo no válido",
          description: "Solo se permiten archivos PDF, PNG, JPG, JPEG",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB
        toast({
          title: "Archivo muy grande",
          description: "El tamaño máximo es 10MB",
          variant: "destructive",
        });
        return;
      }
      setVoucherFile(file);
    }
  };

  // Filtrar pagos por búsqueda
  const filteredPayments = payments.filter(p => {
    if (!paymentFilter) return true;
    const searchLower = paymentFilter.toLowerCase();
    return (
      p.supplier_name?.toLowerCase().includes(searchLower) ||
      p.reference?.toLowerCase().includes(searchLower) ||
      p.amount?.toString().includes(searchLower)
    );
  });

  const pendingPayments = filteredPayments.filter((p) => p.status === "pending");
  const paidPayments = filteredPayments.filter((p) => p.status === "paid");

  // Filtrar complementos por búsqueda
  const filteredComplements = complements.filter(c => {
    if (!complementFilter) return true;
    const searchLower = complementFilter.toLowerCase();
    return (
      c.client_name?.toLowerCase().includes(searchLower) ||
      c.invoice_reference?.toLowerCase().includes(searchLower)
    );
  });

  // Filtrar tipos de cambio por periodo
  const filteredExchangeRates = exchangeRates.filter(rate => {
    const rateDate = new Date(rate.date);
    const now = new Date();
    
    switch (ratePeriod) {
      case "today":
        return (
          rateDate.getDate() === now.getDate() &&
          rateDate.getMonth() === now.getMonth() &&
          rateDate.getFullYear() === now.getFullYear()
        );
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return rateDate >= weekAgo;
      case "month":
        return (
          rateDate.getMonth() === now.getMonth() &&
          rateDate.getFullYear() === now.getFullYear()
        );
      case "all":
      default:
        return true;
    }
  });

  // Calcular estadísticas
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalPaidThisMonth = paidPayments.filter(p => {
    const paidDate = new Date(p.paid_at || p.created_at);
    const now = new Date();
    return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
  }).reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const pendingComplements = filteredComplements.filter(c => c.status === "pending").length;
  const latestRate = exchangeRates[0];
  const previousRate = exchangeRates[1];

  // Filtrar comprobantes por mes/año
  const filteredVouchers = showAllVouchers 
    ? paymentVouchers 
    : paymentVouchers.filter(v => {
        if (!v.createdAt) return false;
        const voucherDate = new Date(v.createdAt);
        return (
          voucherDate.getMonth() + 1 === parseInt(voucherMonth) &&
          voucherDate.getFullYear() === parseInt(voucherYear)
        );
      });

  // Estadísticas de comprobantes
  const voucherStats = {
    total: filteredVouchers.length,
    facturaPagada: filteredVouchers.filter(v => v.status === "factura_pagada").length,
    pendienteComplemento: filteredVouchers.filter(v => v.status === "pendiente_complemento").length,
    complementoRecibido: filteredVouchers.filter(v => v.status === "complemento_recibido").length,
    cierreContable: filteredVouchers.filter(v => v.status === "cierre_contable").length,
  };

  // Preparar datos para el gráfico de tendencias
  const chartData = filteredExchangeRates.slice(0, 20).reverse().map(rate => ({
    date: format(new Date(rate.date), 'dd/MM HH:mm', { locale: es }),
    compra: rate.buy_rate,
    venta: rate.sell_rate,
  }));

  // Calcular tendencia del tipo de cambio
  const rateTrend = latestRate && previousRate 
    ? latestRate.buy_rate > previousRate.buy_rate ? 'up' : latestRate.buy_rate < previousRate.buy_rate ? 'down' : 'stable'
    : 'stable';

  return (
    <AppLayout title="Tesorería">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            Tesorería
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gestión de pagos, comprobantes y tipo de cambio
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Pagos Pendientes
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {pendingPayments.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    ${totalPendingAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Pagado Este Mes
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    ${totalPaidThisMonth.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {paidPayments.length} pagos totales
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Complementos Pendientes
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {pendingComplements}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {complements.length} totales
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    TC Actual (USD/MXN)
                  </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {latestRate ? `$${latestRate.sell_rate}` : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {latestRate ? `Compra: $${latestRate.buy_rate}` : 'Sin registros'}
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="payments" data-testid="tab-payments">
              <Calendar className="h-4 w-4 mr-2" />
              Pagos
            </TabsTrigger>
            <TabsTrigger value="receipts" data-testid="tab-receipts">
              <Upload className="h-4 w-4 mr-2" />
              Comprobantes
            </TabsTrigger>
            <TabsTrigger value="exchange-rates" data-testid="tab-exchange-rates">
              <TrendingUp className="h-4 w-4 mr-2" />
              Tipo de Cambio
            </TabsTrigger>
          </TabsList>

          {/* Tab: Pagos Programados */}
          <TabsContent value="payments" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formulario */}
              <Card>
                <CardHeader>
                  <CardTitle>Programar Pago</CardTitle>
                  <CardDescription>Registra un nuevo pago pendiente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Empresa</Label>
                    <Select
                      value={paymentForm.companyId}
                      onValueChange={(value) =>
                        setPaymentForm({ ...paymentForm, companyId: value })
                      }
                    >
                      <SelectTrigger data-testid="select-company">
                        <SelectValue placeholder="Selecciona empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Dura International</SelectItem>
                        <SelectItem value="2">Grupo Orsega</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Proveedor</Label>
                    <Input
                      value={paymentForm.supplierName}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, supplierName: e.target.value })
                      }
                      placeholder="Nombre del proveedor"
                      data-testid="input-supplier"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        value={paymentForm.amount}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, amount: e.target.value })
                        }
                        placeholder="0.00"
                        data-testid="input-amount"
                      />
                    </div>
                    <div>
                      <Label>Moneda</Label>
                      <Select
                        value={paymentForm.currency}
                        onValueChange={(value) =>
                          setPaymentForm({ ...paymentForm, currency: value })
                        }
                      >
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MXN">MXN</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Fecha de vencimiento</Label>
                    <Input
                      type="date"
                      value={paymentForm.dueDate}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, dueDate: e.target.value })
                      }
                      data-testid="input-due-date"
                    />
                  </div>

                  <div>
                    <Label>Referencia (opcional)</Label>
                    <Input
                      value={paymentForm.reference}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, reference: e.target.value })
                      }
                      placeholder="No. de factura o referencia"
                      data-testid="input-reference"
                    />
                  </div>

                  <Button
                    onClick={handleCreatePayment}
                    disabled={createPaymentMutation.isPending}
                    className="w-full"
                    data-testid="button-create-payment"
                  >
                    {createPaymentMutation.isPending ? "Guardando..." : "Programar Pago"}
                  </Button>
                </CardContent>
              </Card>

              {/* Lista de pagos */}
              <div className="space-y-4">
                {/* Campo de búsqueda */}
                <Input
                  placeholder="Buscar por proveedor, referencia o monto..."
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full"
                  data-testid="input-payment-search"
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Pendientes ({pendingPayments.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {paymentsLoading ? (
                      <p className="text-sm text-slate-500">Cargando...</p>
                    ) : pendingPayments.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay pagos pendientes</p>
                    ) : (
                      pendingPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`payment-${payment.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{payment.supplier_name}</p>
                            <p className="text-sm text-slate-500">
                              {payment.amount} {payment.currency} •{" "}
                              {format(new Date(payment.due_date), "dd/MMM", { locale: es })}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => markAsPaidMutation.mutate(payment.id)}
                            data-testid={`button-mark-paid-${payment.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Marcar pagado
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pagados ({paidPayments.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {paidPayments.slice(0, 5).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20"
                        data-testid={`paid-payment-${payment.id}`}
                      >
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">
                            {payment.supplier_name}
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-500">
                            {payment.amount} {payment.currency}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-900">
                          Pagado
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exchange-rates" className="space-y-6">
            {/* Header con Botón de Registro */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  Análisis de Tipo de Cambio
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Monitoreo y tendencias del mercado cambiario
                </p>
              </div>
              
              <Dialog open={isRateModalOpen} onOpenChange={setIsRateModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-open-rate-modal"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Registrar Tipo de Cambio
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Registrar Tipo de Cambio</DialogTitle>
                    <DialogDescription>
                      Captura diaria USD/MXN desde diferentes fuentes
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Compra</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={exchangeRateForm.buyRate}
                          onChange={(e) =>
                            setExchangeRateForm({ ...exchangeRateForm, buyRate: e.target.value })
                          }
                          placeholder="17.2500"
                          data-testid="input-buy-rate"
                        />
                      </div>
                      <div>
                        <Label>Venta</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={exchangeRateForm.sellRate}
                          onChange={(e) =>
                            setExchangeRateForm({ ...exchangeRateForm, sellRate: e.target.value })
                          }
                          placeholder="17.4500"
                          data-testid="input-sell-rate"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Fuente</Label>
                      <Select
                        value={exchangeRateForm.source}
                        onValueChange={(value) =>
                          setExchangeRateForm({ ...exchangeRateForm, source: value })
                        }
                      >
                        <SelectTrigger data-testid="select-source">
                          <SelectValue placeholder="Selecciona fuente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONEX">MONEX</SelectItem>
                          <SelectItem value="Santander">Santander</SelectItem>
                          <SelectItem value="DOF">DOF</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Notas (opcional)</Label>
                      <Input
                        value={exchangeRateForm.notes}
                        onChange={(e) =>
                          setExchangeRateForm({ ...exchangeRateForm, notes: e.target.value })
                        }
                        placeholder="Notas adicionales"
                        data-testid="input-notes"
                      />
                    </div>

                    <Button
                      onClick={handleCreateExchangeRate}
                      disabled={createExchangeRateMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="button-create-rate"
                    >
                      {createExchangeRateMutation.isPending ? "Guardando..." : "Registrar"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Historial Mensual - Gráfica Principal */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-lg">Historial de Tipo de Cambio</CardTitle>
                    <CardDescription>
                      {fxPeriodDays === 90 ? 'Últimos 3 meses' : 
                       fxPeriodDays === 60 ? 'Últimos 2 meses' :
                       fxPeriodDays === 30 ? 'Último mes' : 
                       'Última semana'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={fxPeriodDays.toString()}
                      onValueChange={(value) => setFxPeriodDays(parseInt(value))}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-fx-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">1 Semana</SelectItem>
                        <SelectItem value="30">1 Mes</SelectItem>
                        <SelectItem value="60">2 Meses</SelectItem>
                        <SelectItem value="90">3 Meses</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedFxSource}
                      onValueChange={(value) => setSelectedFxSource(value)}
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-fx-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONEX">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-[#2563eb]"></div>
                            MONEX
                          </div>
                        </SelectItem>
                        <SelectItem value="Santander">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-[#16a34a]"></div>
                            Santander
                          </div>
                        </SelectItem>
                        <SelectItem value="DOF">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-[#ea580c]"></div>
                            DOF
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedFxSource === "MONEX" && (
                  <>
                    {monexSeries?.spreads_analysis && (
                      <div className="mb-4 flex gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>Tendencia 7d: <strong>{monexSeries.spreads_analysis.trend_7d || 'N/A'}</strong></span>
                        <span>Volatilidad 5d: <strong>{monexSeries.spreads_analysis.volatility_5d || 'N/A'}</strong></span>
                      </div>
                    )}
                    {monexLoading ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Cargando datos de MONEX...</p>
                      </div>
                    ) : monexSeries?.series && monexSeries.series.length > 0 ? (
                      (() => {
                        // Calcular apertura (9 AM) y cierre (12 PM / 5 PM)
                        const morningData = monexSeries.series.filter((p: any) => new Date(p.date).getHours() === 9);
                        const afternoonData = monexSeries.series.filter((p: any) => {
                          const hour = new Date(p.date).getHours();
                          return hour === 12 || hour === 17;
                        });
                        
                        const avgMorning = morningData.length > 0 
                          ? morningData.reduce((sum: number, p: any) => sum + (p.buy + p.sell) / 2, 0) / morningData.length
                          : null;
                        const avgAfternoon = afternoonData.length > 0
                          ? afternoonData.reduce((sum: number, p: any) => sum + (p.buy + p.sell) / 2, 0) / afternoonData.length
                          : null;

                        return (
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={monexSeries.series}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="date" 
                                fontSize={11}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis fontSize={11} domain={['dataMin - 0.05', 'dataMax + 0.05']} />
                              <Tooltip />
                              <Legend />
                              
                              {avgMorning && (
                                <ReferenceLine 
                                  y={avgMorning} 
                                  stroke="#f59e0b" 
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{ value: `Apertura: $${avgMorning.toFixed(4)}`, position: 'left', fill: '#f59e0b', fontSize: 11 }}
                                />
                              )}
                              {avgAfternoon && (
                                <ReferenceLine 
                                  y={avgAfternoon} 
                                  stroke="#8b5cf6" 
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{ value: `Cierre: $${avgAfternoon.toFixed(4)}`, position: 'right', fill: '#8b5cf6', fontSize: 11 }}
                                />
                              )}
                              
                              <Line type="monotone" dataKey="buy" stroke="#2563eb" strokeWidth={3} name="Compra" />
                              <Line type="monotone" dataKey="sell" stroke="#60a5fa" strokeWidth={3} name="Venta" />
                            </LineChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Sin datos disponibles para MONEX</p>
                      </div>
                    )}
                  </>
                )}
                
                {selectedFxSource === "Santander" && (
                  <>
                    {santanderSeries?.spreads_analysis && (
                      <div className="mb-4 flex gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>Tendencia 7d: <strong>{santanderSeries.spreads_analysis.trend_7d || 'N/A'}</strong></span>
                        <span>Volatilidad 5d: <strong>{santanderSeries.spreads_analysis.volatility_5d || 'N/A'}</strong></span>
                      </div>
                    )}
                    {santanderLoading ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Cargando datos de Santander...</p>
                      </div>
                    ) : santanderSeries?.series && santanderSeries.series.length > 0 ? (
                      (() => {
                        // Calcular apertura (9 AM) y cierre (12 PM / 5 PM)
                        const morningData = santanderSeries.series.filter((p: any) => new Date(p.date).getHours() === 9);
                        const afternoonData = santanderSeries.series.filter((p: any) => {
                          const hour = new Date(p.date).getHours();
                          return hour === 12 || hour === 17;
                        });
                        
                        const avgMorning = morningData.length > 0 
                          ? morningData.reduce((sum: number, p: any) => sum + (p.buy + p.sell) / 2, 0) / morningData.length
                          : null;
                        const avgAfternoon = afternoonData.length > 0
                          ? afternoonData.reduce((sum: number, p: any) => sum + (p.buy + p.sell) / 2, 0) / afternoonData.length
                          : null;

                        return (
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={santanderSeries.series}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="date" 
                                fontSize={11}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis fontSize={11} domain={['dataMin - 0.05', 'dataMax + 0.05']} />
                              <Tooltip />
                              <Legend />
                              
                              {avgMorning && (
                                <ReferenceLine 
                                  y={avgMorning} 
                                  stroke="#f59e0b" 
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{ value: `Apertura: $${avgMorning.toFixed(4)}`, position: 'left', fill: '#f59e0b', fontSize: 11 }}
                                />
                              )}
                              {avgAfternoon && (
                                <ReferenceLine 
                                  y={avgAfternoon} 
                                  stroke="#8b5cf6" 
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{ value: `Cierre: $${avgAfternoon.toFixed(4)}`, position: 'right', fill: '#8b5cf6', fontSize: 11 }}
                                />
                              )}
                              
                              <Line type="monotone" dataKey="buy" stroke="#16a34a" strokeWidth={3} name="Compra" />
                              <Line type="monotone" dataKey="sell" stroke="#4ade80" strokeWidth={3} name="Venta" />
                            </LineChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Sin datos disponibles para Santander</p>
                      </div>
                    )}
                  </>
                )}
                
                {selectedFxSource === "DOF" && (
                  <>
                    {dofSeries?.spreads_analysis && (
                      <div className="mb-4 flex gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>Tendencia 7d: <strong>{dofSeries.spreads_analysis.trend_7d || 'N/A'}</strong></span>
                        <span>Volatilidad 5d: <strong>{dofSeries.spreads_analysis.volatility_5d || 'N/A'}</strong></span>
                      </div>
                    )}
                    {dofLoading ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Cargando datos de DOF...</p>
                      </div>
                    ) : dofSeries?.series && dofSeries.series.length > 0 ? (
                      (() => {
                        // Calcular apertura (9 AM) y cierre (12 PM / 5 PM)
                        const morningData = dofSeries.series.filter((p: any) => new Date(p.date).getHours() === 9);
                        const afternoonData = dofSeries.series.filter((p: any) => {
                          const hour = new Date(p.date).getHours();
                          return hour === 12 || hour === 17;
                        });
                        
                        const avgMorning = morningData.length > 0 
                          ? morningData.reduce((sum: number, p: any) => sum + (p.buy + p.sell) / 2, 0) / morningData.length
                          : null;
                        const avgAfternoon = afternoonData.length > 0
                          ? afternoonData.reduce((sum: number, p: any) => sum + (p.buy + p.sell) / 2, 0) / afternoonData.length
                          : null;

                        return (
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={dofSeries.series}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="date" 
                                fontSize={11}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis fontSize={11} domain={['dataMin - 0.05', 'dataMax + 0.05']} />
                              <Tooltip />
                              <Legend />
                              
                              {avgMorning && (
                                <ReferenceLine 
                                  y={avgMorning} 
                                  stroke="#f59e0b" 
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{ value: `Apertura: $${avgMorning.toFixed(4)}`, position: 'left', fill: '#f59e0b', fontSize: 11 }}
                                />
                              )}
                              {avgAfternoon && (
                                <ReferenceLine 
                                  y={avgAfternoon} 
                                  stroke="#8b5cf6" 
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  label={{ value: `Cierre: $${avgAfternoon.toFixed(4)}`, position: 'right', fill: '#8b5cf6', fontSize: 11 }}
                                />
                              )}
                              
                              <Line type="monotone" dataKey="buy" stroke="#ea580c" strokeWidth={3} name="Compra" />
                              <Line type="monotone" dataKey="sell" stroke="#fb923c" strokeWidth={3} name="Venta" />
                            </LineChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Sin datos disponibles para DOF</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tarjetas de Información por Fuente */}
            {(() => {
              const selectedSeries = selectedFxSource === "MONEX" ? monexSeries :
                                    selectedFxSource === "Santander" ? santanderSeries :
                                    dofSeries;
              
              const isLoading = selectedFxSource === "MONEX" ? monexLoading :
                              selectedFxSource === "Santander" ? santanderLoading :
                              dofLoading;

              const latestData = selectedSeries?.series?.[selectedSeries.series.length - 1];
              const lastUpdate = selectedSeries?.last_update;

              return isLoading ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">Cargando datos...</p>
                </div>
              ) : latestData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Última Actualización Compra
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                            ${latestData.buy?.toFixed(4) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {lastUpdate ? format(new Date(lastUpdate), "dd/MMM/yyyy HH:mm", { locale: es }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        Última Actualización Venta
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            ${latestData.sell?.toFixed(4) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {lastUpdate ? format(new Date(lastUpdate), "dd/MMM/yyyy HH:mm", { locale: es }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        {selectedSeries?.spreads_analysis?.trend_7d === 'up' ? (
                          <ArrowUp className="h-4 w-4 text-green-600" />
                        ) : selectedSeries?.spreads_analysis?.trend_7d === 'down' ? (
                          <ArrowDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-slate-600" />
                        )}
                        Tendencia
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                            {selectedSeries?.spreads_analysis?.trend_7d === 'up' ? '↑ Alza' :
                             selectedSeries?.spreads_analysis?.trend_7d === 'down' ? '↓ Baja' :
                             '→ Estable'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Volatilidad: {selectedSeries?.spreads_analysis?.volatility_5d || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null;
            })()}

            {/* Gráfica Comparativa de Fuentes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-lg">Comparativa de Fuentes</CardTitle>
                    <CardDescription>Compara diferentes fuentes de tipo de cambio</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant={showMonex ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowMonex(!showMonex)}
                      className={showMonex ? "bg-[#2563eb] hover:bg-[#1d4ed8]" : ""}
                      data-testid="toggle-monex"
                    >
                      <div className="h-3 w-3 rounded-full bg-[#2563eb] mr-2"></div>
                      MONEX
                    </Button>
                    <Button
                      variant={showSantander ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowSantander(!showSantander)}
                      className={showSantander ? "bg-[#16a34a] hover:bg-[#15803d]" : ""}
                      data-testid="toggle-santander"
                    >
                      <div className="h-3 w-3 rounded-full bg-[#16a34a] mr-2"></div>
                      Santander
                    </Button>
                    <Button
                      variant={showDOF ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDOF(!showDOF)}
                      className={showDOF ? "bg-[#ea580c] hover:bg-[#c2410c]" : ""}
                      data-testid="toggle-dof"
                    >
                      <div className="h-3 w-3 rounded-full bg-[#ea580c] mr-2"></div>
                      DOF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Combinar datos de todas las fuentes
                  const allDates = new Set<string>();
                  const dataMap = new Map<string, any>();

                  // Recopilar todas las fechas únicas
                  if (showMonex && monexSeries?.series) {
                    monexSeries.series.forEach((point: any) => {
                      allDates.add(point.date);
                      if (!dataMap.has(point.date)) {
                        dataMap.set(point.date, { date: point.date });
                      }
                      dataMap.get(point.date)!.monexBuy = point.buy;
                      dataMap.get(point.date)!.monexSell = point.sell;
                    });
                  }

                  if (showSantander && santanderSeries?.series) {
                    santanderSeries.series.forEach((point: any) => {
                      allDates.add(point.date);
                      if (!dataMap.has(point.date)) {
                        dataMap.set(point.date, { date: point.date });
                      }
                      dataMap.get(point.date)!.santanderBuy = point.buy;
                      dataMap.get(point.date)!.santanderSell = point.sell;
                    });
                  }

                  if (showDOF && dofSeries?.series) {
                    dofSeries.series.forEach((point: any) => {
                      allDates.add(point.date);
                      if (!dataMap.has(point.date)) {
                        dataMap.set(point.date, { date: point.date });
                      }
                      dataMap.get(point.date)!.dofBuy = point.buy;
                      dataMap.get(point.date)!.dofSell = point.sell;
                    });
                  }

                  // Convertir a array y ordenar por fecha
                  const combinedData = Array.from(dataMap.values()).sort((a, b) => 
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );

                  const isLoading = (showMonex && monexLoading) || (showSantander && santanderLoading) || (showDOF && dofLoading);
                  const hasData = combinedData.length > 0;

                  return isLoading ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500">Cargando datos...</p>
                    </div>
                  ) : hasData ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={combinedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          fontSize={10}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis fontSize={10} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        
                        {showMonex && (
                          <>
                            <Line type="monotone" dataKey="monexBuy" stroke="#60a5fa" strokeWidth={2} name="MONEX Compra" dot={false} strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="monexSell" stroke="#2563eb" strokeWidth={2} name="MONEX Venta" dot={false} />
                          </>
                        )}
                        
                        {showSantander && (
                          <>
                            <Line type="monotone" dataKey="santanderBuy" stroke="#4ade80" strokeWidth={2} name="Santander Compra" dot={false} strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="santanderSell" stroke="#16a34a" strokeWidth={2} name="Santander Venta" dot={false} />
                          </>
                        )}
                        
                        {showDOF && (
                          <>
                            <Line type="monotone" dataKey="dofBuy" stroke="#fb923c" strokeWidth={2} name="DOF Compra" dot={false} strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="dofSell" stroke="#ea580c" strokeWidth={2} name="DOF Venta" dot={false} />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-500">Selecciona al menos una fuente para ver la comparativa</p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Tabla Comparativa de Spreads */}
            {fxComparison?.spreads_analysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Análisis Comparativo de Spreads</CardTitle>
                  <CardDescription>Comparación detallada entre fuentes de tipo de cambio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Fuente</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Compra</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Venta</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Spread</th>
                          <th className="text-center py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Tendencia 7d</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Volatilidad 5d</th>
                          <th className="text-center py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(fxComparison.spreads_analysis).map(([source, data]: [string, any]) => (
                          <tr key={source} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-3 font-medium">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${
                                  source === 'MONEX' ? 'bg-[#2563eb]' :
                                  source === 'Santander' ? 'bg-[#16a34a]' :
                                  source === 'DOF' ? 'bg-[#ea580c]' : 'bg-slate-400'
                                }`}></div>
                                {source}
                              </div>
                            </td>
                            <td className="text-right py-2 px-3">${data.avg_buy?.toFixed(4) || 'N/A'}</td>
                            <td className="text-right py-2 px-3">${data.avg_sell?.toFixed(4) || 'N/A'}</td>
                            <td className="text-right py-2 px-3">{data.spread?.toFixed(4) || 'N/A'}</td>
                            <td className="text-center py-2 px-3">
                              <Badge variant="outline" className={
                                data.trend_7d === 'up' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' :
                                data.trend_7d === 'down' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' :
                                'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400'
                              }>
                                {data.trend_7d === 'up' ? '↑' : data.trend_7d === 'down' ? '↓' : '→'} {data.trend_7d || 'N/A'}
                              </Badge>
                            </td>
                            <td className="text-center py-2 px-3">{data.volatility_5d || 'N/A'}</td>
                            <td className="text-center py-2 px-3">
                              <Badge variant="outline" className={
                                data.spread_status === 'favorable' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' :
                                data.spread_status === 'normal' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                                'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                              }>
                                {data.spread_status || 'N/A'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Nota Informativa */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                      Nota sobre el análisis FX
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                      Los datos presentados son exclusivamente informativos y reflejan las variaciones del mercado cambiario. 
                      Las tendencias, volatilidades y diferenciales mostrados están basados en datos históricos del periodo seleccionado. 
                      El análisis comparativo permite identificar patrones de comportamiento entre diferentes fuentes sin constituir recomendaciones de operación.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Comprobantes */}
          <TabsContent value="receipts" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Comprobantes Bancarios</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Gestiona el flujo de comprobantes de pago con análisis automático
                </p>
              </div>
              <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-upload-voucher">
                    <Plus className="h-4 w-4 mr-2" />
                    Subir Comprobante
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Subir Comprobante Bancario</DialogTitle>
                    <DialogDescription>
                      El sistema analizará automáticamente el documento con IA para extraer datos clave
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Selector de Cliente */}
                    <div className="space-y-2">
                      <Label htmlFor="client-select">Cliente *</Label>
                      <Select
                        value={selectedClientForVoucher?.toString() || ""}
                        onValueChange={(value) => setSelectedClientForVoucher(parseInt(value))}
                      >
                        <SelectTrigger id="client-select" data-testid="select-client-voucher">
                          <SelectValue placeholder="Selecciona un cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client: any) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.name}
                              {client.requires_payment_complement && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Requiere Complemento
                                </Badge>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subir Archivo */}
                    <div className="space-y-2">
                      <Label htmlFor="voucher-file">Comprobante (PDF, PNG, JPG) *</Label>
                      <Input
                        id="voucher-file"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleVoucherFileChange}
                        data-testid="input-voucher-file"
                      />
                      {voucherFile && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Archivo: {voucherFile.name} ({(voucherFile.size / 1024).toFixed(2)} KB)
                        </p>
                      )}
                    </div>

                    {/* Notas Opcionales */}
                    <div className="space-y-2">
                      <Label htmlFor="voucher-notes">Notas (Opcional)</Label>
                      <Input
                        id="voucher-notes"
                        value={voucherNotes}
                        onChange={(e) => setVoucherNotes(e.target.value)}
                        placeholder="Observaciones adicionales..."
                        data-testid="input-voucher-notes"
                      />
                    </div>

                    {/* Resultado del Análisis */}
                    {uploadAnalysis && (
                      <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <p className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                              <Check className="h-4 w-4" />
                              Análisis Completado
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-slate-600 dark:text-slate-400">Monto:</span>
                                <span className="ml-2 font-medium">
                                  {uploadAnalysis.analysis?.extractedCurrency} ${uploadAnalysis.analysis?.extractedAmount?.toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-600 dark:text-slate-400">Banco:</span>
                                <span className="ml-2 font-medium">{uploadAnalysis.analysis?.extractedBank || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-slate-600 dark:text-slate-400">Referencia:</span>
                                <span className="ml-2 font-medium">{uploadAnalysis.analysis?.extractedReference || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-slate-600 dark:text-slate-400">Estado:</span>
                                <Badge variant="outline" className="ml-2">
                                  {uploadAnalysis.autoStatus === 'factura_pagada' ? 'Factura Pagada' : 'Pendiente Complemento'}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                              Confianza del análisis: {((uploadAnalysis.analysis?.ocrConfidence || 0) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsUploadModalOpen(false);
                        setUploadAnalysis(null);
                      }}
                      data-testid="button-cancel-upload"
                    >
                      {uploadAnalysis ? 'Cerrar' : 'Cancelar'}
                    </Button>
                    {!uploadAnalysis && (
                      <Button
                        onClick={handleUploadVoucher}
                        disabled={uploadVoucherMutation.isPending}
                        data-testid="button-confirm-upload"
                      >
                        {uploadVoucherMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Analizando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Subir y Analizar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Filtros y Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Filtro de Mes */}
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs text-slate-500 mb-2 block">Mes</Label>
                  <Select value={voucherMonth} onValueChange={setVoucherMonth} disabled={showAllVouchers}>
                    <SelectTrigger data-testid="select-voucher-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Enero</SelectItem>
                      <SelectItem value="2">Febrero</SelectItem>
                      <SelectItem value="3">Marzo</SelectItem>
                      <SelectItem value="4">Abril</SelectItem>
                      <SelectItem value="5">Mayo</SelectItem>
                      <SelectItem value="6">Junio</SelectItem>
                      <SelectItem value="7">Julio</SelectItem>
                      <SelectItem value="8">Agosto</SelectItem>
                      <SelectItem value="9">Septiembre</SelectItem>
                      <SelectItem value="10">Octubre</SelectItem>
                      <SelectItem value="11">Noviembre</SelectItem>
                      <SelectItem value="12">Diciembre</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Filtro de Año */}
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs text-slate-500 mb-2 block">Año</Label>
                  <Select value={voucherYear} onValueChange={setVoucherYear} disabled={showAllVouchers}>
                    <SelectTrigger data-testid="select-voucher-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Toggle Ver Todos */}
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs text-slate-500 mb-2 block">Vista</Label>
                  <Button
                    variant={showAllVouchers ? "default" : "outline"}
                    onClick={() => setShowAllVouchers(!showAllVouchers)}
                    className="w-full"
                    data-testid="button-toggle-all-vouchers"
                  >
                    {showAllVouchers ? "Mes Actual" : "Ver Todos"}
                  </Button>
                </CardContent>
              </Card>

              {/* Estadística: Total */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Total Comprobantes</p>
                      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {voucherStats.total}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-slate-400" />
                  </div>
                </CardContent>
              </Card>

              {/* Estadística: Pendientes Complemento */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Pendientes</p>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {voucherStats.pendienteComplemento}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {vouchersLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500">Cargando comprobantes...</p>
                </div>
              </div>
            ) : (
              <PaymentVouchersKanban vouchers={filteredVouchers} />
            )}

            {/* Nota Informativa */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 mt-6">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                      Flujo Automático de Comprobantes
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                      Al subir un comprobante, el sistema analiza automáticamente el documento con IA para extraer datos clave (monto, fecha, banco, referencia). 
                      Según el cliente, el comprobante se mueve automáticamente al estado correcto: si requiere complemento de pago, irá a "Pendiente Complemento"; 
                      si no, quedará en "Factura Pagada" listo para cierre. Arrastra las tarjetas entre columnas para actualizar su estado.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}
