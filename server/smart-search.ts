/**
 * Smart Search - Búsqueda inteligente con OpenAI Function Calling
 * Permite hacer preguntas en lenguaje natural sobre los datos del sistema
 */

import OpenAI from "openai";
import { neon, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = WebSocket;

const sql = neon(process.env.DATABASE_URL!);

// Cache para el último período con datos (evitar múltiples queries)
let lastDataCache: { [key: number]: { year: number; month: number } } = {};
let cacheTimestamp = 0;

// Obtener el último período con datos para una empresa
async function getLastDataPeriod(companyId: number): Promise<{ year: number; month: number }> {
  // Usar cache si es reciente (5 minutos)
  const now = Date.now();
  if (lastDataCache[companyId] && (now - cacheTimestamp) < 300000) {
    return lastDataCache[companyId];
  }

  const result = await sql`
    SELECT sale_year, sale_month
    FROM sales_data
    WHERE company_id = ${companyId}
    GROUP BY sale_year, sale_month
    ORDER BY sale_year DESC, sale_month DESC
    LIMIT 1
  `;

  const period = {
    year: parseInt(result[0]?.sale_year || '2025'),
    month: parseInt(result[0]?.sale_month || '6')
  };

  lastDataCache[companyId] = period;
  cacheTimestamp = now;

  return period;
}

// Tipos para function calling
interface FunctionCall {
  name: string;
  arguments: string;
}

interface SearchResult {
  answer: string;
  data?: any;
  source?: string;
}

// Definición de las funciones disponibles para OpenAI
const availableFunctions = [
  {
    type: "function" as const,
    function: {
      name: "get_sales_volume",
      description: "Obtener el volumen de ventas para una empresa en un período específico",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            enum: ["dura", "orsega"],
            description: "La empresa: dura para DURA International, orsega para Grupo ORSEGA"
          },
          period: {
            type: "string",
            enum: ["this_month", "last_month", "this_year", "last_year", "last_3_months"],
            description: "El período de tiempo para consultar"
          }
        },
        required: ["company", "period"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_active_clients",
      description: "Obtener el número de clientes activos (que han comprado) en un período",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            enum: ["dura", "orsega", "both"],
            description: "La empresa o 'both' para ambas"
          },
          period: {
            type: "string",
            enum: ["this_month", "last_month", "last_3_months", "this_year"],
            description: "El período de tiempo"
          }
        },
        required: ["company", "period"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_clients",
      description: "Obtener los principales clientes por volumen de compra",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            enum: ["dura", "orsega"],
            description: "La empresa"
          },
          limit: {
            type: "number",
            description: "Número de clientes a retornar (máximo 10)"
          },
          period: {
            type: "string",
            enum: ["this_month", "last_3_months", "this_year"],
            description: "El período de tiempo"
          }
        },
        required: ["company", "limit"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_growth_comparison",
      description: "Comparar el crecimiento entre el año actual y el anterior",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            enum: ["dura", "orsega"],
            description: "La empresa"
          }
        },
        required: ["company"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_exchange_rate",
      description: "Obtener el tipo de cambio actual o de una fecha específica",
      parameters: {
        type: "object",
        properties: {
          currency: {
            type: "string",
            enum: ["USD", "EUR"],
            description: "La moneda (USD por defecto)"
          },
          date: {
            type: "string",
            description: "Fecha en formato YYYY-MM-DD (opcional, por defecto hoy)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_new_clients",
      description: "Obtener clientes nuevos (primera compra) en un período",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            enum: ["dura", "orsega"],
            description: "La empresa"
          },
          period: {
            type: "string",
            enum: ["this_month", "last_month", "last_3_months"],
            description: "El período de tiempo"
          }
        },
        required: ["company"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_summary",
      description: "Obtener un resumen general de ventas de ambas empresas",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_sales_by_month",
      description: "Obtener ventas de un mes específico (enero, febrero, marzo, etc.)",
      parameters: {
        type: "object",
        properties: {
          company: {
            type: "string",
            enum: ["dura", "orsega", "both"],
            description: "La empresa o 'both' para ambas"
          },
          month: {
            type: "number",
            description: "Número del mes (1=enero, 2=febrero, ..., 12=diciembre)"
          },
          year: {
            type: "number",
            description: "Año (ej: 2024, 2025). Si no se especifica, usar el año más reciente con datos."
          }
        },
        required: ["company", "month"]
      }
    }
  }
];

