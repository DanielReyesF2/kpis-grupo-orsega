import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, RefreshCw } from "lucide-react";
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
      await queryClient.invalidateQueries({ queryKey: ["/api/treasury/exchange-rates/range"], exact: false });
      
      // Forzar refetch inmediato con un pequeño delay para asegurar que el backend procesó
      setTimeout(async () => {
        await queryClient.refetchQueries({ queryKey: ["/api/treasury/exchange-rates"], exact: false });
        await queryClient.refetchQueries({ queryKey: ["/api/fx/source-series"], exact: false });
        await queryClient.refetchQueries({ queryKey: ["/api/treasury/exchange-rates/range"], exact: false });
        console.log('[ExchangeRateForm] Queries refetched después de guardar');
      }, 500);
      
      const sourceName = source || selectedSource;
      toast({
        title: "✅ Tipo de cambio registrado",
        description: `El tipo de cambio de ${sourceName} ha sido actualizado correctamente`,
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
    
    const finalSource = source || selectedSource;
    
    if (!finalSource) {
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
      source: finalSource,
    });
  };

  // Si no hay source seleccionada, no mostrar el formulario
  if (!source && !selectedSource) {
    return null;
  }

  const displaySource = source || selectedSource;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground mb-1">
            Actualizar Tipo de Cambio - {displaySource}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Compra */}
            <div className="space-y-2">
              <Label htmlFor="buyRate" className="text-base font-semibold text-foreground">
                Compra
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="buyRate"
                  type="text"
                  value={buyRate}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, "");
                    setBuyRate(value);
                  }}
                  placeholder="18.5000"
                  className="h-12 text-lg pl-10 font-medium"
                  required
                />
              </div>
            </div>

            {/* Venta */}
            <div className="space-y-2">
              <Label htmlFor="sellRate" className="text-base font-semibold text-foreground">
                Venta
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="sellRate"
                  type="text"
                  value={sellRate}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, "");
                    setSellRate(value);
                  }}
                  placeholder="19.5000"
                  className="h-12 text-lg pl-10 font-medium"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Actualizar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

