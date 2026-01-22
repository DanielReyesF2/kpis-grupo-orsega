/**
 * EcoNova Agent - Asistente de IA completo con Claude
 *
 * Este es un Claude completo que puede:
 * - Tener conversaciones naturales sobre cualquier tema
 * - Ayudar con análisis, estrategia, ideas
 * - Consultar datos de ventas, KPIs y métricas del negocio
 * - Dar insights proactivos y recomendaciones
 */

import Anthropic from "@anthropic-ai/sdk";
import { neon, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = WebSocket;

const sql = neon(process.env.DATABASE_URL!);

interface SearchResult {
  answer: string;
  data?: any;
  source?: string;
  query?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ============================================================
// SCHEMA DEL NEGOCIO - Para cuando Claude necesite datos
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

Empresas: DURA (company_id=1, KG) | ORSEGA (company_id=2, unidades)
Datos disponibles: DURA hasta junio 2025, ORSEGA hasta octubre 2025
`;

// ============================================================
// HERRAMIENTAS DISPONIBLES
// ============================================================

const claudeTools: Anthropic.Tool[] = [
  {
    name: "query_database",
    description: `Ejecuta una consulta SQL para obtener datos del negocio. Usa esta herramienta cuando necesites información específica sobre ventas, clientes, KPIs, etc.

Schema disponible:
${DATABASE_SCHEMA}

Ejemplos:
- Top clientes: SELECT client_name, SUM(quantity) as total FROM sales_data WHERE company_id=1 GROUP BY client_name ORDER BY total DESC LIMIT 10
- Ventas por mes: SELECT sale_month, SUM(quantity) FROM sales_data WHERE sale_year=2025 GROUP BY sale_month`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Consulta SQL SELECT"
        },
        purpose: {
          type: "string",
          description: "Qué información buscas obtener"
        }
      },
      required: ["query", "purpose"]
    }
  },
  {
    name: "get_exchange_rate",
    description: "Obtiene los tipos de cambio USD/MXN MÁS RECIENTES de TODAS las fuentes disponibles (DOF/Banxico, MONEX, Santander). Retorna buy_rate (compra), sell_rate (venta), source (fuente) y fecha de cada cotización.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_business_summary",
    description: "Obtiene un resumen ejecutivo del estado actual del negocio incluyendo ventas recientes, KPIs principales y métricas clave",
    input_schema: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          enum: ["ventas", "kpis", "clientes", "general"],
          description: "Área de enfoque del resumen"
        }
      },
      required: []
    }
  }
];

// ============================================================
// EJECUTAR QUERIES DE FORMA SEGURA
// ============================================================

async function executeSafeQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery.startsWith('select')) {
    return { success: false, error: "Solo se permiten consultas SELECT" };
  }

  const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke', ';'];
  for (const word of forbidden) {
    if (normalizedQuery.includes(word)) {
      return { success: false, error: `Operación no permitida: ${word}` };
    }
  }

  try {
    console.log(`[EcoNova] SQL: ${query}`);
    const result = await sql(query);
    return { success: true, data: result as any[] };
  } catch (error: any) {
    console.error(`[EcoNova] SQL Error:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// EJECUTAR HERRAMIENTAS
// ============================================================

async function executeClaudeTool(
  toolName: string,
  toolInput: Record<string, any>
): Promise<{ success: boolean; result: any; error?: string }> {
  console.log(`[EcoNova] Tool: ${toolName}`, toolInput);

  switch (toolName) {
    case "query_database": {
      const queryResult = await executeSafeQuery(toolInput.query);
      if (queryResult.success) {
        return { success: true, result: queryResult.data };
      }
      return { success: false, result: null, error: queryResult.error };
    }

    case "get_exchange_rate": {
      // Get the most recent exchange rates from ALL sources
      const query = `
        WITH latest_per_source AS (
          SELECT source, buy_rate, sell_rate, date,
                 ROW_NUMBER() OVER (PARTITION BY source ORDER BY date DESC) as rn
          FROM exchange_rates
        )
        SELECT source, buy_rate, sell_rate,
               to_char(date AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') as fecha
        FROM latest_per_source
        WHERE rn = 1
        ORDER BY date DESC
        LIMIT 10`;
      const result = await executeSafeQuery(query);
      console.log(`[EcoNova] Exchange rate query returned ${result.data?.length || 0} sources`);
      return { success: result.success, result: result.data, error: result.error };
    }

    case "get_business_summary": {
      const focus = toolInput.focus || 'general';
      const summaryData: any = {};

      // Ventas recientes
      if (focus === 'ventas' || focus === 'general') {
        const salesQuery = `
          SELECT company_id, sale_year, sale_month, SUM(quantity) as total,
                 COUNT(DISTINCT client_name) as clientes_unicos
          FROM sales_data
          WHERE sale_year = 2025
          GROUP BY company_id, sale_year, sale_month
          ORDER BY sale_month DESC
          LIMIT 6`;
        const salesResult = await executeSafeQuery(salesQuery);
        summaryData.ventas_recientes = salesResult.data;
      }

      // KPIs
      if (focus === 'kpis' || focus === 'general') {
        const kpiQuery = `SELECT name, value, target, unit, category FROM kpis ORDER BY category LIMIT 15`;
        const kpiResult = await executeSafeQuery(kpiQuery);
        summaryData.kpis = kpiResult.data;
      }

      // Top clientes
      if (focus === 'clientes' || focus === 'general') {
        const clientQuery = `
          SELECT company_id, client_name, SUM(quantity) as total
          FROM sales_data
          WHERE sale_year = 2025 AND client_name IS NOT NULL AND client_name <> ''
          GROUP BY company_id, client_name
          ORDER BY total DESC
          LIMIT 10`;
        const clientResult = await executeSafeQuery(clientQuery);
        summaryData.top_clientes = clientResult.data;
      }

      return { success: true, result: summaryData };
    }

    default:
      return { success: false, result: null, error: `Tool desconocido: ${toolName}` };
  }
}

// ============================================================
// SISTEMA PRINCIPAL - CLAUDE COMPLETO
// ============================================================

export async function econovaSearch(
  question: string,
  context?: { userId?: string; companyId?: number; conversationHistory?: ConversationMessage[] }
): Promise<SearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log(`[EcoNova] API Key: ${apiKey ? 'SI' : 'NO'}`);

  if (!apiKey) {
    console.warn("[EcoNova] ANTHROPIC_API_KEY no configurada");
    return {
      answer: "El asistente de IA no está disponible en este momento. Por favor contacta al administrador.",
      source: "Error de configuración"
    };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log(`[EcoNova] Pregunta: "${question}"`);

    const systemPrompt = `Eres EcoNova, el asistente de IA de Grupo ORSEGA. Eres Claude, un asistente de IA creado por Anthropic.

PERSONALIDAD:
- Eres inteligente, amigable y profesional
- Puedes ayudar con CUALQUIER tema: análisis, estrategia, ideas, preguntas generales, consejos, etc.
- Cuando el usuario hace preguntas sobre datos del negocio, usas las herramientas disponibles
- Eres proactivo: das insights, sugieres análisis adicionales, identificas oportunidades

CAPACIDADES:
1. **Conversación general** - Puedes hablar de cualquier tema, dar consejos, explicar conceptos
2. **Análisis de negocio** - Tienes acceso a datos de ventas, clientes, KPIs de Grupo ORSEGA
3. **Consultoría estratégica** - Puedes ayudar con estrategia, planeación, toma de decisiones
4. **Creatividad** - Ideas, brainstorming, solución de problemas

DATOS DEL NEGOCIO DISPONIBLES:
- Ventas de DURA International (productos en KG) y Grupo ORSEGA (productos en unidades)
- KPIs y métricas de rendimiento
- Tipos de cambio actuales
- Información de embarques y logística

CUANDO USES DATOS:
- Usa las herramientas disponibles para consultar información real
- Interpreta los datos y da insights útiles
- Sugiere análisis adicionales si son relevantes
- Formatea números de forma legible (ej: 1,234,567)

CONTEXTO DEL USUARIO:
- Usuario ID: ${context?.userId || 'usuario'}
- Empresa preferida: ${context?.companyId === 1 ? 'DURA International' : context?.companyId === 2 ? 'Grupo ORSEGA' : 'ambas empresas'}

Responde en español. Sé útil, claro y conciso pero completo.`;

    // Construir mensajes con historial si existe
    const messages: Anthropic.MessageParam[] = [];

    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      // Agregar historial de conversación (últimos 10 mensajes)
      const recentHistory = context.conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Agregar la pregunta actual
    messages.push({ role: "user", content: question });

    // Llamar a Claude
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: claudeTools,
      messages: messages
    });

    // Procesar tool calls en loop
    let toolResults: any[] = [];
    let lastQuery: string | undefined;
    let iterations = 0;
    const maxIterations = 5;
    let allMessages = [...messages]; // Track full conversation

    console.log(`[EcoNova] Initial stop_reason: ${response.stop_reason}`);

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;
      console.log(`[EcoNova] Tool iteration ${iterations}/${maxIterations}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[EcoNova] Tool: ${toolUse.name}`, JSON.stringify(toolUse.input));

        const toolResult = await executeClaudeTool(toolUse.name, toolUse.input as Record<string, any>);

        if (toolUse.name === "query_database") {
          lastQuery = (toolUse.input as any).query;
          if (toolResult.success) {
            toolResults = toolResult.result;
            console.log(`[EcoNova] Query returned ${toolResults.length} rows`);
          } else {
            console.log(`[EcoNova] Query error: ${toolResult.error}`);
          }
        }

        toolResultContents.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error })
        });
      }

      // Update conversation history
      allMessages = [
        ...allMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResultContents }
      ];

      // Continuar conversación con resultados
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: claudeTools,
        messages: allMessages
      });

      console.log(`[EcoNova] Response stop_reason: ${response.stop_reason}`);
    }

    // Check if we hit the iteration limit
    if (iterations >= maxIterations && response.stop_reason === "tool_use") {
      console.warn(`[EcoNova] Hit max iterations (${maxIterations}), response may be incomplete`);
    }

    // Extraer respuesta final - collect ALL text blocks
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    // Join all text blocks if there are multiple
    let finalAnswer = textBlocks.map(b => b.text).join("\n\n");

    // If no text in final response, check if we have intermediate text
    if (!finalAnswer) {
      console.log(`[EcoNova] No text in final response, stop_reason: ${response.stop_reason}`);
      finalAnswer = "No pude procesar tu mensaje. ¿Podrías reformularlo?";
    }

    console.log(`[EcoNova] Final answer length: ${finalAnswer.length} chars`);

    return {
      answer: finalAnswer,
      data: toolResults.length > 0 ? toolResults : undefined,
      source: "EcoNova AI",
      query: lastQuery
    };

  } catch (error: any) {
    console.error("[EcoNova] Error:", error.message);
    return {
      answer: `Ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.\n\nError: ${error.message}`,
      source: "Error"
    };
  }
}

export default econovaSearch;
