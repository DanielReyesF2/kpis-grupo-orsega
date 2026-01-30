/**
 * ============================================================================
 * 🤖 ECONOVA MCP SERVER - Model Context Protocol para Agente AI
 * ============================================================================
 *
 * Este servidor MCP expone todas las capacidades del sistema Orsega a Claude,
 * permitiendo que el agente Econova pueda:
 *
 * - Procesar y analizar facturas (CFDI, internacionales, recibos)
 * - Consultar y gestionar tesorería (flujo de caja, pagos, cuentas)
 * - Ejecutar queries inteligentes a la base de datos
 * - Generar reportes y análisis de KPIs
 * - Enviar notificaciones y alertas
 *
 * Arquitectura:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    AGENTE ECONOVA (Claude)                  │
 * │                                                             │
 * │   "Procesa la factura de CFE y programa el pago"           │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    MCP SERVER ECONOVA                       │
 * │                                                             │
 * │   Tools:                                                    │
 * │   - mcp_invoices: Procesar facturas PDF/XML                │
 * │   - mcp_treasury: Gestión de tesorería                     │
 * │   - mcp_database: Consultas inteligentes                   │
 * │   - mcp_reports: Generación de reportes                    │
 * │   - mcp_notifications: Alertas y notificaciones            │
 * └─────────────────────────────────────────────────────────────┘
 *
 * @author Econova AI Team
 * @version 1.0.0
 */

import { invoiceTools, executeInvoiceTool } from './tools/invoices';
import { treasuryTools, executeTreasuryTool } from './tools/treasury';
import { databaseTools, executeDatabaseTool } from './tools/database';
import { reportsTools, executeReportsTool } from './tools/reports';
import { notificationTools, executeNotificationTool } from './tools/notifications';
import { salesUploadTools, executeSalesUploadTool } from './tools/sales-upload';

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  category: 'invoices' | 'treasury' | 'database' | 'reports' | 'notifications' | 'sales';
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
      required?: boolean;
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