// Implementación de las funciones
async function getSalesVolume(company: string, period: string): Promise<any> {
  const companyId = company === "dura" ? 1 : 2;
  const companyName = company === "dura" ? "DURA International" : "Grupo ORSEGA";

  // Obtener el último período con datos reales
  const lastPeriod = await getLastDataPeriod(companyId);
  const lastYear = lastPeriod.year;
  const lastMonth = lastPeriod.month;

  let dateFilter = "";
  let periodLabel = "";

  switch (period) {
    case "this_month":
      // Usar el último mes con datos
      dateFilter = `sale_year = ${lastYear} AND sale_month = ${lastMonth}`;
      periodLabel = `en ${getMonthName(lastMonth)} ${lastYear}`;
      break;
    case "last_month":
      const prevMonth = lastMonth === 1 ? 12 : lastMonth - 1;
      const prevYear = lastMonth === 1 ? lastYear - 1 : lastYear;
      dateFilter = `sale_year = ${prevYear} AND sale_month = ${prevMonth}`;
      periodLabel = `en ${getMonthName(prevMonth)} ${prevYear}`;
      break;
    case "this_year":
      dateFilter = `sale_year = ${lastYear}`;
      periodLabel = `en ${lastYear}`;
      break;
    case "last_year":
      dateFilter = `sale_year = ${lastYear - 1}`;
      periodLabel = `en ${lastYear - 1}`;
      break;
    case "last_3_months":
      dateFilter = `(sale_year = ${lastYear} AND sale_month >= ${Math.max(1, lastMonth - 2)}) OR (sale_year = ${lastYear - 1} AND sale_month >= ${lastMonth + 10})`;
      periodLabel = "en los últimos 3 meses con datos";
      break;
    default:
      dateFilter = `sale_year = ${lastYear} AND sale_month = ${lastMonth}`;
      periodLabel = `en ${getMonthName(lastMonth)} ${lastYear}`;
  }

  const result = await sql(`
    SELECT
      COALESCE(SUM(quantity), 0) as total_volume,
      COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = $1 AND ${dateFilter}
  `, [companyId]);

  const row = result[0];
  return {
    company: companyName,
    volume: parseFloat(row?.total_volume || "0"),
    clients: parseInt(row?.clients || "0"),
    unit: row?.unit || (companyId === 1 ? "KG" : "unidades"),
    period: periodLabel,
    dataAsOf: `${getMonthName(lastMonth)} ${lastYear}`
  };
}

// Helper para obtener nombre del mes
function getMonthName(month: number): string {
  const months = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return months[month] || '';
}

