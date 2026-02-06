/**
 * Smart Search v2 - Sistema de IA Inteligente con Text-to-SQL
 * La AI puede explorar todo el sistema y generar queries dinámicos
 */

import OpenAI from "openai";
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

// ============================================================
// SCHEMA DEL SISTEMA - La AI conoce toda la estructura de datos
// ============================================================
const DATABASE_SCHEMA = `
## Base de Datos del Sistema KPIs Grupo ORSEGA

### Tabla: ventas (Datos de Ventas - Single Source of Truth)
Contiene todas las ventas de ambas empresas.
- id: ID único
- company_id: 1 = DURA International (vende en KG), 2 = Grupo ORSEGA (vende en unidades)
- cliente: Nombre del cliente
- producto: Nombre del producto
- familia_producto: Familia del producto
- cantidad: Cantidad vendida (KG para DURA, unidades para ORSEGA)
- unidad: Unidad de medida ('KG' o 'unidades')
- fecha: Fecha completa de la venta (DATE)
- anio: Año de la venta (generado de fecha)
- mes: Mes de la venta 1-12 (generado de fecha)
- importe: Monto total de la venta
- precio_unitario: Precio por unidad
- tipo_cambio: Tipo de cambio USD/MXN
- importe_mn: Importe en moneda nacional
- folio: Folio de factura
- submodulo: 'DI' o 'GO'
- created_at: Fecha de registro

IMPORTANTE sobre fechas:
- Los datos van de 2024 a enero 2026
- NO usar CURRENT_DATE, usar los datos reales disponibles
- Usar anio y mes (generados automáticamente) en lugar de EXTRACT

### Tabla: exchange_rates (Tipos de Cambio)
- id: ID único
- currency: Moneda (USD, EUR)
- rate: Tipo de cambio actual
- tipo_cambio_anterior: Tipo de cambio anterior
- fecha_publicacion: Fecha de publicación
- source: Fuente del dato (banxico, dof, etc.)

### Tabla: kpis (Indicadores Clave)
- id: ID único
- name: Nombre del KPI
- value: Valor actual
- target: Meta objetivo
- unit: Unidad ('%', '$', etc.)
- category: Categoría (ventas, finanzas, operaciones)
- frequency: Frecuencia de actualización

### Tabla: users (Usuarios del Sistema)
- id, email, name, role (admin/user)

### Tabla: shipments (Embarques/Logística)
- id, container_number, status, origin, destination, eta

### Empresas:
- company_id = 1: DURA International (vende productos en KG)
- company_id = 2: Grupo ORSEGA (vende productos en unidades)
`;

// ============================================================
// FUNCIONES PARA TEXT-TO-SQL
// ============================================================

const sqlGeneratorFunction = {
  type: "function" as const,
  function: {
    name: "execute_sql_query",
    description: "Ejecuta una consulta SQL para obtener datos del sistema. SIEMPRE usa esta función para responder preguntas sobre datos.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La consulta SQL a ejecutar. Debe ser SELECT solamente. Usar los nombres de columnas exactos del schema."
        },
        explanation: {
          type: "string",
          description: "Breve explicación de qué busca esta consulta"
        }
      },
      required: ["query", "explanation"]
    }
  }
};

// Ejecutar query de forma segura (solo SELECT)
async function executeSafeQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const trimmed = query.trim();
  const normalizedQuery = trimmed.toLowerCase();

  // Must start with SELECT
  if (!normalizedQuery.startsWith('select')) {
    return { success: false, error: "Solo se permiten consultas SELECT" };
  }

  // Block multiple statements (semicolons outside of string literals)
  if (trimmed.replace(/'[^']*'/g, '').includes(';')) {
    return { success: false, error: "No se permiten múltiples sentencias SQL" };
  }

  // Block dangerous keywords as whole words (using word boundaries)
  const forbidden = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
    'grant', 'revoke', 'exec', 'execute', 'copy', 'pg_read_file',
    'pg_write_file', 'lo_import', 'lo_export'
  ];
  for (const word of forbidden) {
    // Match as whole word to avoid false positives (e.g. "updated_at" matching "update")
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalizedQuery)) {
      return { success: false, error: `Operación no permitida: ${word}` };
    }
  }

  // Enforce a row limit to prevent unbounded result sets
  if (!normalizedQuery.includes('limit')) {
    query = trimmed + ' LIMIT 500';
  }

  try {
    const result = await sql(query);
    return { success: true, data: result as any[] };
  } catch (error: any) {
    console.error(`[Smart Search] Error SQL:`, error.message);
    return { success: false, error: error.message };
  }
}

