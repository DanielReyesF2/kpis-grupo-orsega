/**
 * InvoiceUploadFlow - Flujo horizontal de 3 pasos para subir facturas
 *
 * Los 3 pasos son visibles simultáneamente de izquierda a derecha:
 * 1. Seleccionar empresa
 * 2. Seleccionar proveedor
 * 3. Subir documento
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Building2,
  Search,
  Check,
  Upload,
  FileText,
  Loader2,
  X,
  Package,
  ChevronRight,
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

interface InvoiceUploadFlowProps {
  onUploadComplete?: (data: any) => void;
}

export function InvoiceUploadFlow({ onUploadComplete }: InvoiceUploadFlowProps) {
  const queryClient = useQueryClient();
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
      formData.append("voucher", file);
      formData.append("payerCompanyId", payerCompanyId.toString());
      formData.append("supplierId", supplierId.toString());

      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("No se encontró token de autenticación");

      const response = await fetch("/api/payment-vouchers/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.error || data.message || `Error ${response.status}`);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      toast({
        title: "✅ Factura procesada",
        description: `Factura de ${selectedSupplier?.name} procesada exitosamente`,
      });
      // Reset form
      setSelectedCompanyId(null);
      setSelectedSupplier(null);
      setFiles([]);
      setSearchTerm("");
      onUploadComplete?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error al procesar factura",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const handleCompanySelect = (companyId: number) => {
    setSelectedCompanyId(companyId);
    if (selectedSupplier && selectedSupplier.company_id !== companyId) {
      setSelectedSupplier(null);
    }
    setSearchTerm("");
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
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

  const canProceed = selectedCompanyId && selectedSupplier && files.length > 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Subir Factura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Paso 1: Empresa */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                selectedCompanyId ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"
              )}>
                {selectedCompanyId ? <Check className="h-3 w-3" /> : "1"}
              </div>
              <span className="font-medium text-sm">Empresa</span>
            </div>

            <div className="space-y-2">
              <div
                className={cn(
                  "p-3 rounded-lg border-2 cursor-pointer transition-all",
                  selectedCompanyId === 1
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-primary/50"
                )}
                onClick={() => handleCompanySelect(1)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">DURA International</p>
                    <p className="text-xs text-muted-foreground">Químicos</p>
                  </div>
                  {selectedCompanyId === 1 && <Check className="h-4 w-4 text-primary ml-auto" />}
                </div>
              </div>

              <div
                className={cn(
                  "p-3 rounded-lg border-2 cursor-pointer transition-all",
                  selectedCompanyId === 2
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-primary/50"
                )}
                onClick={() => handleCompanySelect(2)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Grupo ORSEGA</p>
                    <p className="text-xs text-muted-foreground">Logística</p>
                  </div>
                  {selectedCompanyId === 2 && <Check className="h-4 w-4 text-primary ml-auto" />}
                </div>
              </div>
            </div>
          </div>

          {/* Flecha separadora (solo desktop) */}
          <div className="hidden lg:flex items-center justify-center -mx-4">
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Paso 2: Proveedor */}
          <div className={cn("space-y-3", !selectedCompanyId && "opacity-50 pointer-events-none")}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                selectedSupplier ? "bg-green-500 text-white" :
                selectedCompanyId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {selectedSupplier ? <Check className="h-3 w-3" /> : "2"}
              </div>
              <span className="font-medium text-sm">Proveedor</span>
              {selectedSupplier && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedSupplier.short_name || selectedSupplier.name.substring(0, 15)}
                </Badge>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
                disabled={!selectedCompanyId}
              />
            </div>

            <div className="max-h-[140px] overflow-y-auto space-y-1">
              {isLoadingSuppliers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">
                  {selectedCompanyId ? "Sin proveedores" : "Selecciona empresa"}
                </p>
              ) : (
                filteredSuppliers.slice(0, 5).map((supplier) => (
                  <div
                    key={supplier.id}
                    className={cn(
                      "p-2 rounded cursor-pointer transition-all text-sm",
                      selectedSupplier?.id === supplier.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    )}
                    onClick={() => handleSupplierSelect(supplier)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{supplier.name}</span>
                      {selectedSupplier?.id === supplier.id && (
                        <Check className="h-3 w-3 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
              {filteredSuppliers.length > 5 && (
                <p className="text-xs text-center text-muted-foreground py-1">
                  +{filteredSuppliers.length - 5} más...
                </p>
              )}
            </div>
          </div>

          {/* Flecha separadora (solo desktop) */}
          <div className="hidden lg:flex items-center justify-center -mx-4">
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Paso 3: Subir documento */}
          <div className={cn("space-y-3", !selectedSupplier && "opacity-50 pointer-events-none")}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                files.length > 0 ? "bg-green-500 text-white" :
                selectedSupplier ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {files.length > 0 ? <Check className="h-3 w-3" /> : "3"}
              </div>
              <span className="font-medium text-sm">Documento</span>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-colors min-h-[120px] flex flex-col items-center justify-center",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                selectedSupplier && "hover:border-primary hover:bg-primary/5 cursor-pointer"
              )}
              onDragOver={(e) => { e.preventDefault(); if (selectedSupplier) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={selectedSupplier ? handleDrop : undefined}
            >
              {files.length === 0 ? (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground mb-2">
                    Arrastra aquí o
                  </p>
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.xml,image/*"
                      multiple
                      onChange={handleFileSelect}
                      disabled={!selectedSupplier}
                    />
                    <Button variant="outline" size="sm" asChild disabled={!selectedSupplier}>
                      <span className="text-xs">Seleccionar</span>
                    </Button>
                  </label>
                </>
              ) : (
                <div className="w-full space-y-1">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={!canProceed || uploadMutation.isPending}
              className="w-full"
              size="sm"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Procesar Factura
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