async function getActiveClients(company: string, period: string): Promise<any> {
  // Para "both", usar el período más reciente de cualquier empresa
  const companyId = company === "dura" ? 1 : company === "orsega" ? 2 : 2;
  const lastPeriod = await getLastDataPeriod(companyId);
  const lastYear = lastPeriod.year;
  const lastMonth = lastPeriod.month;

  let dateFilter = "";
  let periodLabel = "";

  switch (period) {
    case "this_month":
      dateFilter = `sale_year = ${lastYear} AND sale_month = ${lastMonth}`;
      periodLabel = `en ${getMonthName(lastMonth)} ${lastYear}`;
      break;
    case "last_month":
      const prevMonth = lastMonth === 1 ? 12 : lastMonth - 1;
      const prevYear = lastMonth === 1 ? lastYear - 1 : lastYear;
      dateFilter = `sale_year = ${prevYear} AND sale_month = ${prevMonth}`;
      periodLabel = `en ${getMonthName(prevMonth)} ${prevYear}`;
      break;
    case "last_3_months":
      dateFilter = `sale_year = ${lastYear} AND sale_month >= ${Math.max(1, lastMonth - 2)}`;
      periodLabel = "en los últimos 3 meses con datos";
      break;
    case "this_year":
      dateFilter = `sale_year = ${lastYear}`;
      periodLabel = `en ${lastYear}`;
      break;
    default:
      dateFilter = `sale_year = ${lastYear} AND sale_month = ${lastMonth}`;
      periodLabel = `en ${getMonthName(lastMonth)} ${lastYear}`;
  }

  if (company === "both") {
    const result = await sql(`
      SELECT
        company_id,
        COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients
      FROM sales_data
      WHERE ${dateFilter}
      GROUP BY company_id
    `);

    const dura = result.find((r: any) => parseInt(r.company_id) === 1);
    const orsega = result.find((r: any) => parseInt(r.company_id) === 2);

    return {
      dura: parseInt(dura?.clients || "0"),
      orsega: parseInt(orsega?.clients || "0"),
      total: parseInt(dura?.clients || "0") + parseInt(orsega?.clients || "0"),
      period: periodLabel
    };
  }

  const companyName = company === "dura" ? "DURA International" : "Grupo ORSEGA";

  const result = await sql(`
    SELECT COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients
    FROM sales_data
    WHERE company_id = $1 AND ${dateFilter}
  `, [companyId]);

  return {
    company: companyName,
    clients: parseInt(result[0]?.clients || "0"),
    period: periodLabel
  };
}

async function getTopClients(company: string, limit: number, period: string = "this_year"): Promise<any> {
  const companyId = company === "dura" ? 1 : 2;
  const companyName = company === "dura" ? "DURA International" : "Grupo ORSEGA";
  const safeLimit = Math.min(Math.max(1, limit), 10);

  // Obtener el último período con datos
  const lastPeriod = await getLastDataPeriod(companyId);
  const lastYear = lastPeriod.year;
  const lastMonth = lastPeriod.month;

  let dateFilter = "";
  let periodLabel = "";
  switch (period) {
    case "this_month":
      dateFilter = `sale_year = ${lastYear} AND sale_month = ${lastMonth}`;
      periodLabel = `${getMonthName(lastMonth)} ${lastYear}`;
      break;
    case "last_3_months":
      dateFilter = `sale_year = ${lastYear} AND sale_month >= ${Math.max(1, lastMonth - 2)}`;
      periodLabel = "últimos 3 meses";
      break;
    case "this_year":
    default:
      dateFilter = `sale_year = ${lastYear}`;
      periodLabel = `${lastYear}`;
  }

  const result = await sql(`
    SELECT
      client_name,
      COALESCE(SUM(quantity), 0) as total_volume,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = $1
      AND ${dateFilter}
      AND client_name IS NOT NULL AND client_name <> ''
    GROUP BY client_name
    ORDER BY total_volume DESC
    LIMIT $2
  `, [companyId, safeLimit]);

  return {
    company: companyName,
    period: periodLabel,
    clients: result.map((r: any, i: number) => ({
      rank: i + 1,
      name: r.client_name,
      volume: parseFloat(r.total_volume || "0"),
      unit: r.unit || (companyId === 1 ? "KG" : "unidades")
    }))
  };
}

async function getGrowthComparison(company: string): Promise<any> {
  const companyId = company === "dura" ? 1 : 2;
  const companyName = company === "dura" ? "DURA International" : "Grupo ORSEGA";

  // Obtener el último período con datos
  const lastPeriod = await getLastDataPeriod(companyId);
  const lastYear = lastPeriod.year;
  const lastMonth = lastPeriod.month;

  const result = await sql`
    WITH current_year AS (
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM sales_data
      WHERE company_id = ${companyId}
        AND sale_year = ${lastYear}
    ),
    last_year AS (
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM sales_data
      WHERE company_id = ${companyId}
        AND sale_year = ${lastYear - 1}
    )
    SELECT
      current_year.total as current_volume,
      last_year.total as last_volume
    FROM current_year, last_year
  `;

  const current = parseFloat(result[0]?.current_volume || "0");
  const last = parseFloat(result[0]?.last_volume || "0");
  const growth = last > 0 ? ((current - last) / last * 100).toFixed(1) : (current > 0 ? 100 : 0);

  return {
    company: companyName,
    currentYear: current,
    currentYearLabel: lastYear,
    lastYear: last,
    lastYearLabel: lastYear - 1,
    growth: parseFloat(growth as string),
    isPositive: current >= last,
    dataAsOf: `${getMonthName(lastMonth)} ${lastYear}`
  };
}

