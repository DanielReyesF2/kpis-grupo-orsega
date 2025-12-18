/**
 * InvoiceUploadWizard - Wizard para subir facturas con selección de empresa y proveedor
 *
 * Flujo:
 * 1. Seleccionar empresa (DURA o ORSEGA)
 * 2. Seleccionar proveedor
 * 3. Subir factura(s)
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Building2,
  Search,
  Check,
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
  company_id: number;
  is_active?: boolean;
}

interface InvoiceUploadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (data: any) => void;
}

type Step = "company" | "supplier" | "upload";

export function InvoiceUploadWizard({ isOpen, onClose, onUploadComplete }: InvoiceUploadWizardProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>("company");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch suppliers
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    staleTime: 60000,
  });

  // Filter suppliers by company and search
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!supplier.is_active) return false;
    if (selectedCompanyId && supplier.company_id !== selectedCompanyId) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(search) ||
      supplier.short_name?.toLowerCase().includes(search)
    );
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, payerCompanyId, supplierId }: { file: File; payerCompanyId: number; supplierId: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("payerCompanyId", payerCompanyId.toString());
      formData.append("supplierId", supplierId.toString()); // Pre-selected supplier

      const response = await fetch("/api/treasury/upload-document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      toast({
        title: "✅ Factura procesada",
        description: `Factura de ${selectedSupplier?.name} procesada exitosamente`,
      });
      onUploadComplete(data);
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al procesar factura",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep("company");
    setSelectedCompanyId(null);
    setSelectedSupplier(null);
    setSearchTerm("");
    setFiles([]);
    onClose();
  };

  const handleCompanySelect = (companyId: number) => {
    setSelectedCompanyId(companyId);
    setSelectedSupplier(null);
    setSearchTerm("");
    setCurrentStep("supplier");
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setCurrentStep("upload");
  };

  const handleBack = () => {
    if (currentStep === "supplier") {
      setCurrentStep("company");
      setSelectedCompanyId(null);
    } else if (currentStep === "upload") {
      setCurrentStep("supplier");
      setFiles([]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === "application/pdf" ||
              file.type === "text/xml" ||
              file.name.endsWith('.xml') ||
              file.type.startsWith("image/")
    );
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!selectedCompanyId || !selectedSupplier || files.length === 0) return;

    for (const file of files) {
      await uploadMutation.mutateAsync({
        file,
        payerCompanyId: selectedCompanyId,
        supplierId: selectedSupplier.id,
      });
    }
  };

  const getCompanyName = (id: number) => id === 1 ? "DURA International" : "Grupo ORSEGA";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Subir Factura
          </DialogTitle>
          <DialogDescription>
            {currentStep === "company" && "Paso 1: Selecciona la empresa que pagará esta factura"}
            {currentStep === "supplier" && "Paso 2: Selecciona el proveedor de la factura"}
            {currentStep === "upload" && "Paso 3: Sube el archivo de la factura"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
            currentStep === "company" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"
          )}>
            1
          </div>
          <div className={cn("h-1 w-12 rounded", currentStep !== "company" ? "bg-primary" : "bg-muted")} />
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
            currentStep === "supplier" ? "bg-primary text-primary-foreground" :
            currentStep === "upload" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            2
          </div>
          <div className={cn("h-1 w-12 rounded", currentStep === "upload" ? "bg-primary" : "bg-muted")} />
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
            currentStep === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            3
          </div>
        </div>

        {/* Step 1: Select Company */}
        {currentStep === "company" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              ¿A qué empresa corresponde esta factura?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={cn(
                  "cursor-pointer hover:border-primary transition-all hover:shadow-md",
                  selectedCompanyId === 1 && "border-primary bg-primary/5"
                )}
                onClick={() => handleCompanySelect(1)}
              >
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg">DURA International</h3>
                    <p className="text-sm text-muted-foreground">Químicos y Materias Primas</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer hover:border-primary transition-all hover:shadow-md",
                  selectedCompanyId === 2 && "border-primary bg-primary/5"
                )}
                onClick={() => handleCompanySelect(2)}
              >
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Package className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg">Grupo ORSEGA</h3>
                    <p className="text-sm text-muted-foreground">Distribución y Logística</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Select Supplier */}
        {currentStep === "supplier" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{getCompanyName(selectedCompanyId!)}</Badge>
              <span>→ Selecciona proveedor</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar proveedor por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {isLoadingSuppliers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron proveedores
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <Card
                    key={supplier.id}
                    className={cn(
                      "cursor-pointer hover:border-primary transition-all",
                      selectedSupplier?.id === supplier.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => handleSupplierSelect(supplier)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{supplier.name}</p>
                        {supplier.short_name && (
                          <p className="text-xs text-muted-foreground">{supplier.short_name}</p>
                        )}
                      </div>
                      {selectedSupplier?.id === supplier.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Button variant="ghost" onClick={handleBack} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cambiar empresa
            </Button>
          </div>
        )}

        {/* Step 3: Upload File */}
        {currentStep === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{getCompanyName(selectedCompanyId!)}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">{selectedSupplier?.name}</Badge>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                "hover:border-primary hover:bg-primary/5"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {files.length === 0 ? (
                <>
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Arrastra tu factura aquí
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    PDF, XML, JPG, PNG
                  </p>
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.xml,image/*"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <Button variant="outline" asChild>
                      <span>Seleccionar archivo</span>
                    </Button>
                  </label>
                </>
              ) : (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cambiar proveedor
              </Button>
              <Button
                onClick={handleUpload}
                disabled={files.length === 0 || uploadMutation.isPending}
                className="flex-1"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Factura
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
