/**
 * PriorityClientsTable - Tabla interactiva de clientes prioritarios
 * Muestra los Top 10 clientes que requieren atención con opciones de ordenamiento
 * y botón para marcar como contactado.
 */

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Package,
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react";
import { formatCurrency } from "@/lib/sales-utils";
import { cn } from "@/lib/utils";
import type { ClientFocus } from "@shared/sales-analyst-types";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface PriorityClientsTableProps {
  companyId: number;
  criticalClients: ClientFocus[];
  warningClients: ClientFocus[];
  opportunityClients: ClientFocus[];
}

type SortField = 'priority' | 'potential' | 'daysSince';
type SortDirection = 'asc' | 'desc';

export function PriorityClientsTable({
  companyId,
  criticalClients,
  warningClients,
  opportunityClients,
}: PriorityClientsTableProps) {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [contactedClients, setContactedClients] = useState<Set<string>>(new Set());
  const [loadingClients, setLoadingClients] = useState<Set<string>>(new Set());

  // Combine all clients and add priority ranking
  const allClients = useMemo(() => {
    const clients: (ClientFocus & { priorityOrder: number })[] = [];

    // Critical clients get priority 1-3 based on contactPriority
    criticalClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: c.contactPriority || 1 });
    });

    // Warning clients get priority 4-6
    warningClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: (c.contactPriority || 1) + 3 });
    });

    // Opportunity clients get priority 7-10
    opportunityClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: (c.contactPriority || 1) + 6 });
    });

    return clients;
  }, [criticalClients, warningClients, opportunityClients]);

  // Sort clients
  const sortedClients = useMemo(() => {
    const sorted = [...allClients].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'priority':
          comparison = a.priorityOrder - b.priorityOrder;
          break;
        case 'potential':
          comparison = b.previousYearRevenue - a.previousYearRevenue;
          break;
        case 'daysSince':
          comparison = b.daysSincePurchase - a.daysSincePurchase;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Return top 10
    return sorted.slice(0, 10);
  }, [allClients, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleMarkContacted = async (client: ClientFocus) => {
    const clientKey = client.name;

    // Optimistic update
    setLoadingClients(prev => new Set(prev).add(clientKey));

    try {
      await apiRequest('POST', '/api/client-contact-tracking', {
        companyId,
        clientName: client.name,
        clientId: client.clientId,
        notes: `Contactado desde Plan de Ventas`,
      });

      setContactedClients(prev => new Set(prev).add(clientKey));

      // Optionally invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/client-contact-tracking'] });
    } catch (error) {
      console.error('Error marking client as contacted:', error);
      // Could show a toast here
    } finally {
      setLoadingClients(prev => {
        const newSet = new Set(prev);
        newSet.delete(clientKey);
        return newSet;
      });
    }
  };

  const toggleExpand = (clientName: string) => {
    setExpandedClient(expandedClient === clientName ? null : clientName);
  };

  const getPriorityBadge = (client: ClientFocus) => {
    if (client.priority === 'critical') {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">Critico</Badge>;
    } else if (client.priority === 'warning') {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">Riesgo</Badge>;
    } else {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">Oportunidad</Badge>;
    }
  };

  const getActionIcon = (client: ClientFocus) => {
    if (client.priority === 'critical' || client.priority === 'warning') {
      return <Phone className="w-4 h-4" />;
    }
    return <Package className="w-4 h-4" />;
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={cn(
        "w-3 h-3",
        sortField === field && "text-primary"
      )} />
    </button>
  );

  if (sortedClients.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg">
        <p>No hay clientes prioritarios en este momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Clientes Prioritarios (Top 10)
        </h3>
        <div className="flex items-center gap-4">
          <SortHeader field="priority" label="Prioridad" />
          <SortHeader field="potential" label="Potencial" />
          <SortHeader field="daysSince" label="Dias sin compra" />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left py-2.5 px-3 font-medium">#</th>
              <th className="text-left py-2.5 px-3 font-medium">Cliente</th>
              <th className="text-center py-2.5 px-3 font-medium">Dias</th>
              <th className="text-right py-2.5 px-3 font-medium">Potencial</th>
              <th className="text-left py-2.5 px-3 font-medium">Productos</th>
              <th className="text-center py-2.5 px-3 font-medium">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedClients.map((client, index) => {
              const isExpanded = expandedClient === client.name;
              const isContacted = contactedClients.has(client.name);
              const isLoading = loadingClients.has(client.name);

              return (
                <>
                  <tr
                    key={client.name}
                    className={cn(
                      "hover:bg-muted/30 transition-colors cursor-pointer",
                      isContacted && "bg-emerald-50/50 dark:bg-emerald-950/20"
                    )}
                    onClick={() => toggleExpand(client.name)}
                  >
                    <td className="py-3 px-3">
                      <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{client.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {getPriorityBadge(client)}
                            {isContacted && (
                              <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Contactado
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          "text-sm font-medium",
                          client.daysSincePurchase >= 180 ? "text-red-600" :
                          client.daysSincePurchase >= 90 ? "text-amber-600" :
                          "text-muted-foreground"
                        )}>
                          {client.daysSincePurchase}
                        </span>
                        <span className="text-xs text-muted-foreground">dias</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-sm font-semibold">
                        {formatCurrency(client.previousYearRevenue, companyId)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(client.topProducts || []).slice(0, 2).map((product, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs max-w-[100px] truncate"
                            title={product}
                          >
                            {product}
                          </Badge>
                        ))}
                        {(client.topProducts || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{client.topProducts.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        size="sm"
                        variant={isContacted ? "outline" : "default"}
                        className={cn(
                          "h-8 text-xs gap-1.5",
                          isContacted && "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isContacted && !isLoading) {
                            handleMarkContacted(client);
                          }
                        }}
                        disabled={isContacted || isLoading}
                      >
                        {isLoading ? (
                          <Clock className="w-4 h-4 animate-spin" />
                        ) : isContacted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          getActionIcon(client)
                        )}
                        {isContacted ? 'Listo' : 'Llamar'}
                      </Button>
                    </td>
                  </tr>
                  {/* Expanded details row */}
                  {isExpanded && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="py-3 px-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Calendar className="w-4 h-4" />
                              <span className="font-medium">Ultima compra</span>
                            </div>
                            <p>{client.lastOrderDateFormatted || client.lastPurchaseDate}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Package className="w-4 h-4" />
                              <span className="font-medium">Productos que compraba</span>
                            </div>
                            <p>{(client.topProducts || []).join(', ') || 'Sin datos'}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Phone className="w-4 h-4" />
                              <span className="font-medium">Accion sugerida</span>
                            </div>
                            <p className="text-primary font-medium">
                              {client.suggestedAction || 'Contactar para seguimiento'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
