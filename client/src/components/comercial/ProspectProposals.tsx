import { useState } from "react";
import { format, formatDistance } from "date-fns";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Send,
  DollarSign,
  Calendar,
  MoreVertical,
  ExternalLink,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useProposalVersions,
  useCreateProposal,
  useSendProposal,
  useChangeProposalStatus,
} from "@/hooks/useComercial";

interface ProspectProposalsProps {
  prospectId: number;
}

const statusColors: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-800",
  enviada: "bg-blue-100 text-blue-800",
  revisada: "bg-amber-100 text-amber-800",
  aceptada: "bg-green-100 text-green-800",
  rechazada: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  revisada: "En revision",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export function ProspectProposals({ prospectId }: ProspectProposalsProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProposal, setNewProposal] = useState({
    name: "",
    url: "",
    amount: "",
    validUntil: "",
    notes: "",
  });

  const { data: proposals = [], isLoading } = useProposalVersions(prospectId);
  const createProposal = useCreateProposal();
  const sendProposal = useSendProposal();
  const changeStatus = useChangeProposalStatus();

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleCreateProposal = async () => {
    if (!newProposal.name.trim() || !newProposal.url.trim()) {
      toast({
        title: "Error",
        description: "El nombre y URL son requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      await createProposal.mutateAsync({
        prospectId,
        data: {
          name: newProposal.name,
          url: newProposal.url,
          amount: newProposal.amount || undefined,
          validUntil: newProposal.validUntil ? new Date(newProposal.validUntil) : undefined,
          notes: newProposal.notes || undefined,
        },
      });
      setIsDialogOpen(false);
      setNewProposal({ name: "", url: "", amount: "", validUntil: "", notes: "" });
      toast({
        title: "Propuesta creada",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la propuesta",
        variant: "destructive",
      });
    }
  };

  const handleSendProposal = async (proposalId: number) => {
    try {
      await sendProposal.mutateAsync({ prospectId, proposalId });
      toast({
        title: "Propuesta enviada",
        description: "Se actualizo el estado a 'Enviada'",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar la propuesta",
        variant: "destructive",
      });
    }
  };

  const handleChangeStatus = async (proposalId: number, status: string) => {
    try {
      await changeStatus.mutateAsync({ prospectId, proposalId, status });
      toast({
        title: "Estado actualizado",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h4 className="font-medium">Propuestas</h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nueva Version
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Propuesta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Propuesta de servicios Q1 2026"
                  value={newProposal.name}
                  onChange={(e) => setNewProposal({ ...newProposal, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">URL del documento</label>
                <Input
                  className="mt-1"
                  placeholder="https://drive.google.com/..."
                  value={newProposal.url}
                  onChange={(e) => setNewProposal({ ...newProposal, url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Monto (opcional)</label>
                  <Input
                    className="mt-1"
                    type="number"
                    placeholder="150000"
                    value={newProposal.amount}
                    onChange={(e) => setNewProposal({ ...newProposal, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Vigencia (opcional)</label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={newProposal.validUntil}
                    onChange={(e) => setNewProposal({ ...newProposal, validUntil: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Notas sobre esta version..."
                  value={newProposal.notes}
                  onChange={(e) => setNewProposal({ ...newProposal, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateProposal} disabled={createProposal.isPending}>
                  {createProposal.isPending ? "Guardando..." : "Crear"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Proposals List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No hay propuestas</p>
              <p className="text-sm">Crea una propuesta para enviar al prospecto</p>
            </div>
          ) : (
            proposals.map((proposal) => (
              <Card
                key={proposal.id}
                className={proposal.version === proposals[0]?.version ? "border-primary" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          v{proposal.version}
                        </Badge>
                        <h4 className="font-medium">{proposal.name}</h4>
                        <Badge
                          variant="outline"
                          className={statusColors[proposal.status || "borrador"]}
                        >
                          {statusLabels[proposal.status || "borrador"]}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 mt-3 text-sm">
                        {proposal.amount && (
                          <div className="flex items-center gap-1 text-green-600">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-medium">
                              {formatCurrency(proposal.amount)}
                            </span>
                          </div>
                        )}
                        {proposal.validUntil && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Vigente hasta{" "}
                            {format(new Date(proposal.validUntil), "PP", { locale: es })}
                          </div>
                        )}
                        {proposal.sentAt && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Send className="h-4 w-4" />
                            Enviada{" "}
                            {formatDistance(new Date(proposal.sentAt), new Date(), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </div>
                        )}
                      </div>

                      {proposal.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{proposal.notes}</p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        Creada{" "}
                        {proposal.createdAt &&
                          formatDistance(new Date(proposal.createdAt), new Date(), {
                            addSuffix: true,
                            locale: es,
                          })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <a href={proposal.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {proposal.status === "borrador" && (
                            <DropdownMenuItem
                              onClick={() => handleSendProposal(proposal.id)}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Marcar como enviada
                            </DropdownMenuItem>
                          )}
                          {proposal.status === "enviada" && (
                            <DropdownMenuItem
                              onClick={() => handleChangeStatus(proposal.id, "revisada")}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              En revision
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleChangeStatus(proposal.id, "aceptada")}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar aceptada
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleChangeStatus(proposal.id, "rechazada")}
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Marcar rechazada
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
