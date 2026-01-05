import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Receipt, FileCheck, Image as ImageIcon, AlertCircle, Building2, Calendar, DollarSign, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { PDFViewer } from "@/components/treasury/document-viewer/PDFViewer";
import { ImageViewer } from "@/components/treasury/document-viewer/ImageViewer";

interface PaymentDocumentsViewProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledPaymentId: number;
}

interface PaymentDetails {
  id: number;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  sourceType: string | null;
  createdAt: string;
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

interface DocumentsResponse {
  scheduledPaymentId: number;
  payment: PaymentDetails;
  documents: Document[];
}

export function PaymentDocumentsView({ isOpen, onClose, scheduledPaymentId }: PaymentDocumentsViewProps) {
  const { data: documentsData, isLoading } = useQuery<DocumentsResponse>({
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

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'idrall_imported': { label: 'Importada', variant: 'secondary' },
      'pending_approval': { label: 'Pendiente Aprobación', variant: 'secondary' },
      'approved': { label: 'Aprobada', variant: 'outline' },
      'payment_scheduled': { label: 'Pago Programado', variant: 'outline' },
      'payment_pending': { label: 'Pago Pendiente', variant: 'secondary' },
      'payment_completed': { label: 'Pagada', variant: 'default' },
      'voucher_uploaded': { label: 'Comprobante Subido', variant: 'outline' },
      'closed': { label: 'Cerrada', variant: 'default' },
    };
    return statusMap[status] || { label: status, variant: 'secondary' as const };
  };

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

  const payment = documentsData?.payment;
  const isOverdue = payment?.dueDate ? new Date(payment.dueDate) < new Date() : false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Detalles de Cuenta por Pagar
          </DialogTitle>
          {payment && (
            <DialogDescription className="text-base">
              {payment.supplierName || 'Proveedor desconocido'}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando información...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Detalles del Pago */}
            {payment && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-slate-900 dark:text-slate-50">
                          {payment.supplierName || 'Proveedor desconocido'}
                        </h3>
                        {payment.reference && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Referencia: <span className="font-semibold">{payment.reference}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={getStatusLabel(payment.status).variant} className="text-sm px-3 py-1">
                      {getStatusLabel(payment.status).label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Monto</p>
                        <p className="font-bold text-lg text-slate-900 dark:text-slate-50">
                          {payment.currency} ${payment.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-slate-500'}`} />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fecha de Vencimiento</p>
                        <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-900 dark:text-slate-50'}`}>
                          {format(new Date(payment.dueDate), "dd MMM yyyy", { locale: es })}
                          {isOverdue && <span className="ml-1 text-xs">(Vencida)</span>}
                        </p>
                      </div>
                    </div>

                    {payment.paymentDate && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Pago Programado</p>
                          <p className="font-semibold text-blue-600">
                            {format(new Date(payment.paymentDate), "dd MMM yyyy", { locale: es })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Origen</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-50">
                          {payment.sourceType === 'idrall' ? 'Importado (Idrall)' : 'Manual'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {payment.notes && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notas</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{payment.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sección de Documentos */}
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos Asociados
              </h3>

              {documentsData?.documents && documentsData.documents.length > 0 ? (
                <div className="space-y-4">
                  {documentsData.documents.map((doc, index) => {
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
                                      <ImageViewer
                                        imageUrl={getDocumentUrl(doc.url)}
                                        imageName={doc.name}
                                        onDownload={() => handleDownload(doc.url, doc.name)}
                                        className="h-full"
                                      />
                                    </div>
                                  ) : isPDF(doc.name) ? (
                                    <div className="relative w-full" style={{ height: '600px' }}>
                                      <PDFViewer
                                        fileUrl={getDocumentUrl(doc.url)}
                                        fileName={doc.name}
                                        onDownload={() => handleDownload(doc.url, doc.name)}
                                        className="h-full"
                                      />
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
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-slate-500 text-sm">No hay documentos asociados</p>
                      <p className="text-slate-400 text-xs mt-1">Sube una factura o comprobante para verlo aquí</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}







