import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Receipt, FileCheck, Calendar, DollarSign, Building2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentDocumentsView } from "./PaymentDocumentsView";
import { useState } from "react";

interface PaymentHistoryProps {
  companyId?: number;
}

interface Payment {
  id: number;
  supplierName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  paymentDate?: string | null;
  status: string;
  reference: string | null;
  voucherId: number | null;
  hydralFileUrl: string | null;
  hydralFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function PaymentHistory({ companyId }: PaymentHistoryProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/treasury/payments", companyId, "history"],
    queryFn: async () => {
      const params = companyId ? `?companyId=${companyId}` : '';
      const response = await fetch(`/api/treasury/payments${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      
      // Normalizar datos
      const normalizedData = data.map((payment: any) => ({
        ...payment,
        companyId: payment.company_id || payment.companyId,
        supplierId: payment.supplier_id || payment.supplierId,
        supplierName: payment.supplier_name || payment.supplierName,
        dueDate: payment.due_date || payment.dueDate,
        paymentDate: payment.payment_date || payment.paymentDate,
        voucherId: payment.voucher_id || payment.voucherId,
        hydralFileUrl: payment.hydral_file_url || payment.hydralFileUrl,
        hydralFileName: payment.hydral_file_name || payment.hydralFileName,
        createdAt: payment.created_at || payment.createdAt,
        updatedAt: payment.updated_at || payment.updatedAt,
      }));

      // Filtrar solo pagos completados o cerrados
      return normalizedData.filter((p: Payment) => 
        p.status === 'payment_completed' || 
        p.status === 'closed' || 
        p.status === 'voucher_uploaded'
      ).sort((a: Payment, b: Payment) => {
        // Ordenar por fecha de pago o fecha de actualización (más recientes primero)
        const dateA = new Date(a.paymentDate || a.updatedAt || a.dueDate).getTime();
        const dateB = new Date(b.paymentDate || b.updatedAt || b.dueDate).getTime();
        return dateB - dateA;
      });
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'payment_completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300">Pagada</Badge>;
      case 'closed':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300">Cerrada</Badge>;
      case 'voucher_uploaded':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300">En seguimiento REP</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewDocuments = (paymentId: number) => {
    setSelectedPaymentId(paymentId);
  };

  const hasDocuments = (payment: Payment) => {
    return !!(payment.hydralFileUrl || payment.voucherId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando historial de pagos...</p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
          No hay pagos completados
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500">
          Los pagos completados aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {payments.map((payment) => (
          <Card 
            key={payment.id} 
            className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500/50"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                {/* Información principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                          {payment.supplierName || 'Proveedor desconocido'}
                        </h3>
                        {getStatusBadge(payment.status)}
                      </div>
                      
                      {payment.reference && (
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Factura: <span className="text-slate-900 dark:text-slate-100">{payment.reference}</span>
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Monto</p>
                            <p className="text-base font-bold text-slate-900 dark:text-slate-50">
                              {payment.currency} ${payment.amount.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {payment.paymentDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Fecha de pago</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {format(new Date(payment.paymentDate), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                          </div>
                        )}

                        {payment.dueDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Fecha de vencimiento</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {format(new Date(payment.dueDate), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Estado</p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">
                              {payment.status.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {hasDocuments(payment) ? (
                    <Button
                      variant="default"
                      className="w-full font-semibold"
                      onClick={() => handleViewDocuments(payment.id)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Documentos
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled
                      className="w-full"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Sin documentos
                    </Button>
                  )}
                  
                  {payment.hydralFileUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = payment.hydralFileUrl!.startsWith('http') 
                          ? payment.hydralFileUrl! 
                          : payment.hydralFileUrl!.startsWith('/uploads')
                          ? payment.hydralFileUrl!
                          : `/uploads/${payment.hydralFileUrl!}`;
                        link.download = payment.hydralFileName || 'factura.pdf';
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Factura
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de documentos */}
      {selectedPaymentId && (
        <PaymentDocumentsView
          isOpen={!!selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
          scheduledPaymentId={selectedPaymentId}
        />
      )}
    </>
  );
}

