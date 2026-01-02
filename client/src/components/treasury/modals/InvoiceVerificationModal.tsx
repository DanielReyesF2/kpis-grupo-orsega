import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, FileText, CheckCircle2, XCircle, AlertCircle, CheckCircle, Eye, Badge } from "lucide-react";
import { Badge as BadgeComponent } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InvoiceAnalysis {
  extractedSupplierName: string | null;
  extractedAmount: number | null;
  extractedCurrency: string | null;
  extractedDueDate: string | null;
  extractedDate: string | null; // Fecha de factura (para calcular vencimiento si falta)
  extractedInvoiceNumber: string | null;
  extractedReference: string | null;
  extractedTaxId: string | null;
  extractedBank?: string | null;
  extractedOriginAccount?: string | null;
  extractedDestinationAccount?: string | null;
  extractedTrackingKey?: string | null;
  extractedBeneficiaryName?: string | null;
  paymentMethod?: string | null;
  paymentTerms?: string | null;
  transferType?: string | null;
}

interface InvoiceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: {
    analysis: InvoiceAnalysis;
    invoiceFile: {
      path: string;
      originalName: string;
    };
    supplier: {
      id: number | null;
      name: string;
    };
    payerCompanyId: number;
    matchConfidence?: number;
    supplierSuggestions?: Array<{
      id: number;
      name: string;
      confidence: number;
    }>;
  };
}

