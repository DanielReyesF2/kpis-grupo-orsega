/**
 * ContactClientDialog - Dialog para capturar notas al contactar un cliente
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ClientFocus } from '@shared/sales-analyst-types';

interface ContactClientDialogProps {
  client: ClientFocus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notes?: string, nextAction?: string, nextActionDate?: string) => Promise<void>;
  isLoading?: boolean;
}

export function ContactClientDialog({
  client,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: ContactClientDialogProps) {
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState<Date | undefined>(undefined);

  const handleSubmit = async () => {
    await onConfirm(
      notes || undefined,
      nextAction || undefined,
      nextActionDate ? nextActionDate.toISOString().split('T')[0] : undefined
    );
    // Reset form
    setNotes('');
    setNextAction('');
    setNextActionDate(undefined);
  };

  const handleQuickSubmit = async () => {
    await onConfirm();
    setNotes('');
    setNextAction('');
    setNextActionDate(undefined);
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar contacto</DialogTitle>
          <DialogDescription>
            Registra el contacto con <span className="font-semibold">{client.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Info del cliente */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Dias sin compra:</span>
              <span className="font-medium">{client.daysSincePurchase} dias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accion sugerida:</span>
            </div>
            <p className="text-primary font-medium mt-1">{client.suggestedAction}</p>
          </div>

          {/* Notas */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas del contacto (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Resumen de la conversacion, compromisos, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Proxima accion */}
          <div className="grid gap-2">
            <Label htmlFor="nextAction">Proxima accion (opcional)</Label>
            <Input
              id="nextAction"
              placeholder="Ej: Enviar cotizacion, Llamar de nuevo"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>

          {/* Fecha proxima accion */}
          <div className="grid gap-2">
            <Label>Fecha proxima accion (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !nextActionDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextActionDate ? (
                    format(nextActionDate, 'PPP', { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={nextActionDate}
                  onSelect={setNextActionDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleQuickSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Marcar sin notas
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Guardar contacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