export interface MCPContext {
  userId?: string;
  companyId?: number;
  sessionId?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

// ============================================================================
// REGISTRO DE HERRAMIENTAS
// ============================================================================

/**
 * Registro completo de todas las herramientas MCP disponibles
 */
export const mcpToolRegistry: MCPTool[] = [
  ...invoiceTools,
  ...treasuryTools,
  ...databaseTools,
  ...reportsTools,
  ...notificationTools,
  ...salesUploadTools,
];

/**
 * Obtiene la lista de herramientas disponibles para Claude
 */
export function getAvailableTools(): MCPTool[] {
  return mcpToolRegistry;
}

/**
 * Obtiene herramientas por categoría
 */
export function getToolsByCategory(category: MCPTool['category']): MCPTool[] {
  return mcpToolRegistry.filter(tool => tool.category === category);
}

/**
 * Busca una herramienta por nombre
 */
export function findTool(name: string): MCPTool | undefined {
  return mcpToolRegistry.find(tool => tool.name === name);
}

// ============================================================================
// EJECUTOR DE HERRAMIENTAS
// ============================================================================

/**
 * Ejecuta una herramienta MCP por nombre
 *
 * @param toolName - Nombre de la herramienta a ejecutar
 * @param params - Parámetros para la herramienta
 * @param context - Contexto de la ejecución (usuario, empresa, sesión)
 * @returns Resultado de la ejecución
 */
export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  context: MCPContext = {}
): Promise<MCPToolResult> {
  const startTime = Date.now();

  console.log(`🔧 [MCP] Ejecutando herramienta: ${toolName}`);
  console.log(`📋 [MCP] Parámetros:`, JSON.stringify(params, null, 2));

  try {
    const tool = findTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Herramienta "${toolName}" no encontrada. Herramientas disponibles: ${mcpToolRegistry.map(t => t.name).join(', ')}`,
        metadata: {
          toolName,
          timestamp: new Date().toISOString(),
        }
      };
    }

    // Ejecutar según la categoría
    let result: MCPToolResult;

    switch (tool.category) {
      case 'invoices':
        result = await executeInvoiceTool(toolName, params, context);
        break;
      case 'treasury':
        result = await executeTreasuryTool(toolName, params, context);
        break;
      case 'database':
        result = await executeDatabaseTool(toolName, params, context);
        break;
      case 'reports':
        result = await executeReportsTool(toolName, params, context);
        break;
      case 'notifications':
        result = await executeNotificationTool(toolName, params, context);
        break;
      case 'sales':
        result = await executeSalesUploadTool(toolName, params, context);
        break;
      default:
        result = {
          success: false,
          error: `Categoría de herramienta desconocida: ${tool.category}`,
        };
    }

    const executionTime = Date.now() - startTime;

    console.log(`✅ [MCP] Herramienta ${toolName} ejecutada en ${executionTime}ms`);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        executionTime,
        toolName,
        timestamp: new Date().toISOString(),
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ [MCP] Error ejecutando ${toolName}:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      metadata: {
        executionTime,
        toolName,
        timestamp: new Date().toISOString(),
      }
    };
  }
}

// ============================================================================
// GENERADOR DE PROMPT DEL SISTEMA
// ============================================================================

/**
 * Genera el prompt del sistema para Econova con todas las herramientas disponibles
 */
export function generateSystemPrompt(context: MCPContext = {}): string {
  const toolDescriptions = mcpToolRegistry.map(tool => {
    const params = Object.entries(tool.inputSchema.properties)
      .map(([name, schema]) => `    - ${name} (${schema.type}${tool.inputSchema.required.includes(name) ? ', requerido' : ', opcional'}): ${schema.description}`)
      .join('\n');

    return `
### ${tool.name}
**Categoría:** ${tool.category}
**Descripción:** ${tool.description}
**Parámetros:**
${params}`;
  }).join('\n');

  return `# Agente Econova - Sistema de Gestión Financiera Inteligente

Eres Econova, el asistente de inteligencia artificial del Sistema KPIs de Grupo Orsega. Tu objetivo es ayudar a los usuarios con tareas financieras, análisis de datos, procesamiento de facturas y gestión de tesorería.

## Personalidad
- Profesional pero amigable
- Proactivo en sugerencias
- Preciso con números y fechas
- Siempre confirmas acciones importantes antes de ejecutarlas

## Contexto del Usuario
- Usuario ID: ${context.userId || 'No identificado'}
- Empresa ID: ${context.companyId || 'No especificada'}
- Sesión: ${context.sessionId || 'Nueva sesión'}

## Herramientas Disponibles
${toolDescriptions}

## Instrucciones de Uso
1. Analiza la solicitud del usuario
2. Determina qué herramienta(s) necesitas usar
3. Ejecuta las herramientas en el orden correcto
4. Presenta los resultados de forma clara y accionable
5. Sugiere próximos pasos cuando sea relevante

## Formato de Respuesta
- Usa viñetas para listas
- Formatea montos como: $1,234.56 MXN
- Fechas en formato: DD/MM/YYYY
- Incluye siempre el nivel de confianza cuando proceses facturas

## Ejemplo de Flujo
Usuario: "Procesa esta factura de CFE"
1. Usa \`process_invoice\` para extraer datos
2. Valida los datos extraídos
3. Sugiere programar el pago con \`schedule_payment\`
4. Presenta resumen al usuario
`;
}

// ============================================================================
// EXPORTACIONES PARA API
// ============================================================================

export {
  invoiceTools,
  treasuryTools,
  databaseTools,
  reportsTools,
  notificationTools,
  salesUploadTools,
};

export default {
  getAvailableTools,
  getToolsByCategory,
  findTool,
  executeTool,
  generateSystemPrompt,
  mcpToolRegistry,
};
