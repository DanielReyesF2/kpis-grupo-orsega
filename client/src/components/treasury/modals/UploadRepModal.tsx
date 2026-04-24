import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, X, CheckCircle2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiUpload } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { PDFPreview } from "../common/PDFPreview";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RepSibling {
  id: number;
  clientName: string;
  client_name?: string;
  extractedAmount: number | null;
  extracted_amount?: number | null;
  extractedCurrency: string | null;
  extracted_currency?: string | null;
  extractedReference: string | null;
  extracted_reference?: string | null;
  createdAt: string;
  created_at?: string;
}

interface UploadRepModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherId: number;
  clientName: string;
  clientId?: number;
  onSuccess?: () => void;
}

export function UploadRepModal({
  isOpen,
  onClose,
  voucherId,
  clientName,
  clientId,
  onSuccess,
}: UploadRepModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([voucherId]));

  // Fetch hermanos del mismo proveedor (por client_id, NO por nombre)
  const { data: siblings = [], isLoading: loadingSiblings } = useQuery<RepSibling[]>({
    queryKey: [`/api/payment-vouchers/${voucherId}/rep-siblings`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/payment-vouchers/${voucherId}/rep-siblings`);
      return res.json();
    },
    enabled: isOpen && !!clientId,
    staleTime: 30000,
  });

  // Cuando llegan los hermanos, pre-seleccionar todos
  const allVoucherIds = [voucherId, ...siblings.map(s => s.id)];

  const toggleVoucher = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      // El trigger siempre se queda seleccionado
      if (id === voucherId) return next;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allVoucherIds));
  const deselectSiblings = () => setSelectedIds(new Set([voucherId]));

  const isBulk = selectedIds.size > 1;

  // Mutation: bulk o individual
  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append('file', uploadFile);

      if (isBulk) {
        formData.append('voucherIds', JSON.stringify(Array.from(selectedIds)));
        const response = await apiUpload('POST', '/api/payment-vouchers/bulk-upload-rep', formData);
        return await response.json();
      } else {
        const response = await apiUpload('POST', `/api/payment-vouchers/${voucherId}/upload-rep`, formData);
        return await response.json();
      }
    },
    onSuccess: (data) => {
      const count = isBulk ? data.updatedCount : 1;
      toast({
        title: "REP subido exitosamente",
        description: count > 1
          ? `${count} comprobantes completados con este REP`
          : "El comprobante se movió a Completado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setFile(null);
      setPreview(null);
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
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

  const getName = (s: RepSibling) => s.clientName || s.client_name || clientName;
  const getAmount = (s: RepSibling) => s.extractedAmount ?? s.extracted_amount ?? null;
  const getCurrency = (s: RepSibling) => s.extractedCurrency ?? s.extracted_currency ?? 'MXN';
  const getRef = (s: RepSibling) => s.extractedReference ?? s.extracted_reference ?? null;
  const getDate = (s: RepSibling) => s.createdAt || s.created_at || '';

  const hasSiblings = siblings.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${hasSiblings ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Subir REP
          </DialogTitle>
          <DialogDescription>
            Sube el Recibo Electrónico de Pago para: {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Siblings section — solo aparece si hay hermanos */}
          {hasSiblings ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Pagos de {clientName} esperando REP ({allVoucherIds.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAll}
                  >
                    Seleccionar todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deselectSiblings}
                  >
                    Solo este
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {/* Trigger voucher — siempre primero, siempre seleccionado */}
                <Card className="p-3 border-orange-300 bg-orange-50/50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={true}
                      disabled
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Este pago
                        </span>
                        <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600">
                          Seleccionado
                        </Badge>
                      </div>
                    </div>
                    <Badge className="bg-orange-500 text-xs">Esperando REP</Badge>
                  </div>
                </Card>

                {/* Siblings */}
                {loadingSiblings ? (
                  <div className="text-center py-3 text-sm text-muted-foreground">
                    Buscando otros pagos del mismo proveedor...
                  </div>
                ) : (
                  siblings.map((sibling) => {
                    const isSelected = selectedIds.has(sibling.id);
                    const amount = getAmount(sibling);
                    const ref = getRef(sibling);
                    const date = getDate(sibling);
                    return (
                      <Card
                        key={sibling.id}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected ? 'border-orange-300 bg-orange-50/30' : 'border-border hover:border-orange-200'
                        }`}
                        onClick={() => toggleVoucher(sibling.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleVoucher(sibling.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {ref || `Pago #${sibling.id}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              {date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(date), "dd MMM yyyy", { locale: es })}
                                </span>
                              )}
                              {amount !== null && (
                                <span className="font-medium text-foreground">
                                  {getCurrency(sibling)} ${amount.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-orange-500 text-xs shrink-0">Esperando REP</Badge>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Summary */}
              {selectedIds.size > 1 && (
                <Card className="p-3 mt-3 bg-orange-100/50 border-orange-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">
                      {selectedIds.size} pago{selectedIds.size > 1 ? 's' : ''} será{selectedIds.size > 1 ? 'n' : ''} completado{selectedIds.size > 1 ? 's' : ''} con este REP
                    </span>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            /* Sin hermanos — info card simple como antes */
            <Card className="p-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Proveedor/Cliente</p>
                  <p className="font-semibold">{clientName}</p>
                </div>
                <Badge className="bg-orange-500">Esperando REP</Badge>
              </div>
            </Card>
          )}

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
              {uploadMutation.isPending
                ? "Subiendo..."
                : isBulk
                  ? `Confirmar REP (${selectedIds.size} pagos)`
                  : "Confirmar REP"
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
