/**
 * EcoNova Agent - Sistema de IA con Claude (Anthropic)
 * Reemplaza OpenAI con Claude para consultas inteligentes
 */

import Anthropic from "@anthropic-ai/sdk";
import { neon, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { executeTool, getAvailableTools, generateSystemPrompt } from './mcp';

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = WebSocket;

const sql = neon(process.env.DATABASE_URL!);

interface SearchResult {
  answer: string;
  data?: any;
  source?: string;
  query?: string;
}

// ============================================================
// SCHEMA DEL SISTEMA - Claude conoce toda la estructura de datos
// ============================================================
const DATABASE_SCHEMA = `
## Base de Datos del Sistema KPIs Grupo ORSEGA

### Tabla: sales_data (Datos de Ventas)
Contiene todas las ventas de ambas empresas.
- id: ID unico
- company_id: 1 = DURA International (vende en KG), 2 = Grupo ORSEGA (vende en unidades)
- client_name: Nombre del cliente
- quantity: Cantidad vendida (KG para DURA, unidades para ORSEGA)
- unit: Unidad de medida ('KG' o 'unidades')
- sale_year: Anio de la venta (ej: 2024, 2025)
- sale_month: Mes de la venta (1-12)
- sale_date: Fecha completa de la venta
- created_at: Fecha de registro

IMPORTANTE sobre fechas:
- DURA tiene datos hasta junio 2025
- ORSEGA tiene datos hasta octubre 2025
- NO usar CURRENT_DATE, usar los datos reales disponibles

### Tabla: exchange_rates (Tipos de Cambio)
- id: ID unico
- currency: Moneda (USD, EUR)
- rate: Tipo de cambio actual
- tipo_cambio_anterior: Tipo de cambio anterior
- fecha_publicacion: Fecha de publicacion
- source: Fuente del dato (banxico, dof, etc.)

### Tabla: kpis (Indicadores Clave)
- id: ID unico
- name: Nombre del KPI
- value: Valor actual
- target: Meta objetivo
- unit: Unidad ('%', '$', etc.)
- category: Categoria (ventas, finanzas, operaciones)
- frequency: Frecuencia de actualizacion

### Tabla: users (Usuarios del Sistema)
- id, email, name, role (admin/user)

### Tabla: shipments (Embarques/Logistica)
- id, container_number, status, origin, destination, eta

### Empresas:
- company_id = 1: DURA International (vende productos en KG)
- company_id = 2: Grupo ORSEGA (vende productos en unidades)
`;

// ============================================================
// CLAUDE TOOL DEFINITIONS
// ============================================================

const claudeTools: Anthropic.Tool[] = [
  {
    name: "execute_sql_query",
    description: "Ejecuta una consulta SQL SELECT para obtener datos del sistema. SIEMPRE usa esta herramienta para responder preguntas sobre datos de ventas, clientes, KPIs, etc.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La consulta SQL a ejecutar. Debe ser SELECT solamente. Usar los nombres de columnas exactos del schema."
        },
        explanation: {
          type: "string",
          description: "Breve explicacion de que busca esta consulta"
        }
      },
      required: ["query", "explanation"]
    }
  },
  {
    name: "get_kpi_summary",
    description: "Obtiene un resumen de los KPIs principales del sistema",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Categoria de KPIs (ventas, finanzas, operaciones) o 'all' para todos",
          enum: ["ventas", "finanzas", "operaciones", "all"]
        }
      },
      required: []
    }
  },
  {
    name: "get_exchange_rate",
    description: "Obtiene el tipo de cambio actual",
    input_schema: {
      type: "object",
      properties: {
        currency: {
          type: "string",
          description: "Moneda a consultar",
          enum: ["USD", "EUR"]
        }
      },
      required: ["currency"]
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

  const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke'];
  for (const word of forbidden) {
    if (normalizedQuery.includes(word)) {
      return { success: false, error: `Operacion no permitida: ${word}` };
    }
  }

  try {
    console.log(`[EcoNova] Ejecutando SQL: ${query}`);
    const result = await sql(query);
    return { success: true, data: result as any[] };
  } catch (error: any) {
    console.error(`[EcoNova] Error SQL:`, error.message);
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
  console.log(`[EcoNova] Ejecutando tool: ${toolName}`, toolInput);

  switch (toolName) {
    case "execute_sql_query": {
      const queryResult = await executeSafeQuery(toolInput.query);
      if (queryResult.success) {
        return { success: true, result: queryResult.data };
      }
      return { success: false, result: null, error: queryResult.error };
    }

    case "get_kpi_summary": {
      const category = toolInput.category || 'all';
      let query = "SELECT name, value, target, unit, category FROM kpis";
      if (category !== 'all') {
        query += ` WHERE category = '${category}'`;
      }
      query += " ORDER BY category, name LIMIT 20";

      const result = await executeSafeQuery(query);
      return { success: result.success, result: result.data, error: result.error };
    }

    case "get_exchange_rate": {
      const currency = toolInput.currency || 'USD';
      const query = `SELECT currency, rate, fecha_publicacion, source
                     FROM exchange_rates
                     WHERE currency = '${currency}'
                     ORDER BY fecha_publicacion DESC LIMIT 1`;

      const result = await executeSafeQuery(query);
      return { success: result.success, result: result.data, error: result.error };
    }

    default:
      return { success: false, result: null, error: `Tool desconocido: ${toolName}` };
  }
}

// ============================================================
// FUNCION PRINCIPAL - ECONOVA AGENT
// ============================================================

export async function econovaSearch(question: string, context?: { userId?: string; companyId?: number }): Promise<SearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("[EcoNova] ANTHROPIC_API_KEY no configurada, usando fallback");
    return fallbackSearch(question);
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log(`[EcoNova] Pregunta: "${question}"`);

    const systemPrompt = `Eres EcoNova, el asistente de IA de Grupo ORSEGA. Tu trabajo es ayudar a los usuarios a consultar datos de ventas, KPIs y metricas del negocio.

${DATABASE_SCHEMA}

REGLAS IMPORTANTES:
1. SIEMPRE usa la herramienta execute_sql_query para responder preguntas sobre datos
2. Usa nombres de columnas EXACTOS del schema
3. Para ventas, SIEMPRE filtra por company_id (1=DURA en KG, 2=ORSEGA en unidades)
4. Meses: enero=1, febrero=2, marzo=3, abril=4, mayo=5, junio=6, julio=7, agosto=8, septiembre=9, octubre=10, noviembre=11, diciembre=12
5. Si no especifican empresa, incluye datos de ambas con GROUP BY company_id
6. Si no especifican anio, usa 2025
7. Usa COALESCE para evitar NULLs en sumas
8. Para contar clientes unicos: COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '')
9. Limita resultados a 20 filas maximo con LIMIT
10. Formatea numeros grandes con separadores de miles
11. Se breve pero informativo en tus respuestas

EJEMPLOS DE QUERIES:
- "cuantos pedidos en noviembre" -> SELECT sale_year, SUM(quantity) as total, COUNT(*) as registros FROM sales_data WHERE sale_month = 11 GROUP BY sale_year, company_id ORDER BY sale_year DESC
- "top 5 clientes de DURA" -> SELECT client_name, SUM(quantity) as total_kg FROM sales_data WHERE company_id = 1 AND sale_year = 2025 GROUP BY client_name ORDER BY total_kg DESC LIMIT 5

CONTEXTO:
- Usuario ID: ${context?.userId || 'anonimo'}
- Empresa preferida: ${context?.companyId === 1 ? 'DURA' : context?.companyId === 2 ? 'ORSEGA' : 'ambas'}`;

    // Paso 1: Llamar a Claude con tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: claudeTools,
      messages: [
        { role: "user", content: question }
      ]
    });

    // Procesar tool calls en un loop hasta obtener respuesta final
    let toolResults: any[] = [];
    let lastQuery: string | undefined;

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[EcoNova] Tool call: ${toolUse.name}`);

        const toolResult = await executeClaudeTool(toolUse.name, toolUse.input as Record<string, any>);

        if (toolUse.name === "execute_sql_query") {
          lastQuery = (toolUse.input as any).query;
          if (toolResult.success) {
            toolResults = toolResult.result;
          }
        }

        toolResultContents.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error })
        });
      }

      // Continuar la conversacion con los resultados
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools: claudeTools,
        messages: [
          { role: "user", content: question },
          { role: "assistant", content: response.content },
          { role: "user", content: toolResultContents }
        ]
      });
    }

    // Extraer respuesta final de texto
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    const finalAnswer = textBlock?.text || "No pude procesar tu pregunta.";

    return {
      answer: finalAnswer,
      data: toolResults.length > 0 ? toolResults : undefined,
      source: lastQuery ? `EcoNova AI (Claude) - SQL: ${lastQuery}` : "EcoNova AI (Claude)",
      query: lastQuery
    };

  } catch (error: any) {
    console.error("[EcoNova] Error:", error.message);
    return fallbackSearch(question);
  }
}

// ============================================================
// BUSQUEDA DE RESPALDO (sin Claude)
// ============================================================

async function fallbackSearch(question: string): Promise<SearchResult> {
  const q = question.toLowerCase().trim();

  const monthMap: { [key: string]: number } = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };

  let month: number | null = null;
  for (const [name, num] of Object.entries(monthMap)) {
    if (q.includes(name)) {
      month = num;
      break;
    }
  }

  const isDura = q.includes('dura');
  const isOrsega = q.includes('orsega');

  try {
    if (month) {
      let query = '';
      if (isDura) {
        query = `SELECT sale_year, SUM(quantity) as total_kg, COUNT(DISTINCT client_name) as clientes
                 FROM sales_data WHERE company_id = 1 AND sale_month = ${month}
                 GROUP BY sale_year ORDER BY sale_year DESC LIMIT 5`;
      } else if (isOrsega) {
        query = `SELECT sale_year, SUM(quantity) as total_unidades, COUNT(DISTINCT client_name) as clientes
                 FROM sales_data WHERE company_id = 2 AND sale_month = ${month}
                 GROUP BY sale_year ORDER BY sale_year DESC LIMIT 5`;
      } else {
        query = `SELECT company_id, sale_year, SUM(quantity) as total, COUNT(DISTINCT client_name) as clientes
                 FROM sales_data WHERE sale_month = ${month}
                 GROUP BY company_id, sale_year ORDER BY sale_year DESC, company_id LIMIT 10`;
      }

      const result = await executeSafeQuery(query);
      if (result.success && result.data) {
        const monthName = Object.keys(monthMap).find(k => monthMap[k] === month) || '';
        let answer = `Datos de ${monthName}:\n\n`;

        result.data.forEach((row: any) => {
          const company = row.company_id === 1 ? 'DURA' : row.company_id === 2 ? 'ORSEGA' : '';
          const unit = row.company_id === 1 ? 'KG' : 'unidades';
          const total = row.total_kg || row.total_unidades || row.total || 0;
          answer += `${company ? company + ' ' : ''}${row.sale_year}: ${Number(total).toLocaleString('es-MX')} ${unit}, ${row.clientes} clientes\n`;
        });

        return { answer, data: result.data, source: "Busqueda local (fallback)", query };
      }
    }

    // Resumen general
    if (q.includes('resumen') || q.includes('general') || q.includes('total')) {
      const query = `SELECT company_id, sale_year, SUM(quantity) as total, COUNT(DISTINCT client_name) as clientes
                     FROM sales_data GROUP BY company_id, sale_year ORDER BY sale_year DESC, company_id LIMIT 10`;
      const result = await executeSafeQuery(query);

      if (result.success && result.data) {
        let answer = "Resumen de ventas:\n\n";
        result.data.forEach((row: any) => {
          const company = row.company_id === 1 ? 'DURA' : 'ORSEGA';
          const unit = row.company_id === 1 ? 'KG' : 'unidades';
          answer += `${company} ${row.sale_year}: ${Number(row.total).toLocaleString('es-MX')} ${unit}, ${row.clientes} clientes\n`;
        });
        return { answer, data: result.data, source: "Busqueda local (fallback)", query };
      }
    }

    // Top clientes
    if (q.includes('top') || q.includes('mejores') || q.includes('principales')) {
      const companyId = isDura ? 1 : 2;
      const query = `SELECT client_name, SUM(quantity) as total
                     FROM sales_data WHERE company_id = ${companyId} AND sale_year = 2025
                     AND client_name IS NOT NULL AND client_name <> ''
                     GROUP BY client_name ORDER BY total DESC LIMIT 10`;
      const result = await executeSafeQuery(query);

      if (result.success && result.data) {
        const company = isDura ? 'DURA' : 'ORSEGA';
        const unit = isDura ? 'KG' : 'unidades';
        let answer = `Top clientes ${company} 2025:\n\n`;
        result.data.forEach((row: any, i: number) => {
          answer += `${i + 1}. ${row.client_name}: ${Number(row.total).toLocaleString('es-MX')} ${unit}\n`;
        });
        return { answer, data: result.data, source: "Busqueda local (fallback)", query };
      }
    }

  } catch (error) {
    console.error("[Fallback] Error:", error);
  }

  return {
    answer: `No pude procesar tu pregunta. Prueba preguntar:
- Cuanto vendimos en noviembre?
- Cuales son los top clientes de DURA?
- Dame un resumen de ventas
- Cuantos clientes tiene ORSEGA en octubre?`,
    source: "Ayuda"
  };
}

export default econovaSearch;
