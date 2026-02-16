import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateProspect } from "@/hooks/useComercial";

interface ProspectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProspectFormDialog({ open, onOpenChange, onSuccess }: ProspectFormDialogProps) {
  const { toast } = useToast();
  const createProspect = useCreateProspect();

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactPosition: "",
    industry: "",
    website: "",
    city: "",
    state: "",
    source: "otro",
    priority: "media",
    estimatedValue: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyName.trim() || !formData.contactName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la empresa y contacto son requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      await createProspect.mutateAsync({
        companyName: formData.companyName,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail || undefined,
        contactPhone: formData.contactPhone || undefined,
        contactPosition: formData.contactPosition || undefined,
        industry: formData.industry || undefined,
        website: formData.website || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        source: formData.source as any,
        priority: formData.priority as any,
        estimatedValue: formData.estimatedValue || undefined,
        notes: formData.notes || undefined,
      });

      toast({
        title: "Prospecto creado",
        description: `${formData.companyName} se agrego al pipeline`,
      });

      // Reset form
      setFormData({
        companyName: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        contactPosition: "",
        industry: "",
        website: "",
        city: "",
        state: "",
        source: "otro",
        priority: "media",
        estimatedValue: "",
        notes: "",
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el prospecto",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Prospecto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Company Info */}
          <div>
            <h4 className="font-medium mb-3">Informacion de la Empresa</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre de la empresa *</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Industrias ABC S.A. de C.V."
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              <div>
                <Label>Industria</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Manufactura, Alimentos"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>
              <div>
                <Label>Sitio web</Label>
                <Input
                  className="mt-1"
                  placeholder="https://www.ejemplo.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
              <div>
                <Label>Ciudad</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Monterrey"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Nuevo Leon"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-medium mb-3">Informacion de Contacto</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del contacto *</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Juan Perez"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>
              <div>
                <Label>Puesto</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Director de Operaciones"
                  value={formData.contactPosition}
                  onChange={(e) => setFormData({ ...formData, contactPosition: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  placeholder="contacto@empresa.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input
                  className="mt-1"
                  placeholder="+52 81 1234 5678"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Opportunity Info */}
          <div>
            <h4 className="font-medium mb-3">Informacion de la Oportunidad</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Fuente</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referido">Referido</SelectItem>
                    <SelectItem value="web">Sitio Web</SelectItem>
                    <SelectItem value="llamada_fria">Llamada en frio</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="email_marketing">Email Marketing</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor estimado (MXN)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="150000"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notas adicionales</Label>
            <Textarea
              className="mt-1"
              placeholder="Informacion adicional sobre el prospecto..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createProspect.isPending}>
              {createProspect.isPending ? "Creando..." : "Crear Prospecto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