async function getExchangeRate(currency: string = "USD", date?: string): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];

  // Intentar obtener de la base de datos
  const result = await sql`
    SELECT rate, fecha_publicacion, tipo_cambio_anterior
    FROM exchange_rates
    WHERE currency = ${currency}
    ORDER BY fecha_publicacion DESC
    LIMIT 1
  `;

  if (result.length > 0) {
    const row = result[0];
    return {
      currency,
      rate: parseFloat(row.rate),
      date: row.fecha_publicacion,
      previousRate: row.tipo_cambio_anterior ? parseFloat(row.tipo_cambio_anterior) : null,
      source: "database"
    };
  }

  // Si no hay en la BD, usar un valor aproximado
  return {
    currency,
    rate: currency === "USD" ? 17.20 : 18.50,
    date: targetDate,
    previousRate: null,
    source: "approximate"
  };
}

async function getNewClients(company: string, period: string = "this_month"): Promise<any> {
  const companyId = company === "dura" ? 1 : 2;
  const companyName = company === "dura" ? "DURA International" : "Grupo ORSEGA";

  let periodStart = "";
  let periodLabel = "";

  switch (period) {
    case "this_month":
      periodStart = "DATE_TRUNC('month', CURRENT_DATE)";
      periodLabel = "este mes";
      break;
    case "last_month":
      periodStart = "DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')";
      periodLabel = "el mes pasado";
      break;
    case "last_3_months":
      periodStart = "CURRENT_DATE - INTERVAL '3 months'";
      periodLabel = "los últimos 3 meses";
      break;
    default:
      periodStart = "DATE_TRUNC('month', CURRENT_DATE)";
      periodLabel = "este mes";
  }

  const result = await sql(`
    SELECT COUNT(DISTINCT client_name) as new_clients
    FROM sales_data
    WHERE company_id = $1
      AND sale_date >= ${periodStart}
      AND client_name IS NOT NULL AND client_name <> ''
      AND client_name NOT IN (
        SELECT DISTINCT client_name FROM sales_data
        WHERE company_id = $1
          AND sale_date < ${periodStart}
          AND client_name IS NOT NULL AND client_name <> ''
      )
  `, [companyId]);

  return {
    company: companyName,
    newClients: parseInt(result[0]?.new_clients || "0"),
    period: periodLabel
  };
}

