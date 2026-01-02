import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFPreview } from "./common/PDFPreview";

interface FileWithPreview extends File {
  preview?: string;
  status?: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
}

interface EnhancedUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onUpload?: (files: File[]) => Promise<void>;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
}

export function EnhancedUploadZone({
  onFilesSelected,
  onUpload,
  acceptedTypes = [".pdf", ".xml", ".jpg", ".jpeg", ".png", ".zip"],
  maxFiles = 10,
  maxSizeMB = 10,
  className,
}: EnhancedUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Validar tipo
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.some((type) => extension.includes(type.replace(".", "")))) {
      return `Tipo de archivo no permitido. Aceptados: ${acceptedTypes.join(", ")}`;
    }

    // Validar tamaño
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `El archivo es demasiado grande. Máximo: ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      const validFiles: FileWithPreview[] = [];
      const errors: string[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
          continue;
        }

        const fileWithPreview: FileWithPreview = Object.assign(file, {
          status: "pending" as const,
          progress: 0,
        });

        // Generar preview para imágenes
        if (file.type.startsWith("image/")) {
          fileWithPreview.preview = URL.createObjectURL(file);
        }

        validFiles.push(fileWithPreview);
      }

      if (errors.length > 0) {
        // Mostrar errores (podrías usar toast aquí)
        console.error("Errores de validación:", errors);
      }

      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles].slice(0, maxFiles);
        setFiles(newFiles);
        onFilesSelected(newFiles);
      }
    },
    [files, maxFiles, acceptedTypes, maxSizeMB, onFilesSelected]
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
      onFilesSelected(newFiles);
    },
    [files, onFilesSelected]
  );

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !onUpload) return;

    setIsUploading(true);
    const updatedFiles = files.map((f) => ({ ...f, status: "uploading" as const, progress: 0 }));
    setFiles(updatedFiles);

    try {
      // Simular progreso (en producción, esto vendría del servidor)
      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, progress: 50 } : f
          )
        );

        // Aquí harías el upload real
        await new Promise((resolve) => setTimeout(resolve, 500));

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success" as const, progress: 100 } : f
          )
        );
      }

      await onUpload(files);
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Error desconocido",
        }))
      );
    } finally {
      setIsUploading(false);
    }
  }, [files, onUpload]);

  return (
    <div className={cn("space-y-4", className)}>
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
                "p-4 rounded-full transition-all",
                isDragging
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary"
              )}
            >
              {isDragging ? (
                <FileCheck className="h-8 w-8" />
              ) : (
                <Upload className="h-8 w-8" />
              )}
            </motion.div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {isDragging ? "Suelta aquí tus archivos" : "Arrastra y suelta archivos aquí"}
              </h3>
              <p className="text-sm text-muted-foreground">
                o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos: {acceptedTypes.join(", ")} • Máximo: {maxSizeMB}MB por archivo
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
        />
      </Card>

      {/* Lista de archivos */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                {files.length} archivo{files.length > 1 ? "s" : ""} seleccionado{files.length > 1 ? "s" : ""}
              </h4>
              {onUpload && (
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
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
                      Subir {files.length} archivo{files.length > 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {files.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
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
                        {file.status === "uploading" && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          </div>
                        )}
                        {file.status === "success" && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                          </div>
                        )}
                        {file.status === "error" && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-red-500" />
                          </div>
                        )}

                        {/* Remove button */}
                        {file.status !== "uploading" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* File info */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>

                        {/* Progress */}
                        {file.status === "uploading" && file.progress !== undefined && (
                          <Progress value={file.progress} className="h-1" />
                        )}

                        {/* Error message */}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