export function InvoiceVerificationModal({
  isOpen,
  onClose,
  invoiceData,
}: InvoiceVerificationModalProps) {
  const { toast } = useToast();
  
  // Log de datos recibidos para diagnóstico
  console.log('🔍 [InvoiceVerificationModal] Datos recibidos:', JSON.stringify({
    extractedSupplierName: invoiceData.analysis.extractedSupplierName,
    extractedAmount: invoiceData.analysis.extractedAmount,
    extractedCurrency: invoiceData.analysis.extractedCurrency,
    extractedDueDate: invoiceData.analysis.extractedDueDate,
    extractedDate: invoiceData.analysis.extractedDate,
    extractedInvoiceNumber: invoiceData.analysis.extractedInvoiceNumber,
    extractedTaxId: invoiceData.analysis.extractedTaxId,
    supplierName: invoiceData.supplier.name,
    supplierId: invoiceData.supplier.id
  }, null, 2));
  
  // Estados para los datos editables
  const [supplierName, setSupplierName] = useState(invoiceData.analysis.extractedSupplierName || '');
  const [amount, setAmount] = useState(invoiceData.analysis.extractedAmount?.toString() || '');
  const [currency, setCurrency] = useState(invoiceData.analysis.extractedCurrency || 'MXN');
  const [dueDate, setDueDate] = useState<Date | null>(
    invoiceData.analysis.extractedDueDate 
      ? new Date(invoiceData.analysis.extractedDueDate) 
      : (invoiceData.analysis.extractedDate 
          ? (() => {
              const date = new Date(invoiceData.analysis.extractedDate);
              date.setDate(date.getDate() + 30); // Default: +30 días
              return date;
            })()
          : null)
  );
  const [paymentDate, setPaymentDate] = useState<Date | null>(null); // OBLIGATORIO
  const [reference, setReference] = useState(invoiceData.analysis.extractedInvoiceNumber || invoiceData.analysis.extractedReference || '');
  const [notes, setNotes] = useState('');
  const [taxId, setTaxId] = useState(invoiceData.analysis.extractedTaxId || '');
  const [showPreview, setShowPreview] = useState(false);
  
  // Calcular confianza por campo
  const getFieldConfidence = (field: string): number => {
    const analysis = invoiceData.analysis;
    switch (field) {
      case 'supplierName':
        return analysis.extractedSupplierName ? (invoiceData.matchConfidence || 0.8) : 0;
      case 'amount':
        return analysis.extractedAmount ? 0.9 : 0;
      case 'dueDate':
        return analysis.extractedDueDate ? 0.85 : (analysis.extractedDate ? 0.7 : 0);
      case 'invoiceNumber':
        return analysis.extractedInvoiceNumber ? 0.8 : 0;
      case 'taxId':
        return analysis.extractedTaxId ? 0.9 : 0;
      default:
        return 0.5;
    }
  };
  
  // Verificar si todos los campos críticos están presentes
  const hasAllCriticalFields = useMemo(() => {
    return !!(
      supplierName.trim() &&
      amount &&
      dueDate &&
      paymentDate
    );
  }, [supplierName, amount, dueDate, paymentDate]);
  
  // Calcular confianza general
  const overallConfidence = useMemo(() => {
    const fields = ['supplierName', 'amount', 'dueDate', 'invoiceNumber', 'taxId'];
    const confidences = fields.map(f => getFieldConfidence(f));
    return confidences.reduce((a, b) => a + b, 0) / fields.length;
  }, [invoiceData]);

  // Sincronizar estados cuando cambien los datos
  useEffect(() => {
    if (invoiceData) {
      // Usar supplier.name del backend si extractedSupplierName es null o vacío
      // IMPORTANTE: Usar nullish coalescing (??) para distinguir null de ''
      const supplierNameToUse = invoiceData.analysis.extractedSupplierName ?? invoiceData.supplier.name ?? '';
      setSupplierName(supplierNameToUse);
      setAmount(invoiceData.analysis.extractedAmount?.toString() || '');
      setCurrency(invoiceData.analysis.extractedCurrency || 'MXN');
      
      // Fecha de vencimiento: usar la extraída, o calcular desde fecha de factura, o null
      const extractedDueDate = invoiceData.analysis.extractedDueDate 
        ? new Date(invoiceData.analysis.extractedDueDate) 
        : null;
      
      if (extractedDueDate) {
        setDueDate(extractedDueDate);
      } else if (invoiceData.analysis.extractedDate) {
        // Calcular fecha de vencimiento por defecto (+30 días desde fecha de factura)
        const invoiceDate = new Date(invoiceData.analysis.extractedDate);
        const calculatedDueDate = new Date(invoiceDate);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + 30);
        setDueDate(calculatedDueDate);
      } else {
        setDueDate(null);
      }
      
      setReference(invoiceData.analysis.extractedInvoiceNumber || invoiceData.analysis.extractedReference || '');
      setTaxId(invoiceData.analysis.extractedTaxId || '');
      setNotes('');
      setPaymentDate(null); // Resetear fecha de pago
    }
  }, [invoiceData]);

  const confirmMutation = useMutation({
    mutationFn: async (data: {
      payerCompanyId: number;
      supplierId: number | null;
      supplierName: string;
      amount: number;
      currency: string;
      dueDate: Date;
      paymentDate: Date;
      reference: string | null;
      notes: string | null;
      invoiceFilePath: string;
      invoiceFileName: string;
      extractedInvoiceNumber: string | null;
      extractedTaxId: string | null;
    }) => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No se encontró token de autenticación");
      }

      const response = await fetch("/api/scheduled-payments/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.details || "Error al confirmar cuenta por pagar");
      }

      return await response.json();
    },
    onSuccess: async (data) => {
      console.log('✅ [InvoiceVerificationModal] Cuenta por pagar creada:', data);
      
      toast({
        title: "✅ Cuenta por pagar creada exitosamente",
        description: data.message || "La cuenta por pagar ha sido creada con la fecha de pago especificada",
      });
      
      // Invalidar y refetch queries relacionadas inmediatamente
      // Usar exact: false para invalidar todas las queries que empiezan con estas keys
      await Promise.all([
        queryClient.invalidateQueries({ 
          queryKey: ["/api/treasury/payments"],
          exact: false, // Invalida todas las queries que empiezan con esta key (incluye las que tienen companyId)
        }),
        queryClient.invalidateQueries({ 
          queryKey: ["/api/payment-vouchers"],
          exact: false,
        }),
        queryClient.invalidateQueries({ 
          queryKey: ["/api/scheduled-payments"],
          exact: false,
        }),
      ]);
      
      // Forzar refetch inmediato para asegurar que los datos se actualicen
      await queryClient.refetchQueries({ 
        queryKey: ["/api/treasury/payments"],
        exact: false, // Refetch todas las queries relacionadas
      });
      
      console.log('✅ [InvoiceVerificationModal] Queries invalidadas y refetched');
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al confirmar cuenta por pagar",
        description: error.message || "No se pudo crear la cuenta por pagar",
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    // Validaciones
    if (!supplierName.trim()) {
      toast({
        title: "Error de validación",
        description: "El nombre del proveedor es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        title: "Error de validación",
        description: "El monto debe ser un número válido mayor a cero",
        variant: "destructive",
      });
      return;
    }

    if (!dueDate) {
      toast({
        title: "Error de validación",
        description: "La fecha de vencimiento es obligatoria",
        variant: "destructive",
      });
      return;
    }

    // ✅ VALIDACIÓN CRÍTICA: Fecha de pago es OBLIGATORIA
    if (!paymentDate) {
      toast({
        title: "Fecha de pago requerida",
        description: "Debes especificar la fecha de pago para confirmar la cuenta por pagar",
        variant: "destructive",
      });
      return;
    }

    // Confirmar creación
    confirmMutation.mutate({
      payerCompanyId: invoiceData.payerCompanyId,
      supplierId: invoiceData.supplier.id,
      supplierName: supplierName.trim(),
      amount: parseFloat(amount),
      currency: currency,
      dueDate: dueDate,
      paymentDate: paymentDate, // ✅ Fecha de pago obligatoria
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      invoiceFilePath: invoiceData.invoiceFile.path,
      invoiceFileName: invoiceData.invoiceFile.originalName,
      extractedInvoiceNumber: invoiceData.analysis.extractedInvoiceNumber || null,
      extractedTaxId: taxId.trim() || null,
    });
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Verificar Datos de Factura
              </DialogTitle>
              <DialogDescription className="mt-2">
                Revisa y confirma los datos extraídos automáticamente. Los campos marcados con * son obligatorios.
              </DialogDescription>
            </div>
            {overallConfidence > 0.8 && hasAllCriticalFields && (
              <BadgeComponent className="bg-green-500 text-white">
                <CheckCircle className="h-3 w-3 mr-1" />
                Listo para confirmar
              </BadgeComponent>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Información del archivo y preview */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Archivo: {invoiceData.invoiceFile.originalName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? "Ocultar" : "Ver"} documento
                </Button>
              </div>
              {showPreview && (
                <div className="mt-4 border rounded-lg p-2 bg-muted/50">
                  <iframe
                    src={`/api/files/${encodeURIComponent(invoiceData.invoiceFile.path)}`}
                    className="w-full h-96 rounded"
                    title="Preview del documento"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Indicador de confianza general */}
          {overallConfidence > 0 && (
            <Card className={cn(
              "border-2",
              overallConfidence > 0.8 ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" :
              overallConfidence > 0.6 ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20" :
              "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
            )}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {overallConfidence > 0.8 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : overallConfidence > 0.6 ? (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      Confianza de extracción: {(overallConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {invoiceData.matchConfidence && invoiceData.matchConfidence > 0.8 && (
                    <BadgeComponent variant="outline" className="text-xs">
                      Proveedor encontrado: {(invoiceData.matchConfidence * 100).toFixed(0)}% confianza
                    </BadgeComponent>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campos editables - Agrupados por sección */}
          
          {/* Sección 1: Datos del Proveedor */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground border-b pb-2">
              Datos del Proveedor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Proveedor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supplierName">
                    Proveedor <span className="text-red-500">*</span>
                  </Label>
                  {getFieldConfidence('supplierName') > 0.7 && (
                    <BadgeComponent variant="outline" className="text-xs">
                      {(getFieldConfidence('supplierName') * 100).toFixed(0)}% confianza
                    </BadgeComponent>
                  )}
                </div>
                <Input
                  id="supplierName"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Nombre del proveedor"
                  className={cn(
                    "w-full",
                    !supplierName.trim() && "border-red-300"
                  )}
                />
                {invoiceData.supplierSuggestions && invoiceData.supplierSuggestions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    💡 Proveedor sugerido: {invoiceData.supplierSuggestions[0].name} 
                    ({(invoiceData.supplierSuggestions[0].confidence * 100).toFixed(0)}% confianza)
                  </p>
                )}
              </div>

              {/* RFC / Tax ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="taxId">RFC / Tax ID</Label>
                  {getFieldConfidence('taxId') > 0.7 && (
                    <BadgeComponent variant="outline" className="text-xs">
                      {(getFieldConfidence('taxId') * 100).toFixed(0)}% confianza
                    </BadgeComponent>
                  )}
                </div>
                <Input
                  id="taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="RFC o Tax ID"
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          {/* Sección 2: Datos Financieros */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground border-b pb-2">
              Datos Financieros
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Monto */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">
                    Monto <span className="text-red-500">*</span>
                  </Label>
                  {getFieldConfidence('amount') > 0.7 && (
                    <BadgeComponent variant="outline" className="text-xs">
                      {(getFieldConfidence('amount') * 100).toFixed(0)}% confianza
                    </BadgeComponent>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={cn(
                      "flex-1",
                      (!amount || parseFloat(amount) <= 0) && "border-red-300"
                    )}
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {/* Referencia / Número de factura */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reference">Referencia / Número de Factura</Label>
                  {getFieldConfidence('invoiceNumber') > 0.7 && (
                    <BadgeComponent variant="outline" className="text-xs">
                      {(getFieldConfidence('invoiceNumber') * 100).toFixed(0)}% confianza
                    </BadgeComponent>
                  )}
                </div>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Número de factura o referencia"
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          {/* Sección 3: Fechas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground border-b pb-2">
              Fechas Importantes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Fecha de vencimiento */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Fecha de Vencimiento <span className="text-red-500">*</span>
                  </Label>
                  {getFieldConfidence('dueDate') > 0.7 && (
                    <BadgeComponent variant="outline" className="text-xs">
                      {(getFieldConfidence('dueDate') * 100).toFixed(0)}% confianza
                    </BadgeComponent>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground border-red-300"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate || undefined}
                      onSelect={(date) => setDueDate(date || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {!dueDate && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Fecha de vencimiento requerida
                  </p>
                )}
              </div>

            {/* Fecha de pago - OBLIGATORIA */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Fecha de Pago <span className="text-red-500">*</span>
                <span className="text-xs text-muted-foreground font-normal">
                  (Cuándo se va a pagar)
                </span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paymentDate && "text-muted-foreground border-red-300"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP", { locale: es }) : "Seleccionar fecha de pago"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate || undefined}
                    onSelect={(date) => setPaymentDate(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {!paymentDate && (
                <p className="text-xs text-red-500 mt-1">
                  La fecha de pago es obligatoria para confirmar la cuenta por pagar
                </p>
              )}
            </div>
          </div>
          </div>
          
          {/* Sección 4: Información Adicional (si está disponible) */}
          {(invoiceData.analysis.paymentTerms || invoiceData.analysis.paymentMethod) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">
                Información Adicional Extraída
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invoiceData.analysis.paymentTerms && (
                  <div className="space-y-2">
                    <Label>Términos de Pago</Label>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {invoiceData.analysis.paymentTerms}
                    </div>
                  </div>
                )}
                {invoiceData.analysis.paymentMethod && (
                  <div className="space-y-2">
                    <Label>Método de Pago</Label>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      {invoiceData.analysis.paymentMethod}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre esta cuenta por pagar"
              className="w-full min-h-[80px] px-3 py-2 border rounded-md bg-background resize-none"
            />
          </div>

          {/* Resumen visual */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Resumen</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Proveedor:</span>
                  <span className="ml-2 font-medium">{supplierName || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Monto:</span>
                  <span className="ml-2 font-medium">
                    {currency} {amount ? parseFloat(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : "0.00"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha de Vencimiento:</span>
                  <span className="ml-2 font-medium">
                    {dueDate ? format(dueDate, "PPP", { locale: es }) : "No especificada"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha de Pago:</span>
                  <span className={cn(
                    "ml-2 font-medium",
                    paymentDate ? "text-green-600" : "text-red-500"
                  )}>
                    {paymentDate ? format(paymentDate, "PPP", { locale: es }) : "⚠️ No especificada"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={confirmMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmMutation.isPending || !paymentDate}
            className="min-w-[140px]"
          >
            {confirmMutation.isPending ? (
              "Confirmando..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Cuenta por Pagar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

