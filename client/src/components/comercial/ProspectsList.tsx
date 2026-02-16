import { formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Mail, Phone, Calendar, DollarSign } from "lucide-react";
import type { Prospect } from "@shared/schema";

interface ProspectsListProps {
  prospects: Prospect[];
  isLoading: boolean;
  onSelectProspect: (id: number) => void;
  stageLabels: Record<string, string>;
}

const priorityColors: Record<string, string> = {
  urgente: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-blue-100 text-blue-800 border-blue-200",
  baja: "bg-gray-100 text-gray-800 border-gray-200",
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

export function ProspectsList({
  prospects,
  isLoading,
  onSelectProspect,
  stageLabels,
}: ProspectsListProps) {
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

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-4 opacity-50" />
        <p>No hay prospectos que mostrar</p>
        <p className="text-sm">Crea uno nuevo para comenzar</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-[300px]">Prospecto</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Valor Estimado</TableHead>
            <TableHead>Probabilidad</TableHead>
            <TableHead>Ultimo Contacto</TableHead>
            <TableHead>Proximo Seguimiento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((prospect) => (
            <TableRow
              key={prospect.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectProspect(prospect.id)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(prospect.companyName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{prospect.companyName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{prospect.contactName}</span>
                      {prospect.contactEmail && (
                        <Mail className="h-3 w-3" />
                      )}
                      {prospect.contactPhone && (
                        <Phone className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={stageColors[prospect.stage || "lead"]}
                >
                  {stageLabels[prospect.stage || "lead"]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={priorityColors[prospect.priority || "media"]}
                >
                  {prospect.priority || "Media"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {formatCurrency(prospect.estimatedValue)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${prospect.probability || 50}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {prospect.probability || 50}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {prospect.lastContactAt ? (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDistance(new Date(prospect.lastContactAt), new Date(), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {prospect.nextFollowUpAt ? (
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3" />
                    {formatDistance(new Date(prospect.nextFollowUpAt), new Date(), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
