import { useMemo } from "react";
import { formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Building2,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { Prospect } from "@shared/schema";

interface PipelineKanbanProps {
  prospects: Prospect[];
  isLoading: boolean;
  onSelectProspect: (id: number) => void;
  stageLabels: Record<string, string>;
}

const PIPELINE_STAGES = [
  { key: "lead", color: "bg-slate-500" },
  { key: "contactado", color: "bg-blue-500" },
  { key: "calificado", color: "bg-purple-500" },
  { key: "propuesta", color: "bg-amber-500" },
  { key: "negociacion", color: "bg-cyan-500" },
];

const priorityColors: Record<string, string> = {
  urgente: "border-l-red-500",
  alta: "border-l-orange-500",
  media: "border-l-blue-500",
  baja: "border-l-gray-400",
};

export function PipelineKanban({
  prospects,
  isLoading,
  onSelectProspect,
  stageLabels,
}: PipelineKanbanProps) {
  // Group prospects by stage
  const prospectsByStage = useMemo(() => {
    const grouped: Record<string, Prospect[]> = {};
    PIPELINE_STAGES.forEach((stage) => {
      grouped[stage.key] = [];
    });

    prospects.forEach((prospect) => {
      const stage = prospect.stage || "lead";
      // Only include active pipeline stages
      if (grouped[stage]) {
        grouped[stage].push(prospect);
      }
    });

    return grouped;
  }, [prospects]);

  // Calculate totals per stage
  const stageTotals = useMemo(() => {
    const totals: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach((stage) => {
      const stageProspects = prospectsByStage[stage.key] || [];
      totals[stage.key] = {
        count: stageProspects.length,
        value: stageProspects.reduce((sum, p) => {
          const val = p.estimatedValue ? parseFloat(p.estimatedValue.toString()) : 0;
          return sum + val;
        }, 0),
      };
    });
    return totals;
  }, [prospectsByStage]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isOverdue = (date: Date | string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.key} className="flex-shrink-0 w-80">
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-32 w-full mb-2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex gap-4 p-4 min-w-max">
        {PIPELINE_STAGES.map((stage) => {
          const stageData = stageTotals[stage.key];
          const stageProspects = prospectsByStage[stage.key] || [];

          return (
            <div key={stage.key} className="flex-shrink-0 w-80">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                  <h3 className="font-semibold">{stageLabels[stage.key]}</h3>
                  <Badge variant="secondary" className="ml-1">
                    {stageData.count}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground font-medium">
                  {formatCurrency(stageData.value)}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 min-h-[200px]">
                {stageProspects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Building2 className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Sin prospectos</p>
                  </div>
                ) : (
                  stageProspects.map((prospect) => (
                    <Card
                      key={prospect.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                        priorityColors[prospect.priority || "media"]
                      }`}
                      onClick={() => onSelectProspect(prospect.id)}
                    >
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(prospect.companyName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">
                                {prospect.companyName}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {prospect.contactName}
                              </p>
                            </div>
                          </div>
                          {prospect.priority === "urgente" && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>

                        {/* Value */}
                        {prospect.estimatedValue && (
                          <div className="flex items-center gap-1 mb-2">
                            <DollarSign className="h-3 w-3 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(parseFloat(prospect.estimatedValue.toString()))}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({prospect.probability || 50}%)
                            </span>
                          </div>
                        )}

                        {/* Services */}
                        {prospect.servicesInterested && prospect.servicesInterested.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {prospect.servicesInterested.slice(0, 2).map((service) => (
                              <Badge
                                key={service}
                                variant="outline"
                                className="text-xs py-0"
                              >
                                {service}
                              </Badge>
                            ))}
                            {prospect.servicesInterested.length > 2 && (
                              <Badge variant="outline" className="text-xs py-0">
                                +{prospect.servicesInterested.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                          {prospect.lastContactAt ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistance(new Date(prospect.lastContactAt), new Date(), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </div>
                          ) : (
                            <span>Sin contacto</span>
                          )}

                          {prospect.nextFollowUpAt && (
                            <div
                              className={`flex items-center gap-1 ${
                                isOverdue(prospect.nextFollowUpAt)
                                  ? "text-red-500"
                                  : ""
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {formatDistance(new Date(prospect.nextFollowUpAt), new Date(), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
