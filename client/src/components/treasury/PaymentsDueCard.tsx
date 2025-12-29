import { devLog } from "@/lib/logger";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface Payment {
  id: number;
  supplier_name?: string;
  supplierName?: string;
  amount: number;
  currency: string;
  due_date?: string;
  dueDate?: string;
  payment_date?: string; // ✅ Agregar paymentDate
  paymentDate?: string; // ✅ Agregar paymentDate
  status: string;
  company_id?: number;
  companyId?: number;
}

interface PaymentsDueCardProps {
  onViewAll: () => void;
}

export function PaymentsDueCard({ onViewAll }: PaymentsDueCardProps) {
  // Obtener pagos programados
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/treasury/payments"],
    staleTime: 0, // Reducir staleTime para que siempre refetch después de invalidación
    refetchInterval: 60000,
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/treasury/payments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      
      // Normalizar datos: convertir snake_case a camelCase
      const normalizedData = data.map((payment: any) => ({
        ...payment,
        companyId: payment.company_id || payment.companyId,
        supplierId: payment.supplier_id || payment.supplierId,
        supplierName: payment.supplier_name || payment.supplierName,
        dueDate: payment.due_date || payment.dueDate,
        paymentDate: payment.payment_date || payment.paymentDate, // ✅ IMPORTANTE: paymentDate
        voucherId: payment.voucher_id || payment.voucherId,
        createdAt: payment.created_at || payment.createdAt,
        updatedAt: payment.updated_at || payment.updatedAt,
      }));
      
      return normalizedData;
    },
  });

  // Log para depuración
  devLog.log('[PaymentsDueCard] payments recibidos:', payments.length, payments);

  // Filtrar pagos por pagar (vencidos o próximos 7 días para mostrar más ejemplos)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const paymentsDue = payments.filter((p: Payment) => {
    if (p.status === "paid" || p.status === "cancelled" || p.status === "payment_completed" || p.status === "closed") {
      devLog.log('[PaymentsDueCard] Filtrado por status:', p.id, p.status);
      return false;
    }
    
    // ✅ PRIORIDAD: Usar paymentDate si existe, sino usar dueDate
    // Mostrar pagos que están programados para los próximos 7 días (por paymentDate)
    // O pagos que están vencidos (por dueDate)
    const paymentDateStr = p.paymentDate || p.payment_date;
    const dueDateStr = p.dueDate || p.due_date;
    
    // Si tiene paymentDate, usar ese para mostrar pagos programados
    if (paymentDateStr) {
      const paymentDate = new Date(paymentDateStr);
      if (isNaN(paymentDate.getTime())) {
        devLog.log('[PaymentsDueCard] Fecha de pago inválida:', p.id, paymentDateStr);
        // Si paymentDate es inválido, intentar con dueDate
        if (!dueDateStr) return false;
      } else {
        paymentDate.setHours(0, 0, 0, 0);
        // Mostrar si está programado para los próximos 7 días
        const isInRange = paymentDate <= sevenDaysFromNow && paymentDate >= today;
        if (isInRange) {
          devLog.log('[PaymentsDueCard] Pago en rango (paymentDate):', p.id, paymentDate.toISOString());
        }
        return isInRange;
      }
    }
    
    // Si no tiene paymentDate, usar dueDate (para pagos vencidos o antiguos)
    if (!dueDateStr) {
      devLog.log('[PaymentsDueCard] Sin fecha de pago ni vencimiento:', p.id);
      return false;
    }
    
    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) {
      devLog.log('[PaymentsDueCard] Fecha inválida:', p.id, dueDateStr);
      return false;
    }
    dueDate.setHours(0, 0, 0, 0);
    
    // Incluir vencidos o próximos 7 días (usando dueDate como fallback)
    const isInRange = dueDate <= sevenDaysFromNow;
    if (!isInRange) {
      devLog.log('[PaymentsDueCard] Fuera de rango (dueDate):', p.id, dueDateStr, 'hasta', sevenDaysFromNow.toISOString());
    }
    return isInRange;
  }).sort((a: Payment, b: Payment) => {
    // Ordenar por paymentDate si existe, sino por dueDate
    const dateA = new Date((a.paymentDate || a.payment_date || a.dueDate || a.due_date || "")).getTime();
    const dateB = new Date((b.paymentDate || b.payment_date || b.dueDate || b.due_date || "")).getTime();
    return dateA - dateB;
  });

  devLog.log('[PaymentsDueCard] paymentsDue filtrados:', paymentsDue.length, paymentsDue);

  const isOverdue = (dueDateStr: string | undefined) => {
    if (!dueDateStr) return false;
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Cuentas por Pagar
          </CardTitle>
          <Badge variant="outline" className="text-xs px-2 py-0.5">
            {paymentsDue.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : paymentsDue.length === 0 ? (
          <div className="text-center py-4">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm font-semibold text-foreground mb-1">
              Sin pagos pendientes
            </p>
            <p className="text-xs text-muted-foreground">
              No hay pagos programados próximos
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {paymentsDue.slice(0, 4).map((payment: Payment) => {
                const overdue = isOverdue(payment.due_date || payment.dueDate);
                return (
                  <div
                    key={payment.id}
                    className={`p-4 border rounded-lg bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer border-l-4 ${
                      overdue ? "border-l-red-500/50 border-red-300 dark:border-red-700" : "border-l-green-500/50 border-border"
                    }`}
                    onClick={onViewAll}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {overdue ? (
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                          ) : (
                            <Calendar className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          )}
                          <p className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                            {payment.supplier_name || payment.supplierName || "Sin proveedor"}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-green-700 dark:text-green-400 mb-1">
                          {payment.currency} ${payment.amount.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        {(payment.due_date || payment.dueDate) && (
                          <p className={`text-sm font-medium mt-1 ${overdue ? "text-red-700 dark:text-red-300" : "text-slate-600 dark:text-slate-400"}`}>
                            Vence: {format(new Date(payment.due_date || payment.dueDate || ""), "dd 'de' MMMM", { locale: es })}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={overdue ? "destructive" : "outline"}
                        className="text-xs font-semibold flex-shrink-0"
                      >
                        {overdue ? "Vencido" : "Próximo"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            {paymentsDue.length > 4 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-center text-muted-foreground">
                  Y {paymentsDue.length - 4} más...
                </p>
              </div>
            )}
            <button
              onClick={onViewAll}
              className="w-full py-2 px-3 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-all"
            >
              Ver Todos los Pagos
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

