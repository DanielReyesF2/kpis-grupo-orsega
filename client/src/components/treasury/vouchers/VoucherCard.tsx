import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calendar,
  Building2,
  Eye,
  Edit,
  Trash2,
  Send,
  MoreVertical,
  Download,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PaymentVoucher {
  id: number;
  companyId: number;
  payerCompanyId?: number;
  clientId: number;
  clientName: string;
  supplierId?: number;
  status: "pago_programado" | "factura_pagada" | "pendiente_complemento" | "complemento_recibido" | "cierre_contable";
  voucherFileUrl: string;
  voucherFileName: string;
  extractedAmount: number | null;
  extractedDate: string | null;
  extractedBank: string | null;
  extractedReference: string | null;
  extractedCurrency: string | null;
  extractedTrackingKey?: string | null;
  ocrConfidence: number | null;
  notes: string | null;
  createdAt: string;
}

interface VoucherCardProps {
  voucher: PaymentVoucher;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onResend?: () => void;
  onDownload?: () => void;
  onPay?: () => void;
  isDragging?: boolean;
}

export const VoucherCard = memo(function VoucherCard({
  voucher,
  onClick,
  onEdit,
  onDelete,
  onResend,
  onDownload,
  onPay,
  isDragging = false,
}: VoucherCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Abrir documento en nueva pestaña
    const fileUrl = voucher.voucherFileUrl.startsWith("http")
      ? voucher.voucherFileUrl
      : voucher.voucherFileUrl.startsWith("/uploads")
      ? voucher.voucherFileUrl
      : `/uploads/${voucher.voucherFileUrl}`;

    window.open(fileUrl, "_blank");
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload();
    } else {
      const fileUrl = voucher.voucherFileUrl.startsWith("http")
        ? voucher.voucherFileUrl
        : voucher.voucherFileUrl.startsWith("/uploads")
        ? voucher.voucherFileUrl
        : `/uploads/${voucher.voucherFileUrl}`;
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = voucher.voucherFileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`
          cursor-pointer transition-all duration-200 bg-white
          hover:shadow-lg hover:border-emerald-400
          border border-slate-200
          ${isDragging ? "opacity-50" : ""}
        `}
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header con cliente y acciones */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-base text-slate-900 truncate">
                {voucher.clientName}
              </h4>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {voucher.voucherFileName}
              </p>
            </div>
            {/* Botones siempre visibles */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                onClick={handlePreview}
              >
                <Eye className="h-3.5 w-3.5 text-slate-600" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-lg" onClick={(e) => e.stopPropagation()}>
                  {onEdit && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="cursor-pointer">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </DropdownMenuItem>
                  {onResend && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResend(); }} className="cursor-pointer">
                      <Send className="h-4 w-4 mr-2" />
                      Reenviar
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="text-red-600 cursor-pointer hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Monto destacado */}
          {voucher.extractedCurrency && voucher.extractedAmount && (
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="font-semibold text-sm px-3 py-1 bg-primary/10 border-primary/20"
              >
                {voucher.extractedCurrency} ${voucher.extractedAmount.toLocaleString()}
              </Badge>
              {voucher.ocrConfidence !== null && (
                <Badge
                  variant={voucher.ocrConfidence > 0.7 ? "default" : "secondary"}
                  className="text-xs"
                >
                  OCR: {(voucher.ocrConfidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          )}

          {/* Botón Pagar - solo para pagos programados */}
          {(voucher.status === 'pago_programado' || voucher.status === 'factura_pagada') && onPay && (
            <Button
              size="sm"
              variant="default"
              className="w-full h-9 font-medium bg-emerald-600 hover:bg-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                onPay();
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar
            </Button>
          )}

          {/* Información adicional */}
          <div className="space-y-1.5">
            {voucher.extractedBank && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{voucher.extractedBank}</span>
              </div>
            )}
            {voucher.extractedReference && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Ref: {voucher.extractedReference}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{format(new Date(voucher.createdAt), "dd MMM yyyy", { locale: es })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

