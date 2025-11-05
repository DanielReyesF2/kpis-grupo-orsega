import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CompanySelector } from "@/components/treasury/common/CompanySelector";

interface IdrallUploadFlowProps {
  onBack: () => void;
  preselectedCompanyId?: number | null;
  preselectedFiles?: File[];
}

interface ProcessingResult {
  success: boolean;
  created: number;
  payments: any[];
  processing: {
    totalRecords: number;
    processedFiles: number;
    errors: string[];
  };
}

export function IdrallUploadFlow({ onBack, preselectedCompanyId, preselectedFiles }: IdrallUploadFlowProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(preselectedCompanyId || null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>(preselectedFiles || []);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);

  // Inicializar empresa si viene preseleccionada
  useEffect(() => {
    if (preselectedCompanyId && !selectedCompanyId) {
      setSelectedCompanyId(preselectedCompanyId);
    }
  }, [preselectedCompanyId]);

  // Inicializar archivos si vienen preseleccionados
  useEffect(() => {
    if (preselectedFiles && preselectedFiles.length > 0 && selectedFiles.length === 0) {
      setSelectedFiles(preselectedFiles);
    }
  }, [preselectedFiles]);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/treasury/idrall/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al procesar archivos Idrall");
      }

      return res.json();
    },
    onSuccess: (data: ProcessingResult) => {
      setProcessingResult(data);
      toast({
        title: "✅ Archivos procesados",
        description: `Se crearon ${data.created} Cuentas por Pagar desde Idrall`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudieron procesar los archivos",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Filtrar solo PDFs y ZIPs
      const validFiles = files.filter(
        (f) =>
          f.type === "application/pdf" ||
          f.type === "application/zip" ||
          f.type === "application/x-zip-compressed" ||
          f.name.toLowerCase().endsWith(".pdf") ||
          f.name.toLowerCase().endsWith(".zip")
      );

      setSelectedFiles([...selectedFiles, ...validFiles]);
      e.target.value = ""; // Reset input
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (!selectedCompanyId) {
      toast({
        title: "Error",
        description: "Selecciona una empresa",
        variant: "destructive",
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un archivo",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("companyId", selectedCompanyId.toString());

    uploadMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onBack} variant="ghost" size="lg">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-foreground">
          Importar desde Idrall
        </h1>
      </div>

      {/* Paso 1: Seleccionar Empresa - Solo si no viene preseleccionada */}
      {!selectedCompanyId && !preselectedCompanyId && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground">
              Paso 1: Selecciona la Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompanySelector
              selectedCompanyId={selectedCompanyId}
              onSelect={setSelectedCompanyId}
            />
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Subir Archivos */}
      {selectedCompanyId && !processingResult && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground">
              Paso 2: Sube los archivos de Idrall
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center bg-primary/5">
                <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-lg font-semibold text-foreground mb-2">
                  Arrastra archivos PDF o ZIP aquí
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Puedes subir múltiples archivos (máx. 50MB c/u)
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="idrall-upload"
                />
                <label htmlFor="idrall-upload">
                  <Button type="button" size="lg" variant="outline" asChild>
                    <span>Seleccionar Archivos</span>
                  </Button>
                </label>
              </div>

              {/* Lista de archivos seleccionados */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    Archivos seleccionados ({selectedFiles.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border-2 rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Eliminar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setSelectedCompanyId(null)}
                  variant="outline"
                  size="lg"
                >
                  ← Anterior
                </Button>
                <Button
                  onClick={handleUpload}
                  size="lg"
                  disabled={selectedFiles.length === 0 || uploadMutation.isPending}
                  className="flex-1"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-2" />
                      Procesar Archivos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado del Procesamiento */}
      {processingResult && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Procesamiento Completado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-lg border-2 border-green-300">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {processingResult.created}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  CxP Creados
                </p>
              </div>
              <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {processingResult.processing.processedFiles}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Archivos Procesados
                </p>
              </div>
              <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg border-2 border-orange-300">
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {processingResult.processing.errors.length}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Errores
                </p>
              </div>
            </div>

            {processingResult.processing.errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Errores
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {processingResult.processing.errors.map((error, index) => (
                    <p key={index} className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setProcessingResult(null);
                  setSelectedFiles([]);
                }}
                variant="outline"
                size="lg"
              >
                Procesar Otros Archivos
              </Button>
              <Button onClick={onBack} size="lg" className="flex-1">
                Ver Cuentas por Pagar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

