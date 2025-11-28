import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Receipt, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PDFPreview } from "./common/PDFPreview";

interface PaymentDocumentsViewProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledPaymentId: number;
}

interface Document {
  type: 'invoice' | 'voucher' | 'rep';
  name: string;
  url: string;
  uploadedAt: string;
  extractedAmount?: number;
  extractedDate?: string;
  extractedBank?: string;
  extractedReference?: string;
}

export function PaymentDocumentsView({ isOpen, onClose, scheduledPaymentId }: PaymentDocumentsViewProps) {
  const { data: documentsData, isLoading } = useQuery<{ documents: Document[] }>({
    queryKey: [`/api/scheduled-payments/${scheduledPaymentId}/documents`],
    queryFn: async () => {
      const response = await fetch(`/api/scheduled-payments/${scheduledPaymentId}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return await response.json();
    },
    enabled: isOpen && scheduledPaymentId > 0,
  });

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return FileText;
      case 'voucher':
        return Receipt;
      case 'rep':
        return FileCheck;
      default:
        return FileText;
    }
  };

  const getDocumentLabel = (type: string) => {
    switch (type) {
      case 'invoice':
        return 'Factura';
      case 'voucher':
        return 'Comprobante de Pago';
      case 'rep':
        return 'REP (Recibo Electrónico de Pago)';
      default:
        return 'Documento';
    }
  };

  const handleDownload = (url: string, name: string) => {
    // Crear un enlace temporal para descargar
    const link = document.createElement('a');
    link.href = `/api/files/${encodeURIComponent(url)}`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Repertorio de Documentos
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando documentos...</p>
            </div>
          </div>
        ) : documentsData?.documents && documentsData.documents.length > 0 ? (
          <div className="space-y-4 py-4">
            {documentsData.documents.map((doc, index) => {
              const Icon = getDocumentIcon(doc.type);
              return (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-6 w-6 text-primary" />
                          <div>
                            <p className="font-semibold text-lg">
                              {getDocumentLabel(doc.type)}
                            </p>
                            <p className="text-sm text-slate-500">{doc.name}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Subido: {format(new Date(doc.uploadedAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(doc.url, doc.name)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Descargar
                        </Button>
                      </div>

                      {/* Información extraída del comprobante */}
                      {doc.type === 'voucher' && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t bg-slate-50 dark:bg-slate-900/50 p-3 rounded">
                          {doc.extractedAmount && (
                            <div>
                              <p className="text-xs text-slate-500">Monto</p>
                              <p className="font-semibold">${doc.extractedAmount.toLocaleString()}</p>
                            </div>
                          )}
                          {doc.extractedDate && (
                            <div>
                              <p className="text-xs text-slate-500">Fecha</p>
                              <p className="font-semibold">
                                {format(new Date(doc.extractedDate), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                          )}
                          {doc.extractedBank && (
                            <div>
                              <p className="text-xs text-slate-500">Banco</p>
                              <p className="font-semibold">{doc.extractedBank}</p>
                            </div>
                          )}
                          {doc.extractedReference && (
                            <div>
                              <p className="text-xs text-slate-500">Referencia</p>
                              <p className="font-semibold">{doc.extractedReference}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Preview para PDFs */}
                      {doc.url && doc.url.toLowerCase().endsWith('.pdf') && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Vista previa:</p>
                          <div className="border rounded-lg overflow-hidden">
                            <iframe
                              src={`/api/files/${encodeURIComponent(doc.url)}`}
                              className="w-full h-96"
                              title={doc.name}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500">No hay documentos disponibles</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}







