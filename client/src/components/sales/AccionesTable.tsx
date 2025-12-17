import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  TrendingDown,
  Calendar,
  User,
  FileText,
  Filter,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface Accion {
  id: number;
  cliente_id: number | null;
  cliente_nombre: string;
  submodulo: "DI" | "GO";
  descripcion: string;
  prioridad: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  estado: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  responsables: string | null;
  diferencial: number | null;
  kilos_2024: number | null;
  kilos_2025: number | null;
  usd_2025: number | null;
  utilidad: number | null;
  fecha_creacion: string;
  fecha_limite: string | null;
  fecha_completado: string | null;
  notas: string | null;
  excel_origen_id: number | null;
}

interface AccionesTableProps {
  companyId: number;
}

export function AccionesTable({ companyId }: AccionesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filtros
  const [submoduloFilter, setSubmoduloFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [prioridadFilter, setPrioridadFilter] = useState<string>("all");
  const [responsableFilter, setResponsableFilter] = useState<string>("");

  // Modal de edición
  const [selectedAccion, setSelectedAccion] = useState<Accion | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editEstado, setEditEstado] = useState<string>("");
  const [editNotas, setEditNotas] = useState<string>("");
  const [editFechaLimite, setEditFechaLimite] = useState<string>("");
  const [editPrioridad, setEditPrioridad] = useState<string>("");

  // Construir query params
  const queryParams = new URLSearchParams();
  if (submoduloFilter !== "all") queryParams.append("submodulo", submoduloFilter);
  if (estadoFilter !== "all") queryParams.append("estado", estadoFilter);
  if (prioridadFilter !== "all") queryParams.append("prioridad", prioridadFilter);
  if (responsableFilter) queryParams.append("responsable", responsableFilter);
  queryParams.append("limit", "100");

  // Query para acciones
  const { data: acciones, isLoading } = useQuery<Accion[]>({
    queryKey: ["/api/sales/acciones", companyId, queryParams.toString()],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/sales/acciones?${queryParams.toString()}`
      );
      return await res.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Mutation para actualizar acción
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: {
        estado?: string;
        notas?: string;
        fecha_limite?: string;
        prioridad?: string;
      };
    }) => {
      const res = await apiRequest("PATCH", `/api/sales/acciones/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Acción actualizada",
        description: "Los cambios se guardaron exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/acciones"] });
      setIsEditDialogOpen(false);
      setSelectedAccion(null);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Abrir modal de edición
  const handleEdit = (accion: Accion) => {
    setSelectedAccion(accion);
    setEditEstado(accion.estado);
    setEditNotas(accion.notas || "");
    setEditFechaLimite(accion.fecha_limite || "");
    setEditPrioridad(accion.prioridad);
    setIsEditDialogOpen(true);
  };

  // Guardar cambios
  const handleSave = () => {
    if (!selectedAccion) return;

    const data: any = {};
    if (editEstado !== selectedAccion.estado) data.estado = editEstado;
    if (editNotas !== (selectedAccion.notas || "")) data.notas = editNotas;
    if (editFechaLimite !== (selectedAccion.fecha_limite || ""))
      data.fecha_limite = editFechaLimite;
    if (editPrioridad !== selectedAccion.prioridad) data.prioridad = editPrioridad;

    if (Object.keys(data).length === 0) {
      toast({
        title: "Sin cambios",
        description: "No se detectaron cambios para guardar",
        variant: "default",
      });
      return;
    }

    updateMutation.mutate({ id: selectedAccion.id, data });
  };

  // Helpers para badges de prioridad
  const getPrioridadBadge = (prioridad: string) => {
    const badges = {
      CRITICA: {
        variant: "destructive" as const,
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        label: "🔴 CRÍTICA",
      },
      ALTA: {
        variant: "destructive" as const,
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        label: "🟠 ALTA",
      },
      MEDIA: {
        variant: "secondary" as const,
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        label: "🟡 MEDIA",
      },
      BAJA: {
        variant: "outline" as const,
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        label: "🟢 BAJA",
      },
    };

    const config = badges[prioridad as keyof typeof badges] || badges.MEDIA;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // Helpers para badges de estado
  const getEstadoBadge = (estado: string) => {
    const badges = {
      PENDIENTE: {
        variant: "secondary" as const,
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: "Pendiente",
      },
      EN_PROGRESO: {
        variant: "default" as const,
        icon: <RefreshCw className="h-3 w-3 mr-1" />,
        label: "En Progreso",
      },
      COMPLETADO: {
        variant: "outline" as const,
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        label: "Completado",
        className: "bg-green-50 text-green-700 border-green-200",
      },
      CANCELADO: {
        variant: "outline" as const,
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: "Cancelado",
        className: "bg-gray-50 text-gray-500 border-gray-200",
      },
    };

    const config = badges[estado as keyof typeof badges] || badges.PENDIENTE;
    return (
      <Badge
        variant={config.variant}
        className={`flex items-center gap-1 ${config.className || ""}`}
      >
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-500" />
                Acciones de Ventas
              </CardTitle>
              <CardDescription>
                Gestión de acciones estratégicas por cliente
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sales/acciones"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Filtros
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Submódulo
                </label>
                <Select value={submoduloFilter} onValueChange={setSubmoduloFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="DI">Dura International (DI)</SelectItem>
                    <SelectItem value="GO">Grupo Orsega (GO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Estado
                </label>
                <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="EN_PROGRESO">En Progreso</SelectItem>
                    <SelectItem value="COMPLETADO">Completado</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Prioridad
                </label>
                <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CRITICA">🔴 Crítica</SelectItem>
                    <SelectItem value="ALTA">🟠 Alta</SelectItem>
                    <SelectItem value="MEDIA">🟡 Media</SelectItem>
                    <SelectItem value="BAJA">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Responsable
                </label>
                <Input
                  placeholder="Ej: ON, EDV..."
                  value={responsableFilter}
                  onChange={(e) => setResponsableFilter(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* Tabla */}
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-16 w-16 text-gray-300 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Cargando acciones...</p>
            </div>
          ) : !acciones || acciones.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No hay acciones para mostrar
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Las acciones se crean automáticamente al subir el Excel semanal
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando <span className="font-semibold">{acciones.length}</span>{" "}
                  {acciones.length === 1 ? "acción" : "acciones"}
                </p>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <TableHead className="font-bold">Prioridad</TableHead>
                        <TableHead className="font-bold">Cliente</TableHead>
                        <TableHead className="font-bold">Submódulo</TableHead>
                        <TableHead className="font-bold">Descripción</TableHead>
                        <TableHead className="font-bold text-right">Diferencial</TableHead>
                        <TableHead className="font-bold">Responsable</TableHead>
                        <TableHead className="font-bold">Estado</TableHead>
                        <TableHead className="font-bold">Fecha Límite</TableHead>
                        <TableHead className="font-bold text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acciones.map((accion, index) => (
                        <TableRow
                          key={accion.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <TableCell>{getPrioridadBadge(accion.prioridad)}</TableCell>
                          <TableCell className="font-semibold">
                            {accion.cliente_nombre}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{accion.submodulo}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                              {accion.descripcion}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {accion.diferencial !== null ? (
                              <div
                                className={`flex items-center justify-end gap-1 ${
                                  accion.diferencial < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-green-600 dark:text-green-400"
                                }`}
                              >
                                {accion.diferencial < 0 && (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                <span className="font-semibold">
                                  {accion.diferencial.toLocaleString("es-MX", {
                                    maximumFractionDigits: 0,
                                  })}{" "}
                                  kg
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {accion.responsables ? (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-gray-500" />
                                <span className="text-sm">{accion.responsables}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Sin asignar</span>
                            )}
                          </TableCell>
                          <TableCell>{getEstadoBadge(accion.estado)}</TableCell>
                          <TableCell>
                            {accion.fecha_limite ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3 text-gray-500" />
                                {new Date(accion.fecha_limite).toLocaleDateString("es-MX")}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(accion)}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-500" />
              Editar Acción
            </DialogTitle>
            <DialogDescription>
              Cliente: <span className="font-semibold">{selectedAccion?.cliente_nombre}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedAccion && (
            <div className="space-y-4 py-4">
              {/* Descripción (solo lectura) */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Descripción
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  {selectedAccion.descripcion}
                </p>
              </div>

              {/* Métricas (solo lectura) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Diferencial
                  </p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {selectedAccion.diferencial?.toLocaleString("es-MX") || "-"} kg
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                    Responsable
                  </p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {selectedAccion.responsables || "Sin asignar"}
                  </p>
                </div>
              </div>

              {/* Prioridad */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Prioridad
                </label>
                <Select value={editPrioridad} onValueChange={setEditPrioridad}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRITICA">🔴 Crítica</SelectItem>
                    <SelectItem value="ALTA">🟠 Alta</SelectItem>
                    <SelectItem value="MEDIA">🟡 Media</SelectItem>
                    <SelectItem value="BAJA">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Estado */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Estado
                </label>
                <Select value={editEstado} onValueChange={setEditEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="EN_PROGRESO">En Progreso</SelectItem>
                    <SelectItem value="COMPLETADO">Completado</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Límite */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Fecha Límite
                </label>
                <Input
                  type="date"
                  value={editFechaLimite}
                  onChange={(e) => setEditFechaLimite(e.target.value)}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Notas
                </label>
                <Textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  placeholder="Agregar notas sobre esta acción..."
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