async function getSalesByMonth(company: string, month: number, year?: number): Promise<any> {
  const monthNames = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  if (company === "both") {
    // Obtener datos de ambas empresas
    const duraPeriod = await getLastDataPeriod(1);
    const orsegaPeriod = await getLastDataPeriod(2);

    const targetYearDura = year || duraPeriod.year;
    const targetYearOrsega = year || orsegaPeriod.year;

    const duraResult = await sql`
      SELECT
        COALESCE(SUM(quantity), 0) as volume,
        COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients,
        COUNT(*) as orders,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = 1
        AND sale_year = ${targetYearDura}
        AND sale_month = ${month}
    `;

    const orsegaResult = await sql`
      SELECT
        COALESCE(SUM(quantity), 0) as volume,
        COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients,
        COUNT(*) as orders,
        MAX(unit) as unit
      FROM sales_data
      WHERE company_id = 2
        AND sale_year = ${targetYearOrsega}
        AND sale_month = ${month}
    `;

    return {
      month: monthNames[month],
      monthNumber: month,
      dura: {
        year: targetYearDura,
        volume: parseFloat(duraResult[0]?.volume || "0"),
        clients: parseInt(duraResult[0]?.clients || "0"),
        orders: parseInt(duraResult[0]?.orders || "0"),
        unit: duraResult[0]?.unit || "KG"
      },
      orsega: {
        year: targetYearOrsega,
        volume: parseFloat(orsegaResult[0]?.volume || "0"),
        clients: parseInt(orsegaResult[0]?.clients || "0"),
        orders: parseInt(orsegaResult[0]?.orders || "0"),
        unit: orsegaResult[0]?.unit || "unidades"
      }
    };
  }

  const companyId = company === "dura" ? 1 : 2;
  const companyName = company === "dura" ? "DURA International" : "Grupo ORSEGA";

  // Si no se especifica año, usar el más reciente con datos
  const lastPeriod = await getLastDataPeriod(companyId);
  const targetYear = year || lastPeriod.year;

  const result = await sql`
    SELECT
      COALESCE(SUM(quantity), 0) as volume,
      COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients,
      COUNT(*) as orders,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = ${companyId}
      AND sale_year = ${targetYear}
      AND sale_month = ${month}
  `;

  const row = result[0];
  return {
    company: companyName,
    month: monthNames[month],
    monthNumber: month,
    year: targetYear,
    volume: parseFloat(row?.volume || "0"),
    clients: parseInt(row?.clients || "0"),
    orders: parseInt(row?.orders || "0"),
    unit: row?.unit || (companyId === 1 ? "KG" : "unidades"),
    hasData: parseInt(row?.orders || "0") > 0
  };
}

async function getSummary(): Promise<any> {
  // Obtener el último período con datos de cada empresa
  const duraPeriod = await getLastDataPeriod(1);
  const orsegaPeriod = await getLastDataPeriod(2);

  const duraResult = await sql`
    SELECT
      COALESCE(SUM(quantity), 0) as volume,
      COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = 1
      AND sale_year = ${duraPeriod.year}
  `;

  const orsegaResult = await sql`
    SELECT
      COALESCE(SUM(quantity), 0) as volume,
      COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as clients,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = 2
      AND sale_year = ${orsegaPeriod.year}
  `;

  return {
    dura: {
      volume: parseFloat(duraResult[0]?.volume || "0"),
      clients: parseInt(duraResult[0]?.clients || "0"),
      unit: duraResult[0]?.unit || "KG",
      dataAsOf: `${getMonthName(duraPeriod.month)} ${duraPeriod.year}`
    },
    orsega: {
      volume: parseFloat(orsegaResult[0]?.volume || "0"),
      clients: parseInt(orsegaResult[0]?.clients || "0"),
      unit: orsegaResult[0]?.unit || "unidades",
      dataAsOf: `${getMonthName(orsegaPeriod.month)} ${orsegaPeriod.year}`
    }
  };
}

