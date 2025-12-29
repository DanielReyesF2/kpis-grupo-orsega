import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, X, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PDFPreview } from "../common/PDFPreview";

interface ScheduledPayment {
  id: number;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  reference: string | null;
}

interface UploadVoucherToPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledPayment: ScheduledPayment;
  onSuccess?: () => void;
}

export function UploadVoucherToPaymentModal({
  isOpen,
  onClose,
  scheduledPayment,
  onSuccess,
}: UploadVoucherToPaymentModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/scheduled-payments/${scheduledPayment.id}/upload-voucher`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir comprobante');
      }

      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Comprobante subido exitosamente",
        description: data.message || "El comprobante ha sido vinculado a la cuenta por pagar",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setFile(null);
      setPreview(null);
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al subir comprobante",
        description: error.message || "No se pudo subir el comprobante",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Crear preview para PDFs
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
        description: "Selecciona un archivo",
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
          <DialogTitle className="text-2xl font-bold">
            Subir Comprobante de Pago
          </DialogTitle>
          <DialogDescription className="text-base">
            Sube el comprobante de pago para la cuenta por pagar: {scheduledPayment.supplierName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información de la cuenta por pagar */}
          <Card className="p-4 bg-primary/10 border-primary/20">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Proveedor</p>
                <p className="font-semibold">{scheduledPayment.supplierName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monto</p>
                <p className="font-semibold">
                  {scheduledPayment.currency} ${scheduledPayment.amount.toLocaleString()}
                </p>
              </div>
              {scheduledPayment.reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Referencia</p>
                  <p className="font-semibold">{scheduledPayment.reference}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Área de drop */}
          {!file ? (
            <Card
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed p-8 text-center transition-all min-h-[200px] flex flex-col items-center justify-center ${
                isDragging
                  ? "border-primary bg-primary/10 scale-105"
                  : "border-primary/30 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              }`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Receipt className={`h-12 w-12 mb-4 ${
                isDragging ? "text-primary" : "text-primary/70"
              }`} />
              <p className="text-lg font-semibold mb-2">
                {isDragging ? "Suelta el archivo aquí" : "Arrastra el comprobante aquí"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                PDF, PNG, JPG, JPEG (máx. 10MB)
              </p>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivo
              </Button>
              <input
                id="file-input"
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
                    <FileText className="h-5 w-5 text-primary" />
                    <p className="font-semibold">{file.name}</p>
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
                        className="max-w-full h-auto rounded-lg border"
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
          >
            {uploadMutation.isPending ? "Subiendo..." : "Subir Comprobante"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}







