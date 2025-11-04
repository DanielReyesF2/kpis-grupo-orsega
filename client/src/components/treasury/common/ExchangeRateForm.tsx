import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExchangeRateFormProps {
  isOpen: boolean;
  onClose: () => void;
  source?: string; // Para pre-seleccionar la fuente si viene de una tarjeta específica
}

export function ExchangeRateForm({ isOpen, onClose, source }: ExchangeRateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [buyRate, setBuyRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>(source || "");
  const [notes, setNotes] = useState("");

  // Actualizar selectedSource cuando cambie el prop source
  useEffect(() => {
    if (source) {
      setSelectedSource(source);
    }
  }, [source]);

  // Resetear formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setBuyRate("");
      setSellRate("");
      setNotes("");
      if (!source) {
        setSelectedSource("");
      }
    }
  }, [isOpen, source]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      buyRate: number;
      sellRate: number;
      source: string;
      notes?: string;
    }) => {
      try {
        const res = await apiRequest("POST", "/api/treasury/exchange-rates", data);
        const result = await res.json();
        return result;
      } catch (error: any) {
        // Extraer el mensaje de error del servidor si está disponible
        let errorMessage = "No se pudo registrar el tipo de cambio";
        if (error?.message) {
          errorMessage = error.message;
          // Si es un error HTTP, extraer el mensaje del body
          if (error.message.includes(":")) {
            const parts = error.message.split(":");
            if (parts.length > 1) {
              try {
                const errorBody = JSON.parse(parts[1].trim());
                if (errorBody.error) {
                  errorMessage = errorBody.error;
                }
              } catch {
                // Si no se puede parsear, usar el mensaje original
              }
            }
          }
        }
        throw new Error(errorMessage);
      }
    },
    onSuccess: async (data) => {
      console.log('[ExchangeRateForm] Registro exitoso:', data);
      
      // Invalidar todas las queries relacionadas con tipos de cambio (más agresivo)
      await queryClient.invalidateQueries({ queryKey: ["/api/treasury/exchange-rates"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/fx/source-series"], exact: false });
      
      // Forzar refetch inmediato con un pequeño delay para asegurar que el backend procesó
      setTimeout(async () => {
        await queryClient.refetchQueries({ queryKey: ["/api/treasury/exchange-rates"], exact: false });
        await queryClient.refetchQueries({ queryKey: ["/api/fx/source-series"], exact: false });
        console.log('[ExchangeRateForm] Queries refetched después de guardar');
      }, 500);
      
      toast({
        title: "✅ Tipo de cambio registrado",
        description: `El tipo de cambio de ${selectedSource} ha sido actualizado correctamente`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo registrar el tipo de cambio",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSource) {
      toast({
        title: "Error",
        description: "Selecciona una fuente",
        variant: "destructive",
      });
      return;
    }

    const buy = parseFloat(buyRate.replace(/[^0-9.]/g, ""));
    const sell = parseFloat(sellRate.replace(/[^0-9.]/g, ""));

    if (isNaN(buy) || isNaN(sell)) {
      toast({
        title: "Error",
        description: "Los montos deben ser números válidos",
        variant: "destructive",
      });
      return;
    }

    if (buy <= 0 || sell <= 0) {
      toast({
        title: "Error",
        description: "Los montos deben ser mayores a cero",
        variant: "destructive",
      });
      return;
    }

    if (sell <= buy) {
      toast({
        title: "Error",
        description: "La tasa de venta debe ser mayor que la de compra",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      buyRate: buy,
      sellRate: sell,
      source: selectedSource,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Registrar Tipo de Cambio
          </DialogTitle>
          <DialogDescription className="text-base">
            Ingresa los nuevos valores de compra y venta
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Fuente *
              </Label>
              <Select
                value={selectedSource}
                onValueChange={setSelectedSource}
                disabled={!!source} // Si viene pre-seleccionada, deshabilitar
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecciona la fuente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONEX">MONEX</SelectItem>
                  <SelectItem value="Santander">Santander</SelectItem>
                  <SelectItem value="DOF">DOF (Oficial)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buyRate" className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs font-bold">COMPRA</span>
                    <span className="text-sm text-muted-foreground">(USD → MXN)</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuántos pesos te dan por 1 dólar
                  </p>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="buyRate"
                      type="text"
                      value={buyRate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, "");
                        setBuyRate(value);
                      }}
                      placeholder="18.5000"
                      className="h-12 text-lg pl-10 font-semibold border-2 border-green-300 dark:border-green-700 focus:border-green-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sellRate" className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded text-xs font-bold">VENTA</span>
                    <span className="text-sm text-muted-foreground">(MXN → USD)</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuántos pesos necesitas para 1 dólar
                  </p>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="sellRate"
                      type="text"
                      value={sellRate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, "");
                        setSellRate(value);
                      }}
                      placeholder="19.5000"
                      className="h-12 text-lg pl-10 font-semibold border-2 border-red-300 dark:border-red-700 focus:border-red-500"
                      required
                    />
                  </div>
                </div>
              </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Notas (opcional)
              </Label>
              <Input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Actualización de mercado matutino"
                className="h-12 text-base"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} size="lg" disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Tipo de Cambio
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

