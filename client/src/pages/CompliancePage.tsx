import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanyFilter } from "@/hooks/use-company-filter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Building2,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface ObligationCatalog {
  id: number;
  code: string;
  name: string;
  authority: string;
  legalBasis: string | null;
  periodicity: string | null;
  description: string | null;
  appliesToCriteria: Record<string, unknown>;
  evidenceTemplate: Array<{ type: string; name: string }>;
  category: string | null;
  isVoluntary: boolean;
  createdAt: string;
}

interface TenantObligationWithCatalog {
  id: number;
  companyId: number;
  obligationCatalogId: number;
  status: string;
  currentDueDate: string | null;
  lastSubmittedAt: string | null;
  notes: string | null;
  autoDiagnosed: boolean;
  createdAt: string;
  updatedAt: string;
  obligation: ObligationCatalog;
}

interface DossierWithEvidence {
  dossier: {
    id: number;
    tenantObligationId: number;
    period: string;
    status: string;
    progressPct: number;
    startedAt: string | null;
    submittedAt: string | null;
    reviewedBy: string | null;
    notes: string | null;
  };
  evidence: Array<{
    id: number;
    dossierId: number;
    evidenceType: string;
    fileUrl: string | null;
    fileName: string | null;
    source: string;
    uploadedAt: string;
    uploadedBy: string | null;
    verified: boolean;
    notes: string | null;
  }>;
}

interface ComplianceScore {
  total: number;
  compliant: number;
  pending: number;
  expired: number;
  score: number;
}

interface DeadlineItem {
  id: number;
  code: string;
  name: string;
  authority: string;
  dueDate: string;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  compliant: { label: "Cumple", variant: "default", icon: CheckCircle2 },
  pending: { label: "Pendiente", variant: "secondary", icon: Clock },
  expired: { label: "Vencido", variant: "destructive", icon: XCircle },
  not_applicable: { label: "No aplica", variant: "outline", icon: XCircle },
};

const categoryLabels: Record<string, string> = {
  environmental: "Ambiental",
  chemical: "Químico",
  safety: "Seguridad",
  transport: "Transporte",
  voluntary: "Voluntario",
};

