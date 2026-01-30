/**
 * ============================================================================
 * 💰 MCP TREASURY - Herramientas de Gestión de Tesorería
 * ============================================================================
 *
 * Este módulo expone herramientas para:
 * - Gestionar cuentas bancarias y saldos
 * - Programar y ejecutar pagos
 * - Analizar flujo de caja
 * - Proyectar necesidades de liquidez
 * - Gestionar tipos de cambio
 * - Conciliar movimientos bancarios
 *
 * Integraciones:
 * - Bancos mexicanos (SPEI, transferencias)
 * - Tipos de cambio (Banxico, XE)
 * - Cuentas por pagar/cobrar
 *
 * @module mcp/tools/treasury
 */

import type { MCPTool, MCPToolResult, MCPContext } from '../index';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// ============================================================================
// DEFINICIÓN DE HERRAMIENTAS
// ============================================================================

export const treasuryTools: MCPTool[] = [
  // -------------------------------------------------------------------------
  // GET_ACCOUNTS - Obtener cuentas bancarias
  // -------------------------------------------------------------------------
  {
    name: 'get_accounts',
    description: `Obtiene la lista de cuentas bancarias con sus saldos actuales.

    Información por cuenta:
    - Banco y número de cuenta (enmascarado)
    - Alias/nombre de la cuenta
    - Moneda (MXN, USD, EUR)
    - Saldo disponible
    - Saldo retenido
    - Última actualización
    - Estado (activa, inactiva)

    Puede filtrar por banco, moneda o estado.`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        bank: {
          type: 'string',
          description: 'Filtrar por banco',
          enum: ['banamex', 'bbva', 'santander', 'hsbc', 'scotiabank', 'banorte', 'all'],
        },
        currency: {
          type: 'string',
          description: 'Filtrar por moneda',
          enum: ['MXN', 'USD', 'EUR', 'all'],
        },
        status: {
          type: 'string',
          description: 'Estado de la cuenta',
          enum: ['active', 'inactive', 'all'],
        },
        include_balance_history: {
          type: 'boolean',
          description: 'Incluir historial de saldos últimos 30 días',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_CASH_FLOW - Flujo de caja
  // -------------------------------------------------------------------------
  {
    name: 'get_cash_flow',
    description: `Obtiene el análisis de flujo de caja.

    Incluye:
    - Ingresos proyectados (cuentas por cobrar)
    - Egresos proyectados (cuentas por pagar)
    - Saldo inicial y proyectado
    - Flujo neto por período
    - Alertas de liquidez
    - Comparativo vs período anterior

    Períodos disponibles: diario, semanal, mensual, trimestral`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Período de análisis',
          enum: ['daily', 'weekly', 'monthly', 'quarterly'],
        },
        date_from: {
          type: 'string',
          description: 'Fecha inicial (YYYY-MM-DD)',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final (YYYY-MM-DD)',
        },
        include_pending: {
          type: 'boolean',
          description: 'Incluir transacciones pendientes de confirmar',
        },
        group_by: {
          type: 'string',
          description: 'Agrupar por',
          enum: ['category', 'supplier', 'account', 'none'],
        },
        currency: {
          type: 'string',
          description: 'Moneda para el reporte',
          enum: ['MXN', 'USD'],
        },
      },
      required: ['period'],
    },
  },

  // -------------------------------------------------------------------------
  // SCHEDULE_PAYMENT - Programar pago
  // -------------------------------------------------------------------------
  {
    name: 'schedule_payment',
    description: `Programa un pago para una fecha específica.

    Tipos de pago:
    - SPEI (transferencia inmediata)
    - Transferencia programada
    - Cheque
    - Pago a proveedores

    Requiere:
    - Cuenta origen
    - Beneficiario (cuenta CLABE o datos)
    - Monto y moneda
    - Fecha de ejecución
    - Concepto/referencia

    Retorna ID de programación para seguimiento.`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        source_account_id: {
          type: 'number',
          description: 'ID de la cuenta origen',
        },
        beneficiary_clabe: {
          type: 'string',
          description: 'CLABE del beneficiario (18 dígitos)',
        },
        beneficiary_name: {
          type: 'string',
          description: 'Nombre del beneficiario',
        },
        beneficiary_rfc: {
          type: 'string',
          description: 'RFC del beneficiario',
        },
        beneficiary_bank: {
          type: 'string',
          description: 'Banco del beneficiario',
        },
        amount: {
          type: 'number',
          description: 'Monto a pagar',
        },
        currency: {
          type: 'string',
          description: 'Moneda',
          enum: ['MXN', 'USD'],
        },
        scheduled_date: {
          type: 'string',
          description: 'Fecha de ejecución (YYYY-MM-DD)',
        },
        payment_type: {
          type: 'string',
          description: 'Tipo de pago',
          enum: ['spei', 'transfer', 'check'],
        },
        reference: {
          type: 'string',
          description: 'Referencia/concepto del pago',
        },
        invoice_id: {
          type: 'number',
          description: 'ID de factura asociada (opcional)',
        },
        notify_beneficiary: {
          type: 'boolean',
          description: 'Enviar notificación al beneficiario',
        },
      },
      required: ['source_account_id', 'beneficiary_clabe', 'amount', 'scheduled_date'],
    },
  },

  // -------------------------------------------------------------------------
  // GET_PENDING_PAYMENTS - Pagos pendientes
  // -------------------------------------------------------------------------
  {
    name: 'get_pending_payments',
    description: `Obtiene la lista de pagos pendientes.

    Incluye:
    - Pagos programados
    - Facturas por pagar
    - Servicios recurrentes
    - Pagos vencidos

    Filtros por: fecha, proveedor, monto, prioridad`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          description: 'Fecha inicial',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final',
        },
        status: {
          type: 'string',
          description: 'Estado',
          enum: ['scheduled', 'overdue', 'pending_approval', 'all'],
        },
        priority: {
          type: 'string',
          description: 'Prioridad',
          enum: ['high', 'medium', 'low', 'all'],
        },
        supplier_id: {
          type: 'number',
          description: 'Filtrar por proveedor',
        },
        min_amount: {
          type: 'number',
          description: 'Monto mínimo',
        },
        order_by: {
          type: 'string',
          description: 'Ordenar por',
          enum: ['due_date', 'amount', 'supplier', 'priority'],
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_EXCHANGE_RATE - Tipo de cambio
  // -------------------------------------------------------------------------
  {
    name: 'get_exchange_rate',
    description: `Obtiene tipos de cambio actuales o históricos.

    Fuentes:
    - Banxico (oficial)
    - DOF (Diario Oficial de la Federación)
    - Mercado (compra/venta bancario)

    Pares disponibles: USD/MXN, EUR/MXN, EUR/USD`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        from_currency: {
          type: 'string',
          description: 'Moneda origen',
          enum: ['USD', 'EUR', 'MXN'],
        },
        to_currency: {
          type: 'string',
          description: 'Moneda destino',
          enum: ['USD', 'EUR', 'MXN'],
        },
        date: {
          type: 'string',
          description: 'Fecha específica (YYYY-MM-DD) o "today"',
        },
        source: {
          type: 'string',
          description: 'Fuente del tipo de cambio',
          enum: ['banxico', 'dof', 'market', 'all'],
        },
        include_history: {
          type: 'boolean',
          description: 'Incluir últimos 30 días',
        },
      },
      required: ['from_currency', 'to_currency'],
    },
  },

  // -------------------------------------------------------------------------
  // CONVERT_CURRENCY - Convertir moneda
  // -------------------------------------------------------------------------
  {
    name: 'convert_currency',
    description: `Convierte un monto entre monedas usando tipo de cambio actual.

    Usa el tipo de cambio de Banxico por defecto.
    Puede especificar tipo de cambio manual.`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Monto a convertir',
        },
        from_currency: {
          type: 'string',
          description: 'Moneda origen',
          enum: ['USD', 'EUR', 'MXN'],
        },
        to_currency: {
          type: 'string',
          description: 'Moneda destino',
          enum: ['USD', 'EUR', 'MXN'],
        },
        exchange_rate: {
          type: 'number',
          description: 'Tipo de cambio manual (opcional)',
        },
        date: {
          type: 'string',
          description: 'Fecha del tipo de cambio (YYYY-MM-DD)',
        },
      },
      required: ['amount', 'from_currency', 'to_currency'],
    },
  },

  // -------------------------------------------------------------------------
  // GET_RECEIVABLES - Cuentas por cobrar
  // -------------------------------------------------------------------------
  {
    name: 'get_receivables',
    description: `Obtiene las cuentas por cobrar.

    Incluye:
    - Facturas emitidas pendientes de cobro
    - Antigüedad de saldos
    - Clientes con mayor adeudo
    - Proyección de cobranza

    Filtros: cliente, antigüedad, monto`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'Filtrar por cliente',
        },
        aging: {
          type: 'string',
          description: 'Antigüedad',
          enum: ['current', '1-30', '31-60', '61-90', '90+', 'all'],
        },
        min_amount: {
          type: 'number',
          description: 'Monto mínimo',
        },
        include_projections: {
          type: 'boolean',
          description: 'Incluir proyecciones de cobro',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // GET_PAYABLES - Cuentas por pagar
  // -------------------------------------------------------------------------
  {
    name: 'get_payables',
    description: `Obtiene las cuentas por pagar.

    Incluye:
    - Facturas recibidas pendientes de pago
    - Antigüedad de saldos
    - Proveedores prioritarios
    - Calendario de vencimientos

    Filtros: proveedor, antigüedad, monto, prioridad`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_id: {
          type: 'number',
          description: 'Filtrar por proveedor',
        },
        aging: {
          type: 'string',
          description: 'Antigüedad',
          enum: ['current', '1-30', '31-60', '61-90', '90+', 'all'],
        },
        priority: {
          type: 'string',
          description: 'Prioridad',
          enum: ['critical', 'high', 'medium', 'low', 'all'],
        },
        due_date_from: {
          type: 'string',
          description: 'Vencimiento desde',
        },
        due_date_to: {
          type: 'string',
          description: 'Vencimiento hasta',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // CANCEL_PAYMENT - Cancelar pago programado
  // -------------------------------------------------------------------------
  {
    name: 'cancel_payment',
    description: `Cancela un pago programado que aún no se ha ejecutado.

    Solo puede cancelar pagos en estado 'scheduled' o 'pending_approval'.
    Requiere confirmación para montos mayores a $50,000.`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        payment_id: {
          type: 'number',
          description: 'ID del pago a cancelar',
        },
        reason: {
          type: 'string',
          description: 'Motivo de la cancelación',
        },
        confirm: {
          type: 'boolean',
          description: 'Confirmar cancelación (requerido para montos > $50,000)',
        },
      },
      required: ['payment_id', 'reason'],
    },
  },

  // -------------------------------------------------------------------------
  // GET_BANK_MOVEMENTS - Movimientos bancarios
  // -------------------------------------------------------------------------
  {
    name: 'get_bank_movements',
    description: `Obtiene movimientos bancarios de una cuenta.

    Incluye:
    - Depósitos y retiros
    - Transferencias
    - Comisiones
    - Intereses

    Filtros: fecha, tipo, monto, referencia`,
    category: 'treasury',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'number',
          description: 'ID de la cuenta',
        },
        date_from: {
          type: 'string',
          description: 'Fecha inicial',
        },
        date_to: {
          type: 'string',
          description: 'Fecha final',
        },
        type: {
          type: 'string',
          description: 'Tipo de movimiento',
          enum: ['deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'all'],
        },
        min_amount: {
          type: 'number',
          description: 'Monto mínimo',
        },
        reference: {
          type: 'string',
          description: 'Buscar en referencia',
        },
        reconciled: {
          type: 'boolean',
          description: 'Solo conciliados/no conciliados',
        },
      },
      required: ['account_id'],
    },
  },
];

