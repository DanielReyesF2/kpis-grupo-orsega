import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Upload, FileText, X, Receipt, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FileWithKind {
  file: File;
  kind: "voucher" | "invoice";
  preview?: string;
}

interface DropzoneProps {
  files: FileWithKind[];
  onFilesChange: (files: FileWithKind[]) => void;
  disabled?: boolean;
}

export function Dropzone({ files, onFilesChange, disabled }: DropzoneProps) {
  const [draggingOver, setDraggingOver] = useState<"voucher" | "invoice" | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent, kind: "voucher" | "invoice") => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(kind);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetKind: "voucher" | "invoice") => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingOver(null);

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      const newFiles: FileWithKind[] = droppedFiles.map((file) => ({
        file,
        kind: targetKind,
      }));

      onFilesChange([...files, ...newFiles]);
    },
    [files, onFilesChange, disabled]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, targetKind: "voucher" | "invoice") => {
      if (!e.target.files) return;

      const selectedFiles = Array.from(e.target.files);
      const newFiles: FileWithKind[] = selectedFiles.map((file) => ({
        file,
        kind: targetKind,
      }));

      onFilesChange([...files, ...newFiles]);
      e.target.value = ""; // Reset input
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      onFilesChange(newFiles);
    },
    [files, onFilesChange]
  );

  const voucherFiles = files.filter((f) => f.kind === "voucher");
  const invoiceFiles = files.filter((f) => f.kind === "invoice");

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-foreground mb-4">
        Sube los archivos
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Área de Comprobante Bancario */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Comprobante Bancario
            </h4>
            {voucherFiles.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                {voucherFiles.length}
              </Badge>
            )}
          </div>
          <Card
            onDragOver={(e) => handleDragOver(e, "voucher")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "voucher")}
            className={`border-2 border-dashed p-6 text-center transition-all min-h-[200px] flex flex-col items-center justify-center ${
              draggingOver === "voucher"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-105"
                : "border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <Receipt className={`h-10 w-10 mx-auto mb-3 ${
              draggingOver === "voucher" ? "text-blue-600 dark:text-blue-400" : "text-blue-400 dark:text-blue-600"
            }`} />
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {voucherFiles.length > 0 
                ? "Arrastra otro comprobante o haz clic para cambiar"
                : "Arrastra el comprobante aquí"}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              PDF, PNG, JPG (máx. 10MB)
            </p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => handleFileSelect(e, "voucher")}
              disabled={disabled}
              className="hidden"
              id="voucher-upload"
            />
            <label htmlFor="voucher-upload">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                disabled={disabled}
                asChild
              >
                <span>Seleccionar Comprobante</span>
              </Button>
            </label>
          </Card>

          {/* Lista de comprobantes subidos */}
          {voucherFiles.length > 0 && (
            <div className="space-y-2">
              {voucherFiles.map((fileWithKind, index) => {
                const actualIndex = files.findIndex((f) => f === fileWithKind);
                return (
                  <Card
                    key={actualIndex}
                    className="p-3 flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                          {fileWithKind.file.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {(fileWithKind.file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(actualIndex)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Área de Facturas */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Facturas
            </h4>
            {invoiceFiles.length > 0 && (
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                {invoiceFiles.length}
              </Badge>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              (Opcional)
            </span>
          </div>
          <Card
            onDragOver={(e) => handleDragOver(e, "invoice")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "invoice")}
            className={`border-2 border-dashed p-6 text-center transition-all min-h-[200px] flex flex-col items-center justify-center ${
              draggingOver === "invoice"
                ? "border-green-500 bg-green-50 dark:bg-green-950/30 scale-105"
                : "border-green-300 dark:border-green-700 hover:border-green-400 dark:hover:border-green-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <FileCheck className={`h-10 w-10 mx-auto mb-3 ${
              draggingOver === "invoice" ? "text-green-600 dark:text-green-400" : "text-green-400 dark:text-green-600"
            }`} />
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {invoiceFiles.length > 0
                ? "Arrastra más facturas o haz clic para agregar"
                : "Arrastra las facturas aquí"}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              PDF, PNG, JPG (máx. 10MB cada uno)
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => handleFileSelect(e, "invoice")}
              disabled={disabled}
              className="hidden"
              id="invoice-upload"
            />
            <label htmlFor="invoice-upload">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                disabled={disabled}
                asChild
              >
                <span>Seleccionar Facturas</span>
              </Button>
            </label>
          </Card>

          {/* Lista de facturas subidas */}
          {invoiceFiles.length > 0 && (
            <div className="space-y-2">
              {invoiceFiles.map((fileWithKind, index) => {
                const actualIndex = files.findIndex((f) => f === fileWithKind);
                return (
                  <Card
                    key={actualIndex}
                    className="p-3 flex items-center justify-between bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                          {fileWithKind.file.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {(fileWithKind.file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(actualIndex)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      {files.length > 0 && (
        <Card className="p-4 bg-primary/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Resumen de archivos
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {voucherFiles.length} comprobante{voucherFiles.length !== 1 ? 's' : ''} • {invoiceFiles.length} factura{invoiceFiles.length !== 1 ? 's' : ''}
              </p>
            </div>
            {voucherFiles.length === 0 && (
              <Badge variant="destructive" className="text-xs">
                Se requiere al menos 1 comprobante
              </Badge>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
