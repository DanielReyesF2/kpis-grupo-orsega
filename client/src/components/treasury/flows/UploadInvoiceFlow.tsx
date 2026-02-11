import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Receipt
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CompanySelector } from "../common/CompanySelector";
import { ProviderAutocomplete } from "../common/ProviderAutocomplete";
import { PDFPreview } from "../common/PDFPreview";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
  company_id: number;
  requires_rep?: boolean;
  rep_frequency?: number;
}

interface UploadInvoiceFlowProps {
  onBack: () => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function UploadInvoiceFlow({ onBack, onSuccess }: UploadInvoiceFlowProps) {
  const { toast } = useToast();

  // State
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Datos de la factura
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [dueDate, setDueDate] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Mutation para crear cuenta por pagar
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("authToken");

      // 1. Crear la cuenta por pagar
      const paymentRes = await fetch("/api/treasury/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          supplierName: selectedSupplier?.name,
          supplierId: selectedSupplier?.id,
          amount: parseFloat(amount),
          currency,
          dueDate,
          reference: reference || null,
          notes: notes || null,
          status: "pending",
        }),
      });

      if (!paymentRes.ok) {
        const error = await paymentRes.json();
        throw new Error(error.error || "Error al crear cuenta por pagar");
      }

      const payment = await paymentRes.json();

      // 2. Si hay archivo, subirlo
      if (file && payment.id) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(`/api/scheduled-payments/${payment.id}/upload-voucher`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          console.warn("No se pudo subir el archivo, pero la cuenta se creó");
        }
      }

      return payment;
    },
    onSuccess: () => {
      toast({
        title: "Cuenta por pagar creada",
        description: `Se registró el pago a ${selectedSupplier?.name} por ${currency} $${parseFloat(amount).toLocaleString()}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      onSuccess?.();
      onBack();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la cuenta por pagar",
        variant: "destructive",
      });
    },
  });

  // File handling
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const processFile = (selectedFile: File) => {
    // Validar tipo
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos PDF, PNG o JPG",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El tamaño máximo es 10MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);

    if (selectedFile.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const removeFile = () => {
    setFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return companyId !== null;
      case 2:
        return selectedSupplier !== null;
      case 3:
        return amount && parseFloat(amount) > 0 && dueDate;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    } else {
      onBack();
    }
  };

  const handleSubmit = () => {
    if (!companyId || !selectedSupplier || !amount || !dueDate) {
      toast({
        title: "Error",
        description: "Completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    createPaymentMutation.mutate();
  };

  const getCompanyName = () => {
    if (companyId === 1) return "Dura International";
    if (companyId === 2) return "Grupo Orsega";
    return "";
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registrar Factura</h1>
          <p className="text-sm text-muted-foreground">
            Paso {currentStep} de 4
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-2 flex-1 rounded-full transition-colors ${
              step <= currentStep ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Seleccionar Empresa */}
      {currentStep === 1 && (
        <Card>
          <CardContent className="p-6">
            <CompanySelector
              selectedCompanyId={companyId}
              onSelect={(id) => {
                setCompanyId(id);
                // Reset supplier si cambia la empresa
                if (selectedSupplier && selectedSupplier.company_id !== id) {
                  setSelectedSupplier(null);
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Seleccionar Proveedor */}
      {currentStep === 2 && (
        <Card>
          <CardContent className="p-6">
            <ProviderAutocomplete
              companyId={companyId}
              selectedSupplierId={selectedSupplier?.id || null}
              onSelect={setSelectedSupplier}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Datos de la Factura */}
      {currentStep === 3 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <h3 className="text-xl font-bold text-foreground">
              Datos de la factura
            </h3>

            {/* Resumen de selección */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Empresa:</span>
                <span className="font-medium">{getCompanyName()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Proveedor:</span>
                <span className="font-medium">{selectedSupplier?.name}</span>
                {selectedSupplier?.requires_rep && (
                  <Badge variant="outline" className="text-xs">REP</Badge>
                )}
              </div>
            </div>

            {/* Monto */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="amount">Monto *</Label>
                <div className="relative mt-1.5">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <Label>Moneda</Label>
                <div className="flex gap-2 mt-1.5">
                  <Button
                    type="button"
                    variant={currency === "MXN" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setCurrency("MXN")}
                  >
                    MXN
                  </Button>
                  <Button
                    type="button"
                    variant={currency === "USD" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setCurrency("USD")}
                  >
                    USD
                  </Button>
                </div>
              </div>
            </div>

            {/* Fecha de vencimiento */}
            <div>
              <Label htmlFor="dueDate">Fecha de vencimiento *</Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Referencia */}
            <div>
              <Label htmlFor="reference">Referencia / No. Factura</Label>
              <Input
                id="reference"
                placeholder="Ej: FAC-2024-001"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Subir Archivo (Opcional) */}
      {currentStep === 4 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Adjuntar factura (opcional)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Puedes adjuntar el PDF de la factura ahora o hacerlo después
              </p>
            </div>

            {/* Resumen */}
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-3">Resumen de la cuenta por pagar</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">{getCompanyName()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Proveedor:</span>
                  <p className="font-medium">{selectedSupplier?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Monto:</span>
                  <p className="font-medium text-lg">
                    {currency} ${parseFloat(amount || "0").toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Vencimiento:</span>
                  <p className="font-medium">
                    {dueDate ? new Date(dueDate + "T12:00:00").toLocaleDateString("es-MX") : "-"}
                  </p>
                </div>
                {reference && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Referencia:</span>
                    <p className="font-medium">{reference}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Drop zone */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("invoice-file")?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                  ${isDragging
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <p className="font-medium">
                  {isDragging ? "Suelta el archivo aquí" : "Arrastra la factura aquí"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, PNG, JPG (máx. 10MB)
                </p>
                <Button variant="outline" className="mt-4">
                  Seleccionar archivo
                </Button>
                <input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {filePreview && file.type === "application/pdf" && (
                  <PDFPreview file={file} />
                )}
                {filePreview && file.type.startsWith("image/") && (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded border"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? "Cancelar" : "Anterior"}
        </Button>

        {currentStep < 4 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Siguiente
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createPaymentMutation.isPending}
            className="min-w-[150px]"
          >
            {createPaymentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Crear cuenta
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
