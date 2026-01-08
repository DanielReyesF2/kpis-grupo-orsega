import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, X, Receipt, CreditCard, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { PDFPreview } from "../common/PDFPreview";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PaymentVoucher } from "./VoucherCard";

interface PayVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: PaymentVoucher;
  onSuccess?: () => void;
}

export function PayVoucherModal({
  isOpen,
  onClose,
  voucher,
  onSuccess,
}: PayVoucherModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/payment-vouchers/${voucher.id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir comprobante de pago');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Pago registrado exitosamente",
        description: data.requiresREP 
          ? "El proveedor requiere REP. Pendiente complemento de pago."
          : "El pago ha sido completado y cerrado contablemente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setFile(null);
      setPreview(null);
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al registrar pago",
        description: error.message || "No se pudo registrar el pago",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      if (selectedFile.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(URL.createObjectURL(selectedFile));
      }
    }
  }, []);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      
      if (droppedFile.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(droppedFile);
      } else {
        setPreview(URL.createObjectURL(droppedFile));
      }
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  }, [preview]);

  const handleUpload = useCallback(() => {
    if (!file) {
      toast({
        title: "Error",
        description: "Selecciona un comprobante de pago",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  }, [file, uploadMutation, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-emerald-600" />
            Registrar Pago
          </DialogTitle>
          <DialogDescription className="text-base">
            Sube el comprobante de pago para la factura de: {voucher.clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información de la factura */}
          <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Proveedor/Cliente</p>
                <p className="font-semibold">{voucher.clientName}</p>
              </div>
              {voucher.extractedAmount && voucher.extractedCurrency && (
                <div>
                  <p className="text-sm text-muted-foreground">Monto a Pagar</p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {voucher.extractedCurrency} ${voucher.extractedAmount.toLocaleString()}
                  </p>
                </div>
              )}
              {voucher.extractedReference && (
                <div>
                  <p className="text-sm text-muted-foreground">Referencia Factura</p>
                  <p className="font-semibold">{voucher.extractedReference}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Factura</p>
                <p className="font-semibold">
                  {format(new Date(voucher.createdAt), "dd MMM yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </Card>

          {/* Nota informativa */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">¿Qué pasa después?</p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                Si el proveedor requiere REP (Recibo Electrónico de Pago), la factura pasará a "Pendiente Complemento". 
                Si no requiere REP, se cerrará contablemente de forma automática.
              </p>
            </div>
          </div>

          {/* Área de drop */}
          {!file ? (
            <Card
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed p-8 text-center transition-all min-h-[200px] flex flex-col items-center justify-center ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[1.02]"
                  : "border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 cursor-pointer"
              }`}
              onClick={() => document.getElementById('pay-file-input')?.click()}
            >
              <Receipt className={`h-12 w-12 mb-4 ${
                isDragging ? "text-emerald-600" : "text-emerald-500"
              }`} />
              <p className="text-lg font-semibold mb-2">
                {isDragging ? "Suelta el comprobante aquí" : "Arrastra el comprobante de pago aquí"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                PDF, PNG, JPG, JPEG (máx. 10MB)
              </p>
              <Button variant="outline" className="border-emerald-300 hover:bg-emerald-50">
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivo
              </Button>
              <input
                id="pay-file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    <p className="font-semibold">{file.name}</p>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {preview && (
                  <div className="mt-4">
                    {file.type === 'application/pdf' ? (
                      <PDFPreview file={file} />
                    ) : (
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-w-full h-auto rounded-lg border max-h-[300px] object-contain mx-auto"
                      />
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {uploadMutation.isPending ? "Procesando..." : "Confirmar Pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