// ============================================================================
// EJECUTOR DE HERRAMIENTAS
// ============================================================================

export async function executeTreasuryTool(
  toolName: string,
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  console.log(`💰 [MCP Treasury] Ejecutando: ${toolName}`);

  switch (toolName) {
    case 'get_accounts':
      return await getAccounts(params, context);

    case 'get_cash_flow':
      return await getCashFlow(params, context);

    case 'schedule_payment':
      return await schedulePayment(params, context);

    case 'get_pending_payments':
      return await getPendingPayments(params, context);

    case 'get_exchange_rate':
      return await getExchangeRate(params);

    case 'convert_currency':
      return await convertCurrency(params);

    case 'get_receivables':
      return await getReceivables(params, context);

    case 'get_payables':
      return await getPayables(params, context);

    case 'cancel_payment':
      return await cancelPayment(params, context);

    case 'get_bank_movements':
      return await getBankMovements(params, context);

    default:
      return {
        success: false,
        error: `Herramienta de tesorería no implementada: ${toolName}`,
      };
  }
}

// ============================================================================
// IMPLEMENTACIONES
// ============================================================================

async function getAccounts(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // TODO: Conectar con base de datos
  return {
    success: false,
    error: 'Herramienta get_accounts no implementada aun. Usa smart_query para consultar cuentas bancarias.',
  };
}

