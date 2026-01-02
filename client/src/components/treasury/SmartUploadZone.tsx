import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileCheck,
  Zap,
  Building2,
  Users,
  Sparkles,
  Group,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFPreview } from "./common/PDFPreview";
import { useQuery } from "@tanstack/react-query";

interface FileWithMetadata extends File {
  preview?: string;
  status?: "pending" | "analyzing" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
  documentType?: "invoice" | "voucher" | "rep" | "unknown";
  detectedSupplier?: {
    id: number;
    name: string;
    confidence: number;
  };
  extractedData?: {
    amount?: number;
    date?: string;
    supplierName?: string;
    invoiceNumber?: string;
  };
}

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
  company_id: number;
}

interface SmartUploadZoneProps {
  onFilesProcessed: (groupedFiles: Record<string, FileWithMetadata[]>) => void;
  onUpload?: (files: FileWithMetadata[]) => Promise<void>;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
}

export function SmartUploadZone({
  onFilesProcessed,
  onUpload,
  acceptedTypes = [".pdf", ".xml", ".jpg", ".jpeg", ".png", ".zip"],
  maxFiles = 20,
  maxSizeMB = 10,
  className,
}: SmartUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obtener proveedores para matching
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    staleTime: 60000,
  });

  // Clasificar tipo de documento basado en nombre y tipo
  const classifyDocument = useCallback(
    async (file: File): Promise<"invoice" | "voucher" | "rep" | "unknown"> => {
      const fileName = file.name.toLowerCase();
      
      // Heurísticas simples (en producción, usarías IA)
      if (fileName.includes("factura") || fileName.includes("invoice") || fileName.includes(".xml")) {
        return "invoice";
      }
      if (fileName.includes("comprobante") || fileName.includes("voucher") || fileName.includes("pago")) {
        return "voucher";
      }
      if (fileName.includes("rep") || fileName.includes("recibo")) {
        return "rep";
      }
      
      // Si es PDF, intentar analizar el contenido (simulado)
      if (file.type === "application/pdf") {
        // En producción, aquí harías una llamada a OpenAI para analizar
        return "unknown";
      }
      
      return "unknown";
    },
    []
  );

  // Detectar proveedor basado en nombre de archivo y contenido
  const detectSupplier = useCallback(
    (file: File, extractedData?: any): { id: number; name: string; confidence: number } | undefined => {
      if (!suppliers.length) return undefined;

      const fileName = file.name.toLowerCase();
      const searchTerms = [
        ...(extractedData?.supplierName ? [extractedData.supplierName.toLowerCase()] : []),
        ...fileName.split(/[-_\s]/).filter((term) => term.length > 3),
      ];

      // Buscar coincidencias
      for (const supplier of suppliers) {
        const supplierName = (supplier.short_name || supplier.name).toLowerCase();
        const matches = searchTerms.filter((term) => supplierName.includes(term) || term.includes(supplierName));
        
        if (matches.length > 0) {
          const confidence = Math.min(0.9, 0.5 + matches.length * 0.1);
          return {
            id: supplier.id,
            name: supplier.name,
            confidence,
          };
        }
      }

      return undefined;
    },
    [suppliers]
  );

  // Analizar archivo con IA (simulado - en producción usarías OpenAI)
  const analyzeFile = useCallback(
    async (file: File): Promise<{
      documentType: "invoice" | "voucher" | "rep" | "unknown";
      extractedData?: any;
      detectedSupplier?: { id: number; name: string; confidence: number };
    }> => {
      const documentType = await classifyDocument(file);
      
      // Simular extracción de datos (en producción, usarías OpenAI Vision)
      const extractedData = {
        amount: null as number | null,
        date: null as string | null,
        supplierName: null as string | null,
        invoiceNumber: null as string | null,
      };

      const detectedSupplier = detectSupplier(file, extractedData);

      return {
        documentType,
        extractedData,
        detectedSupplier,
      };
    },
    [classifyDocument, detectSupplier]
  );

  const validateFile = (file: File): string | null => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.some((type) => extension.includes(type.replace(".", "")))) {
      return `Tipo no permitido. Aceptados: ${acceptedTypes.join(", ")}`;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `Archivo muy grande. Máximo: ${maxSizeMB}MB`;
    }
    return null;
  };

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      const validFiles: FileWithMetadata[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          console.error(`${file.name}: ${error}`);
          continue;
        }

        const fileWithMetadata: FileWithMetadata = Object.assign(file, {
          status: "pending" as const,
          progress: 0,
        });

        if (file.type.startsWith("image/")) {
          fileWithMetadata.preview = URL.createObjectURL(file);
        }

        validFiles.push(fileWithMetadata);
      }

      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles].slice(0, maxFiles);
        setFiles(newFiles);

        // Analizar archivos
        setIsAnalyzing(true);
        const analyzedFiles = await Promise.all(
          newFiles.map(async (file) => {
            if (file.status === "pending") {
              file.status = "analyzing";
              const analysis = await analyzeFile(file);
              file.documentType = analysis.documentType;
              file.extractedData = analysis.extractedData;
              file.detectedSupplier = analysis.detectedSupplier;
              file.status = "pending";
            }
            return file;
          })
        );
        setFiles(analyzedFiles);
        setIsAnalyzing(false);

        // Agrupar por proveedor
        const grouped = groupFilesBySupplier(analyzedFiles);
        onFilesProcessed(grouped);
      }
    },
    [files, maxFiles, acceptedTypes, maxSizeMB, analyzeFile, onFilesProcessed]
  );

  // Agrupar archivos por proveedor detectado
  const groupFilesBySupplier = useCallback(
    (files: FileWithMetadata[]): Record<string, FileWithMetadata[]> => {
      const grouped: Record<string, FileWithMetadata[]> = {
        unknown: [],
      };

      files.forEach((file) => {
        const supplierId = file.detectedSupplier?.id;
        if (supplierId) {
          const key = `supplier-${supplierId}`;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(file);
        } else {
          grouped.unknown.push(file);
        }
      });

      return grouped;
    },
    []
  );

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
      const grouped = groupFilesBySupplier(newFiles);
      onFilesProcessed(grouped);
    },
    [files, groupFilesBySupplier, onFilesProcessed]
  );

  // Agrupar archivos para mostrar
  const groupedFiles = useMemo(() => {
    return groupFilesBySupplier(files);
  }, [files, groupFilesBySupplier]);

  const getDocumentTypeLabel = (type?: string) => {
    switch (type) {
      case "invoice":
        return "Factura";
      case "voucher":
        return "Comprobante";
      case "rep":
        return "REP";
      default:
        return "Desconocido";
    }
  };

  const getDocumentTypeColor = (type?: string) => {
    switch (type) {
      case "invoice":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "voucher":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "rep":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Zona de Drop */}
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed transition-all cursor-pointer group",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01] shadow-lg"
            : "border-primary/30 hover:border-primary/50 hover:bg-primary/5"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <motion.div
              animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "p-4 rounded-full transition-all relative",
                isDragging
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary"
              )}
            >
              {isAnalyzing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isDragging ? (
                <FileCheck className="h-8 w-8" />
              ) : (
                <>
                  <Upload className="h-8 w-8" />
                  <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-yellow-500" />
                </>
              )}
            </motion.div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center justify-center gap-2">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizando documentos...
                  </>
                ) : isDragging ? (
                  "Suelta aquí tus archivos"
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-primary" />
                    Subida Inteligente de Documentos
                  </>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAnalyzing
                  ? "Detectando tipo de documento y proveedor automáticamente"
                  : "Arrastra archivos o haz clic para seleccionar"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos: {acceptedTypes.join(", ")} • Máximo: {maxSizeMB}MB • Hasta {maxFiles} archivos
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-2"
              disabled={isAnalyzing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Seleccionar archivos
            </Button>
          </div>
        </CardContent>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleFileInput}
          className="hidden"
          disabled={isAnalyzing}
        />
      </Card>

      {/* Archivos agrupados por proveedor */}
      <AnimatePresence>
        {Object.keys(groupedFiles).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <Group className="h-5 w-5" />
                Archivos Agrupados ({files.length} total)
              </h4>
              {onUpload && (
                <Button
                  onClick={async () => {
                    if (files.length === 0 || !onUpload) return;
                    setIsUploading(true);
                    try {
                      await onUpload(files);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  disabled={isUploading || isAnalyzing}
                  className="gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Subir Todo
                    </>
                  )}
                </Button>
              )}
            </div>

            {Object.entries(groupedFiles).map(([key, groupFiles]) => {
              const supplier = groupFiles[0]?.detectedSupplier;
              const isUnknown = key === "unknown";

              return (
                <Card key={key} className="overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {supplier ? (
                          <>
                            <Building2 className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">
                                {supplier.name}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">
                                Confianza: {(supplier.confidence * 100).toFixed(0)}% • {groupFiles.length} archivo{groupFiles.length > 1 ? "s" : ""}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <CardTitle className="text-base text-muted-foreground">
                                Sin proveedor detectado
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {groupFiles.length} archivo{groupFiles.length > 1 ? "s" : ""} sin clasificar
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groupFiles.map((file, index) => (
                        <motion.div
                          key={`${file.name}-${index}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative"
                        >
                          <Card className="overflow-hidden">
                            <CardContent className="p-3">
                              {/* Preview */}
                              <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg mb-2 overflow-hidden">
                                {file.preview ? (
                                  <img
                                    src={file.preview}
                                    alt={file.name}
                                    className="w-full h-full object-contain"
                                  />
                                ) : file.type.includes("pdf") ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <FileText className="h-12 w-12 text-slate-400" />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="h-12 w-12 text-slate-400" />
                                  </div>
                                )}

                                {/* Status overlay */}
                                {file.status === "analyzing" && (
                                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                  </div>
                                )}
                                {file.status === "uploading" && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                  </div>
                                )}
                                {file.status === "success" && (
                                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                  </div>
                                )}

                                {/* Remove button */}
                                {file.status !== "uploading" && file.status !== "analyzing" && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-2 right-2 h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const fileIndex = files.findIndex((f) => f.name === file.name && f.size === file.size);
                                      if (fileIndex !== -1) removeFile(fileIndex);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>

                              {/* File info */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium truncate flex-1" title={file.name}>
                                    {file.name}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className={cn("text-xs flex-shrink-0", getDocumentTypeColor(file.documentType))}
                                  >
                                    {getDocumentTypeLabel(file.documentType)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>

                                {/* Extracted data */}
                                {file.extractedData && (
                                  <div className="pt-1 border-t text-xs space-y-0.5">
                                    {file.extractedData.amount && (
                                      <p className="text-muted-foreground">
                                        Monto: ${file.extractedData.amount.toLocaleString()}
                                      </p>
                                    )}
                                    {file.extractedData.date && (
                                      <p className="text-muted-foreground">
                                        Fecha: {new Date(file.extractedData.date).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Progress */}
                                {file.status === "uploading" && file.progress !== undefined && (
                                  <Progress value={file.progress} className="h-1 mt-1" />
                                )}

                                {/* Error */}
                                {file.status === "error" && file.error && (
                                  <p className="text-xs text-red-500 truncate" title={file.error}>
                                    {file.error}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