// Ejecutar una función por nombre
async function executeFunction(name: string, args: any): Promise<any> {
  console.log(`[Smart Search] Ejecutando: ${name} con args:`, JSON.stringify(args));

  try {
    switch (name) {
      case "get_sales_volume":
        return await getSalesVolume(args.company, args.period);
      case "get_active_clients":
        return await getActiveClients(args.company, args.period);
      case "get_top_clients":
        return await getTopClients(args.company, args.limit, args.period);
      case "get_growth_comparison":
        return await getGrowthComparison(args.company);
      case "get_exchange_rate":
        return await getExchangeRate(args.currency, args.date);
      case "get_new_clients":
        return await getNewClients(args.company, args.period);
      case "get_summary":
        return await getSummary();
      case "get_sales_by_month":
        return await getSalesByMonth(args.company, args.month, args.year);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  } catch (error) {
    console.error(`[Smart Search] Error en función ${name}:`, error);
    throw error;
  }
}

// Función principal de búsqueda inteligente
export async function smartSearch(question: string): Promise<SearchResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Si no hay API key, usar el patrón de búsqueda básico
  if (!apiKey) {
    console.warn("[Smart Search] OPENAI_API_KEY no configurada, usando búsqueda básica");
    return basicSearch(question);
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log(`[Smart Search] Procesando pregunta: "${question}"`);

    // Primera llamada: determinar qué función llamar
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un asistente de negocios para Grupo ORSEGA. SIEMPRE debes usar las funciones disponibles para responder preguntas sobre datos.

Tienes acceso a datos de ventas de dos empresas:
- DURA International (company="dura") - vende en KG
- Grupo ORSEGA (company="orsega") - vende en unidades

IMPORTANTE:
- Cuando el usuario pregunta sobre un mes específico (enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre), USA la función get_sales_by_month con el número del mes (1-12).
- Si el usuario no especifica empresa, usa company="both" para mostrar datos de ambas.
- Si el usuario pregunta "cuántos pedidos" o "cuántas ventas", esto se refiere al volumen de ventas.
- Siempre llama una función para obtener datos reales. Nunca inventes números.

Meses: enero=1, febrero=2, marzo=3, abril=4, mayo=5, junio=6, julio=7, agosto=8, septiembre=9, octubre=10, noviembre=11, diciembre=12`
        },
        {
          role: "user",
          content: question
        }
      ],
      tools: availableFunctions,
      tool_choice: "auto"
    });

    const message = response.choices[0].message;

    // Si no hay llamada a función, devolver la respuesta directa
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        answer: message.content || "No pude procesar tu pregunta. Intenta reformularla.",
        source: "OpenAI (sin datos)"
      };
    }

    // Ejecutar las funciones llamadas
    const toolResults: any[] = [];
    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      console.log(`[Smart Search] Ejecutando función: ${functionName}`, functionArgs);

      const result = await executeFunction(functionName, functionArgs);
      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool" as const,
        content: JSON.stringify(result)
      });
    }

    // Segunda llamada: generar respuesta con los datos
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un asistente de negocios para Grupo ORSEGA. Responde en español de manera clara, profesional y concisa.
Formatea los números grandes con separadores de miles (ej: 50,000 KG).
Incluye el contexto relevante pero sé breve.`
        },
        {
          role: "user",
          content: question
        },
        message,
        ...toolResults
      ]
    });

    const finalMessage = finalResponse.choices[0].message;
    const data = toolResults.length > 0 ? JSON.parse(toolResults[0].content) : undefined;

    return {
      answer: finalMessage.content || "No pude generar una respuesta.",
      data,
      source: `OpenAI + ${message.tool_calls.map(tc => tc.function.name).join(", ")}`
    };

  } catch (error) {
    console.error("[Smart Search] Error:", error);

    // Si falla OpenAI, usar búsqueda básica
    return basicSearch(question);
  }
}

