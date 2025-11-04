import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, FileText, Building2 } from "lucide-react";
import { PDFPreview } from "./PDFPreview";
import { FileWithKind } from "./Dropzone";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  companyName: string;
  providerName: string;
  files: FileWithKind[];
  matchConfidence?: number;
  isLoading?: boolean;
}

export function PreviewModal({
  isOpen,
  onClose,
  onConfirm,
  companyName,
  providerName,
  files,
  matchConfidence,
  isLoading = false,
}: PreviewModalProps) {
  const voucherFile = files.find((f) => f.kind === "voucher")?.file;
  const invoiceFiles = files.filter((f) => f.kind === "invoice").map((f) => f.file);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Revisa la información antes de enviar
          </DialogTitle>
          <DialogDescription className="text-base">
            Verifica que todo esté correcto antes de guardar y enviar el comprobante
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información resumida */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Empresa Pagadora</p>
              </div>
              <p className="text-lg font-bold text-foreground">{companyName}</p>
            </div>
            <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-lg border-2 border-green-300 dark:border-green-700">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-muted-foreground">Proveedor/Cliente</p>
              </div>
              <p className="text-lg font-bold text-foreground">{providerName}</p>
            </div>
          </div>

          {/* Coincidencia automática */}
          {matchConfidence !== undefined && (
            <div className={`p-4 rounded-lg border-2 ${
              matchConfidence >= 0.8
                ? "bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                : "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
            }`}>
              <div className="flex items-center gap-2">
                {matchConfidence >= 0.8 ? (
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                )}
                <div>
                  <p className="font-semibold text-base">
                    {matchConfidence >= 0.8
                      ? "Coincidencia encontrada"
                      : "Revisión manual requerida"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Confianza: {Math.round(matchConfidence * 100)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Vista previa del comprobante */}
          {voucherFile && (
            <div>
              <h4 className="text-base font-semibold text-foreground mb-2">
                Comprobante Bancario
              </h4>
              <PDFPreview file={voucherFile} />
            </div>
          )}

          {/* Facturas asociadas */}
          {invoiceFiles.length > 0 && (
            <div>
              <h4 className="text-base font-semibold text-foreground mb-2">
                Facturas Asociadas ({invoiceFiles.length})
              </h4>
              <div className="space-y-2">
                {invoiceFiles.map((file, index) => (
                  <PDFPreview key={index} file={file} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} size="lg" disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} size="lg" disabled={isLoading || !voucherFile}>
            {isLoading ? "Enviando..." : "Guardar y Enviar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

