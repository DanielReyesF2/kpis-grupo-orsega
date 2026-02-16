import { useState } from "react";
import { formatDistance, format } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Phone,
  Mail,
  Users,
  FileText,
  ArrowRightLeft,
  File,
  Send,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProspectActivities, useCreateActivity } from "@/hooks/useComercial";

interface ProspectTimelineProps {
  prospectId: number;
}

const activityIcons: Record<string, React.ReactNode> = {
  llamada: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  reunion: <Users className="h-4 w-4" />,
  nota: <FileText className="h-4 w-4" />,
  cambio_etapa: <ArrowRightLeft className="h-4 w-4" />,
  documento: <File className="h-4 w-4" />,
  propuesta: <Send className="h-4 w-4" />,
  otro: <MessageSquare className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  llamada: "bg-green-100 text-green-600",
  email: "bg-blue-100 text-blue-600",
  reunion: "bg-purple-100 text-purple-600",
  nota: "bg-yellow-100 text-yellow-600",
  cambio_etapa: "bg-orange-100 text-orange-600",
  documento: "bg-gray-100 text-gray-600",
  propuesta: "bg-cyan-100 text-cyan-600",
  otro: "bg-slate-100 text-slate-600",
};

const activityLabels: Record<string, string> = {
  llamada: "Llamada",
  email: "Email",
  reunion: "Reunion",
  nota: "Nota",
  cambio_etapa: "Cambio de Etapa",
  documento: "Documento",
  propuesta: "Propuesta",
  otro: "Otro",
};

export function ProspectTimeline({ prospectId }: ProspectTimelineProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: "llamada",
    title: "",
    description: "",
  });

  const { data: activities = [], isLoading } = useProspectActivities(prospectId);
  const createActivity = useCreateActivity();

  const handleCreateActivity = async () => {
    if (!newActivity.title.trim()) {
      toast({
        title: "Error",
        description: "El titulo es requerido",
        variant: "destructive",
      });
      return;
    }

    try {
      await createActivity.mutateAsync({
        prospectId,
        data: {
          type: newActivity.type as any,
          title: newActivity.title,
          description: newActivity.description || undefined,
        },
      });
      toast({
        title: "Actividad registrada",
        description: "La actividad se agrego al timeline",
      });
      setIsDialogOpen(false);
      setNewActivity({ type: "llamada", title: "", description: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo registrar la actividad",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h4 className="font-medium">Historial de Actividades</h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Registrar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Actividad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select
                  value={newActivity.type}
                  onValueChange={(v) => setNewActivity({ ...newActivity, type: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llamada">Llamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="reunion">Reunion</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Titulo</label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Llamada de seguimiento"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descripcion (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Detalles adicionales..."
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateActivity} disabled={createActivity.isPending}>
                  {createActivity.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No hay actividades registradas</p>
            <p className="text-sm">Las interacciones apareceran aqui</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            {/* Activities */}
            <div className="space-y-6">
              {activities.map((activity) => (
                <div key={activity.id} className="relative pl-10">
                  {/* Icon */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      activityColors[activity.type || "otro"]
                    }`}
                  >
                    {activityIcons[activity.type || "otro"]}
                  </div>

                  {/* Content */}
                  <div className="bg-card border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activityLabels[activity.type || "otro"]}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {activity.createdAt
                          ? formatDistance(new Date(activity.createdAt), new Date(), {
                              addSuffix: true,
                              locale: es,
                            })
                          : ""}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
