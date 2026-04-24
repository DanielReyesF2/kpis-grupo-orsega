import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calendar,
  CreditCard,
  Upload,
  ChevronDown,
  ChevronUp,
  Eye,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PaymentVoucher } from "./VoucherCard";

interface GroupedVoucherCardProps {
  vouchers: PaymentVoucher[];
  onVoucherClick: (voucher: PaymentVoucher) => void;
  onPay: (voucher: PaymentVoucher) => void;
  onDelete: (voucher: PaymentVoucher) => void;
  onUploadRep: (voucher: PaymentVoucher) => void;
}

export const GroupedVoucherCard = memo(function GroupedVoucherCard({
  vouchers,
  onVoucherClick,
  onPay,
  onDelete,
  onUploadRep,
}: GroupedVoucherCardProps) {
  const [expanded, setExpanded] = useState(false);
  const first = vouchers[0];
  const supplierName = first.clientName || first.client_name || "Proveedor";
  const status = first.status;

  // Aggregate amounts by currency
  const totals = vouchers.reduce<Record<string, number>>((acc, v) => {
    if (v.extractedAmount) {
      const currency = v.extractedCurrency || "MXN";
      acc[currency] = (acc[currency] || 0) + v.extractedAmount;
    }
    return acc;
  }, {});

  const totalEntries = Object.entries(totals);

  // Date range
  const dates = vouchers.map((v) => new Date(v.createdAt)).sort((a, b) => a.getTime() - b.getTime());
  const oldestDate = dates[0];
  const newestDate = dates[dates.length - 1];
  const sameDate =
    format(oldestDate, "dd MMM yyyy") === format(newestDate, "dd MMM yyyy");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="cursor-pointer transition-all duration-200 bg-white hover:shadow-lg hover:border-emerald-400 border border-slate-200">
        <CardContent className="p-4 space-y-3">
          {/* Header: supplier name + count badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-base text-slate-900 truncate">
                {supplierName}
              </h4>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 font-bold text-sm bg-primary/10 border-primary/20 flex items-center gap-1"
            >
              <Layers className="h-3 w-3" />
              {vouchers.length}
            </Badge>
          </div>

          {/* Totals */}
          {totalEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {totalEntries.map(([currency, amount]) => (
                <Badge
                  key={currency}
                  variant="outline"
                  className="font-semibold text-sm px-3 py-1 bg-primary/10 border-primary/20"
                >
                  {currency} ${amount.toLocaleString()}
                </Badge>
              ))}
            </div>
          )}

          {/* Expand/collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Ocultar detalle
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Ver {vouchers.length} facturas
              </>
            )}
          </Button>

          {/* Expanded detail */}
          {expanded && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              {vouchers.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 transition-colors text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVoucherClick(v);
                  }}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      {v.extractedReference && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <FileText className="h-3 w-3" />
                          {v.extractedReference}
                        </span>
                      )}
                      {v.extractedAmount && (
                        <span className="font-semibold text-slate-800">
                          {v.extractedCurrency || "MXN"} $
                          {v.extractedAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="truncate max-w-[180px]">
                        {v.voucherFileName}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(v.createdAt), "dd MMM", {
                          locale: es,
                        })}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      const fileUrl = v.voucherFileUrl.startsWith("http")
                        ? v.voucherFileUrl
                        : v.voucherFileUrl.startsWith("/uploads")
                        ? v.voucherFileUrl
                        : `/uploads/${v.voucherFileUrl}`;
                      window.open(fileUrl, "_blank");
                    }}
                    title="Ver documento"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {(status === "pago_programado" || status === "factura_pagada") && (
            <Button
              size="sm"
              variant="default"
              className="w-full h-9 font-medium bg-emerald-600 hover:bg-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                onPay(first);
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar ({vouchers.length} facturas)
            </Button>
          )}

          {status === "pendiente_complemento" && (
            <Button
              size="sm"
              className="w-full h-9 font-medium bg-orange-500 hover:bg-orange-600 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onUploadRep(first);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Subir REP ({vouchers.length} facturas)
            </Button>
          )}

          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            {sameDate ? (
              <span>
                {format(oldestDate, "dd MMM yyyy", { locale: es })}
              </span>
            ) : (
              <span>
                {format(oldestDate, "dd MMM", { locale: es })} —{" "}
                {format(newestDate, "dd MMM yyyy", { locale: es })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});
