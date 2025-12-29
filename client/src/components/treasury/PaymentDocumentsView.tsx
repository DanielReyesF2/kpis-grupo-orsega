import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Receipt, FileCheck, Image as ImageIcon, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

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

  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});

  const handleDownload = (url: string, name: string) => {
    // Crear un enlace temporal para descargar
    const link = document.createElement('a');
    // Si la URL ya es absoluta o completa, usarla directamente
    // Si comienza con /uploads, construir la ruta completa
    const fileUrl = url.startsWith('http') ? url : url.startsWith('/uploads') ? url : `/uploads/${url}`;
    link.href = fileUrl;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
  };

  const isPDF = (fileName: string) => {
    return /\.pdf$/i.test(fileName);
  };

  const getDocumentUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return url;
    return `/uploads/${url}`;
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
          <div className="space-y-6 py-4">
            {documentsData.documents.map((doc: Document, index: number) => {
              const Icon = getDocumentIcon(doc.type);
              return (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-lg text-slate-900 dark:text-slate-50">
                              {getDocumentLabel(doc.type)}
                            </p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">{doc.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                              Subido: {format(new Date(doc.uploadedAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-semibold"
                          onClick={() => handleDownload(doc.url, doc.name)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Descargar
                        </Button>
                      </div>

                      {/* Información extraída del comprobante */}
                      {doc.type === 'voucher' && (doc.extractedAmount || doc.extractedDate || doc.extractedBank || doc.extractedReference) && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                          {doc.extractedAmount && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monto</p>
                              <p className="font-bold text-base text-slate-900 dark:text-slate-50">${doc.extractedAmount.toLocaleString()}</p>
                            </div>
                          )}
                          {doc.extractedDate && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fecha</p>
                              <p className="font-bold text-base text-slate-900 dark:text-slate-50">
                                {format(new Date(doc.extractedDate), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                          )}
                          {doc.extractedBank && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Banco</p>
                              <p className="font-bold text-base text-slate-900 dark:text-slate-50">{doc.extractedBank}</p>
                            </div>
                          )}
                          {doc.extractedReference && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Referencia</p>
                              <p className="font-bold text-base text-slate-900 dark:text-slate-50">{doc.extractedReference}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Preview para PDFs e Imágenes */}
                      {doc.url && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Vista previa:</p>
                          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                            {isImage(doc.name) && !imageErrors[index] ? (
                              <div className="relative w-full" style={{ minHeight: '400px', maxHeight: '600px' }}>
                                <img
                                  src={getDocumentUrl(doc.url)}
                                  alt={doc.name}
                                  className="w-full h-auto object-contain"
                                  style={{ maxHeight: '600px' }}
                                  onError={() => setImageErrors({ ...imageErrors, [index]: true })}
                                  onLoad={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    const container = img.parentElement;
                                    if (container) {
                                      container.style.height = 'auto';
                                    }
                                  }}
                                />
                                <div className="absolute top-2 right-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleDownload(doc.url, doc.name)}
                                    className="shadow-md"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : isPDF(doc.name) ? (
                              <div className="relative w-full" style={{ height: '600px' }}>
                                <iframe
                                  src={getDocumentUrl(doc.url)}
                                  className="w-full h-full"
                                  title={doc.name}
                                  onError={() => {
                                    setImageErrors({ ...imageErrors, [index]: true });
                                  }}
                                />
                                <div className="absolute top-2 right-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleDownload(doc.url, doc.name)}
                                    className="shadow-md"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-12 text-center" style={{ minHeight: '300px' }}>
                                <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
                                <p className="text-slate-600 dark:text-slate-400 mb-4">
                                  Vista previa no disponible para este tipo de archivo
                                </p>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDownload(doc.url, doc.name)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar archivo
                                </Button>
                              </div>
                            )}
                            {imageErrors[index] && (
                              <div className="flex flex-col items-center justify-center p-12 text-center">
                                <ImageIcon className="h-12 w-12 text-slate-400 mb-4" />
                                <p className="text-slate-600 dark:text-slate-400 mb-4">
                                  No se pudo cargar la imagen
                                </p>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDownload(doc.url, doc.name)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Descargar archivo
                                </Button>
                              </div>
                            )}
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







