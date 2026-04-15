import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { PDFPreview } from "../common/PDFPreview";

interface UploadRepModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherId: number;
  clientName: string;
  onSuccess?: () => void;
}

export function UploadRepModal({
  isOpen,
  onClose,
  voucherId,
  clientName,
  onSuccess,
}: UploadRepModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/payment-vouchers/${voucherId}/upload-rep`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir REP');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "REP subido exitosamente",
        description: "El comprobante se movió a Completado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setFile(null);
      setPreview(null);
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al subir REP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/xml', 'text/xml'];

  const processFile = useCallback((selectedFile: File) => {
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xml')) {
      toast({ title: "Formato no válido", description: "Solo PDF, PNG, JPG o XML", variant: "destructive" });
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }
  }, [toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Subir REP
          </DialogTitle>
          <DialogDescription>
            Sube el Recibo Electrónico de Pago para: {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info card */}
          <Card className="p-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Proveedor/Cliente</p>
                <p className="font-semibold">{clientName}</p>
              </div>
              <Badge className="bg-orange-500">Esperando REP</Badge>
            </div>
          </Card>

          {/* Upload area */}
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-muted-foreground/25 hover:border-orange-400'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
              }}
              onClick={() => document.getElementById('rep-file-input')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-orange-400 mb-2" />
              <p className="text-sm text-muted-foreground">
                Arrastra el REP aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG o XML (máx. 10MB)</p>
              <input
                id="rep-file-input"
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.xml"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              />
            </div>
          ) : (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {preview && file.type === 'application/pdf' && (
                <div className="mt-2 max-h-48 overflow-hidden rounded">
                  <PDFPreview file={file} url={preview} />
                </div>
              )}
              {preview && file.type.startsWith('image/') && (
                <img src={preview} alt="Preview" className="mt-2 max-h-48 rounded object-contain" />
              )}
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!file || uploadMutation.isPending}
              onClick={() => file && uploadMutation.mutate(file)}
            >
              {uploadMutation.isPending ? "Subiendo..." : "Confirmar REP"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}