const periodicityLabels: Record<string, string> = {
  annual: "Anual",
  biennial: "Bienal",
  triennial: "Trienal",
  one_time: "Única vez",
  per_event: "Por evento",
  per_product: "Por producto",
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Main Component ─────────────────────────────────────────

export default function CompliancePage() {
  const { selectedCompany } = useCompanyFilter();
  const [activeTab, setActiveTab] = useState("diagnostico");
  const [selectedObligation, setSelectedObligation] = useState<TenantObligationWithCatalog | null>(null);
  const [dossierDialogOpen, setDossierDialogOpen] = useState(false);

  const companyName = selectedCompany === 1 ? "Dura International" : "Grupo Orsega";

  return (
    <AppLayout title="Cumplimiento Regulatorio">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Compliance</h2>
            <p className="text-muted-foreground text-sm">
              Estado regulatorio de {companyName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{companyName}</span>
          </div>
        </div>

        {/* Score Cards */}
        <ScoreCards companyId={selectedCompany} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="diagnostico" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Diagnóstico
            </TabsTrigger>
            <TabsTrigger value="expediente" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Expediente
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Calendario
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostico">
            <DiagnosticoTab
              companyId={selectedCompany}
              onViewDossier={(ob) => {
                setSelectedObligation(ob);
                setDossierDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="expediente">
            <ExpedienteTab companyId={selectedCompany} />
          </TabsContent>

          <TabsContent value="calendario">
            <CalendarioTab companyId={selectedCompany} />
          </TabsContent>
        </Tabs>

        {/* Dossier Detail Dialog */}
        {selectedObligation && (
          <DossierDialog
            obligation={selectedObligation}
            open={dossierDialogOpen}
            onOpenChange={setDossierDialogOpen}
          />
        )}
      </div>
    </AppLayout>
  );
}

// ─── Score Cards ─────────────────────────────────────────────

function ScoreCards({ companyId }: { companyId: number }) {
  const { data: score, isLoading } = useQuery<ComplianceScore>({
    queryKey: ["/api/compliance/score", companyId],
    queryFn: () => apiRequest("GET", `/api/compliance/score?companyId=${companyId}`).then(r => r.json()),
    staleTime: 0,
  });

  if (isLoading || !score) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="p-4 h-20 animate-pulse bg-muted/30" /></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-2xl font-bold">{score.score}%</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-primary opacity-50" />
          </div>
          <Progress value={score.score} className="mt-2 h-1.5" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Cumple</p>
              <p className="text-2xl font-bold text-green-500">{score.compliant}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">de {score.total} obligaciones</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className="text-2xl font-bold text-yellow-500">{score.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">requieren atención</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Vencido</p>
              <p className="text-2xl font-bold text-red-500">{score.expired}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">acción urgente</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Diagnóstico ───────────────────────────────────────

function DiagnosticoTab({
  companyId,
  onViewDossier,
}: {
  companyId: number;
  onViewDossier: (ob: TenantObligationWithCatalog) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: obligations = [], isLoading } = useQuery<TenantObligationWithCatalog[]>({
    queryKey: ["/api/compliance/obligations", companyId],
    queryFn: () => apiRequest("GET", `/api/compliance/obligations?companyId=${companyId}`).then(r => r.json()),
    staleTime: 0,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/compliance/obligations/${id}`, { status, notes }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/obligations", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/score", companyId] });
      setEditingId(null);
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({ title: "Error al actualizar", variant: "destructive" });
    },
  });

  // Group by category
  const grouped = obligations.reduce<Record<string, TenantObligationWithCatalog[]>>((acc, ob) => {
    const cat = ob.obligation.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ob);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, obs]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {categoryLabels[category] ?? category}
              <Badge variant="outline" className="ml-2">{obs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Obligación</TableHead>
                  <TableHead className="w-[120px]">Autoridad</TableHead>
                  <TableHead className="w-[100px]">Periodicidad</TableHead>
                  <TableHead className="w-[120px]">Vencimiento</TableHead>
                  <TableHead className="w-[120px]">Estado</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {obs.map((ob) => (
                  <TableRow key={ob.id}>
                    <TableCell className="font-mono text-xs">{ob.obligation.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{ob.obligation.name}</p>
                        {ob.obligation.legalBasis && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {ob.obligation.legalBasis}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{ob.obligation.authority}</TableCell>
                    <TableCell className="text-sm">
                      {periodicityLabels[ob.obligation.periodicity ?? ""] ?? ob.obligation.periodicity ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(ob.currentDueDate)}</TableCell>
                    <TableCell>
                      {editingId === ob.id ? (
                        <div className="space-y-2">
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compliant">Cumple</SelectItem>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="expired">Vencido</SelectItem>
                              <SelectItem value="not_applicable">No aplica</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea
                            placeholder="Notas (opcional)"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="text-xs h-16"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 text-xs"
                              onClick={() => updateMutation.mutate({ id: ob.id, status: editStatus, notes: editNotes || undefined })}
                              disabled={updateMutation.isPending}
                            >
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            setEditingId(ob.id);
                            setEditStatus(ob.status);
                            setEditNotes(ob.notes ?? "");
                          }}
                        >
                          <StatusBadge status={ob.status} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onViewDossier(ob)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Tab: Expediente ────────────────────────────────────────

function ExpedienteTab({ companyId }: { companyId: number }) {
  const { data: dossiers = [], isLoading } = useQuery<Array<{
    id: number;
    tenantObligationId: number;
    period: string;
    status: string;
    progressPct: number;
    obligationCode: string;
    obligationName: string;
  }>>({
    queryKey: ["/api/compliance/dossiers", companyId],
    queryFn: () => apiRequest("GET", `/api/compliance/dossiers?companyId=${companyId}&period=2026`).then(r => r.json()),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dossierStatusLabels: Record<string, string> = {
    not_started: "Sin iniciar",
    in_progress: "En progreso",
    complete: "Completo",
    submitted: "Enviado",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Expedientes 2026
          <Badge variant="outline" className="ml-2">{dossiers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Código</TableHead>
              <TableHead>Obligación</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead className="w-[200px]">Progreso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dossiers.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.obligationCode}</TableCell>
                <TableCell className="text-sm">{d.obligationName}</TableCell>
                <TableCell>
                  <Badge variant={d.status === "complete" ? "default" : d.status === "in_progress" ? "secondary" : "outline"}>
                    {dossierStatusLabels[d.status] ?? d.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={d.progressPct} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{d.progressPct}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Calendario ────────────────────────────────────────

function CalendarioTab({ companyId }: { companyId: number }) {
  const { data: deadlines = [], isLoading } = useQuery<DeadlineItem[]>({
    queryKey: ["/api/compliance/deadlines", companyId],
    queryFn: () => apiRequest("GET", `/api/compliance/deadlines?companyId=${companyId}&days=365`).then(r => r.json()),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deadlines.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No hay vencimientos próximos configurados.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Próximos Vencimientos
          <Badge variant="outline" className="ml-2">{deadlines.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Código</TableHead>
              <TableHead>Obligación</TableHead>
              <TableHead className="w-[120px]">Autoridad</TableHead>
              <TableHead className="w-[140px]">Vencimiento</TableHead>
              <TableHead className="w-[100px]">Días</TableHead>
              <TableHead className="w-[100px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deadlines.map((d) => {
              const days = daysUntil(d.dueDate);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.code}</TableCell>
                  <TableCell className="text-sm">{d.name}</TableCell>
                  <TableCell className="text-sm">{d.authority}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.dueDate)}</TableCell>
                  <TableCell>
                    <Badge variant={days <= 30 ? "destructive" : days <= 90 ? "secondary" : "outline"}>
                      {days} días
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Dossier Detail Dialog ──────────────────────────────────

function DossierDialog({
  obligation,
  open,
  onOpenChange,
}: {
  obligation: TenantObligationWithCatalog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery<DossierWithEvidence>({
    queryKey: ["/api/compliance/dossier", obligation.id, "2026"],
    queryFn: () =>
      apiRequest("GET", `/api/compliance/dossier/${obligation.id}?period=2026`).then(r => r.json()),
    enabled: open,
    staleTime: 0,
  });

  const template = obligation.obligation.evidenceTemplate ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Expediente: {obligation.obligation.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Dossier Summary */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground">Periodo: {data.dossier.period}</span>
                  <Badge variant={data.dossier.status === "complete" ? "default" : "secondary"}>
                    {data.dossier.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={data.dossier.progressPct} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{data.dossier.progressPct}%</span>
                </div>
              </div>
            </div>

            {/* Evidence Checklist */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Evidencia requerida</h4>
              {template.map((t) => {
                const uploaded = data.evidence.find(e => e.evidenceType === t.type);
                return (
                  <div
                    key={t.type}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {uploaded ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.type}</p>
                      </div>
                    </div>
                    {uploaded ? (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(uploaded.uploadedAt)}
                        </p>
                        {uploaded.verified && (
                          <Badge variant="default" className="text-[10px]">Verificado</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pendiente</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Extra evidence not in template */}
            {data.evidence.filter(e => !template.some(t => t.type === e.evidenceType)).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Evidencia adicional</h4>
                {data.evidence
                  .filter(e => !template.some(t => t.type === e.evidenceType))
                  .map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm">{e.evidenceType}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.source} — {formatDate(e.uploadedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No se encontró expediente para este periodo.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