async function getCashFlow(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_cash_flow no implementada aun. Usa smart_query para consultar flujo de caja.',
  };
}

async function schedulePayment(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // Validación básica
  if (!params.amount || params.amount <= 0) {
    return { success: false, error: 'Monto inválido' };
  }

  if (!params.beneficiary_clabe || params.beneficiary_clabe.length !== 18) {
    return { success: false, error: 'CLABE debe tener 18 dígitos' };
  }

  // TODO: Implementar programación real
  return {
    success: true,
    data: {
      payment_id: Date.now(),
      status: 'scheduled',
      message: 'Pago programado (simulación)',
      details: params,
    },
  };
}

async function getPendingPayments(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_pending_payments no implementada aun. Usa smart_query para consultar pagos pendientes.',
  };
}

async function getExchangeRate(params: Record<string, any>): Promise<MCPToolResult> {
  const { from_currency, to_currency, date, source } = params;

  // Only USD/MXN pair is stored in DB (exchange_rates table)
  const isUsdMxn = (from_currency === 'USD' && to_currency === 'MXN') ||
                   (from_currency === 'MXN' && to_currency === 'USD');

  if (isUsdMxn) {
    try {
      // Query the latest exchange rate from DB
      let query = `SELECT buy_rate, sell_rate, date, source FROM exchange_rates`;
      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (source && source !== 'all') {
        queryParams.push(source.toUpperCase());
        conditions.push(`UPPER(source) = $${queryParams.length}`);
      }

      if (date && date !== 'today') {
        queryParams.push(date);
        conditions.push(`date = $${queryParams.length}`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY date DESC LIMIT 1`;

      const rows = await sql(query, queryParams);

      if (rows.length > 0) {
        const row = rows[0];
        const rate = from_currency === 'USD'
          ? parseFloat(row.sell_rate || row.buy_rate)
          : 1 / parseFloat(row.buy_rate || row.sell_rate);

        return {
          success: true,
          data: {
            from: from_currency,
            to: to_currency,
            rate: Math.round(rate * 10000) / 10000,
            buy_rate: parseFloat(row.buy_rate),
            sell_rate: parseFloat(row.sell_rate),
            date: row.date,
            source: row.source,
          },
        };
      }
    } catch (error) {
      console.warn('[MCP Treasury] Error querying exchange_rates, falling back to hardcoded:', error);
    }
  }

  // Fallback: hardcoded approximate rates
  const fallbackRates: Record<string, number> = {
    'USD_MXN': 17.15,
    'EUR_MXN': 18.50,
    'EUR_USD': 1.08,
  };

  const key = `${from_currency}_${to_currency}`;
  const reverseKey = `${to_currency}_${from_currency}`;

  let rate = fallbackRates[key];
  if (!rate && fallbackRates[reverseKey]) {
    rate = 1 / fallbackRates[reverseKey];
  }

  if (!rate) {
    return { success: false, error: `Par de divisas no soportado: ${key}` };
  }

  return {
    success: true,
    data: {
      from: from_currency,
      to: to_currency,
      rate,
      date: new Date().toISOString().split('T')[0],
      source: 'fallback',
      note: 'Tipo de cambio aproximado (no se encontraron datos recientes en la BD).',
    },
  };
}

async function convertCurrency(params: Record<string, any>): Promise<MCPToolResult> {
  const { amount, from_currency, to_currency, exchange_rate } = params;

  let rate = exchange_rate;

  if (!rate) {
    const rateResult = await getExchangeRate({ from_currency, to_currency });
    if (!rateResult.success) {
      return rateResult;
    }
    rate = rateResult.data.rate;
  }

  const converted = amount * rate;

  return {
    success: true,
    data: {
      original_amount: amount,
      original_currency: from_currency,
      converted_amount: Math.round(converted * 100) / 100,
      target_currency: to_currency,
      exchange_rate: rate,
      date: new Date().toISOString().split('T')[0],
    },
  };
}

async function getReceivables(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_receivables no implementada aun. Usa smart_query para consultar cuentas por cobrar.',
  };
}

async function getPayables(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_payables no implementada aun. Usa smart_query para consultar cuentas por pagar.',
  };
}

async function cancelPayment(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  const { payment_id, reason, confirm } = params;

  // TODO: Implementar cancelación real
  return {
    success: true,
    data: {
      payment_id,
      status: 'cancelled',
      reason,
      message: 'Pago cancelado (simulación)',
    },
  };
}

async function getBankMovements(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  return {
    success: false,
    error: 'Herramienta get_bank_movements no implementada aun. Usa smart_query para consultar movimientos bancarios.',
  };
}

export default {
  treasuryTools,
  executeTreasuryTool,
};
