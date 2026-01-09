/**
 * Hook para interactuar con el MCP Econova
 * Permite ejecutar herramientas del agente AI desde el frontend
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Tipos
export interface MCPTool {
  name: string;
  description: string;
  category: 'invoices' | 'treasury' | 'database' | 'reports' | 'notifications';
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required: string[];
  };
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    toolName?: string;
    timestamp?: string;
  };
}

export interface MCPToolsResponse {
  success: boolean;
  tools: MCPTool[];
  count: number;
}

/**
 * Hook para obtener las herramientas MCP disponibles
 */
export function useMCPTools() {
  return useQuery<MCPToolsResponse>({
    queryKey: ['mcp-tools'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/mcp/tools");
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
}

/**
 * Hook para ejecutar una herramienta MCP
 */
export function useMCPExecute() {
  const queryClient = useQueryClient();

  return useMutation<MCPToolResult, Error, { toolName: string; params?: Record<string, any> }>({
    mutationFn: async ({ toolName, params = {} }) => {
      const res = await apiRequest("POST", "/api/mcp/execute", {
        tool_name: toolName,
        params,
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas según la herramienta ejecutada
      const tool = variables.toolName;

      if (tool.includes('invoice') || tool.includes('supplier')) {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
      if (tool.includes('payment') || tool.includes('treasury') || tool.includes('account')) {
        queryClient.invalidateQueries({ queryKey: ['treasury'] });
      }
      if (tool.includes('sales') || tool.includes('kpi') || tool.includes('customer')) {
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      }
    },
  });
}

/**
 * Hook para obtener el prompt del sistema
 */
export function useMCPSystemPrompt() {
  return useQuery<{ success: boolean; prompt: string }>({
    queryKey: ['mcp-system-prompt'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/mcp/system-prompt");
      return res.json();
    },
    staleTime: 1000 * 60 * 10, // Cache por 10 minutos
  });
}

/**
 * Categorías de herramientas con iconos y colores
 */
export const toolCategories = {
  invoices: {
    label: 'Facturas',
    icon: '📄',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  treasury: {
    label: 'Tesorería',
    icon: '💰',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  database: {
    label: 'Base de Datos',
    icon: '🗄️',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
  reports: {
    label: 'Reportes',
    icon: '📊',
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  },
  notifications: {
    label: 'Notificaciones',
    icon: '🔔',
    color: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
  },
};

/**
 * Herramientas sugeridas para mostrar en el UI
 */
export const suggestedTools = [
  {
    name: 'smart_query',
    label: 'Consultar datos',
    description: 'Pregunta sobre ventas, clientes, KPIs',
    icon: '🔍',
    category: 'database' as const,
    examplePrompt: '¿Cuáles son las ventas del mes pasado?',
  },
  {
    name: 'get_exchange_rate',
    label: 'Tipo de cambio',
    description: 'USD/MXN actual de Banxico',
    icon: '💱',
    category: 'treasury' as const,
    params: { from_currency: 'USD', to_currency: 'MXN' },
  },
  {
    name: 'get_kpis',
    label: 'Ver KPIs',
    description: 'Indicadores de desempeño',
    icon: '📈',
    category: 'database' as const,
    params: { period: 'current_month' },
  },
  {
    name: 'get_pending_payments',
    label: 'Pagos pendientes',
    description: 'Facturas por pagar',
    icon: '💳',
    category: 'treasury' as const,
    params: { status: 'all' },
  },
  {
    name: 'get_cash_flow',
    label: 'Flujo de caja',
    description: 'Análisis mensual',
    icon: '💵',
    category: 'treasury' as const,
    params: { period: 'monthly' },
  },
  {
    name: 'get_executive_summary',
    label: 'Resumen ejecutivo',
    description: 'Estado general del negocio',
    icon: '📋',
    category: 'reports' as const,
    params: { period: 'this_month' },
  },
];

export default {
  useMCPTools,
  useMCPExecute,
  useMCPSystemPrompt,
  toolCategories,
  suggestedTools,
};