// Formatear resultados para respuesta humana
function formatResultsForHuman(data: any[], explanation: string): string {
  if (!data || data.length === 0) {
    return "No se encontraron datos para esta consulta.";
  }

  // Si es un solo valor numérico
  if (data.length === 1 && Object.keys(data[0]).length === 1) {
    const key = Object.keys(data[0])[0];
    const value = data[0][key];
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return Number(value).toLocaleString('es-MX');
    }
    return String(value);
  }

  // Si son pocos registros, formatear como lista
  if (data.length <= 10) {
    return data.map((row, i) => {
      const values = Object.entries(row)
        .map(([key, val]) => {
          const formattedVal = typeof val === 'number' ? val.toLocaleString('es-MX') : val;
          return `${key}: ${formattedVal}`;
        })
        .join(', ');
      return `${i + 1}. ${values}`;
    }).join('\n');
  }

  // Si son muchos, resumir
  return `Se encontraron ${data.length} registros.`;
}

// ============================================================
// FUNCIÓN PRINCIPAL DE BÚSQUEDA INTELIGENTE
// ============================================================

export async function smartSearch(question: string, companyId?: number): Promise<SearchResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn("[Smart Search] OPENAI_API_KEY no configurada");
    return fallbackSearch(question);
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log(`[Smart Search] Pregunta: "${question}"`);

    // Paso 1: Pedir a la AI que genere un SQL query
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un analista de datos experto para Grupo ORSEGA. Tu trabajo es convertir preguntas en español a consultas SQL precisas.

${DATABASE_SCHEMA}

REGLAS IMPORTANTES:
1. SIEMPRE genera un query SQL usando la función execute_sql_query
2. Usa nombres de columnas EXACTOS del schema
3. Para ventas, SIEMPRE filtra por company_id (1=DURA, 2=ORSEGA)
4. Si preguntan por un mes específico: enero=1, febrero=2, marzo=3, abril=4, mayo=5, junio=6, julio=7, agosto=8, septiembre=9, octubre=10, noviembre=11, diciembre=12
5. Si no especifican empresa, incluye datos de ambas con GROUP BY company_id
6. Si no especifican año, usa 2025 para DURA (hasta junio) y ORSEGA (hasta octubre)
7. Usa COALESCE para evitar NULLs en sumas
8. Para contar clientes únicos: COUNT(DISTINCT cliente) FILTER (WHERE cliente IS NOT NULL AND cliente <> '')
9. Siempre incluye el año y mes en el resultado para contexto
10. Limita resultados a 20 filas máximo con LIMIT

EJEMPLOS:
- "cuántos pedidos en noviembre" → SELECT anio, SUM(cantidad) as total, COUNT(*) as registros FROM ventas WHERE mes = 11 GROUP BY anio, company_id ORDER BY anio DESC
- "top 5 clientes de DURA" → SELECT cliente, SUM(cantidad) as total_kg FROM ventas WHERE company_id = 1 AND anio = 2025 GROUP BY cliente ORDER BY total_kg DESC LIMIT 5
- "ventas de octubre ORSEGA" → SELECT SUM(cantidad) as total_unidades, COUNT(DISTINCT cliente) as clientes FROM ventas WHERE company_id = 2 AND mes = 10 AND anio = 2025`
        },
        {
          role: "user",
          content: companyId
            ? `${question} (Contexto: empresa company_id=${companyId}, ${companyId === 1 ? 'DURA International' : companyId === 2 ? 'Grupo Orsega' : 'otra'})`
            : question
        }
      ],
      tools: [sqlGeneratorFunction],
      tool_choice: "required" as const
    });

    const message = response.choices[0].message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log("[Smart Search] No se generó query SQL");
      return {
        answer: message.content || "No pude procesar tu pregunta. Intenta reformularla.",
        source: "OpenAI (sin query)"
      };
    }

    // Paso 2: Ejecutar el SQL generado
    const toolCall = message.tool_calls[0];
    const functionArgs = (toolCall as any).function?.arguments;
    if (!functionArgs) {
      console.error("[Smart Search] No function arguments found in tool call");
      return fallbackSearch(question);
    }
    const args = JSON.parse(functionArgs);
    const sqlQuery = args.query;
    const explanation = args.explanation;

    console.log(`[Smart Search] Query generado: ${sqlQuery}`);
    console.log(`[Smart Search] Explicación: ${explanation}`);

    const queryResult = await executeSafeQuery(sqlQuery);

    if (!queryResult.success) {
      console.error(`[Smart Search] Error en query: ${queryResult.error}`);
      // Intentar con fallback si el query falla
      return fallbackSearch(question);
    }

    // Paso 3: Pedir a la AI que interprete los resultados
    const interpretResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un asistente de negocios que explica datos de ventas de forma clara y concisa en español.

IMPORTANTE:
- Responde de forma directa y profesional
- Formatea números grandes con separadores de miles (ej: 50,000)
- Si los datos son de DURA (company_id=1), la unidad es KG
- Si los datos son de ORSEGA (company_id=2), la unidad es unidades
- Incluye el período/año cuando sea relevante
- Sé breve pero informativo`
        },
        {
          role: "user",
          content: `Pregunta del usuario: "${question}"

Consulta ejecutada: ${sqlQuery}

Resultados obtenidos:
${JSON.stringify(queryResult.data, null, 2)}

Por favor, responde la pregunta del usuario basándote en estos datos.`
        }
      ],
      max_tokens: 500
    });

    const finalAnswer = interpretResponse.choices[0].message.content || "No pude interpretar los resultados.";

    return {
      answer: finalAnswer,
      data: queryResult.data,
      source: `SQL: ${sqlQuery}`,
      query: sqlQuery
    };

  } catch (error: any) {
    console.error("[Smart Search] Error:", error.message);
    return fallbackSearch(question);
  }
}

