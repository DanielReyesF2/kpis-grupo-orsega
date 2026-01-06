/**
 * InvoiceUploadFlow - Flujo moderno y minimalista para subir facturas
 * 
 * Diseño: Card compacto con pasos claros y zona de drop prominente
 */

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowRight,
  FileUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [foundData, setFoundData] = useState<{ field: string; value: string }[]>([]);

  // Pasos de análisis simulados para mejor UX
  const analysisSteps = [
    { message: "Analizando documento...", progress: 10, duration: 800 },
    { message: "Buscando RFC...", progress: 25, duration: 1000 },
    { message: "Extrayendo monto...", progress: 40, duration: 900 },
    { message: "Detectando fecha de vencimiento...", progress: 55, duration: 800 },
    { message: "Identificando proveedor...", progress: 70, duration: 700 },
    { message: "Verificando datos...", progress: 85, duration: 600 },
  ];

  const runAnalysisAnimation = async () => {
    setFoundData([]);
    for (const step of analysisSteps) {
      setAnalysisStep(step.message);
      setUploadProgress(step.progress);
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }
  };

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

      // Iniciar animación de análisis en paralelo con el upload
      const animationPromise = runAnalysisAnimation();
      
      const response = await fetch("/api/payment-vouchers/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      // Esperar a que termine la animación si el upload fue más rápido
      await animationPromise;

      // Mostrar datos encontrados
      if (data.analysis) {
        const found: { field: string; value: string }[] = [];
        if (data.analysis.extractedTaxId) {
          found.push({ field: "RFC", value: data.analysis.extractedTaxId });
        }
        if (data.analysis.extractedAmount) {
          found.push({ field: "Monto", value: `$${Number(data.analysis.extractedAmount).toLocaleString()}` });
        }
        if (data.analysis.extractedSupplierName) {
          found.push({ field: "Proveedor", value: data.analysis.extractedSupplierName.substring(0, 25) });
        }
        if (data.analysis.extractedDueDate) {
          const date = new Date(data.analysis.extractedDueDate);
          found.push({ field: "Vencimiento", value: date.toLocaleDateString('es-MX') });
        }
        setFoundData(found);
        setAnalysisStep(found.length > 0 ? "✓ Datos extraídos" : "Análisis completado");
      }
      
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(data.error || data.message || `Error ${response.status}`);
      }

      // Pequeña pausa para mostrar los datos encontrados
      await new Promise(resolve => setTimeout(resolve, 1500));

      return data;
    },
    onSuccess: (data) => {
      if (data?.requiresVerification) {
        console.log('📋 [InvoiceUploadFlow] Factura requiere verificación');
        onUploadComplete?.(data);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
        toast({
          title: "✅ Documento procesado",
          description: `Factura de ${selectedSupplier?.name} procesada exitosamente`,
        });
        resetForm();
        onUploadComplete?.(data);
      }
    },
    onError: (error: any) => {
      setUploadProgress(0);
      setAnalysisStep("");
      setFoundData([]);
      toast({
        title: "Error al procesar factura",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedCompanyId(null);
    setSelectedSupplier(null);
    setFiles([]);
    setSearchTerm("");
    setUploadProgress(0);
    setAnalysisStep("");
    setFoundData([]);
  };

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

  const currentStep = !selectedCompanyId ? 1 : !selectedSupplier ? 2 : 3;
  const canUpload = selectedCompanyId && selectedSupplier && files.length > 0;

  const companies = [
    { id: 1, name: "DURA", fullName: "DURA International", color: "blue", icon: Building2 },
    { id: 2, name: "ORSEGA", fullName: "Grupo ORSEGA", color: "emerald", icon: Package },
  ];

  return (
    <Card className="overflow-hidden border-2 border-dashed border-slate-200 hover:border-primary/50 transition-colors">
      <CardContent className="p-0">
        {/* Header con progreso */}
        <div className="bg-gradient-to-r from-slate-50 to-white px-5 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <FileUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Subir Factura</h3>
                <p className="text-xs text-muted-foreground">PDF, XML o imagen</p>
              </div>
            </div>
            
            {/* Indicador de pasos minimalista */}
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    step === currentStep ? "w-6 bg-primary" :
                    step < currentStep ? "w-3 bg-primary/60" : "w-3 bg-slate-200"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Selección rápida - Siempre visible cuando no hay empresa */}
          <AnimatePresence mode="wait">
            {!selectedCompanyId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground text-center">¿A qué empresa corresponde?</p>
                <div className="grid grid-cols-2 gap-3">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleCompanySelect(company.id)}
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all duration-200",
                        "hover:border-primary hover:bg-primary/5 hover:shadow-md",
                        "focus:outline-none focus:ring-2 focus:ring-primary/20",
                        company.color === "blue" 
                          ? "border-blue-200 bg-blue-50/50" 
                          : "border-emerald-200 bg-emerald-50/50"
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          company.color === "blue" ? "bg-blue-100" : "bg-emerald-100"
                        )}>
                          <company.icon className={cn(
                            "h-6 w-6",
                            company.color === "blue" ? "text-blue-600" : "text-emerald-600"
                          )} />
                        </div>
                        <span className="font-semibold text-sm">{company.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Selección de proveedor */}
            {selectedCompanyId && !selectedSupplier && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      {companies.find(c => c.id === selectedCompanyId)?.name}
                      <button 
                        onClick={() => setSelectedCompanyId(null)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Proveedor</span>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar proveedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white"
                    autoFocus
                  />
                </div>

                <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1">
                  {isLoadingSuppliers ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredSuppliers.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      No se encontraron proveedores
                    </div>
                  ) : (
                    filteredSuppliers.slice(0, 8).map((supplier) => (
                      <button
                        key={supplier.id}
                        className={cn(
                          "w-full p-3 rounded-lg text-left transition-all duration-150",
                          "hover:bg-primary/10 hover:text-primary",
                          "focus:outline-none focus:bg-primary/10"
                        )}
                        onClick={() => handleSupplierSelect(supplier)}
                      >
                        <span className="text-sm font-medium truncate block">{supplier.name}</span>
                        {supplier.short_name && (
                          <span className="text-xs text-muted-foreground">{supplier.short_name}</span>
                        )}
                      </button>
                    ))
                  )}
                  {filteredSuppliers.length > 8 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      +{filteredSuppliers.length - 8} proveedores más
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Zona de subida de archivo */}
            {selectedCompanyId && selectedSupplier && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Breadcrumb de selección */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="gap-1">
                    {companies.find(c => c.id === selectedCompanyId)?.name}
                    <button 
                      onClick={() => { setSelectedCompanyId(null); setSelectedSupplier(null); setFiles([]); }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1 bg-white">
                    {selectedSupplier.short_name || selectedSupplier.name.substring(0, 20)}
                    <button 
                      onClick={() => { setSelectedSupplier(null); setFiles([]); }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>

                {/* Drop zone */}
                <div
                  className={cn(
                    "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
                    "min-h-[140px] flex flex-col items-center justify-center",
                    isDragging 
                      ? "border-primary bg-primary/5 scale-[1.02]" 
                      : files.length > 0 
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => files.length === 0 && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.xml,image/*"
                    multiple
                    onChange={handleFileSelect}
                  />

                  {files.length === 0 ? (
                    <div className="text-center p-4">
                      <div className={cn(
                        "w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3 transition-colors",
                        isDragging ? "bg-primary/20" : "bg-slate-100"
                      )}>
                        <Upload className={cn(
                          "h-7 w-7 transition-colors",
                          isDragging ? "text-primary" : "text-slate-400"
                        )} />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {isDragging ? "Suelta el archivo aquí" : "Arrastra tu factura"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        o <span className="text-primary font-medium">selecciona un archivo</span>
                      </p>
                    </div>
                  ) : (
                    <div className="w-full p-4 space-y-2">
                      {files.map((file, index) => (
                        <div 
                          key={index} 
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm"
                        >
                          <div className="p-2 rounded-lg bg-emerald-100">
                            <FileText className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFiles(files.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Barra de progreso */}
                  {uploadMutation.isPending && uploadProgress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 rounded-b-xl overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>

                {/* Panel de análisis en progreso */}
                {uploadMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3"
                  >
                    {/* Paso actual */}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">{analysisStep}</p>
                        <div className="w-full h-1.5 bg-primary/20 rounded-full mt-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Datos encontrados */}
                    {foundData.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-1.5 pt-2 border-t border-primary/20"
                      >
                        {foundData.map((item, index) => (
                          <motion.div
                            key={item.field}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.15 }}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-muted-foreground">{item.field}:</span>
                            <span className="font-medium text-foreground">{item.value}</span>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Botón de subida */}
                <Button
                  onClick={handleUpload}
                  disabled={!canUpload || uploadMutation.isPending}
                  className="w-full h-11 text-sm font-medium gap-2"
                  size="lg"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Procesar Factura
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
