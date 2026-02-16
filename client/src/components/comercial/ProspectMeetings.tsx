import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  Video,
  MoreVertical,
  CheckCircle,
  XCircle,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useProspectMeetings,
  useCreateMeeting,
  useCompleteMeeting,
  useCancelMeeting,
} from "@/hooks/useComercial";

interface ProspectMeetingsProps {
  prospectId: number;
}

const statusColors: Record<string, string> = {
  programada: "bg-blue-100 text-blue-800",
  completada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
  reprogramada: "bg-amber-100 text-amber-800",
};

const statusLabels: Record<string, string> = {
  programada: "Programada",
  completada: "Completada",
  cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

export function ProspectMeetings({ prospectId }: ProspectMeetingsProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [completeDialog, setCompleteDialog] = useState<number | null>(null);
  const [outcome, setOutcome] = useState("");
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    duration: 60,
    location: "",
    meetingUrl: "",
  });

  const { data: meetings = [], isLoading } = useProspectMeetings(prospectId);
  const createMeeting = useCreateMeeting();
  const completeMeeting = useCompleteMeeting();
  const cancelMeeting = useCancelMeeting();

  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim() || !newMeeting.scheduledAt) {
      toast({
        title: "Error",
        description: "El titulo y fecha son requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      await createMeeting.mutateAsync({
        prospectId,
        data: {
          title: newMeeting.title,
          description: newMeeting.description || undefined,
          scheduledAt: new Date(newMeeting.scheduledAt),
          duration: newMeeting.duration,
          location: newMeeting.location || undefined,
          meetingUrl: newMeeting.meetingUrl || undefined,
        },
      });
      setIsDialogOpen(false);
      setNewMeeting({
        title: "",
        description: "",
        scheduledAt: "",
        duration: 60,
        location: "",
        meetingUrl: "",
      });
      toast({
        title: "Reunion programada",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo programar la reunion",
        variant: "destructive",
      });
    }
  };

  const handleCompleteMeeting = async () => {
    if (!completeDialog || !outcome.trim()) {
      toast({
        title: "Error",
        description: "El resultado es requerido",
        variant: "destructive",
      });
      return;
    }

    try {
      await completeMeeting.mutateAsync({
        prospectId,
        meetingId: completeDialog,
        outcome: outcome.trim(),
      });
      setCompleteDialog(null);
      setOutcome("");
      toast({
        title: "Reunion completada",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo completar la reunion",
        variant: "destructive",
      });
    }
  };

  const handleCancelMeeting = async (meetingId: number) => {
    try {
      await cancelMeeting.mutateAsync({
        prospectId,
        meetingId,
      });
      toast({
        title: "Reunion cancelada",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cancelar la reunion",
        variant: "destructive",
      });
    }
  };

  // Separate upcoming and past meetings
  const now = new Date();
  const upcomingMeetings = meetings.filter(
    (m) => m.status === "programada" || m.status === "reprogramada"
  );
  const pastMeetings = meetings.filter(
    (m) => m.status === "completada" || m.status === "cancelada"
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h4 className="font-medium">Reuniones</h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Programar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Programar Reunion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Titulo</label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Presentacion de propuesta"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Fecha y hora</label>
                  <Input
                    className="mt-1"
                    type="datetime-local"
                    value={newMeeting.scheduledAt}
                    onChange={(e) => setNewMeeting({ ...newMeeting, scheduledAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duracion (min)</label>
                  <Input
                    className="mt-1"
                    type="number"
                    value={newMeeting.duration}
                    onChange={(e) =>
                      setNewMeeting({ ...newMeeting, duration: parseInt(e.target.value) || 60 })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Ubicacion (opcional)</label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Oficinas del cliente"
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Link de reunion (opcional)</label>
                <Input
                  className="mt-1"
                  placeholder="https://meet.google.com/..."
                  value={newMeeting.meetingUrl}
                  onChange={(e) => setNewMeeting({ ...newMeeting, meetingUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descripcion (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Agenda de la reunion..."
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateMeeting} disabled={createMeeting.isPending}>
                  {createMeeting.isPending ? "Guardando..." : "Programar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Meetings List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No hay reuniones programadas</p>
              <p className="text-sm">Programa una reunion para comenzar</p>
            </div>
          ) : (
            <>
              {/* Upcoming */}
              {upcomingMeetings.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-3">PROXIMAS</p>
                  <div className="space-y-3">
                    {upcomingMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onComplete={() => setCompleteDialog(meeting.id)}
                        onCancel={() => handleCancelMeeting(meeting.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past */}
              {pastMeetings.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-3 mt-6">PASADAS</p>
                  <div className="space-y-3">
                    {pastMeetings.map((meeting) => (
                      <MeetingCard key={meeting.id} meeting={meeting} isPast />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Complete Meeting Dialog */}
      <Dialog open={completeDialog !== null} onOpenChange={() => setCompleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Reunion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Resultado de la reunion</label>
              <Textarea
                className="mt-1"
                placeholder="Describe el resultado y proximos pasos..."
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCompleteDialog(null)}>
                Cancelar
              </Button>
              <Button onClick={handleCompleteMeeting} disabled={completeMeeting.isPending}>
                {completeMeeting.isPending ? "Guardando..." : "Completar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MeetingCardProps {
  meeting: any;
  isPast?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

function MeetingCard({ meeting, isPast, onComplete, onCancel }: MeetingCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{meeting.title}</h4>
              <Badge variant="outline" className={statusColors[meeting.status || "programada"]}>
                {statusLabels[meeting.status || "programada"]}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {meeting.scheduledAt
                  ? format(new Date(meeting.scheduledAt), "PPp", { locale: es })
                  : "-"}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {meeting.duration} min
              </div>
              {meeting.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {meeting.location}
                </div>
              )}
              {meeting.meetingUrl && (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Video className="h-3 w-3" />
                  Unirse
                </a>
              )}
            </div>

            {meeting.description && (
              <p className="text-sm text-muted-foreground mt-2">{meeting.description}</p>
            )}

            {meeting.outcome && (
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">Resultado:</p>
                <p>{meeting.outcome}</p>
              </div>
            )}
          </div>

          {!isPast && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Completar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCancel} className="text-destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
