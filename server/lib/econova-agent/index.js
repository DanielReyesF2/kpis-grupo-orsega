// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";

// src/prompt-builder.ts
function buildSystemPrompt(config, context) {
  const companyContext = getCompanyContext(context?.companyId);
  return `Eres EcoNova, el asistente de IA de ${config.tenantName}. Eres Claude, un asistente de IA creado por Anthropic.

PERSONALIDAD:
- Eres inteligente, amigable y profesional
- Puedes ayudar con CUALQUIER tema: an\xE1lisis, estrategia, ideas, preguntas generales, consejos, etc.
- Cuando el usuario hace preguntas sobre datos del negocio, usas las herramientas disponibles
- Eres proactivo: das insights, sugieres an\xE1lisis adicionales, identificas oportunidades

CAPACIDADES:
1. **Conversaci\xF3n general** - Puedes hablar de cualquier tema, dar consejos, explicar conceptos
2. **An\xE1lisis de negocio** - Tienes acceso a datos de ventas, clientes, KPIs
3. **Consultor\xEDa estrat\xE9gica** - Puedes ayudar con estrategia, planeaci\xF3n, toma de decisiones
4. **Creatividad** - Ideas, brainstorming, soluci\xF3n de problemas

DATOS DEL NEGOCIO DISPONIBLES:
${config.databaseSchema}

CUANDO USES DATOS:
- Usa las herramientas disponibles para consultar informaci\xF3n real
- Interpreta los datos y da insights \xFAtiles
- Sugiere an\xE1lisis adicionales si son relevantes
- Formatea n\xFAmeros de forma legible (ej: 1,234,567)
- Usa formato Markdown para tablas y listas

CONTEXTO DEL USUARIO:
- Usuario ID: ${context?.userId || "usuario"}
- ${companyContext}

${config.systemPromptAdditions || ""}

Responde en espa\xF1ol. S\xE9 \xFAtil, claro y conciso pero completo.`;
}
function getCompanyContext(companyId) {
  if (!companyId) {
    return "Acceso a todas las empresas";
  }
  return `Empresa ID: ${companyId}`;
}
function buildCompactPrompt(config, context) {
  return `Eres EcoNova, asistente IA de ${config.tenantName}.

Datos disponibles:
${config.databaseSchema}

${config.systemPromptAdditions || ""}

Usuario: ${context?.userId || "an\xF3nimo"}
Empresa: ${context?.companyId || "todas"}

Responde en espa\xF1ol. Usa Markdown para formato.`;
}

// src/utils/safe-query.ts
var FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "grant",
  "revoke",
  "exec",
  "execute",
  "sp_",
  "xp_",
  "--",
  "/*",
  "*/",
  "union"
];
var SUSPICIOUS_PATTERNS = [
  /;\s*$/,
  // Trailing semicolon (multiple statements)
  /;\s*\w/,
  // Semicolon followed by word (chained statements)
  /'\s*or\s*'?\s*\d+\s*=\s*\d+/i,
  // ' or 1=1 patterns
  /'\s*or\s*'?\s*'\w+'\s*=\s*'\w+'/i,
  // ' or 'a'='a patterns
  /--\s*$/,
  // SQL comment at end
  /\/\*.*\*\//
  // Block comments
];
function validateQuery(query) {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Query must be a non-empty string" };
  }
  const normalizedQuery = query.trim();
  const lowerQuery = normalizedQuery.toLowerCase();
  if (!lowerQuery.startsWith("select")) {
    return {
      valid: false,
      error: "Only SELECT queries are allowed"
    };
  }
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lowerQuery)) {
      return {
        valid: false,
        error: `Forbidden operation: ${keyword.toUpperCase()}`
      };
    }
  }
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(lowerQuery)) {
      return {
        valid: false,
        error: "Query contains suspicious patterns"
      };
    }
  }
  if (normalizedQuery.includes(";")) {
    return {
      valid: false,
      error: "Multiple statements are not allowed"
    };
  }
  return {
    valid: true,
    normalizedQuery
  };
}
async function executeSafeQuery(query, executeQuery) {
  const validation = validateQuery(query);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  try {
    const result = await executeQuery(validation.normalizedQuery);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return { success: false, error: message };
  }
}

