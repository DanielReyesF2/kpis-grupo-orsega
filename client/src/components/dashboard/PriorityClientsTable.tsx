/**
 * PriorityClientsTable - Tabla interactiva de clientes prioritarios
 * Muestra los Top 10 clientes que requieren atencion con opciones de ordenamiento
 * y boton para marcar como contactado.
 */

import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Phone,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  Moon,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  StickyNote,
} from 'lucide-react';
import { formatCurrency } from '@/lib/sales-utils';
import { cn } from '@/lib/utils';
import type { ClientFocus } from '@shared/sales-analyst-types';
import { useContactedClients } from './ContactedClientsContext';
import { ContactClientDialog } from './ContactClientDialog';
import { ClientNoteDialog } from './ClientNoteDialog';
import { apiRequest } from '@/lib/queryClient';

interface PriorityClientsTableProps {
  companyId: number;
  dormantClients: ClientFocus[];
  criticalClients: ClientFocus[];
  atRiskClients: ClientFocus[];
  opportunityClients: ClientFocus[];
}

type SortField = 'priority' | 'potential' | 'daysSince';
type SortDirection = 'asc' | 'desc';

export function PriorityClientsTable({
  companyId,
  dormantClients,
  criticalClients,
  atRiskClients,
  opportunityClients,
}: PriorityClientsTableProps) {
  const { contactedClients, markAsContacted, isLoading, getRelativeTime } = useContactedClients();
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [dialogClient, setDialogClient] = useState<ClientFocus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [noteDialogClient, setNoteDialogClient] = useState<string | null>(null);

  // Fetch client notes summary
  const { data: clientNotesMap = {} } = useQuery({
    queryKey: ['/api/client-notes/summary', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/client-notes/summary?companyId=${companyId}`);
      return res.json() as Promise<Record<string, { note: string; category: string | null; createdAt: string }>>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Combine all clients and add priority ranking
  const allClients = useMemo(() => {
    const clients: (ClientFocus & { priorityOrder: number })[] = [];

    // Dormant clients get priority 1-2
    dormantClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: c.contactPriority || 1 });
    });

    // Critical clients get priority 3-4
    criticalClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: (c.contactPriority || 1) + 2 });
    });

    // At-risk clients get priority 5-6
    atRiskClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: (c.contactPriority || 1) + 4 });
    });

    // Opportunity clients get priority 7-10
    opportunityClients.forEach((c) => {
      clients.push({ ...c, priorityOrder: (c.contactPriority || 1) + 6 });
    });

    return clients;
  }, [dormantClients, criticalClients, atRiskClients, opportunityClients]);

  // Sort clients
  const sortedClients = useMemo(() => {
    const sorted = [...allClients].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'priority':
          comparison = a.priorityOrder - b.priorityOrder;
          break;
        case 'potential':
          // Mostrar potencial correcto segun tipo de cliente
          const potentialA = a.priority === 'opportunity' ? a.currentYearRevenue : a.previousYearRevenue;
          const potentialB = b.priority === 'opportunity' ? b.currentYearRevenue : b.previousYearRevenue;
          comparison = potentialB - potentialA;
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

  const handleContactClick = (client: ClientFocus) => {
    setDialogClient(client);
    setDialogOpen(true);
  };

  const handleDialogConfirm = async (notes?: string, nextAction?: string, nextActionDate?: string) => {
    if (!dialogClient) return;

    setDialogLoading(true);
    try {
      await markAsContacted(
        dialogClient.name,
        dialogClient.clientId,
        notes,
        nextAction,
        nextActionDate
      );
      setDialogOpen(false);
    } finally {
      setDialogLoading(false);
    }
  };

  const toggleExpand = (clientName: string) => {
    setExpandedClient(expandedClient === clientName ? null : clientName);
  };

  const getPriorityBadge = (client: ClientFocus) => {
    switch (client.priority) {
      case 'dormant':
        return (
          <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">
            <Moon className="w-3 h-3 mr-1" />
            Dormido
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            Critico
          </Badge>
        );
      case 'at-risk':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            En Riesgo
          </Badge>
        );
      case 'opportunity':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            Oportunidad
          </Badge>
        );
      default:
        return null;
    }
  };

  const getActionIcon = (client: ClientFocus) => {
    if (client.priority === 'dormant' || client.priority === 'critical' || client.priority === 'at-risk') {
      return <Phone className="w-4 h-4" />;
    }
    return <Package className="w-4 h-4" />;
  };

  // Obtener el revenue correcto segun tipo de cliente
  const getDisplayRevenue = (client: ClientFocus) => {
    return client.priority === 'opportunity'
      ? client.currentYearRevenue
      : client.previousYearRevenue;
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown
        className={cn('w-3 h-3', sortField === field && 'text-primary')}
      />
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
    <>
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
                const isClientLoading = isLoading(client.name);
                const relativeTime = getRelativeTime(client.name);

                return (
                  <Fragment key={client.name}>
                    <tr
                      className={cn(
                        'hover:bg-muted/30 transition-colors cursor-pointer',
                        isContacted && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                      )}
                      onClick={() => toggleExpand(client.name)}
                    >
                      <td className="py-3 px-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{client.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {getPriorityBadge(client)}
                              {isContacted && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50"
                                  title={relativeTime}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {relativeTime || 'Contactado'}
                                </Badge>
                              )}
                              {clientNotesMap[client.name] && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-amber-300 text-amber-700 bg-amber-50 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setNoteDialogClient(client.name);
                                        }}
                                      >
                                        <StickyNote className="w-3 h-3 mr-1" />
                                        Nota
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="text-sm">{clientNotesMap[client.name].note}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
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
                          <span
                            className={cn(
                              'text-sm font-medium',
                              client.daysSincePurchase >= 120
                                ? 'text-purple-600'
                                : client.daysSincePurchase >= 90
                                ? 'text-red-600'
                                : client.daysSincePurchase >= 60
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {client.daysSincePurchase}
                          </span>
                          <span className="text-xs text-muted-foreground">dias</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-sm font-semibold">
                          {formatCurrency(getDisplayRevenue(client), companyId)}
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
                          variant={isContacted ? 'outline' : 'default'}
                          className={cn(
                            'h-8 text-xs gap-1.5',
                            isContacted &&
                              'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isContacted && !isClientLoading) {
                              handleContactClick(client);
                            }
                          }}
                          disabled={isContacted || isClientLoading}
                        >
                          {isClientLoading ? (
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
                            <div className="md:col-span-3 mt-3 pt-3 border-t">
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <StickyNote className="w-4 h-4" />
                                <span className="font-medium">Notas del cliente</span>
                              </div>
                              {clientNotesMap[client.name] ? (
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm">{clientNotesMap[client.name].note}</p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoteDialogClient(client.name);
                                    }}
                                  >
                                    Ver/Editar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Sin notas</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoteDialogClient(client.name);
                                    }}
                                  >
                                    <StickyNote className="w-3 h-3 mr-1" />
                                    Agregar nota
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ContactClientDialog
        client={dialogClient}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleDialogConfirm}
        isLoading={dialogLoading}
      />

      {noteDialogClient && (
        <ClientNoteDialog
          clientName={noteDialogClient}
          companyId={companyId}
          open={!!noteDialogClient}
          onOpenChange={(open) => !open && setNoteDialogClient(null)}
        />
      )}
    </>
  );
}
