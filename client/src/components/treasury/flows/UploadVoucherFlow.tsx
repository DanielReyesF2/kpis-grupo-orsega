import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CompanySelector } from "@/components/treasury/common/CompanySelector";
import { ProviderAutocomplete } from "@/components/treasury/common/ProviderAutocomplete";
import { Dropzone, FileWithKind } from "@/components/treasury/common/Dropzone";
import { PreviewModal } from "@/components/treasury/common/PreviewModal";

interface UploadVoucherFlowProps {
  onBack: () => void;
  preselectedCompanyId?: number | null;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function UploadVoucherFlow({ onBack, preselectedCompanyId }: UploadVoucherFlowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<Step>(preselectedCompanyId ? 2 : 1);
  const [payerCompanyId, setPayerCompanyId] = useState<number | null>(preselectedCompanyId || null);
  const [selectedSupplier, setSelectedSupplier] = useState<{
    id: number;
    name: string;
    email?: string;
    requires_rep?: boolean;
    rep_frequency?: number;
  } | null>(null);
  const [files, setFiles] = useState<FileWithKind[]>([]);
  const [matchConfidence, setMatchConfidence] = useState<number | undefined>(
    undefined
  );
  const [showPreview, setShowPreview] = useState(false);

  // Mutación para subir comprobante
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/payment-vouchers/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al subir comprobante");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({
        title: "✅ Comprobante enviado correctamente",
        description: `El comprobante ha sido enviado a ${selectedSupplier?.name || "el proveedor"}`,
      });
      // Resetear y volver al inicio
      setTimeout(() => {
        onBack();
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error al subir comprobante",
        description: error?.message || "No se pudo procesar el comprobante",
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (currentStep < 5) {
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

  const handleSubmit = async () => {
    if (!payerCompanyId || !selectedSupplier || files.length === 0) {
      toast({
        title: "Error",
        description: "Completa todos los pasos antes de continuar",
        variant: "destructive",
      });
      return;
    }

    const voucherFile = files.find((f) => f.kind === "voucher");
    if (!voucherFile) {
      toast({
        title: "Error",
        description: "Debes subir al menos un comprobante bancario",
        variant: "destructive",
      });
      return;
    }

    // Simular coincidencia automática (por ahora siempre 0.9, luego se hará en backend)
    setMatchConfidence(0.9);
    setShowPreview(true);
  };

  const handleConfirmUpload = async () => {
    const voucherFile = files.find((f) => f.kind === "voucher");
    if (!voucherFile || !payerCompanyId || !selectedSupplier) return;

    const formData = new FormData();
    formData.append("voucher", voucherFile.file);
    formData.append("payerCompanyId", payerCompanyId.toString());
    // Nota: La API actualmente usa clientId, pero debería usar supplierId
    // Por ahora mapeamos el supplier como client para compatibilidad
    formData.append("clientId", selectedSupplier.id.toString());
    formData.append("notify", "true");
    
    // Email del proveedor si existe
    if (selectedSupplier.email) {
      formData.append("emailTo", selectedSupplier.email);
    }

    // Nota: La API actual solo acepta un archivo (voucher)
    // Las facturas se pueden agregar después o en una versión futura
    // Por ahora subimos solo el comprobante

    uploadMutation.mutate(formData);
    setShowPreview(false);
  };

  const getCompanyName = () => {
    if (payerCompanyId === 2) return "Grupo Orsega";
    if (payerCompanyId === 1) return "Dura International";
    return "";
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return payerCompanyId !== null;
      case 2:
        return selectedSupplier !== null;
      case 3:
        return files.length > 0 && files.some((f) => f.kind === "voucher");
      case 4:
        return true; // Coincidencia automática (simulado)
      case 5:
        return false; // No hay paso 5 visible, se muestra modal
      default:
        return false;
    }
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6">
        <Button onClick={handleBack} variant="ghost" size="lg">
          <ArrowLeft className="h-5 w-5 mr-2" />
          {currentStep === 1 ? "Volver" : "Atrás"}
        </Button>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base ${
                step === currentStep
                  ? "bg-primary text-primary-foreground"
                  : step < currentStep
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step < currentStep ? <Check className="h-5 w-5" /> : step}
            </div>
          ))}
        </div>
      </div>

      {/* Contenido del paso actual */}
      <Card className="border-2 border-primary/20 shadow-lg min-h-[500px]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">
            {currentStep === 1 && "Paso 1: Selecciona la Empresa"}
            {currentStep === 2 && "Paso 2: Selecciona el Proveedor"}
            {currentStep === 3 && "Paso 3: Sube los Archivos"}
            {currentStep === 4 && "Paso 4: Coincidencia Automática"}
            {currentStep === 5 && "Paso 5: Confirmar y Enviar"}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          {currentStep === 1 && (
            <CompanySelector
              selectedCompanyId={payerCompanyId}
              onSelect={setPayerCompanyId}
            />
          )}

          {currentStep === 2 && (
            <ProviderAutocomplete
              companyId={payerCompanyId}
              selectedSupplierId={selectedSupplier?.id || null}
              onSelect={(supplier) =>
                setSelectedSupplier({
                  id: supplier.id,
                  name: supplier.name,
                  email: supplier.email,
                  requires_rep: supplier.requires_rep,
                  rep_frequency: supplier.rep_frequency,
                })
              }
            />
          )}

          {currentStep === 3 && (
            <Dropzone files={files} onFilesChange={setFiles} />
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Coincidencia Encontrada
                </h3>
                <p className="text-lg text-muted-foreground">
                  El sistema ha encontrado una coincidencia automática entre el
                  comprobante y las facturas
                </p>
                <div className="mt-6 p-4 bg-primary/10 rounded-lg inline-block">
                  <p className="text-sm text-muted-foreground mb-1">
                    Confianza del análisis
                  </p>
                  <p className="text-3xl font-bold text-primary">90%</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="text-center py-8">
              <p className="text-lg text-muted-foreground">
                Revisa la información en el modal de confirmación
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botones de navegación */}
      <div className="flex justify-between">
        <Button onClick={handleBack} variant="outline" size="lg">
          {currentStep === 1 ? "Cancelar" : "Atrás"}
        </Button>
        {currentStep < 4 ? (
          <Button
            onClick={handleNext}
            size="lg"
            disabled={!canProceed()}
            className="min-w-[120px]"
          >
            Siguiente
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        ) : currentStep === 4 ? (
          <Button
            onClick={() => {
              handleSubmit();
              setCurrentStep(5);
            }}
            size="lg"
            disabled={!canProceed()}
            className="min-w-[120px]"
          >
            Ver Vista Previa
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleConfirmUpload}
            size="lg"
            disabled={uploadMutation.isPending}
            className="min-w-[120px]"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Confirmar y Enviar"
            )}
          </Button>
        )}
      </div>

      {/* Modal de vista previa */}
      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmUpload}
        companyName={getCompanyName()}
        providerName={selectedSupplier?.name || ""}
        files={files}
        matchConfidence={matchConfidence}
        isLoading={uploadMutation.isPending}
      />
    </div>
  );
}
