import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, DollarSign, FileText, TrendingUp, Check, Clock, Upload, Send, Download, RefreshCw, ArrowUp, ArrowDown, Plus, FileSpreadsheet, User, Edit, Trash2, Mail, Phone } from "lucide-react";
import { PaymentVouchersKanban } from "@/components/treasury/PaymentVouchersKanban";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function TreasuryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
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
  const [selectedCompanyForVoucher, setSelectedCompanyForVoucher] = useState<number | null>(null);
  const [selectedClientForVoucher, setSelectedClientForVoucher] = useState<number | null>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherNotes, setVoucherNotes] = useState("");
  const [uploadAnalysis, setUploadAnalysis] = useState<any>(null);

  // IDRALL Integration State
  const [selectedCompanyForIdrall, setSelectedCompanyForIdrall] = useState<number | null>(null);
  const [idrallFile, setIdrallFile] = useState<File | null>(null);
  const [createAsPending, setCreateAsPending] = useState(true);
  const [idrallResult, setIdrallResult] = useState<any>(null);
  
  // FX Analytics State
  const [fxPeriodDays, setFxPeriodDays] = useState(90);
  const [fxUsdMonthly, setFxUsdMonthly] = useState(25000);
  const [selectedFxSource, setSelectedFxSource] = useState("DOF");
  
  // Comparativa: controlar qué fuentes mostrar
  const [showMonex, setShowMonex] = useState(true);
  const [showSantander, setShowSantander] = useState(true);
  const [showDOF, setShowDOF] = useState(true);

  // Provider Modal State
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any | null>(null);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false); // Nuevo estado para mostrar todos los proveedores
  const [supplierCompanyFilter, setSupplierCompanyFilter] = useState("all"); // Filtro por empresa
  const [providerForm, setProviderForm] = useState({
    name: "",
    shortName: "",
    email: "",
    phone: "",
    contactName: "",
    companyId: "",
    location: "",
    requiresRep: true,
    repFrequency: 7,
    reminderEmail: "",
    notes: "",
  });

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

  // Clients Query for Voucher Upload - Filtrar por empresa seleccionada
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients-db"],
    enabled: isUploadModalOpen && !!selectedCompanyForVoucher,
  });

  // Filtrar clientes por empresa seleccionada
  const filteredClients = selectedCompanyForVoucher 
    ? clients.filter((client: any) => client.companyId === selectedCompanyForVoucher)
    : clients;

  // Suppliers Query (Treasury)
  const { data: suppliers = [], isLoading: suppliersLoading, error: suppliersError } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    enabled: true,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Filtrar proveedores por empresa
  const filteredSuppliers = suppliers.filter((supplier: any) => {
    if (supplierCompanyFilter === "all") return true;
    return supplier.company_id === parseInt(supplierCompanyFilter);
  });

  // Debug suppliers
  useEffect(() => {
    console.log("📦 Suppliers query state:", { 
      suppliers: suppliers.length, 
      isLoading: suppliersLoading, 
      error: suppliersError, 
      isArray: Array.isArray(suppliers),
      firstSupplier: suppliers[0],
      data: suppliers
    });
  }, [suppliers, suppliersLoading, suppliersError]);


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

  // IDRALL Upload Mutation
  const idrallUploadMutation = useMutation({
    mutationFn: async ({ file, companyId, createAsPending }: { file: File; companyId: number; createAsPending: boolean }) => {
      const formData = new FormData();
      formData.append('excel', file);
      formData.append('companyId', companyId.toString());
      formData.append('createAsPending', createAsPending.toString());

      const res = await fetch("/api/idrall/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process Excel");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setIdrallResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      toast({ 
        title: "Excel procesado exitosamente", 
        description: `${data.summary.createdPayments} pagos creados` 
      });
      // Reset form
      setIdrallFile(null);
      setSelectedCompanyForIdrall(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error procesando Excel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleIdrallUpload = () => {
    if (!idrallFile || !selectedCompanyForIdrall) {
      toast({ 
        title: "Error", 
        description: "Selecciona empresa y archivo Excel", 
        variant: "destructive" 
      });
      return;
    }

    idrallUploadMutation.mutate({
      file: idrallFile,
      companyId: selectedCompanyForIdrall,
      createAsPending: createAsPending,
    });
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
    mutationFn: async ({ file, clientId, companyId, notes }: { file: File; clientId: number; companyId: number; notes: string }) => {
      const formData = new FormData();
      formData.append('voucher', file);
      formData.append('companyId', companyId.toString());
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
      setSelectedCompanyForVoucher(null);
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
    if (!voucherFile || !selectedClientForVoucher || !selectedCompanyForVoucher) {
      toast({ 
        title: "Error", 
        description: "Selecciona empresa, cliente y archivo", 
        variant: "destructive" 
      });
      return;
    }

    uploadVoucherMutation.mutate({
      file: voucherFile,
      clientId: selectedClientForVoucher,
      companyId: selectedCompanyForVoucher,
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

  // Supplier Mutations (Treasury)
  const createSupplierMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor creado exitosamente" });
      setIsProviderModalOpen(false);
      setProviderForm({
        name: "",
        shortName: "",
        email: "",
        phone: "",
        contactName: "",
        companyId: "",
        location: "",
        requiresRep: true,
        repFrequency: 7,
        reminderEmail: "",
        notes: "",
      });
      setEditingProvider(null);
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor actualizado exitosamente" });
      setIsProviderModalOpen(false);
      setEditingProvider(null);
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor eliminado exitosamente" });
    },
  });

  const handleSaveProvider = () => {
    if (!providerForm.name || !providerForm.email) {
      toast({ title: "Error", description: "Nombre y email son requeridos", variant: "destructive" });
      return;
    }

    const data = {
      name: providerForm.name,
      shortName: providerForm.shortName,
      email: providerForm.email,
      phone: providerForm.phone || undefined,
      contactName: providerForm.contactName || undefined,
      companyId: providerForm.companyId ? parseInt(providerForm.companyId) : undefined,
      location: providerForm.location || undefined,
      requiresRep: providerForm.requiresRep,
      repFrequency: providerForm.repFrequency,
      reminderEmail: providerForm.reminderEmail || undefined,
      notes: providerForm.notes || undefined,
    };

    if (editingProvider) {
      updateSupplierMutation.mutate({ id: editingProvider.id, data });
    } else {
      createSupplierMutation.mutate(data);
    }
  };

  const handleEditProvider = (provider: any) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name || "",
      shortName: provider.short_name || "",
      email: provider.email || "",
      phone: provider.phone || "",
      contactName: provider.contact_name || "",
      companyId: provider.company_id?.toString() || "",
      location: provider.location || "",
      requiresRep: provider.requires_rep ?? true,
      repFrequency: provider.rep_frequency || 7,
      reminderEmail: provider.reminder_email || "",
      notes: provider.notes || "",
    });
    setIsProviderModalOpen(true);
  };

  const handleDeleteProvider = (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este proveedor?")) {
      deleteSupplierMutation.mutate(id);
    }
  };

  const handleOpenNewProvider = () => {
    setEditingProvider(null);
    setProviderForm({
      name: "",
      shortName: "",
      email: "",
      phone: "",
      contactName: "",
      companyId: "",
      location: "",
      requiresRep: true,
      repFrequency: 7,
      reminderEmail: "",
      notes: "",
    });
    setIsProviderModalOpen(true);
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
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Hero Header con gradiente premium - Solo en dashboard */}
        {activeTab === "dashboard" && (
          <div className="relative bg-gradient-to-br from-[#273949] via-[#1f2f3f] to-[#273949] rounded-2xl p-8 shadow-2xl overflow-hidden">
            {/* Patrón decorativo de fondo */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #b5e951 0, #b5e951 2px, transparent 0, transparent 30px)'
              }}></div>
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-gradient-to-br from-accent to-accent/80 p-3 rounded-xl shadow-lg">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    ¡Hola Lolita! 👋
                  </h1>
                  <p className="text-white/90 text-lg">
                    ¿Con qué pagos te ayudamos hoy?
                  </p>
                </div>
              </div>
              
              {/* Mini stats rápidas */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-accent" />
                    <span className="text-sm text-white/80">Pendientes</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{pendingPayments.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5 text-green-400" />
                    <span className="text-sm text-white/80">Este mes</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{paidPayments.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-white/80">Comprobantes</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{filteredVouchers.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {activeTab === "dashboard" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Módulos de Tesorería</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard
                  title="Pagos Programados"
                  description={`${pendingPayments.length} pendientes`}
                  value={pendingPayments.length}
                  icon={Calendar}
                  onClick={() => setActiveTab("payments")}
                  gradient="from-blue-500 to-indigo-600"
                  dataOnboarding="treasury-payments"
                />
                <DashboardCard
                  title="Comprobantes"
                  description={`${filteredVouchers.length} en total`}
                  value={filteredVouchers.length}
                  icon={Upload}
                  onClick={() => setActiveTab("receipts")}
                  gradient="from-green-500 to-emerald-600"
                  dataOnboarding="treasury-receipts"
                />
                <DashboardCard
                  title="Tipo de Cambio"
                  description="Cotizaciones actualizadas"
                  value={exchangeRates.length > 0 ? `${exchangeRates[0]?.buy_rate?.toFixed(2)}` : "0"}
                  icon={TrendingUp}
                  onClick={() => setActiveTab("exchange-rates")}
                  gradient="from-purple-500 to-pink-600"
                  dataOnboarding="treasury-exchange-rates"
                />
                <DashboardCard
                  title="Proveedores"
                  description={`${suppliers.length} registrados`}
                  value={suppliers.length}
                  icon={User}
                  onClick={() => setActiveTab("providers")}
                  gradient="from-orange-500 to-red-600"
                  dataOnboarding="treasury-providers"
                />
              </div>
            </div>
          ) : null}
          
          <TabsList className="hidden">
            <TabsTrigger value="payments" />
            <TabsTrigger value="receipts" />
            <TabsTrigger value="exchange-rates" />
            <TabsTrigger value="providers" />
          </TabsList>

          {/* Tab: Integración IDRALL */}
          <TabsContent value="payments" className="space-y-6 mt-8">
            {/* Botón Volver al Dashboard */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                onClick={() => setActiveTab("dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowUp className="h-4 w-4 rotate-90" />
                Volver al Dashboard
              </Button>
            </div>

            {/* Header con información */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500 p-3 rounded-xl shadow-lg">
                  <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Integración con IDRALL
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Descarga y sube tu archivo Excel de IDRALL para crear pagos automáticamente
                  </p>
                </div>
              </div>
            </div>

            {/* Upload de Excel IDRALL */}
            <Card className="max-w-2xl mx-auto shadow-xl border-2 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Subir Excel de IDRALL
                </CardTitle>
                <CardDescription>
                  El sistema procesará automáticamente los pagos y los creará en estado "Pendiente"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selector de Empresa */}
                <div className="space-y-2">
                  <Label htmlFor="idrall-company">Empresa *</Label>
                  <Select
                    value={selectedCompanyForIdrall?.toString() || ""}
                    onValueChange={(value) => setSelectedCompanyForIdrall(parseInt(value))}
                  >
                    <SelectTrigger id="idrall-company">
                      <SelectValue placeholder="Selecciona la empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Dura International</SelectItem>
                      <SelectItem value="2">Grupo Orsega</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload de archivo */}
                <div className="space-y-2">
                  <Label htmlFor="idrall-file">Archivo Excel (.xlsx, .xls) *</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="idrall-file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIdrallFile(file);
                        }
                      }}
                      className="flex-1"
                    />
                    {idrallFile && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <FileSpreadsheet className="h-3 w-3" />
                        {idrallFile.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Opciones adicionales */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-as-pending"
                    checked={createAsPending}
                    onCheckedChange={(checked) => setCreateAsPending(checked as boolean)}
                  />
                  <Label htmlFor="create-as-pending" className="text-sm">
                    Crear pagos en estado "Pendiente" (recomendado)
                  </Label>
                </div>

                {/* Botón de procesamiento */}
                <Button
                  onClick={handleIdrallUpload}
                  disabled={!idrallFile || !selectedCompanyForIdrall || idrallUploadMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {idrallUploadMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Procesando Excel...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Procesar Excel de IDRALL
                    </>
                  )}
                </Button>

                {/* Resultado del procesamiento */}
                {idrallResult && (
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">
                      ✅ Procesamiento completado
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>📊 Filas procesadas: {idrallResult.summary.totalRows}</p>
                      <p>✅ Pagos válidos: {idrallResult.summary.validPayments}</p>
                      <p>🎯 Pagos creados: {idrallResult.summary.createdPayments}</p>
                      {idrallResult.summary.errors > 0 && (
                        <p className="text-orange-600">⚠️ Errores: {idrallResult.summary.errors}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Instrucciones */}
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-lg">📋 Instrucciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-600">1.</span>
                  <span>Descarga tu archivo Excel desde IDRALL con los pagos programados</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-600">2.</span>
                  <span>Selecciona la empresa correspondiente</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-600">3.</span>
                  <span>Sube el archivo Excel (.xlsx, .xls o .csv)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-600">4.</span>
                  <span>El sistema creará automáticamente las tarjetas de pago en estado "Pendiente"</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-blue-600">5.</span>
                  <span>Los pagos aparecerán en el tablero Kanban para seguimiento</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exchange-rates" className="space-y-6">
            {/* Botón Volver al Dashboard */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                onClick={() => setActiveTab("dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowUp className="h-4 w-4 rotate-90" />
                Volver al Dashboard
              </Button>
            </div>

            {/* Header con Botón de Registro */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  ¡Hola Emilio! Así amaneció el tipo de cambio hoy
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Análisis completo del mercado cambiario
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
            
            {/* Botón Ver más / Ver menos - Solo si hay proveedores */}
            {filteredSuppliers.length > 0 && filteredSuppliers.length > 5 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAllSuppliers(!showAllSuppliers)}
                  className="flex items-center gap-2 px-6 py-2"
                >
                  {showAllSuppliers ? (
                    <>
                      <ArrowUp className="h-4 w-4" />
                      Ver menos ({filteredSuppliers.length - 5} ocultos)
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-4 w-4" />
                      Ver más ({filteredSuppliers.length - 5} adicionales)
                    </>
                  )}
                </Button>
              </div>
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
          <TabsContent value="receipts" className="space-y-6">
            {/* Botón Volver al Dashboard */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                onClick={() => setActiveTab("dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowUp className="h-4 w-4 rotate-90" />
                Volver al Dashboard
              </Button>
            </div>

            <div className="flex justify-end mb-6">
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
                    {/* Selector de Empresa */}
                    <div className="space-y-2">
                      <Label htmlFor="company-select">Empresa *</Label>
                      <Select
                        value={selectedCompanyForVoucher?.toString() || ""}
                        onValueChange={(value) => {
                          setSelectedCompanyForVoucher(parseInt(value));
                          setSelectedClientForVoucher(null); // Reset cliente al cambiar empresa
                        }}
                      >
                        <SelectTrigger id="company-select" data-testid="select-company-voucher">
                          <SelectValue placeholder="Selecciona la empresa que está pagando" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Dura International</SelectItem>
                          <SelectItem value="2">Grupo Orsega</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selector de Cliente */}
                    <div className="space-y-2">
                      <Label htmlFor="client-select">Cliente/Proveedor *</Label>
                      <Select
                        value={selectedClientForVoucher?.toString() || ""}
                        onValueChange={(value) => setSelectedClientForVoucher(parseInt(value))}
                        disabled={!selectedCompanyForVoucher}
                      >
                        <SelectTrigger id="client-select" data-testid="select-client-voucher">
                          <SelectValue placeholder={selectedCompanyForVoucher ? "Selecciona un cliente" : "Primero selecciona la empresa"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredClients.map((client: any) => (
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
                      {selectedCompanyForVoucher && filteredClients.length === 0 && (
                        <p className="text-sm text-slate-500">No hay clientes registrados para esta empresa</p>
                      )}
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

            {/* Barra de herramientas minimalista */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {/* Filtros compactos */}
                <div className="flex items-center gap-2">
                  <Select value={voucherMonth} onValueChange={setVoucherMonth} disabled={showAllVouchers}>
                    <SelectTrigger className="w-32" data-testid="select-voucher-month">
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
                  
                  <Select value={voucherYear} onValueChange={setVoucherYear} disabled={showAllVouchers}>
                    <SelectTrigger className="w-20" data-testid="select-voucher-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant={showAllVouchers ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAllVouchers(!showAllVouchers)}
                    data-testid="button-toggle-all-vouchers"
                  >
                    {showAllVouchers ? "Mes Actual" : "Ver Todos"}
                  </Button>
                </div>
              </div>
              
              {/* Estadísticas compactas */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-400"></div>
                  <span className="text-slate-600 dark:text-slate-400">{voucherStats.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                  <span className="text-slate-600 dark:text-slate-400">{voucherStats.pendienteComplemento}</span>
                </div>
              </div>
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

          </TabsContent>

          {/* Tab: Proveedores */}
          <TabsContent value="providers" className="space-y-6">
            {/* Botón Volver al Dashboard */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                onClick={() => setActiveTab("dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowUp className="h-4 w-4 rotate-90" />
                Volver al Dashboard
              </Button>
            </div>

            {/* Header con gradiente */}
            <div className="relative bg-gradient-to-r from-[#273949] via-[#2a4055] to-[#273949] rounded-xl p-8 shadow-2xl overflow-hidden">
              {/* Patrón de fondo decorativo */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, #b5e951 0, #b5e951 2px, transparent 0, transparent 25%)'
                }}></div>
              </div>
              
              <div className="relative flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Gestión de Proveedores
                  </h2>
                  <p className="text-white/80 text-base">
                    Administra proveedores y configura recordatorios de pago (REP)
                  </p>
                </div>
                <Button 
                  onClick={handleOpenNewProvider} 
                  size="lg" 
                  className="bg-accent hover:bg-accent/90 text-primary font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nuevo Proveedor
                </Button>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Filtrar por empresa:
                </label>
                <Select value={supplierCompanyFilter} onValueChange={setSupplierCompanyFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="1">Dura</SelectItem>
                    <SelectItem value="2">Orsega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores
              </div>
            </div>

            {/* Tabla de Proveedores */}
            {suppliersLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-[#273949] to-[#2a4055] flex items-center justify-center mb-6 shadow-xl">
                    <User className="h-12 w-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    No hay proveedores registrados
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                    Comienza agregando tu primer proveedor para gestionar recordatorios de pago y mantener un registro organizado.
                  </p>
                  <Button 
                    onClick={handleOpenNewProvider} 
                    className="bg-gradient-to-r from-[#273949] to-[#2a4055] hover:from-[#2a4055] hover:to-[#273949] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Agregar Primer Proveedor
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg border-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-slate-800 to-slate-700">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Empresa</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Proveedor</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Contacto</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Ubicación</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">REP</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Frecuencia</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {(showAllSuppliers ? filteredSuppliers : filteredSuppliers.slice(0, 5)).map((supplier: any, index: number) => (
                          <tr 
                            key={supplier.id} 
                            className="transition-colors hover:bg-gradient-to-r hover:from-accent/5 hover:to-accent/10 group border-b border-slate-200 dark:border-slate-700"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge 
                                className={`font-semibold shadow-sm ${
                                  supplier.company_id === 1 
                                    ? "bg-blue-500 hover:bg-blue-600 text-white" 
                                    : supplier.company_id === 2
                                    ? "bg-purple-500 hover:bg-purple-600 text-white"
                                    : "bg-slate-500"
                                }`}
                              >
                                {supplier.company_id === 1 ? "Dura" : supplier.company_id === 2 ? "Orsega" : "N/A"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-[#273949] to-[#2a4055] flex items-center justify-center text-white font-bold shadow-md">
                                  {supplier.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {supplier.name}
                                  </div>
                                  {supplier.short_name && (
                                    <div className="text-xs text-slate-500 font-medium">{supplier.short_name}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                <Mail className="h-3 w-3 inline mr-1 text-slate-400" />
                                {supplier.email}
                              </div>
                              {supplier.phone && (
                                <div className="text-xs text-slate-500 mt-1">
                                  <Phone className="h-3 w-3 inline mr-1" />
                                  {supplier.phone}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant="outline" className="font-medium">
                                {supplier.location === "NAC" ? "🇲🇽 Nacional" : supplier.location === "EXT" ? "🌍 Exterior" : "-"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {supplier.requires_rep ? (
                                <Badge className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-sm">
                                  ✓ Activado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="font-medium">-</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {supplier.requires_rep ? (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-accent" />
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {supplier.rep_frequency || 7} días
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditProvider(supplier)}
                                  disabled={deleteSupplierMutation.isPending}
                                  className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 transition-colors"
                                  title="Editar proveedor"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteProvider(supplier.id)}
                                  disabled={deleteSupplierMutation.isPending}
                                  className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors"
                                  title="Eliminar proveedor"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Modal de Proveedor */}
            <Dialog open={isProviderModalOpen} onOpenChange={setIsProviderModalOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-primary/20">
                <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[#273949] to-[#2a4055] bg-clip-text text-transparent">
                    {editingProvider ? "✏️ Editar Proveedor" : "➕ Nuevo Proveedor"}
                  </DialogTitle>
                  <DialogDescription className="text-base mt-2">
                    {editingProvider ? "Modifica los datos del proveedor" : "Completa la información del nuevo proveedor"}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {/* Empresa */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider-company">Empresa *</Label>
                      <Select
                        value={providerForm.companyId}
                        onValueChange={(value) => setProviderForm({ ...providerForm, companyId: value })}
                      >
                        <SelectTrigger id="provider-company">
                          <SelectValue placeholder="Selecciona empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Dura International</SelectItem>
                          <SelectItem value="2">Grupo Orsega</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-location">Ubicación</Label>
                      <Select
                        value={providerForm.location}
                        onValueChange={(value) => setProviderForm({ ...providerForm, location: value })}
                      >
                        <SelectTrigger id="provider-location">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NAC">Nacional</SelectItem>
                          <SelectItem value="EXT">Exterior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Nombre */}
                  <div className="space-y-2">
                    <Label htmlFor="provider-name">Nombre Completo *</Label>
                    <Input
                      id="provider-name"
                      value={providerForm.name}
                      onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                      placeholder="Transportes Potosinos"
                    />
                  </div>

                  {/* Nombre Corto */}
                  <div className="space-y-2">
                    <Label htmlFor="provider-short-name">Nombre Corto</Label>
                    <Input
                      id="provider-short-name"
                      value={providerForm.shortName}
                      onChange={(e) => setProviderForm({ ...providerForm, shortName: e.target.value })}
                      placeholder="Potosinos"
                    />
                  </div>

                  {/* Contacto */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider-email">Email *</Label>
                      <Input
                        id="provider-email"
                        type="email"
                        value={providerForm.email}
                        onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value })}
                        placeholder="contacto@proveedor.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider-phone">Teléfono</Label>
                      <Input
                        id="provider-phone"
                        value={providerForm.phone}
                        onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })}
                        placeholder="+52 55 1234 5678"
                      />
                    </div>
                  </div>

                  {/* Persona de Contacto */}
                  <div className="space-y-2">
                    <Label htmlFor="provider-contact">Persona de Contacto</Label>
                    <Input
                      id="provider-contact"
                      value={providerForm.contactName}
                      onChange={(e) => setProviderForm({ ...providerForm, contactName: e.target.value })}
                      placeholder="Juan Pérez"
                    />
                  </div>

                  {/* Configuración REP */}
                  <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4 bg-gradient-to-br from-accent/5 to-accent/10 p-4 rounded-lg">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-accent" />
                      Configuración REP (Recordatorios de Pago)
                    </h4>
                    
                    <div className="flex items-center space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Checkbox
                        id="provider-requires-rep"
                        checked={providerForm.requiresRep}
                        onCheckedChange={(checked) => setProviderForm({ ...providerForm, requiresRep: checked as boolean })}
                      />
                      <Label htmlFor="provider-requires-rep" className="font-semibold cursor-pointer">
                        Activar recordatorios automáticos de pago
                      </Label>
                    </div>

                    {providerForm.requiresRep && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="provider-rep-frequency">Frecuencia (días)</Label>
                          <Input
                            id="provider-rep-frequency"
                            type="number"
                            min="1"
                            value={providerForm.repFrequency}
                            onChange={(e) => setProviderForm({ ...providerForm, repFrequency: parseInt(e.target.value) || 7 })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="provider-reminder-email">Email para Recordatorios</Label>
                          <Input
                            id="provider-reminder-email"
                            type="email"
                            value={providerForm.reminderEmail}
                            onChange={(e) => setProviderForm({ ...providerForm, reminderEmail: e.target.value })}
                            placeholder="recordatorios@proveedor.com"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  <div className="space-y-2">
                    <Label htmlFor="provider-notes">Notas</Label>
                    <textarea
                      id="provider-notes"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md min-h-[80px]"
                      value={providerForm.notes}
                      onChange={(e) => setProviderForm({ ...providerForm, notes: e.target.value })}
                      placeholder="Información adicional..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsProviderModalOpen(false)}
                    className="font-semibold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveProvider}
                    disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
                    className="bg-gradient-to-r from-[#273949] to-[#2a4055] hover:from-[#2a4055] hover:to-[#273949] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {createSupplierMutation.isPending || updateSupplierMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {editingProvider ? "Actualizar Proveedor" : "Guardar Proveedor"}
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}
