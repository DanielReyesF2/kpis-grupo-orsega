import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
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
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { PaymentVoucher } from "./VoucherCard";

interface VoucherDetailPanelProps {
  voucher: PaymentVoucher | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (voucher: Partial<PaymentVoucher>) => void;
}

const STATUS_CONFIG = {
  pago_programado: {
    label: "Por pagar",
    icon: Calendar,
    color: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
  },
  factura_pagada: {
    label: "Factura pagada",
    icon: ClipboardCheck,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  pendiente_complemento: {
    label: "Esperando REP",
    icon: AlertTriangle,
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  },
  complemento_recibido: {
    label: "REP recibido",
    icon: FileCheck,
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  },
  cierre_contable: {
    label: "Completado",
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
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedVoucher, setEditedVoucher] = useState<Partial<PaymentVoucher> | null>(null);
  const [repFile, setRepFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadRepMutation = useMutation({
    mutationFn: async ({ voucherId, file }: { voucherId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/payment-vouchers/${voucherId}/upload-rep`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir REP');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "REP recibido",
        description: "El complemento de pago se registró exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setRepFile(null);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al subir REP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/xml', 'text/xml'];

  const processRepFile = (selectedFile: File) => {
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xml')) {
      toast({
        title: "Formato no valido",
        description: "Solo se permiten archivos PDF, PNG, JPG o XML",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El tamano maximo es 10MB",
        variant: "destructive",
      });
      return;
    }
    setRepFile(selectedFile);
  };

  const handleRepFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processRepFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processRepFile(droppedFile);
    }
  };

  const handleUploadRep = () => {
    if (!repFile || !voucher) return;
    uploadRepMutation.mutate({ voucherId: voucher.id, file: repFile });
  };

  const currentVoucher = editedVoucher || voucher;
  const statusConfig = STATUS_CONFIG[voucher.status];
  const isPendingRep = voucher.status === "pendiente_complemento";

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
            Informacion completa del comprobante de pago
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
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-slate-100">{voucher.clientName || "N/A"}</span>
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
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <DollarSign className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-slate-100">
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
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-900 dark:text-slate-100">{voucher.extractedBank || "N/A"}</span>
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
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-900 dark:text-slate-100">
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
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-900 dark:text-slate-100">{voucher.extractedReference || "N/A"}</span>
                </div>
              )}
            </div>

            {/* Archivo */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                Archivo
              </label>
              <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm truncate text-slate-900 dark:text-slate-100">{voucher.voucherFileName || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Seccion REP */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                  REP (Recibo Electronico de Pago)
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {voucher.status === "complemento_recibido" || voucher.status === "cierre_contable"
                    ? "Ya lo recibimos del proveedor"
                    : voucher.status === "pendiente_complemento"
                    ? "Falta que el proveedor nos lo envie"
                    : "Se le pedira al proveedor despues del pago"}
                </p>
              </div>
              <Badge
                className={
                  voucher.status === "complemento_recibido" || voucher.status === "cierre_contable"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : voucher.status === "pendiente_complemento"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }
              >
                {voucher.status === "complemento_recibido" || voucher.status === "cierre_contable"
                  ? "Recibido"
                  : voucher.status === "pendiente_complemento"
                  ? "Pendiente"
                  : "Por solicitar"}
              </Badge>
            </div>

            {/* Zona de upload REP - solo visible cuando esta en pendiente_complemento */}
            {isPendingRep && (
              <div className="mt-4 space-y-3">
                {!repFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                      ${isDragging
                        ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                        : "border-slate-300 dark:border-slate-600 hover:border-yellow-400 hover:bg-yellow-50/50 dark:hover:bg-yellow-950/10"
                      }
                    `}
                    onClick={() => document.getElementById('rep-file-input')?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Arrastra el REP aqui o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      PDF, XML, PNG o JPG (max 10MB)
                    </p>
                    <input
                      id="rep-file-input"
                      type="file"
                      className="hidden"
                      accept=".pdf,.xml,.png,.jpg,.jpeg"
                      onChange={handleRepFileSelect}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                        <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200 truncate">
                          {repFile.name}
                        </span>
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 shrink-0">
                          ({(repFile.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRepFile(null)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleUploadRep}
                      disabled={uploadRepMutation.isPending}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {uploadRepMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Subiendo REP...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Subir REP
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Mostrar archivo REP si ya fue subido */}
            {voucher.complementFileName && (
              <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-emerald-800 dark:text-emerald-200">{voucher.complementFileName}</span>
              </div>
            )}
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
                rows={3}
                placeholder="Agregar notas..."
              />
            ) : (
              <div className="p-3 rounded-md bg-slate-100 dark:bg-slate-800 min-h-[60px]">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {voucher.notes || "Sin notas"}
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
