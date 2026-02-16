import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  BarChart3,
  Bell,
  Plus,
  Search,
  Filter,
  Kanban,
  List,
} from "lucide-react";
import { useProspects, usePipelineStats, usePendingAlertsCount } from "@/hooks/useComercial";
import { ProspectsList } from "@/components/comercial/ProspectsList";
import { PipelineKanban } from "@/components/comercial/PipelineKanban";
import { ProspectDetail } from "@/components/comercial/ProspectDetail";
import { ProspectFormDialog } from "@/components/comercial/ProspectFormDialog";
import { ComercialReports } from "@/components/comercial/ComercialReports";
import { AlertsDropdown } from "@/components/comercial/AlertsDropdown";

type ViewMode = "list" | "kanban";

export default function ComercialPage() {
  const [activeTab, setActiveTab] = useState("pipeline");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Data hooks
  const { data: pipelineStats } = usePipelineStats();
  const { data: alertsCount } = usePendingAlertsCount();
  const { data: prospects = [], isLoading } = useProspects({
    stage: stageFilter !== "all" ? stageFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    search: searchQuery || undefined,
  });

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Stage labels
  const stageLabels: Record<string, string> = {
    lead: "Lead",
    contactado: "Contactado",
    calificado: "Calificado",
    propuesta: "Propuesta",
    negociacion: "Negociacion",
    cerrado_ganado: "Ganado",
    cerrado_perdido: "Perdido",
  };

  return (
    <AppLayout title="CRM Comercial">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div>
            <h1 className="text-2xl font-bold">CRM Comercial</h1>
            <p className="text-sm text-muted-foreground">
              Gestion de prospectos y pipeline de ventas
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Alerts */}
            <AlertsDropdown>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {alertsCount?.count && alertsCount.count > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {alertsCount.count > 9 ? "9+" : alertsCount.count}
                  </Badge>
                )}
              </Button>
            </AlertsDropdown>

            {/* New Prospect */}
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Prospecto
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {pipelineStats && (
          <div className="grid grid-cols-4 gap-4 p-4 border-b">
            <div className="bg-card rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Prospectos Activos</p>
              <p className="text-2xl font-bold">{pipelineStats.totalProspects}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Valor Total Pipeline</p>
              <p className="text-2xl font-bold">{formatCurrency(pipelineStats.totalValue)}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Pipeline Ponderado</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(pipelineStats.weightedPipeline)}
              </p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">En Negociacion</p>
              <p className="text-2xl font-bold text-blue-600">
                {pipelineStats.byStage.find((s) => s.stage === "negociacion")?.count || 0}
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <TabsList>
              <TabsTrigger value="pipeline" className="gap-2">
                <Users className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="reportes" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Reportes
              </TabsTrigger>
            </TabsList>

            {activeTab === "pipeline" && (
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar prospectos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Stage Filter */}
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las etapas</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="contactado">Contactado</SelectItem>
                    <SelectItem value="calificado">Calificado</SelectItem>
                    <SelectItem value="propuesta">Propuesta</SelectItem>
                    <SelectItem value="negociacion">Negociacion</SelectItem>
                  </SelectContent>
                </Select>

                {/* Priority Filter */}
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Toggle */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={viewMode === "kanban" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                  >
                    <Kanban className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <TabsContent value="pipeline" className="flex-1 m-0 overflow-hidden">
            {viewMode === "kanban" ? (
              <PipelineKanban
                prospects={prospects}
                isLoading={isLoading}
                onSelectProspect={setSelectedProspectId}
                stageLabels={stageLabels}
              />
            ) : (
              <ProspectsList
                prospects={prospects}
                isLoading={isLoading}
                onSelectProspect={setSelectedProspectId}
                stageLabels={stageLabels}
              />
            )}
          </TabsContent>

          <TabsContent value="reportes" className="flex-1 m-0 overflow-auto p-4">
            <ComercialReports />
          </TabsContent>
        </Tabs>

        {/* Prospect Detail Drawer */}
        <ProspectDetail
          prospectId={selectedProspectId}
          onClose={() => setSelectedProspectId(null)}
        />

        {/* New Prospect Dialog */}
        <ProspectFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSuccess={() => setIsFormOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
