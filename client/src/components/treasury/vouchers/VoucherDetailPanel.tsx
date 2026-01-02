import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Edit2,
  Save,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  User,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  ClipboardCheck,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PaymentVoucher } from "./VoucherCard";

interface VoucherDetailPanelProps {
  voucher: PaymentVoucher | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (voucher: Partial<PaymentVoucher>) => void;
}

const STATUS_CONFIG = {
  factura_pagada: {
    label: "Factura Pagada",
    icon: ClipboardCheck,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  pendiente_complemento: {
    label: "Pendiente Complemento",
    icon: AlertTriangle,
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  },
  complemento_recibido: {
    label: "Complemento Recibido",
    icon: FileCheck,
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  },
  cierre_contable: {
    label: "Cierre Contable",
    icon: CheckCircle,
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
};

export function VoucherDetailPanel({
  voucher,
  isOpen,
  onClose,
  onSave,
}: VoucherDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedVoucher, setEditedVoucher] = useState<Partial<PaymentVoucher> | null>(null);

  if (!voucher) return null;

  const handleEdit = () => {
    setEditedVoucher({ ...voucher });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedVoucher && onSave) {
      onSave(editedVoucher);
    }
    setIsEditing(false);
    setEditedVoucher(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedVoucher(null);
  };

  const currentVoucher = editedVoucher || voucher;
  const statusConfig = STATUS_CONFIG[voucher.status];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-2xl">Detalles del Comprobante</SheetTitle>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </>
              )}
            </div>
          </div>
          <SheetDescription>
            Información completa del comprobante de pago
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <statusConfig.icon className="h-5 w-5" />
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Propiedades editables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cliente */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Cliente
              </label>
              {isEditing ? (
                <Input
                  value={currentVoucher.clientName || ""}
                  onChange={(e) =>
                    setEditedVoucher({
                      ...currentVoucher,
                      clientName: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-900">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">{voucher.clientName}</span>
                </div>
              )}
            </div>

            {/* Monto */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Monto
              </label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={currentVoucher.extractedCurrency || ""}
                    onChange={(e) =>
                      setEditedVoucher({
                        ...currentVoucher,
                        extractedCurrency: e.target.value,
                      })
                    }
                    placeholder="MXN"
                    className="w-20"
                  />
                  <Input
                    type="number"
                    value={currentVoucher.extractedAmount || ""}
                    onChange={(e) =>
                      setEditedVoucher({
                        ...currentVoucher,
                        extractedAmount: parseFloat(e.target.value) || null,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-900">
                  <DollarSign className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">
                    {voucher.extractedCurrency || "MXN"} $
                    {voucher.extractedAmount?.toLocaleString() || "0.00"}
                  </span>
                </div>
              )}
            </div>

            {/* Banco */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Banco
              </label>
              {isEditing ? (
                <Input
                  value={currentVoucher.extractedBank || ""}
                  onChange={(e) =>
                    setEditedVoucher({
                      ...currentVoucher,
                      extractedBank: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-900">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span>{voucher.extractedBank || "N/A"}</span>
                </div>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Fecha
              </label>
              {isEditing ? (
                <Input
                  type="date"
                  value={
                    currentVoucher.extractedDate
                      ? format(new Date(currentVoucher.extractedDate), "yyyy-MM-dd")
                      : ""
                  }
                  onChange={(e) =>
                    setEditedVoucher({
                      ...currentVoucher,
                      extractedDate: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-900">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span>
                    {voucher.extractedDate
                      ? format(new Date(voucher.extractedDate), "dd MMM yyyy", {
                          locale: es,
                        })
                      : "N/A"}
                  </span>
                </div>
              )}
            </div>

            {/* Referencia */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Referencia
              </label>
              {isEditing ? (
                <Input
                  value={currentVoucher.extractedReference || ""}
                  onChange={(e) =>
                    setEditedVoucher({
                      ...currentVoucher,
                      extractedReference: e.target.value,
                    })
                  }
                />
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-900">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span>{voucher.extractedReference || "N/A"}</span>
                </div>
              )}
            </div>

            {/* Archivo */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Archivo
              </label>
              <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-900">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-sm truncate">{voucher.voucherFileName}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              Notas
            </label>
            {isEditing ? (
              <Textarea
                value={currentVoucher.notes || ""}
                onChange={(e) =>
                  setEditedVoucher({
                    ...currentVoucher,
                    notes: e.target.value,
                  })
                }
                rows={4}
                placeholder="Agregar notas..."
              />
            ) : (
              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-900 min-h-[100px]">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {voucher.notes || "Sin notas"}
                </p>
              </div>
            )}
          </div>

          {/* Confianza OCR */}
          {voucher.ocrConfidence !== null && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Confianza OCR
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      voucher.ocrConfidence > 0.7
                        ? "bg-green-500"
                        : voucher.ocrConfidence > 0.5
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${voucher.ocrConfidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {(voucher.ocrConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

