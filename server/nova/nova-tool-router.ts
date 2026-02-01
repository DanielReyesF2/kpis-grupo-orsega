/**
 * Nova Tool Router — Intelligent tool selection per request
 *
 * Instead of sending all 40 tools to Claude on every request,
 * selects 10-15 relevant tools based on:
 * 1. CORE tools (always present)
 * 2. Page context (current page the user is on)
 * 3. Keyword triggers (message content)
 */

import Anthropic from '@anthropic-ai/sdk';
import { findToolsByNames } from '../mcp/index';
import type { MCPTool } from '../mcp/index';

// ============================================================================
// CORE TOOLS — always included (5)
// ============================================================================

const CORE_TOOLS: string[] = [
  'smart_query',
  'get_kpis',
  'analyze_data',
  'get_exchange_rate',
  'convert_currency',
];

// ============================================================================
// PAGE CONTEXT → additional tools
// ============================================================================

const PAGE_CONTEXT_TOOLS: Record<string, string[]> = {
  dashboard: [
    'get_sales_data',
    'get_executive_summary',
    'get_cash_flow',
    'get_accounts',
    'generate_chart',
  ],
  sales: [
    'get_sales_data',
    'get_customers',
    'get_products',
    'process_sales_excel',
    'execute_report',
    'generate_excel_export',
  ],
  treasury: [
    'get_accounts',
    'get_cash_flow',
    'get_pending_payments',
    'get_receivables',
    'get_payables',
    'schedule_payment',
    'cancel_payment',
    'get_bank_movements',
  ],
  logistics: [
    'get_suppliers',
    'get_products',
    'execute_report',
  ],
  'trends-analysis': [
    'get_sales_data',
    'generate_chart',
    'execute_report',
    'get_executive_summary',
  ],
  'kpi-control': [
    'get_sales_data',
    'execute_report',
    'generate_chart',
    'get_executive_summary',
  ],
};

const DEFAULT_CONTEXT_TOOLS: string[] = [
  'get_sales_data',
  'get_executive_summary',
  'get_customers',
  'get_products',
  'execute_report',
];

// ============================================================================
// KEYWORD TRIGGERS — additive tools based on message content
// ============================================================================

const KEYWORD_TRIGGERS: Array<{ pattern: RegExp; tools: string[] }> = [
  {
    pattern: /factura|cfdi|xml|rfc/i,
    tools: ['process_invoice', 'validate_rfc', 'validate_cfdi', 'search_invoices', 'get_invoice_details'],
  },
  {
    pattern: /excel|subir|upload/i,
    tools: ['generate_excel_export', 'process_sales_excel'],
  },
  {
    pattern: /pdf|reporte/i,
    tools: ['generate_pdf_report'],
  },
  {
    pattern: /email|correo/i,
    tools: ['send_email'],
  },
  {
    pattern: /whatsapp/i,
    tools: ['send_whatsapp'],
  },
  {
    pattern: /alerta|recordatorio/i,
    tools: ['create_alert', 'create_reminder'],
  },
  {
    pattern: /embarque|tracking/i,
    tools: ['get_suppliers'],
  },
  {
    pattern: /pago|transferencia|spei/i,
    tools: ['schedule_payment', 'get_pending_payments', 'cancel_payment'],
  },
  {
    pattern: /cobrar|cobranza/i,
    tools: ['get_receivables'],
  },
  {
    pattern: /gr[aá]fica|chart/i,
    tools: ['generate_chart'],
  },
];

// ============================================================================
// ROUTER
// ============================================================================

/**
 * Selects relevant tools for a given page context and user message.
 * Returns Anthropic-formatted tool definitions.
 */
export function getToolsForContext(
  pageContext: string | undefined,
  message: string,
): Anthropic.Tool[] {
  const toolNames = new Set<string>(CORE_TOOLS);

  // Add page-context tools
  const contextTools = (pageContext && PAGE_CONTEXT_TOOLS[pageContext])
    ? PAGE_CONTEXT_TOOLS[pageContext]
    : DEFAULT_CONTEXT_TOOLS;

  for (const name of contextTools) {
    toolNames.add(name);
  }

  // Add keyword-triggered tools
  for (const trigger of KEYWORD_TRIGGERS) {
    if (trigger.pattern.test(message)) {
      for (const name of trigger.tools) {
        toolNames.add(name);
      }
    }
  }

  // Resolve from registry and convert to Anthropic format
  const mcpTools = findToolsByNames(Array.from(toolNames));

  return mcpTools.map((tool: MCPTool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));
}