// Búsqueda básica sin OpenAI (fallback)
async function basicSearch(question: string): Promise<SearchResult> {
  const q = question.toLowerCase().trim();

  // Detectar si pregunta por un mes específico
  const monthMap: { [key: string]: number } = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };

  let detectedMonth: number | null = null;
  for (const [name, num] of Object.entries(monthMap)) {
    if (q.includes(name)) {
      detectedMonth = num;
      break;
    }
  }

  // Si detectamos un mes específico
  if (detectedMonth) {
    const isDura = q.includes("dura") || q.includes("di");
    const isOrsega = q.includes("orsega") || q.includes("go");
    const company = isDura ? "dura" : isOrsega ? "orsega" : "both";

    const data = await getSalesByMonth(company, detectedMonth);

    if (company === "both") {
      return {
        answer: `Ventas en ${data.month}:\n\nDURA International (${data.dura.year}):\n• Volumen: ${data.dura.volume.toLocaleString("es-MX")} ${data.dura.unit}\n• Clientes: ${data.dura.clients}\n• Registros: ${data.dura.orders}\n\nGrupo ORSEGA (${data.orsega.year}):\n• Volumen: ${data.orsega.volume.toLocaleString("es-MX")} ${data.orsega.unit}\n• Clientes: ${data.orsega.clients}\n• Registros: ${data.orsega.orders}`,
        data,
        source: "Búsqueda básica (sales_data)"
      };
    }

    return {
      answer: `${data.company} en ${data.month} ${data.year}:\n• Volumen: ${data.volume.toLocaleString("es-MX")} ${data.unit}\n• Clientes activos: ${data.clients}\n• Registros: ${data.orders}`,
      data,
      source: "Búsqueda básica (sales_data)"
    };
  }

  // Patrones básicos
  if ((q.includes("dura") || q.includes("di")) && (q.includes("vend") || q.includes("volumen"))) {
    const data = await getSalesVolume("dura", "this_month");
    return {
      answer: `DURA International ha vendido ${data.volume.toLocaleString("es-MX")} ${data.unit} ${data.period}. Se han atendido ${data.clients} clientes diferentes.`,
      data,
      source: "Búsqueda básica (sales_data)"
    };
  }

  if ((q.includes("orsega") || q.includes("go")) && (q.includes("vend") || q.includes("volumen"))) {
    const data = await getSalesVolume("orsega", "this_month");
    return {
      answer: `Grupo ORSEGA ha vendido ${data.volume.toLocaleString("es-MX")} ${data.unit} ${data.period}. Se han atendido ${data.clients} clientes diferentes.`,
      data,
      source: "Búsqueda básica (sales_data)"
    };
  }

  if (q.includes("cliente") && q.includes("activo")) {
    const isDura = q.includes("dura") || q.includes("di");
    const company = isDura ? "dura" : q.includes("orsega") ? "orsega" : "both";
    const data = await getActiveClients(company, "this_month");

    if (company === "both") {
      return {
        answer: `Este mes hay ${data.dura} clientes activos en DURA y ${data.orsega} en ORSEGA (${data.total} en total).`,
        data,
        source: "Búsqueda básica (sales_data)"
      };
    }

    return {
      answer: `${data.company} tiene ${data.clients} clientes activos ${data.period}.`,
      data,
      source: "Búsqueda básica (sales_data)"
    };
  }

  if (q.includes("tipo de cambio") || q.includes("dolar") || q.includes("dólar")) {
    const data = await getExchangeRate("USD");
    return {
      answer: `El tipo de cambio del dólar es de $${data.rate.toFixed(2)} MXN.`,
      data,
      source: "Búsqueda básica (exchange_rates)"
    };
  }

  if (q.includes("top") && q.includes("cliente")) {
    const isDura = q.includes("dura") || q.includes("di");
    const company = isDura ? "dura" : "orsega";
    const data = await getTopClients(company, 5);

    const clientList = data.clients
      .map((c: any) => `${c.rank}. ${c.name}: ${c.volume.toLocaleString("es-MX")} ${c.unit}`)
      .join("\n");

    return {
      answer: `Top 5 clientes de ${data.company}:\n${clientList}`,
      data,
      source: "Búsqueda básica (sales_data)"
    };
  }

  if (q.includes("resumen") || q.includes("general")) {
    const data = await getSummary();
    return {
      answer: `Resumen del mes:\n\nDURA International:\n• Volumen: ${data.dura.volume.toLocaleString("es-MX")} ${data.dura.unit}\n• Clientes: ${data.dura.clients}\n\nGrupo ORSEGA:\n• Volumen: ${data.orsega.volume.toLocaleString("es-MX")} ${data.orsega.unit}\n• Clientes: ${data.orsega.clients}`,
      data,
      source: "Búsqueda básica (sales_data)"
    };
  }

  return {
    answer: "No pude entender tu pregunta. Intenta preguntar algo como:\n• ¿Cuánto hemos vendido en DURA este mes?\n• ¿Cuántos clientes activos tiene ORSEGA?\n• ¿Cuál es el crecimiento de DURA vs año anterior?\n• Top 5 clientes de ORSEGA\n• Dame un resumen general",
    source: "Búsqueda básica"
  };
}
