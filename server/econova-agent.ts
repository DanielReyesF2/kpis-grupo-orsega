/**
 * EcoNova Agent - Configuración para Grupo ORSEGA
 *
 * Este archivo configura el agente de IA usando @econova/agent.
 * Toda la lógica del agente está en el package, aquí solo configuramos
 * los datos específicos del tenant (schema, prompts, conexión a DB).
 */

import { createEcoNovaAgent, type AgentContext } from './lib/econova-agent/index.js';
import { neon, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = WebSocket;

const sql = neon(process.env.DATABASE_URL!);

// ============================================================
// CONFIGURACIÓN DEL TENANT: GRUPO ORSEGA
// ============================================================

const DATABASE_SCHEMA = `
## Base de Datos - KPIs Grupo ORSEGA

### sales_data (Ventas)
- company_id: 1=DURA (vende en KG), 2=ORSEGA (vende en unidades)
- client_name, quantity, unit, sale_year, sale_month, sale_date

### exchange_rates (Tipos de Cambio USD/MXN)
- buy_rate: Tipo de cambio compra
- sell_rate: Tipo de cambio venta
- source: Fuente (DOF, MONEX, Santander)
- date: Fecha y hora de la cotización

### kpis (Indicadores)
- name, value, target, unit, category (ventas/finanzas/operaciones)

### shipments (Embarques)
- container_number, status, origin, destination, eta
`;

const SYSTEM_PROMPT_ADDITIONS = `
Empresas: DURA (company_id=1, KG) | ORSEGA (company_id=2, unidades)
Datos disponibles: DURA hasta junio 2025, ORSEGA hasta octubre 2025

DATOS DEL NEGOCIO DISPONIBLES:
- Ventas de DURA International (productos en KG) y Grupo ORSEGA (productos en unidades)
- KPIs y métricas de rendimiento
- Tipos de cambio actuales
- Información de embarques y logística
`;

// ============================================================
// CREAR EL AGENTE
// ============================================================

const agent = createEcoNovaAgent({
  tenantId: 'grupo-orsega',
  tenantName: 'Grupo ORSEGA',

  // Función para ejecutar queries - usa la conexión Neon del cliente
  executeQuery: async (query: string) => {
    console.log(`[EcoNova] SQL: ${query}`);
    const result = await sql(query);
    return result as unknown[];
  },

  // Schema de la base de datos para el prompt de Claude
  databaseSchema: DATABASE_SCHEMA,

  // Contexto adicional específico de ORSEGA
  systemPromptAdditions: SYSTEM_PROMPT_ADDITIONS,

  // Herramientas habilitadas
  enabledTools: ['query_database', 'get_exchange_rate', 'get_business_summary'],

  // Callback para tracking de uso (opcional - para billing futuro)
  onUsage: async (usage) => {
    console.log(`[EcoNova] Usage: ${usage.totalTokens} tokens, $${usage.costUsd.toFixed(4)} USD`);
    // TODO: Guardar en ai_usage_log table para billing
  },
});

// ============================================================
// EXPORT - Mantiene la misma interfaz que antes
// ============================================================

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface SearchResult {
  answer: string;
  data?: unknown;
  source?: string;
  query?: string;
}

/**
 * Función principal del agente - compatible con la interfaz anterior
 */
export async function econovaSearch(
  question: string,
  context?: { userId?: string; companyId?: number; conversationHistory?: ConversationMessage[] }
): Promise<SearchResult> {
  // Convertir el contexto al formato del package
  const agentContext: AgentContext = {
    userId: context?.userId,
    companyId: context?.companyId,
    conversationHistory: context?.conversationHistory,
  };

  return agent.chat(question, agentContext);
}

/**
 * Obtener estadísticas de uso del agente
 */
export function getAgentStats() {
  return agent.getUsageStats();
}

export default econovaSearch;
