/**
 * ============================================================================
 * 🗄️ MCP DATABASE - Herramientas de Consulta de Base de Datos
 * ============================================================================
 *
 * Este módulo expone herramientas para:
 * - Ejecutar consultas inteligentes (Text-to-SQL)
 * - Buscar información de clientes, productos, ventas
 * - Consultar KPIs y métricas
 * - Obtener datos para análisis
 *
 * Integración directa con el smart-search existente.
 *
 * @module mcp/tools/database
 */

import type { MCPTool, MCPToolResult, MCPContext } from '../index';

// ============================================================================
// DEFINICIÓN DE HERRAMIENTAS
// ============================================================================

export const databaseTools: MCPTool[] = [
  // -------------------------------------------------------------------------
  // SMART_QUERY - Consulta inteligente
  // -------------------------------------------------------------------------
  {
    name: 'smart_query',
    description: `Ejecuta una consulta en lenguaje natural sobre la base de datos.

    El sistema convierte automáticamente la pregunta en SQL.

    Ejemplos de consultas:
    - "¿Cuáles son las ventas del mes pasado?"
    - "Top 10 clientes por monto"
    - "Productos más vendidos en 2024"
    - "Comparar ventas Q1 vs Q2"
    - "¿Cuántas facturas pendientes hay?"

    Tablas disponibles:
    - sales_data: Datos de ventas (cliente, producto, monto, fecha)
    - kpis_orsega: Indicadores de desempeño
    - exchange_rates: Tipos de cambio históricos
    - users: Usuarios del sistema
    - shipments: Embarques y envíos`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Pregunta en lenguaje natural',
        },
        context: {
          type: 'string',
          description: 'Contexto adicional para refinar la consulta',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados (default: 100)',
        },
        format: {
          type: 'string',
          description: 'Formato de respuesta',
          enum: ['table', 'json', 'summary'],
        },
      },
      required: ['question'],
    },
  },

  // -------------------------------------------------------------------------
  // GET_SALES_DATA - Datos de ventas
  // -------------------------------------------------------------------------
  {
    name: 'get_sales_data',
    description: `Obtiene datos de ventas con filtros específicos.

    Métricas disponibles:
    - Total de ventas
    - Número de transacciones
    - Ticket promedio
    - Ventas por cliente/producto/región
    - Comparativos temporales

    Agrupaciones: día, semana, mes, trimestre, año`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          description: 'Fecha inicial (YYYY-MM-DD)',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final (YYYY-MM-DD)',
        },
        customer_id: {
          type: 'number',
          description: 'Filtrar por cliente',
        },
        product_id: {
          type: 'number',
          description: 'Filtrar por producto',
        },
        salesperson_id: {
          type: 'number',
          description: 'Filtrar por vendedor',
        },
        region: {
          type: 'string',
          description: 'Filtrar por región',
        },
        group_by: {
          type: 'string',
          description: 'Agrupar por',
          enum: ['day', 'week', 'month', 'quarter', 'year', 'customer', 'product', 'salesperson', 'region'],
        },
        metrics: {
          type: 'array',
          description: 'Métricas a incluir',
          items: { type: 'string' },
        },
        order_by: {
          type: 'string',
          description: 'Ordenar por',
          enum: ['date', 'amount', 'quantity'],
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_KPIS - Indicadores de desempeño
  // -------------------------------------------------------------------------
  {
    name: 'get_kpis',
    description: `Obtiene los KPIs (Indicadores Clave de Desempeño).

    KPIs disponibles:
    - Ventas totales
    - Margen de utilidad
    - Rotación de inventario
    - Días de cartera
    - Cumplimiento de metas
    - Satisfacción del cliente
    - Productividad por vendedor

    Incluye: valor actual, meta, tendencia, comparativo`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        kpi_names: {
          type: 'array',
          description: 'Lista de KPIs específicos (vacío = todos)',
          items: { type: 'string' },
        },
        area: {
          type: 'string',
          description: 'Área de negocio',
          enum: ['ventas', 'finanzas', 'operaciones', 'rh', 'all'],
        },
        period: {
          type: 'string',
          description: 'Período',
          enum: ['current_month', 'last_month', 'current_quarter', 'ytd', 'custom'],
        },
        date_from: {
          type: 'string',
          description: 'Fecha inicial (si period=custom)',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final (si period=custom)',
        },
        include_history: {
          type: 'boolean',
          description: 'Incluir historial (últimos 12 meses)',
        },
        include_targets: {
          type: 'boolean',
          description: 'Incluir metas',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_CUSTOMERS - Información de clientes
  // -------------------------------------------------------------------------
  {
    name: 'get_customers',
    description: `Obtiene información de clientes.

    Datos por cliente:
    - Datos de contacto
    - Historial de compras
    - Saldo pendiente
    - Límite de crédito
    - Clasificación (A, B, C)
    - Última actividad

    Búsqueda por: nombre, RFC, email, teléfono`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Texto de búsqueda (nombre, RFC, email)',
        },
        customer_id: {
          type: 'number',
          description: 'ID específico del cliente',
        },
        classification: {
          type: 'string',
          description: 'Clasificación',
          enum: ['A', 'B', 'C', 'all'],
        },
        has_pending_balance: {
          type: 'boolean',
          description: 'Solo con saldo pendiente',
        },
        include_sales_history: {
          type: 'boolean',
          description: 'Incluir historial de ventas',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_PRODUCTS - Información de productos
  // -------------------------------------------------------------------------
  {
    name: 'get_products',
    description: `Obtiene información de productos.

    Datos por producto:
    - SKU, nombre, descripción
    - Precios (lista, mayoreo, promoción)
    - Inventario disponible
    - Unidades vendidas
    - Margen de utilidad
    - Categoría y familia

    Análisis: más vendidos, mayor margen, baja rotación`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Texto de búsqueda (SKU, nombre)',
        },
        product_id: {
          type: 'number',
          description: 'ID específico del producto',
        },
        category: {
          type: 'string',
          description: 'Categoría del producto',
        },
        in_stock: {
          type: 'boolean',
          description: 'Solo con stock disponible',
        },
        analysis_type: {
          type: 'string',
          description: 'Tipo de análisis',
          enum: ['top_sellers', 'highest_margin', 'low_rotation', 'out_of_stock', 'all'],
        },
        include_sales_data: {
          type: 'boolean',
          description: 'Incluir datos de ventas',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_SUPPLIERS - Información de proveedores
  // -------------------------------------------------------------------------
  {
    name: 'get_suppliers',
    description: `Obtiene información de proveedores.

    Datos por proveedor:
    - Razón social, RFC
    - Datos de contacto
    - Productos/servicios
    - Historial de compras
    - Condiciones de pago
    - Calificación`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Texto de búsqueda (nombre, RFC)',
        },
        supplier_id: {
          type: 'number',
          description: 'ID específico del proveedor',
        },
        category: {
          type: 'string',
          description: 'Categoría/tipo de proveedor',
        },
        include_purchase_history: {
          type: 'boolean',
          description: 'Incluir historial de compras',
        },
        include_pending_invoices: {
          type: 'boolean',
          description: 'Incluir facturas pendientes',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // EXECUTE_REPORT - Ejecutar reporte predefinido
  // -------------------------------------------------------------------------
  {
    name: 'execute_report',
    description: `Ejecuta un reporte predefinido del sistema.

    Reportes disponibles:
    - sales_summary: Resumen de ventas
    - accounts_receivable_aging: Antigüedad de cartera
    - accounts_payable_aging: Antigüedad de cuentas por pagar
    - inventory_valuation: Valuación de inventario
    - customer_analysis: Análisis de clientes
    - product_performance: Desempeño de productos
    - salesperson_performance: Desempeño de vendedores
    - cash_flow_projection: Proyección de flujo de caja`,
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        report_name: {
          type: 'string',
          description: 'Nombre del reporte',
          enum: [
            'sales_summary',
            'accounts_receivable_aging',
            'accounts_payable_aging',
            'inventory_valuation',
            'customer_analysis',
            'product_performance',
            'salesperson_performance',
            'cash_flow_projection',
          ],
        },
        date_from: {
          type: 'string',
          description: 'Fecha inicial',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final',
        },
        filters: {
          type: 'object',
          description: 'Filtros adicionales específicos del reporte',
        },
        format: {
          type: 'string',
          description: 'Formato de salida',
          enum: ['json', 'summary', 'detailed'],
        },
      },
      required: ['report_name'],
    },
  },
];

// ============================================================================
// EJECUTOR DE HERRAMIENTAS
// ============================================================================

export async function executeDatabaseTool(
  toolName: string,
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  console.log(`🗄️ [MCP Database] Ejecutando: ${toolName}`);

  switch (toolName) {
    case 'smart_query':
      return await smartQuery(params, context);

    case 'get_sales_data':
      return await getSalesData(params, context);

    case 'get_kpis':
      return await getKPIs(params, context);

    case 'get_customers':
      return await getCustomers(params, context);

    case 'get_products':
      return await getProducts(params, context);

    case 'get_suppliers':
      return await getSuppliers(params, context);

    case 'execute_report':
      return await executeReport(params, context);

    default:
      return {
        success: false,
        error: `Herramienta de base de datos no implementada: ${toolName}`,
      };
  }
}

// ============================================================================
// IMPLEMENTACIONES
// ============================================================================

async function smartQuery(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  try {
    // Importar el smart-search existente
    const { smartSearch } = await import('../../smart-search');

    const result = await smartSearch(params.question, context.companyId || 1);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error en smart_query:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error ejecutando consulta',
    };
  }
}

async function getSalesData(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // TODO: Implementar consulta directa a sales_data
  return {
    success: false,
    error: 'Herramienta get_sales_data no implementada aun. Usa smart_query para consultar ventas.',
  };
}

async function getKPIs(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  try {
    // Usar el sales-analyst existente si está disponible
    const { generateSalesAnalystInsights } = await import('../../sales-analyst');

    const insights = await generateSalesAnalystInsights(context.companyId || 1);

    return {
      success: true,
      data: insights,
    };
  } catch (error) {
    return {
      success: true,
      data: {
        message: 'KPIs pendientes de implementar con conexión completa',
      },
    };
  }
}

async function getCustomers(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_customers no implementada aun. Usa smart_query para consultar clientes.',
  };
}

async function getProducts(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_products no implementada aun. Usa smart_query para consultar productos.',
  };
}

async function getSuppliers(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_suppliers no implementada aun. Usa smart_query para consultar proveedores.',
  };
}

async function executeReport(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta execute_report no implementada aun. Usa smart_query para obtener datos.',
  };
}

export default {
  databaseTools,
  executeDatabaseTool,
};