// ============================================================
// BÚSQUEDA DE RESPALDO (sin OpenAI)
// ============================================================

async function fallbackSearch(question: string): Promise<SearchResult> {
  const q = question.toLowerCase().trim();

  // Detectar mes
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

  // Detectar empresa
  const isDura = q.includes('dura');
  const isOrsega = q.includes('orsega');

  try {
    // Si detectamos mes específico
    if (month) {
      let query = '';
      if (isDura) {
        query = `SELECT anio as sale_year, SUM(cantidad) as total_kg, COUNT(DISTINCT cliente) as clientes
                 FROM ventas WHERE company_id = 1 AND mes = ${month}
                 GROUP BY anio ORDER BY anio DESC LIMIT 5`;
      } else if (isOrsega) {
        query = `SELECT anio as sale_year, SUM(cantidad) as total_unidades, COUNT(DISTINCT cliente) as clientes
                 FROM ventas WHERE company_id = 2 AND mes = ${month}
                 GROUP BY anio ORDER BY anio DESC LIMIT 5`;
      } else {
        query = `SELECT company_id, anio as sale_year, SUM(cantidad) as total, COUNT(DISTINCT cliente) as clientes
                 FROM ventas WHERE mes = ${month}
                 GROUP BY company_id, anio ORDER BY anio DESC, company_id LIMIT 10`;
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

        return { answer, data: result.data, source: "Búsqueda local", query };
      }
    }

    // Resumen general
    if (q.includes('resumen') || q.includes('general') || q.includes('total')) {
      const query = `SELECT company_id, anio as sale_year, SUM(cantidad) as total, COUNT(DISTINCT cliente) as clientes
                     FROM ventas GROUP BY company_id, anio ORDER BY anio DESC, company_id LIMIT 10`;
      const result = await executeSafeQuery(query);

      if (result.success && result.data) {
        let answer = "Resumen de ventas:\n\n";
        result.data.forEach((row: any) => {
          const company = row.company_id === 1 ? 'DURA' : 'ORSEGA';
          const unit = row.company_id === 1 ? 'KG' : 'unidades';
          answer += `${company} ${row.sale_year}: ${Number(row.total).toLocaleString('es-MX')} ${unit}, ${row.clientes} clientes\n`;
        });
        return { answer, data: result.data, source: "Búsqueda local", query };
      }
    }

    // Top clientes
    if (q.includes('top') || q.includes('mejores') || q.includes('principales')) {
      const companyId = isDura ? 1 : 2;
      const query = `SELECT cliente as client_name, SUM(cantidad) as total
                     FROM ventas WHERE company_id = ${companyId} AND anio = 2025
                     AND cliente IS NOT NULL AND cliente <> ''
                     GROUP BY cliente ORDER BY total DESC LIMIT 10`;
      const result = await executeSafeQuery(query);

      if (result.success && result.data) {
        const company = isDura ? 'DURA' : 'ORSEGA';
        const unit = isDura ? 'KG' : 'unidades';
        let answer = `Top clientes ${company} 2025:\n\n`;
        result.data.forEach((row: any, i: number) => {
          answer += `${i + 1}. ${row.client_name}: ${Number(row.total).toLocaleString('es-MX')} ${unit}\n`;
        });
        return { answer, data: result.data, source: "Búsqueda local", query };
      }
    }

  } catch (error) {
    console.error("[Fallback] Error:", error);
  }

  return {
    answer: `No pude procesar tu pregunta. Prueba preguntar:
• ¿Cuánto vendimos en noviembre?
• ¿Cuáles son los top clientes de DURA?
• Dame un resumen de ventas
• ¿Cuántos clientes tiene ORSEGA en octubre?`,
    source: "Ayuda"
  };
}
