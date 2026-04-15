import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PDFPreview } from "../common/PDFPreview";

interface ScheduledPayment {
  id: number;
  companyId: number;
  supplierId: number | null;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  reference: string | null;
  totalPaid?: number | null;
  paymentStatus?: string | null;
}

// Factura pendiente del API
interface PayableInvoice {
  id: number;
  supplier_name: string;
  amount: number;
  currency: string;
  due_date: string;
  reference: string | null;
  total_paid: number | null;
  payment_status: string;
  remaining_balance: number;
}

interface InvoiceSelection {
  paymentId: number;
  amountApplied: number;
  maxAmount: number;
  reference: string | null;
  selected: boolean;
}

interface MultiInvoicePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  triggerPayment: ScheduledPayment;
  onSuccess?: () => void;
}

export function MultiInvoicePaymentDialog({
  isOpen,
  onClose,
  triggerPayment,
  onSuccess,
}: MultiInvoicePaymentDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceSelections, setInvoiceSelections] = useState<InvoiceSelection[]>([]);

  // Fetch facturas pendientes del mismo proveedor
  const { data: payableInvoices = [], isLoading } = useQuery<PayableInvoice[]>({
    queryKey: [`/api/treasury/payments/payable-by-supplier/${triggerPayment.supplierId}?companyId=${triggerPayment.companyId}`],
    enabled: isOpen && !!triggerPayment.supplierId,
  });

  // Inicializar selecciones cuando llegan las facturas
  useEffect(() => {
    if (payableInvoices.length > 0) {
      setInvoiceSelections(payableInvoices.map(inv => ({
        paymentId: inv.id,
        amountApplied: inv.remaining_balance,
        maxAmount: inv.remaining_balance,
        reference: inv.reference,
        // Pre-seleccionar la factura que disparó el flujo
        selected: inv.id === triggerPayment.id,
      })));
    }
  }, [payableInvoices, triggerPayment.id]);

  const selectedInvoices = invoiceSelections.filter(i => i.selected);
  const totalAmount = selectedInvoices.reduce((sum, i) => sum + i.amountApplied, 0);

  const toggleInvoice = (paymentId: number) => {
    setInvoiceSelections(prev => prev.map(i =>
      i.paymentId === paymentId ? { ...i, selected: !i.selected } : i
    ));
  };

  const updateAmount = (paymentId: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInvoiceSelections(prev => prev.map(i =>
      i.paymentId === paymentId
        ? { ...i, amountApplied: Math.min(numValue, i.maxAmount) }
        : i
    ));
  };

  // Mutation para pago múltiple
  const multiPayMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecciona un comprobante");
      if (selectedInvoices.length === 0) throw new Error("Selecciona al menos una factura");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('invoices', JSON.stringify(
        selectedInvoices.map(i => ({
          paymentId: i.paymentId,
          amountApplied: i.amountApplied,
        }))
      ));

      const response = await fetch('/api/payment-vouchers/multi-pay', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar pago');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pago registrado",
        description: data.message || `${data.invoicesProcessed} factura(s) procesadas`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setFile(null);
      setPreview(null);
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al procesar pago",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // File handling
  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/xml', 'text/xml'];

  const processFile = useCallback((selectedFile: File) => {
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xml')) {
      toast({ title: "Formato no válido", description: "Solo PDF, PNG, JPG o XML", variant: "destructive" });
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }
  }, [toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Registrar Pago — {triggerPayment.supplierName}
          </DialogTitle>
          <DialogDescription>
            Selecciona las facturas que cubre este pago y sube el comprobante bancario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lista de facturas */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Facturas pendientes de {triggerPayment.supplierName}
            </h3>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Cargando facturas...</div>
            ) : payableInvoices.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No hay facturas pendientes</div>
            ) : (
              <div className="space-y-2">
                {invoiceSelections.map((inv) => {
                  const invoice = payableInvoices.find(p => p.id === inv.paymentId);
                  if (!invoice) return null;
                  return (
                    <Card key={inv.paymentId} className={`p-3 transition-colors ${inv.selected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={inv.selected}
                          onCheckedChange={() => toggleInvoice(inv.paymentId)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {invoice.reference || `Factura #${invoice.id}`}
                            </span>
                            {invoice.payment_status === 'partially_paid' && (
                              <Badge variant="secondary" className="text-xs">Parcial</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Vence: {format(new Date(invoice.due_date), "dd MMM yyyy", { locale: es })}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Total: {invoice.currency} ${invoice.amount.toLocaleString()}
                            </span>
                            {(invoice.total_paid || 0) > 0 && (
                              <span className="text-orange-600">
                                Pagado: ${(invoice.total_paid || 0).toLocaleString()} — Pendiente: ${invoice.remaining_balance.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {inv.selected && (
                          <div className="w-32">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={inv.maxAmount}
                              value={inv.amountApplied}
                              onChange={(e) => updateAmount(inv.paymentId, e.target.value)}
                              className="h-8 text-sm text-right"
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Resumen */}
            {selectedInvoices.length > 0 && (
              <Card className="p-3 mt-3 bg-primary/10 border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedInvoices.length} factura{selectedInvoices.length > 1 ? 's' : ''} seleccionada{selectedInvoices.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-lg font-bold">
                    {triggerPayment.currency} ${totalAmount.toLocaleString()}
                  </span>
                </div>
              </Card>
            )}
          </div>

          {/* Upload de comprobante */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Comprobante bancario
            </h3>

            {!file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
                }}
                onClick={() => document.getElementById('multi-pay-file-input')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arrastra el comprobante aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG o XML (máx. 10MB)</p>
                <input
                  id="multi-pay-file-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.xml"
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
              </div>
            ) : (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {preview && file.type === 'application/pdf' && (
                  <div className="mt-2 max-h-48 overflow-hidden rounded">
                    <PDFPreview file={file} url={preview} />
                  </div>
                )}
                {preview && file.type.startsWith('image/') && (
                  <img src={preview} alt="Preview" className="mt-2 max-h-48 rounded object-contain" />
                )}
              </Card>
            )}
          </div>

          {/* Botón de confirmación */}
          <Button
            className="w-full h-12 text-lg font-semibold"
            disabled={!file || selectedInvoices.length === 0 || multiPayMutation.isPending}
            onClick={() => multiPayMutation.mutate()}
          >
            {multiPayMutation.isPending
              ? "Procesando pago..."
              : `Confirmar pago — ${triggerPayment.currency} $${totalAmount.toLocaleString()}`
            }
          </Button>

          {selectedInvoices.some(i => i.amountApplied < i.maxAmount) && (
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <AlertCircle className="h-4 w-4" />
              Hay pagos parciales — las facturas no completadas seguirán en pendientes.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}