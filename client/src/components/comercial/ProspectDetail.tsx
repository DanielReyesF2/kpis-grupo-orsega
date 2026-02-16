import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Activity,
  FileText,
  Users,
  File,
  Send,
  Edit,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useProspect,
  useChangeProspectStage,
  useUpdateProspect,
} from "@/hooks/useComercial";
import { ProspectTimeline } from "./ProspectTimeline";
import { ProspectNotes } from "./ProspectNotes";
import { ProspectMeetings } from "./ProspectMeetings";
import { ProspectDocuments } from "./ProspectDocuments";
import { ProspectProposals } from "./ProspectProposals";

interface ProspectDetailProps {
  prospectId: number | null;
  onClose: () => void;
}

const stageLabels: Record<string, string> = {
  lead: "Lead",
  contactado: "Contactado",
  calificado: "Calificado",
  propuesta: "Propuesta",
  negociacion: "Negociacion",
  cerrado_ganado: "Ganado",
  cerrado_perdido: "Perdido",
};

const stageColors: Record<string, string> = {
  lead: "bg-slate-100 text-slate-800",
  contactado: "bg-blue-100 text-blue-800",
  calificado: "bg-purple-100 text-purple-800",
  propuesta: "bg-amber-100 text-amber-800",
  negociacion: "bg-cyan-100 text-cyan-800",
  cerrado_ganado: "bg-green-100 text-green-800",
  cerrado_perdido: "bg-red-100 text-red-800",
};

const priorityColors: Record<string, string> = {
  urgente: "bg-red-100 text-red-800",
  alta: "bg-orange-100 text-orange-800",
  media: "bg-blue-100 text-blue-800",
  baja: "bg-gray-100 text-gray-800",
};

export function ProspectDetail({ prospectId, onClose }: ProspectDetailProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("timeline");

  const { data: prospect, isLoading } = useProspect(prospectId);
  const changeStage = useChangeProspectStage();

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStageChange = async (newStage: string) => {
    if (!prospect) return;

    try {
      await changeStage.mutateAsync({
        id: prospect.id,
        stage: newStage,
      });
      toast({
        title: "Etapa actualizada",
        description: `El prospecto paso a ${stageLabels[newStage]}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la etapa",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={!!prospectId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        {isLoading || !prospect ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="p-6 pb-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getInitials(prospect.companyName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-xl">
                      {prospect.companyName}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      {prospect.contactName}
                      {prospect.contactPosition && ` - ${prospect.contactPosition}`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Stage & Priority */}
              <div className="flex items-center gap-3 mt-4">
                <Select
                  value={prospect.stage || "lead"}
                  onValueChange={handleStageChange}
                  disabled={changeStage.isPending}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="contactado">Contactado</SelectItem>
                    <SelectItem value="calificado">Calificado</SelectItem>
                    <SelectItem value="propuesta">Propuesta</SelectItem>
                    <SelectItem value="negociacion">Negociacion</SelectItem>
                    <SelectItem value="cerrado_ganado">Cerrado Ganado</SelectItem>
                    <SelectItem value="cerrado_perdido">Cerrado Perdido</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant="outline" className={priorityColors[prospect.priority || "media"]}>
                  {prospect.priority || "Media"}
                </Badge>

                {prospect.estimatedValue && (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {formatCurrency(prospect.estimatedValue)}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            {/* Contact Info */}
            <div className="px-6 py-4 border-b bg-muted/30">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {prospect.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${prospect.contactEmail}`}
                      className="text-primary hover:underline"
                    >
                      {prospect.contactEmail}
                    </a>
                  </div>
                )}
                {prospect.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${prospect.contactPhone}`}
                      className="text-primary hover:underline"
                    >
                      {prospect.contactPhone}
                    </a>
                  </div>
                )}
                {prospect.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {prospect.website}
                    </a>
                  </div>
                )}
                {(prospect.city || prospect.state) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[prospect.city, prospect.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Services & Waste Types */}
              <div className="flex flex-wrap gap-2 mt-3">
                {prospect.servicesInterested?.map((service) => (
                  <Badge key={service} variant="secondary" className="text-xs">
                    {service}
                  </Badge>
                ))}
                {prospect.wasteTypes?.map((type) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="mx-6 mt-2 justify-start">
                <TabsTrigger value="timeline" className="gap-1.5">
                  <Activity className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  Notas
                </TabsTrigger>
                <TabsTrigger value="meetings" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Reuniones
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1.5">
                  <File className="h-4 w-4" />
                  Docs
                </TabsTrigger>
                <TabsTrigger value="proposals" className="gap-1.5">
                  <Send className="h-4 w-4" />
                  Propuestas
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="timeline" className="h-full m-0 p-0">
                  <ProspectTimeline prospectId={prospect.id} />
                </TabsContent>
                <TabsContent value="notes" className="h-full m-0 p-0">
                  <ProspectNotes prospectId={prospect.id} />
                </TabsContent>
                <TabsContent value="meetings" className="h-full m-0 p-0">
                  <ProspectMeetings prospectId={prospect.id} />
                </TabsContent>
                <TabsContent value="documents" className="h-full m-0 p-0">
                  <ProspectDocuments prospectId={prospect.id} />
                </TabsContent>
                <TabsContent value="proposals" className="h-full m-0 p-0">
                  <ProspectProposals prospectId={prospect.id} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
