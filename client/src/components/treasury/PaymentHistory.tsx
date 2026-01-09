import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Calendar, DollarSign, Building2, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentDocumentsView } from "./PaymentDocumentsView";
import { useState, useMemo } from "react";

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

type FilterType = 'all' | 'pending' | 'completed';

export function PaymentHistory({ companyId }: PaymentHistoryProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const { data: allPayments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/treasury/payments", companyId, "all"],
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
      return data.map((payment: any) => ({
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
      })).sort((a: Payment, b: Payment) => {
        // Ordenar por fecha más reciente primero
        const dateA = new Date(a.paymentDate || a.updatedAt || a.dueDate).getTime();
        const dateB = new Date(b.paymentDate || b.updatedAt || b.dueDate).getTime();
        return dateB - dateA;
      });
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Filtrar pagos según el filtro seleccionado
  const payments = useMemo(() => {
    if (filter === 'all') return allPayments;
    
    const completedStatuses = ['payment_completed', 'closed', 'voucher_uploaded', 'cierre_contable'];
    const pendingStatuses = ['pending', 'pending_approval', 'approved', 'payment_scheduled', 'payment_pending', 'idrall_imported', 'pago_programado', 'pendiente_complemento'];
    
    if (filter === 'completed') {
      return allPayments.filter(p => completedStatuses.includes(p.status));
    }
    if (filter === 'pending') {
      return allPayments.filter(p => pendingStatuses.includes(p.status));
    }
    return allPayments;
  }, [allPayments, filter]);

  // Contadores para los badges
  const counts = useMemo(() => {
    const completedStatuses = ['payment_completed', 'closed', 'voucher_uploaded', 'cierre_contable'];
    const pendingStatuses = ['pending', 'pending_approval', 'approved', 'payment_scheduled', 'payment_pending', 'idrall_imported', 'pago_programado', 'pendiente_complemento'];
    
    return {
      all: allPayments.length,
      completed: allPayments.filter(p => completedStatuses.includes(p.status)).length,
      pending: allPayments.filter(p => pendingStatuses.includes(p.status)).length,
    };
  }, [allPayments]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'payment_completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300">Pagada</Badge>;
      case 'closed':
      case 'cierre_contable':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300">Cerrada</Badge>;
      case 'voucher_uploaded':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300">Comprobante subido</Badge>;
      case 'pending':
      case 'pending_approval':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">Pendiente aprobación</Badge>;
      case 'approved':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300">Aprobada</Badge>;
      case 'payment_scheduled':
      case 'pago_programado':
        return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-300">Pago programado</Badge>;
      case 'payment_pending':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300">Pago pendiente</Badge>;
      case 'pendiente_complemento':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300">Esperando REP</Badge>;
      case 'idrall_imported':
        return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 border-slate-300">Importada</Badge>;
      default:
        return <Badge variant="outline">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  // Función para obtener etiqueta de estado en español
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'payment_completed': 'Pagada',
      'closed': 'Cerrada',
      'cierre_contable': 'Cerrada',
      'voucher_uploaded': 'Comprobante subido',
      'pending': 'Pendiente',
      'pending_approval': 'Pendiente aprobación',
      'approved': 'Aprobada',
      'payment_scheduled': 'Pago programado',
      'pago_programado': 'Pago programado',
      'payment_pending': 'Pago pendiente',
      'pendiente_complemento': 'Esperando REP',
      'idrall_imported': 'Factura importada',
      'complemento_recibido': 'REP recibido',
      'factura_pagada': 'Factura pagada',
    };
    return labels[status] || status.replace(/_/g, ' ');
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

  // Componente de filtros
  const FilterButtons = () => (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <Button
        variant={filter === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setFilter('all')}
        className="gap-2"
      >
        Todos
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
          {counts.all}
        </Badge>
      </Button>
      <Button
        variant={filter === 'pending' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setFilter('pending')}
        className="gap-2"
      >
        <Clock className="h-4 w-4" />
        Pendientes
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-yellow-100 text-yellow-700">
          {counts.pending}
        </Badge>
      </Button>
      <Button
        variant={filter === 'completed' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setFilter('completed')}
        className="gap-2"
      >
        <CheckCircle className="h-4 w-4" />
        Completados
        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-green-100 text-green-700">
          {counts.completed}
        </Badge>
      </Button>
    </div>
  );

  if (payments.length === 0 && allPayments.length === 0) {
    return (
      <>
        <FilterButtons />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
            No hay pagos registrados
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Los pagos aparecerán aquí cuando se registren
          </p>
        </div>
      </>
    );
  }

  if (payments.length === 0) {
    return (
      <>
        <FilterButtons />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
            No hay pagos {filter === 'pending' ? 'pendientes' : 'completados'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Cambia el filtro para ver otros pagos
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <FilterButtons />
      <div className="space-y-4">
        {payments.map((payment) => {
          const isCompleted = ['payment_completed', 'closed', 'voucher_uploaded', 'cierre_contable'].includes(payment.status);
          const isPending = ['pending', 'pending_approval', 'payment_pending', 'pago_programado', 'pendiente_complemento'].includes(payment.status);
          
          return (
          <Card 
            key={payment.id} 
            className={`hover:shadow-lg transition-all duration-200 border-l-4 ${
              isCompleted ? 'border-l-green-500/50' : 
              isPending ? 'border-l-yellow-500/50' : 
              'border-l-blue-500/50'
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                {/* Información principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-4 mb-3">
                    <div className={`p-3 rounded-lg ${
                      isCompleted ? 'bg-green-100 dark:bg-green-900/30' :
                      isPending ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      ) : isPending ? (
                        <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white truncate" style={{ color: '#111827', fontSize: '20px', fontWeight: 800 }}>
                          {payment.supplierName || 'Proveedor desconocido'}
                        </h3>
                        {getStatusBadge(payment.status)}
                      </div>
                      
                      {payment.reference && (
                        <p className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2" style={{ color: '#1f2937' }}>
                          Factura: <span className="font-bold text-gray-900 dark:text-white" style={{ color: '#111827', fontWeight: 700 }}>{payment.reference}</span>
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400" style={{ color: '#4b5563' }}>Monto</p>
                            <p className="text-lg font-extrabold text-gray-900 dark:text-white" style={{ color: '#111827', fontSize: '18px', fontWeight: 800 }}>
                              {payment.currency} ${payment.amount.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {payment.paymentDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400" style={{ color: '#4b5563' }}>Fecha de pago</p>
                              <p className="text-sm font-bold text-gray-900 dark:text-white" style={{ color: '#111827', fontWeight: 700 }}>
                                {format(new Date(payment.paymentDate), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                          </div>
                        )}

                        {payment.dueDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400" style={{ color: '#4b5563' }}>Fecha de vencimiento</p>
                              <p className="text-sm font-bold text-gray-900 dark:text-white" style={{ color: '#111827', fontWeight: 700 }}>
                                {format(new Date(payment.dueDate), "dd MMM yyyy", { locale: es })}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400" style={{ color: '#4b5563' }}>Estado</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white" style={{ color: '#111827', fontWeight: 700 }}>
                              {getStatusLabel(payment.status)}
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
        );
        })}
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

