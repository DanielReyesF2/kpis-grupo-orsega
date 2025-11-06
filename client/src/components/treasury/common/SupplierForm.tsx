import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  email?: string;
  location?: string;
  requires_rep?: boolean;
  rep_frequency?: number;
  company_id?: number;
  is_active?: boolean;
  notes?: string;
}

interface SupplierFormProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier;
}

export function SupplierForm({ isOpen, onClose, supplier }: SupplierFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    email: "",
    location: "NAC",
    requiresRep: false,
    repFrequency: 30,
    companyId: 1,
    isActive: true,
    notes: "",
  });

  const queryClient = useQueryClient();

  // Inicializar formulario con datos del proveedor si está editando
  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || "",
        shortName: supplier.short_name || "",
        email: supplier.email || "",
        location: supplier.location || "NAC",
        requiresRep: supplier.requires_rep || false,
        repFrequency: supplier.rep_frequency || 30,
        companyId: supplier.company_id || 1,
        isActive: supplier.is_active !== undefined ? supplier.is_active : true,
        notes: supplier.notes || "",
      });
    } else {
      // Resetear formulario para nuevo proveedor
      setFormData({
        name: "",
        shortName: "",
        email: "",
        location: "NAC",
        requiresRep: false,
        repFrequency: 30,
        companyId: 1,
        isActive: true,
        notes: "",
      });
    }
  }, [supplier, isOpen]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/suppliers", {
        name: data.name,
        shortName: data.shortName,
        email: data.email,
        location: data.location,
        requiresRep: data.requiresRep,
        repFrequency: data.repFrequency,
        companyId: data.companyId,
        isActive: data.isActive,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Éxito", description: "Proveedor creado correctamente" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al crear proveedor", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!supplier) return;
      const response = await apiRequest("PATCH", `/api/suppliers/${supplier.id}`, {
        name: data.name,
        shortName: data.shortName,
        email: data.email,
        location: data.location,
        requiresRep: data.requiresRep,
        repFrequency: data.repFrequency,
        companyId: data.companyId,
        isActive: data.isActive,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Éxito", description: "Proveedor actualizado correctamente" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al actualizar proveedor", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "El nombre del proveedor es obligatorio", variant: "destructive" });
      return;
    }
    if (supplier) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {supplier ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold">
              Nombre del Proveedor <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Transportes Potosinos"
              className="h-12 text-lg"
              required
            />
          </div>

          {/* Nombre Corto */}
          <div className="space-y-2">
            <Label htmlFor="shortName" className="text-base font-semibold">
              Nombre Corto
            </Label>
            <Input
              id="shortName"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              placeholder="Ej: Potosinos"
              className="h-12 text-lg"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base font-semibold">
              Email de Contacto
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="proveedor@ejemplo.com"
              className="h-12 text-lg"
            />
          </div>

          {/* Empresa y Ubicación en una fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyId" className="text-base font-semibold">
                Empresa <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.companyId.toString()}
                onValueChange={(value) => setFormData({ ...formData, companyId: parseInt(value) })}
              >
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Dura International</SelectItem>
                  <SelectItem value="2">Grupo Orsega</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold">
                Ubicación
              </Label>
              <Select
                value={formData.location}
                onValueChange={(value) => setFormData({ ...formData, location: value })}
              >
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAC">Nacional (NAC)</SelectItem>
                  <SelectItem value="EXT">Extranjero (EXT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* REP */}
          <div className="space-y-4 p-4 border-2 border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requiresRep" className="text-base font-semibold">
                  Requiere REP (Recordatorio de Pago)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Activa esta opción si el proveedor requiere recordatorios periódicos de pago
                </p>
              </div>
              <Switch
                id="requiresRep"
                checked={formData.requiresRep}
                onCheckedChange={(checked) => setFormData({ ...formData, requiresRep: checked })}
              />
            </div>

            {formData.requiresRep && (
              <div className="space-y-2">
                <Label htmlFor="repFrequency" className="text-base font-semibold">
                  Frecuencia de REP (días)
                </Label>
                <Input
                  id="repFrequency"
                  type="number"
                  min="1"
                  value={formData.repFrequency}
                  onChange={(e) =>
                    setFormData({ ...formData, repFrequency: parseInt(e.target.value) || 30 })
                  }
                  className="h-12 text-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Cada cuántos días se debe enviar el recordatorio de pago
                </p>
              </div>
            )}
          </div>

          {/* Estado Activo */}
          <div className="flex items-center justify-between p-4 border-2 border-primary/20 rounded-lg">
            <div>
              <Label htmlFor="isActive" className="text-base font-semibold">
                Proveedor Activo
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Los proveedores inactivos no aparecerán en las listas de selección
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base font-semibold">
              Notas Adicionales
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional sobre el proveedor..."
              className="text-base min-h-[100px]"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} size="lg" className="h-12 text-lg">
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-12 text-lg font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "Guardando..." : supplier ? "Actualizar" : "Crear"} Proveedor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

