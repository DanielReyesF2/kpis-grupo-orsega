import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Receipt,
  Sparkles,
  AlertCircle
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

  // Datos opcionales (se pueden llenar manualmente o los extrae Nova)
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [dueDate, setDueDate] = useState<string>("");
  const [reference, setReference] = useState<string>("");

  // Mutation para crear cuenta por pagar y subir archivo
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
          amount: amount ? parseFloat(amount) : 0,
          currency,
          dueDate: dueDate || new Date().toISOString().split('T')[0],
          reference: reference || null,
          status: "pending",
        }),
      });

      if (!paymentRes.ok) {
        const error = await paymentRes.json();
        throw new Error(error.error || "Error al crear cuenta por pagar");
      }

      const payment = await paymentRes.json();

      // 2. Subir el archivo (obligatorio en este flujo)
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
          // Si falla el upload, igual se creó el payment
          console.warn("No se pudo subir el archivo, pero la cuenta se creó");
          toast({
            title: "Aviso",
            description: "La cuenta se creó pero el archivo no se pudo subir. Puedes subirlo después.",
            variant: "destructive",
          });
        }
      }

      return payment;
    },
    onSuccess: () => {
      toast({
        title: "Factura registrada",
        description: `Se creó la cuenta por pagar a ${selectedSupplier?.name}. Nova AI extraerá los datos automáticamente.`,
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
  const processFile = useCallback((selectedFile: File) => {
    // Validar tipo
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "application/xml", "text/xml"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos PDF, PNG, JPG o XML",
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
    } else if (selectedFile.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFilePreview(null); // XML no tiene preview visual
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

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
  }, [processFile]);

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
        return file !== null; // Archivo es obligatorio
      case 4:
        return true; // Los datos son opcionales
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
    if (!companyId || !selectedSupplier || !file) {
      toast({
        title: "Error",
        description: "Selecciona empresa, proveedor y sube un archivo",
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

      {/* Step 3: Subir Factura */}
      {currentStep === 3 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Sube la factura
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                El sistema extraerá automáticamente los datos del documento
              </p>
            </div>

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

            {/* Drop zone */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("invoice-file")?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
                  ${isDragging
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-lg font-medium">
                  {isDragging ? "Suelta el archivo aquí" : "Arrastra la factura aquí"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  PDF, PNG, JPG o XML (máx. 10MB)
                </p>
                <Button variant="outline" className="mt-4">
                  Seleccionar archivo
                </Button>
                <input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
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

                {/* Preview */}
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
                {file.type.includes("xml") && (
                  <div className="p-4 bg-muted rounded text-center text-sm text-muted-foreground">
                    Archivo XML - Los datos serán extraídos automáticamente
                  </div>
                )}

                {/* Nova AI badge */}
                <div className="mt-4 p-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                      Nova AI extraerá los datos automáticamente
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Monto, fecha de vencimiento, referencia y más
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirmar (datos opcionales) */}
      {currentStep === 4 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Confirmar y crear
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Opcionalmente puedes agregar datos. Nova AI los extraerá del documento.
              </p>
            </div>

            {/* Resumen */}
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Resumen
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">{getCompanyName()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Proveedor:</span>
                  <p className="font-medium">{selectedSupplier?.name}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Archivo:</span>
                  <p className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {file?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Datos opcionales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Opcional: Puedes agregar datos manualmente o dejar que Nova los extraiga</span>
              </div>

              {/* Monto */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="amount">Monto (opcional)</Label>
                  <div className="relative mt-1.5">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Nova lo extraerá"
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
                      size="sm"
                      onClick={() => setCurrency("MXN")}
                    >
                      MXN
                    </Button>
                    <Button
                      type="button"
                      variant={currency === "USD" ? "default" : "outline"}
                      className="flex-1"
                      size="sm"
                      onClick={() => setCurrency("USD")}
                    >
                      USD
                    </Button>
                  </div>
                </div>
              </div>

              {/* Fecha y referencia */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dueDate">Fecha vencimiento (opcional)</Label>
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
                <div>
                  <Label htmlFor="reference">No. Factura (opcional)</Label>
                  <Input
                    id="reference"
                    placeholder="Nova lo extraerá"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
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
            className="min-w-[180px] bg-emerald-600 hover:bg-emerald-700"
          >
            {createPaymentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Crear cuenta por pagar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
