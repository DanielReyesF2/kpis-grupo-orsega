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
  const isRep = status === "pendiente_complemento";
  const isPay = status === "pago_programado" || status === "factura_pagada";

  // Aggregate totals by currency
  const totals = vouchers.reduce<Record<string, number>>((acc, v) => {
    if (v.extractedAmount) {
      const currency = v.extractedCurrency || "MXN";
      acc[currency] = (acc[currency] || 0) + v.extractedAmount;
    }
    return acc;
  }, {});
  const totalEntries = Object.entries(totals);

  // Accent colors based on status
  const accent = isRep
    ? { border: "border-l-orange-500", bg: "bg-orange-50", headerBg: "bg-orange-100", text: "text-orange-700", badge: "bg-orange-500 text-white" }
    : isPay
    ? { border: "border-l-emerald-500", bg: "bg-emerald-50", headerBg: "bg-emerald-100", text: "text-emerald-700", badge: "bg-emerald-600 text-white" }
    : { border: "border-l-slate-400", bg: "bg-slate-50", headerBg: "bg-slate-100", text: "text-slate-700", badge: "bg-slate-500 text-white" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`transition-all duration-200 bg-white hover:shadow-lg border border-slate-200 border-l-4 ${accent.border}`}>
        <CardContent className="p-0">
          {/* Header — colored banner */}
          <div className={`px-4 py-3 ${accent.headerBg} rounded-t-lg`}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-base text-slate-900 truncate">
                {supplierName}
              </h4>
              <Badge className={`shrink-0 font-bold text-sm px-3 ${accent.badge}`}>
                {vouchers.length} facturas
              </Badge>
            </div>
            {/* Total amounts */}
            {totalEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {totalEntries.map(([currency, amount]) => (
                  <span key={currency} className="font-bold text-lg text-slate-800">
                    {currency} ${amount.toLocaleString()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Mini list: show each invoice reference + amount (always visible) */}
            <div className="space-y-1">
              {vouchers.slice(0, expanded ? vouchers.length : 3).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVoucherClick(v);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-700">
                      {v.extractedReference || v.voucherFileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.extractedAmount ? (
                      <span className="font-semibold text-slate-800 text-sm">
                        ${v.extractedAmount.toLocaleString()}
                      </span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
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
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Show more/less — only if more than 3 */}
            {vouchers.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    +{vouchers.length - 3} más
                  </>
                )}
              </Button>
            )}

            {/* Action button */}
            {isPay && (
              <Button
                size="sm"
                variant="default"
                className="w-full h-10 font-semibold text-sm bg-emerald-600 hover:bg-emerald-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onPay(first);
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar {vouchers.length} facturas
              </Button>
            )}

            {isRep && (
              <Button
                size="sm"
                className="w-full h-10 font-semibold text-sm bg-orange-500 hover:bg-orange-600 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadRep(first);
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir REP ({vouchers.length} facturas)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});
