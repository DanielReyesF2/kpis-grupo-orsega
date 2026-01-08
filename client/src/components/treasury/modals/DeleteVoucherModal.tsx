import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { PaymentVoucher } from "../vouchers/VoucherCard";

interface DeleteVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: PaymentVoucher;
  onSuccess?: () => void;
}

export function DeleteVoucherModal({
  isOpen,
  onClose,
  voucher,
  onSuccess,
}: DeleteVoucherModalProps) {
  const [reason, setReason] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async ({ voucherId, reason }: { voucherId: number; reason: string }) => {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/payment-vouchers/${voucherId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al eliminar");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pago eliminado",
        description: "El registro ha sido eliminado y archivado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-vouchers"] });
      setReason("");
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el registro",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (!reason.trim()) {
      toast({
        title: "Razón requerida",
        description: "Por favor indica la razón de la eliminación",
        variant: "destructive",
      });
      return;
    }

    deleteMutation.mutate({ voucherId: voucher.id, reason: reason.trim() });
  };

  const handleClose = () => {
    if (!deleteMutation.isPending) {
      setReason("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Pago
          </DialogTitle>
          <DialogDescription>
            Esta acción archivará el pago y no podrá deshacerse fácilmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info del pago a eliminar */}
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="font-medium text-red-800 dark:text-red-200">{voucher.clientName}</p>
            {voucher.extractedAmount && voucher.extractedCurrency && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {voucher.extractedCurrency} ${voucher.extractedAmount.toLocaleString()}
              </p>
            )}
            <p className="text-xs text-red-500 mt-1">{voucher.voucherFileName}</p>
          </div>

          {/* Razón de eliminación */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Razón de eliminación <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Ej: Pago duplicado, error de captura, proveedor incorrecto..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={deleteMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Esta razón será guardada en el historial de eliminaciones
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!reason.trim() || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