// src/tools/query-database.ts
function createQueryDatabaseTool(databaseSchema) {
  return {
    name: "query_database",
    description: `Ejecuta una consulta SQL SELECT para obtener datos del negocio. Usa esta herramienta cuando necesites informaci\xF3n espec\xEDfica sobre ventas, clientes, KPIs, etc.

Schema disponible:
${databaseSchema}

Reglas:
- Solo consultas SELECT
- No usar punto y coma
- Usar LIMIT para limitar resultados`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Consulta SQL SELECT"
        },
        purpose: {
          type: "string",
          description: "Qu\xE9 informaci\xF3n buscas obtener"
        }
      },
      required: ["query", "purpose"]
    }
  };
}
async function executeQueryDatabase(input, executeQuery) {
  const query = input.query;
  if (!query) {
    return {
      success: false,
      result: null,
      error: "Query is required"
    };
  }
  const result = await executeSafeQuery(query, executeQuery);
  if (result.success) {
    return {
      success: true,
      result: result.data
    };
  }
  return {
    success: false,
    result: null,
    error: result.error
  };
}

// src/tools/get-exchange-rate.ts
var EXCHANGE_RATE_QUERY = `
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
LIMIT 10
`;
function createGetExchangeRateTool() {
  return {
    name: "get_exchange_rate",
    description: "Obtiene los tipos de cambio USD/MXN m\xE1s recientes de todas las fuentes disponibles (DOF/Banxico, MONEX, Santander). Retorna buy_rate (compra), sell_rate (venta), source (fuente) y fecha de cada cotizaci\xF3n.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  };
}
async function executeGetExchangeRate(executeQuery) {
  const result = await executeSafeQuery(EXCHANGE_RATE_QUERY, executeQuery);
  if (result.success) {
    return {
      success: true,
      result: result.data
    };
  }
  return {
    success: false,
    result: null,
    error: result.error
  };
}

// src/tools/get-business-summary.ts
function createGetBusinessSummaryTool() {
  return {
    name: "get_business_summary",
    description: "Obtiene un resumen ejecutivo del estado actual del negocio incluyendo ventas recientes, KPIs principales y m\xE9tricas clave.",
    input_schema: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          enum: ["ventas", "kpis", "clientes", "general"],
          description: "\xC1rea de enfoque del resumen"
        }
      },
      required: []
    }
  };
}
async function executeGetBusinessSummary(input, executeQuery) {
  const focus = input.focus || "general";
  const summaryData = {};
  try {
    if (focus === "ventas" || focus === "general") {
      const salesQuery = `
        SELECT company_id, sale_year, sale_month, SUM(quantity) as total,
               COUNT(DISTINCT client_name) as clientes_unicos
        FROM sales_data
        WHERE sale_year = 2025
        GROUP BY company_id, sale_year, sale_month
        ORDER BY sale_month DESC
        LIMIT 6
      `;
      const salesResult = await executeSafeQuery(salesQuery, executeQuery);
      if (salesResult.success) {
        summaryData.ventas_recientes = salesResult.data;
      }
    }
    if (focus === "kpis" || focus === "general") {
      const kpiQuery = `
        SELECT name, value, target, unit, category
        FROM kpis
        ORDER BY category
        LIMIT 15
      `;
      const kpiResult = await executeSafeQuery(kpiQuery, executeQuery);
      if (kpiResult.success) {
        summaryData.kpis = kpiResult.data;
      }
    }
    if (focus === "clientes" || focus === "general") {
      const clientQuery = `
        SELECT company_id, client_name, SUM(quantity) as total
        FROM sales_data
        WHERE sale_year = 2025 AND client_name IS NOT NULL AND client_name <> ''
        GROUP BY company_id, client_name
        ORDER BY total DESC
        LIMIT 10
      `;
      const clientResult = await executeSafeQuery(clientQuery, executeQuery);
      if (clientResult.success) {
        summaryData.top_clientes = clientResult.data;
      }
    }
    return {
      success: true,
      result: summaryData
    };
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// src/tools/index.ts
function getToolDefinitions(config) {
  const enabledTools = config.enabledTools || ["query_database", "get_exchange_rate", "get_business_summary"];
  const tools = [];
  if (enabledTools.includes("query_database")) {
    tools.push(createQueryDatabaseTool(config.databaseSchema));
  }
  if (enabledTools.includes("get_exchange_rate")) {
    tools.push(createGetExchangeRateTool());
  }
  if (enabledTools.includes("get_business_summary")) {
    tools.push(createGetBusinessSummaryTool());
  }
  return tools;
}
async function executeTool(toolName, toolInput, config) {
  switch (toolName) {
    case "query_database":
      return executeQueryDatabase(toolInput, config.executeQuery);
    case "get_exchange_rate":
      return executeGetExchangeRate(config.executeQuery);
    case "get_business_summary":
      return executeGetBusinessSummary(toolInput, config.executeQuery);
    default:
      return {
        success: false,
        result: null,
        error: `Unknown tool: ${toolName}`
      };
  }
}
function isToolEnabled(toolName, config) {
  const enabledTools = config.enabledTools || ["query_database", "get_exchange_rate", "get_business_summary"];
  return enabledTools.includes(toolName);
}

// src/utils/usage-tracker.ts
var PRICING = {
  "claude-sonnet-4-20250514": {
    input: 3,
    // $3.00 per 1M input tokens
    output: 15
    // $15.00 per 1M output tokens
  },
  "claude-3-5-sonnet-20241022": {
    input: 3,
    output: 15
  },
  // Default fallback pricing
  default: {
    input: 3,
    output: 15
  }
};
function calculateCost(inputTokens, outputTokens, model) {
  const pricing = PRICING[model] || PRICING.default;
  const inputCost = inputTokens / 1e6 * pricing.input;
  const outputCost = outputTokens / 1e6 * pricing.output;
  return inputCost + outputCost;
}
function createUsageTracker() {
  let stats = {
    totalRequests: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    toolUsage: {}
  };
  return {
    /**
     * Record usage from a request
     */
    record(usage) {
      stats.totalRequests += 1;
      stats.totalTokens += usage.totalTokens;
      stats.totalCostUsd += usage.costUsd;
      for (const tool of usage.toolsUsed) {
        stats.toolUsage[tool] = (stats.toolUsage[tool] || 0) + 1;
      }
    },
    /**
     * Get current stats
     */
    getStats() {
      return { ...stats };
    },
    /**
     * Reset all stats
     */
    reset() {
      stats = {
        totalRequests: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        toolUsage: {}
      };
    }
  };
}
function createUsageData(params) {
  const costUsd = calculateCost(params.inputTokens, params.outputTokens, params.model);
  return {
    tenantId: params.tenantId,
    userId: params.userId,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: params.inputTokens + params.outputTokens,
    costUsd,
    durationMs: params.durationMs,
    toolsUsed: params.toolsUsed,
    timestamp: /* @__PURE__ */ new Date()
  };
}

// src/agent.ts
var DEFAULTS = {
  maxTokensPerRequest: 4096,
  maxConversationHistory: 10,
  maxIterations: 5,
  model: "claude-sonnet-4-20250514"
};
function createEcoNovaAgent(config) {
  if (!config.tenantId) throw new Error("tenantId is required");
  if (!config.tenantName) throw new Error("tenantName is required");
  if (!config.executeQuery) throw new Error("executeQuery function is required");
  if (!config.databaseSchema) throw new Error("databaseSchema is required");
  const finalConfig = {
    ...config,
    maxTokensPerRequest: config.maxTokensPerRequest ?? DEFAULTS.maxTokensPerRequest,
    maxConversationHistory: config.maxConversationHistory ?? DEFAULTS.maxConversationHistory,
    maxIterations: config.maxIterations ?? DEFAULTS.maxIterations,
    model: config.model ?? DEFAULTS.model
  };
  const usageTracker = createUsageTracker();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[EcoNova Agent] ANTHROPIC_API_KEY not set");
  }
  async function chat(question, context) {
    if (!apiKey) {
      return {
        answer: "El asistente de IA no est\xE1 disponible. Falta configurar ANTHROPIC_API_KEY.",
        source: "Error de configuraci\xF3n"
      };
    }
    const startTime = Date.now();
    const anthropic = new Anthropic({ apiKey });
    const tools = getToolDefinitions(finalConfig);
    const systemPrompt = buildSystemPrompt(finalConfig, context);
    const messages = [];
    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      const recentHistory = context.conversationHistory.slice(
        -finalConfig.maxConversationHistory
      );
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    messages.push({ role: "user", content: question });
    try {
      let response = await anthropic.messages.create({
        model: finalConfig.model,
        max_tokens: finalConfig.maxTokensPerRequest,
        system: systemPrompt,
        tools,
        messages
      });
      const toolsUsed = [];
      let lastQuery;
      let toolResults = [];
      let iterations = 0;
      let allMessages = [...messages];
      while (response.stop_reason === "tool_use" && iterations < finalConfig.maxIterations) {
        iterations++;
        const toolUseBlocks = response.content.filter(
          (block) => block.type === "tool_use"
        );
        const toolResultContents = [];
        for (const toolUse of toolUseBlocks) {
          toolsUsed.push(toolUse.name);
          const toolResult = await executeTool(
            toolUse.name,
            toolUse.input,
            finalConfig
          );
          if (toolUse.name === "query_database") {
            lastQuery = toolUse.input.query;
            if (toolResult.success) {
              toolResults = toolResult.result;
            }
          }
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(
              toolResult.success ? toolResult.result : { error: toolResult.error }
            )
          });
        }
        allMessages = [
          ...allMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResultContents }
        ];
        response = await anthropic.messages.create({
          model: finalConfig.model,
          max_tokens: finalConfig.maxTokensPerRequest,
          system: systemPrompt,
          tools,
          messages: allMessages
        });
      }
      const textBlocks = response.content.filter(
        (block) => block.type === "text"
      );
      let finalAnswer = textBlocks.map((b) => b.text).join("\n\n");
      if (!finalAnswer) {
        finalAnswer = "No pude procesar tu mensaje. \xBFPodr\xEDas reformularlo?";
      }
      const durationMs = Date.now() - startTime;
      const usage = createUsageData({
        tenantId: finalConfig.tenantId,
        userId: context?.userId,
        model: finalConfig.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        toolsUsed: [...new Set(toolsUsed)]
      });
      usageTracker.record(usage);
      if (finalConfig.onUsage) {
        try {
          await finalConfig.onUsage(usage);
        } catch (e) {
          console.error("[EcoNova Agent] Error in onUsage callback:", e);
        }
      }
      return {
        answer: finalAnswer,
        data: toolResults.length > 0 ? toolResults : void 0,
        source: "EcoNova AI",
        query: lastQuery
      };
    } catch (error) {
      console.error("[EcoNova Agent] Error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        answer: `Ocurri\xF3 un error al procesar tu mensaje. Por favor intenta de nuevo.

Error: ${message}`,
        source: "Error"
      };
    }
  }
  return {
    chat,
    getUsageStats: () => usageTracker.getStats(),
    resetStats: () => usageTracker.reset(),
    getConfig: () => Object.freeze({ ...finalConfig })
  };
}
export {
  buildCompactPrompt,
  buildSystemPrompt,
  calculateCost,
  createEcoNovaAgent,
  createUsageData,
  createUsageTracker,
  executeSafeQuery,
  executeTool,
  getToolDefinitions,
  isToolEnabled,
  validateQuery
};
