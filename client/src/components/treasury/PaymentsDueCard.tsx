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
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Log para depuración
  console.log('[PaymentsDueCard] payments recibidos:', payments.length, payments);

  // Filtrar pagos por pagar (vencidos o próximos 7 días para mostrar más ejemplos)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const paymentsDue = payments.filter((p) => {
    if (p.status === "paid" || p.status === "cancelled") {
      console.log('[PaymentsDueCard] Filtrado por status:', p.id, p.status);
      return false;
    }
    
    const dueDateStr = p.due_date || p.dueDate;
    if (!dueDateStr) {
      console.log('[PaymentsDueCard] Sin fecha de vencimiento:', p.id);
      return false;
    }
    
    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) {
      console.log('[PaymentsDueCard] Fecha inválida:', p.id, dueDateStr);
      return false;
    }
    dueDate.setHours(0, 0, 0, 0);
    
    // Incluir vencidos o próximos 7 días
    const isInRange = dueDate <= sevenDaysFromNow;
    if (!isInRange) {
      console.log('[PaymentsDueCard] Fuera de rango:', p.id, dueDateStr, 'hasta', sevenDaysFromNow.toISOString());
    }
    return isInRange;
  }).sort((a, b) => {
    const dateA = new Date(a.due_date || a.dueDate || "").getTime();
    const dateB = new Date(b.due_date || b.dueDate || "").getTime();
    return dateA - dateB;
  });

  console.log('[PaymentsDueCard] paymentsDue filtrados:', paymentsDue.length, paymentsDue);

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
              {paymentsDue.slice(0, 4).map((payment) => {
                const overdue = isOverdue(payment.due_date || payment.dueDate);
                return (
                  <div
                    key={payment.id}
                    className={`p-3 border rounded-lg bg-card hover:border-primary/40 transition-all cursor-pointer ${
                      overdue ? "border-red-300 dark:border-red-700" : "border-border"
                    }`}
                    onClick={onViewAll}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {overdue ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          ) : (
                            <Calendar className="h-4 w-4 text-green-600 flex-shrink-0" />
                          )}
                          <p className="text-sm font-semibold text-foreground truncate">
                            {payment.supplier_name || payment.supplierName || "Sin proveedor"}
                          </p>
                        </div>
                        <p className="text-base font-bold text-green-700 dark:text-green-400">
                          {payment.currency} ${payment.amount.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        {(payment.due_date || payment.dueDate) && (
                          <p className={`text-xs mt-0.5 ${overdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                            Vence: {format(new Date(payment.due_date || payment.dueDate || ""), "dd 'de' MMMM", { locale: es })}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={overdue ? "destructive" : "outline"}
                        className="text-xs"
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

