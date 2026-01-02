import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Send, Download, Archive, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PaymentVoucher } from "./VoucherCard";

interface VoucherBulkActionsProps {
  selectedVouchers: PaymentVoucher[];
  onClearSelection: () => void;
  onDelete?: (vouchers: PaymentVoucher[]) => void;
  onResend?: (vouchers: PaymentVoucher[]) => void;
  onDownload?: (vouchers: PaymentVoucher[]) => void;
  onArchive?: (vouchers: PaymentVoucher[]) => void;
}

export function VoucherBulkActions({
  selectedVouchers,
  onClearSelection,
  onDelete,
  onResend,
  onDownload,
  onArchive,
}: VoucherBulkActionsProps) {
  if (selectedVouchers.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 flex items-center gap-3">
        <Badge variant="secondary" className="font-semibold">
          {selectedVouchers.length} seleccionado{selectedVouchers.length > 1 ? "s" : ""}
        </Badge>

        <div className="flex items-center gap-2">
          {onDownload && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDownload(selectedVouchers)}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          )}

          {onResend && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResend(selectedVouchers)}
            >
              <Send className="h-4 w-4 mr-2" />
              Reenviar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Más acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onArchive && (
                <DropdownMenuItem onClick={() => onArchive(selectedVouchers)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archivar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(selectedVouchers)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="ml-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

