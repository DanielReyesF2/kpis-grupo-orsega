import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getAuthToken } from "@/lib/queryClient";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileUp,
  Database,
  TrendingUp
} from "lucide-react";

interface UploadResult {
  success: boolean;
  message?: string;
  details?: string;
  rowsProcessed?: number;
  format?: string;
  companies?: string[];
}

interface SalesExcelUploaderProps {
  companyId?: number;
  onUploadComplete?: (result: UploadResult) => void;
}

type UploadStatus = "idle" | "dragging" | "uploading" | "success" | "error";

export function SalesExcelUploader({ companyId, onUploadComplete }: SalesExcelUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const resetState = () => {
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = useCallback(async (file: File) => {
    // Validar tipo de archivo
    const validExtensions = [".xlsx", ".xls"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validExtensions.includes(fileExtension)) {
      setStatus("error");
      setResult({
        success: false,
        message: "Formato no válido",
        details: "Solo se permiten archivos Excel (.xlsx, .xls)"
      });
      return;
    }

    // Validar tamaño (20MB max)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      setStatus("error");
      setResult({
        success: false,
        message: "Archivo muy grande",
        details: "El tamaño máximo permitido es 20MB"
      });
      return;
    }

    setSelectedFile(file);
    setStatus("uploading");
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (companyId) {
        formData.append("companyId", companyId.toString());
      }

      setProgress(30);

      const token = getAuthToken();
      const response = await fetch("/api/sales/upload", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData,
        credentials: "include"
      });

      setProgress(70);

      const data = await response.json();

      setProgress(90);

      if (response.ok && !data.error) {
        setStatus("success");
        const uploadResult: UploadResult = {
          success: true,
          message: data.message || "Datos importados correctamente",
          rowsProcessed: data.rowsProcessed || data.total || data.inserted,
          format: data.format,
          companies: data.companies
        };
        setResult(uploadResult);

        // Invalidar queries de ventas para refrescar datos
        await queryClient.invalidateQueries({ queryKey: ["/api/sales-data"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/sales-stats"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/sales/acciones"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/sales-analyst"] });

        onUploadComplete?.(uploadResult);
      } else {
        setStatus("error");
        const errorResult: UploadResult = {
          success: false,
          message: data.error || "Error al procesar archivo",
          details: data.details || data.message
        };
        setResult(errorResult);
        onUploadComplete?.(errorResult);
      }
    } catch (error) {
      console.error("[SalesExcelUploader] Error:", error);
      setStatus("error");
      const errorResult: UploadResult = {
        success: false,
        message: "Error de conexión",
        details: error instanceof Error ? error.message : "No se pudo conectar con el servidor"
      };
      setResult(errorResult);
      onUploadComplete?.(errorResult);
    } finally {
      setProgress(100);
    }
  }, [companyId, queryClient, onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "idle" || status === "error") {
      setStatus("dragging");
    }
  }, [status]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "dragging") {
      setStatus("idle");
    }
  }, [status]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    } else {
      setStatus("idle");
    }
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleClick = () => {
    if (status === "idle" || status === "error") {
      fileInputRef.current?.click();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "dragging": return "border-blue-500 bg-blue-500/10";
      case "uploading": return "border-yellow-500 bg-yellow-500/10";
      case "success": return "border-green-500 bg-green-500/10";
      case "error": return "border-red-500 bg-red-500/10";
      default: return "border-dashed border-muted-foreground/50 hover:border-primary hover:bg-primary/5";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Actualizar Ventas</CardTitle>
          </div>
          {(status === "success" || status === "error") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetState}
              className="h-8 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              Nuevo
            </Button>
          )}
        </div>
        <CardDescription>
          Arrastra tu archivo Excel aquí o haz clic para seleccionar
        </CardDescription>
      </CardHeader>

      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative rounded-lg border-2 p-8 text-center transition-all cursor-pointer
            ${getStatusColor()}
            ${status === "uploading" ? "cursor-wait" : ""}
          `}
        >
          {/* Estado: Idle o Dragging */}
          {(status === "idle" || status === "dragging") && (
            <div className="flex flex-col items-center gap-3">
              <div className={`
                rounded-full p-4 transition-colors
                ${status === "dragging" ? "bg-blue-500/20" : "bg-muted"}
              `}>
                {status === "dragging" ? (
                  <FileUp className="h-8 w-8 text-blue-500" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {status === "dragging" ? "Suelta el archivo aquí" : "Drop your Excel here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Formatos: IDRALL, LEGACY, ACUM GO 2026 • Max 20MB
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>.xlsx, .xls</span>
              </div>
            </div>
          )}

          {/* Estado: Uploading */}
          {status === "uploading" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 text-yellow-500 animate-spin" />
              <div>
                <p className="font-medium text-foreground">Procesando archivo...</p>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedFile.name}</p>
                )}
              </div>
              <div className="w-full max-w-xs">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">{progress}%</p>
              </div>
            </div>
          )}

          {/* Estado: Success */}
          {status === "success" && result && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full p-3 bg-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-600">{result.message}</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  {result.rowsProcessed && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {result.rowsProcessed.toLocaleString()} registros
                    </Badge>
                  )}
                  {result.format && (
                    <Badge variant="outline">{result.format}</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Los datos se han integrado a la base de datos
              </p>
            </div>
          )}

          {/* Estado: Error */}
          {status === "error" && result && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full p-3 bg-red-500/20">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-red-600">{result.message}</p>
                {result.details && (
                  <p className="text-sm text-muted-foreground mt-1">{result.details}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={resetState}>
                Intentar de nuevo
              </Button>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Auto-detecta formato
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Genera acciones automáticas
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
