import Anthropic from '@anthropic-ai/sdk';

/**
 * @econova/agent - Core Types
 *
 * Types and interfaces for configuring multi-tenant AI agents.
 */
/**
 * Available tools that can be enabled for a tenant
 */
type ToolName = 'query_database' | 'get_exchange_rate' | 'get_business_summary';
/**
 * Configuration for a tenant's AI agent instance
 */
interface TenantConfig {
    /** Unique identifier for this tenant */
    tenantId: string;
    /** Display name for the tenant (used in prompts) */
    tenantName: string;
    /**
     * Function to execute SQL queries against the tenant's database.
     * The agent will call this with validated SELECT queries.
     * The tenant is responsible for providing their own database connection.
     */
    executeQuery: (sql: string) => Promise<unknown[]>;
    /**
     * Database schema description in markdown format.
     * This is included in the system prompt to help Claude understand
     * what data is available. Keep it concise to minimize tokens.
     *
     * Example:
     * ```
     * ## sales_data
     * - client_name: TEXT
     * - quantity: NUMERIC
     * - sale_date: DATE
     * ```
     */
    databaseSchema: string;
    /**
     * Additional text to append to the system prompt.
     * Use this for tenant-specific instructions, context, or constraints.
     */
    systemPromptAdditions?: string;
    /**
     * Which tools to enable for this tenant.
     * Defaults to all tools if not specified.
     */
    enabledTools?: ToolName[];
    /** Maximum tokens per response. Default: 4096 */
    maxTokensPerRequest?: number;
    /** Maximum conversation history to include. Default: 10 */
    maxConversationHistory?: number;
    /** Maximum tool call iterations per request. Default: 5 */
    maxIterations?: number;
    /** Claude model to use. Default: 'claude-sonnet-4-20250514' */
    model?: string;
    /**
     * Callback for tracking usage (tokens, cost).
     * Called after each successful request.
     */
    onUsage?: (usage: UsageData) => void | Promise<void>;
}
/**
 * Conversation message in history
 */
interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}
/**
 * Context passed with each chat request
 */
interface AgentContext {
    /** ID of the user making the request */
    userId?: string;
    /** Company/organization ID within the tenant (for multi-company tenants) */
    companyId?: number;
    /** Previous messages for conversation continuity */
    conversationHistory?: ConversationMessage[];
}
/**
 * Result returned from the agent
 */
interface SearchResult {
    /** The text response from the AI */
    answer: string;
    /** Raw data from tool calls (if any) */
    data?: unknown;
    /** Source identifier */
    source?: string;
    /** SQL query executed (if query_database was used) */
    query?: string;
}
/**
 * Usage data for tracking/billing
 */
interface UsageData {
    tenantId: string;
    userId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
    toolsUsed: string[];
    timestamp: Date;
}
/**
 * Stats collected by the agent
 */
interface UsageStats {
    totalRequests: number;
    totalTokens: number;
    totalCostUsd: number;
    toolUsage: Record<string, number>;
}
/**
 * The agent instance created by createEcoNovaAgent
 */
interface EcoNovaAgent {
    /**
     * Send a message to the AI and get a response
     */
    chat: (question: string, context?: AgentContext) => Promise<SearchResult>;
    /**
     * Get accumulated usage statistics
     */
    getUsageStats: () => UsageStats;
    /**
     * Reset usage statistics
     */
    resetStats: () => void;
    /**
     * Get the tenant configuration
     */
    getConfig: () => Readonly<TenantConfig>;
}
/**
 * Internal tool execution result
 */
interface ToolExecutionResult {
    success: boolean;
    result: unknown;
    error?: string;
}
/**
 * Tool input schemas (for type safety)
 */
interface QueryDatabaseInput {
    query: string;
    purpose: string;
}
interface GetExchangeRateInput {
}
interface GetBusinessSummaryInput {
    focus?: 'ventas' | 'kpis' | 'clientes' | 'general';
}

/**
 * EcoNova Agent
 *
 * Creates a configured AI agent instance for a tenant.
 * This is the main entry point for using the @econova/agent package.
 */

/**
 * Creates an EcoNova agent instance configured for a specific tenant.
 *
 * @param config - Tenant configuration
 * @returns An agent instance with chat and stats methods
 *
 * @example
 * ```typescript
 * import { createEcoNovaAgent } from '@econova/agent';
 * import { neon } from '@neondatabase/serverless';
 *
 * const sql = neon(process.env.DATABASE_URL);
 *
 * const agent = createEcoNovaAgent({
 *   tenantId: 'my-company',
 *   tenantName: 'My Company',
 *   executeQuery: async (query) => await sql(query),
 *   databaseSchema: `
 *     ## sales
 *     - client_name, amount, date
 *   `,
 * });
 *
 * const result = await agent.chat('Show me top clients');
 * console.log(result.answer);
 * ```
 */
declare function createEcoNovaAgent(config: TenantConfig): EcoNovaAgent;

/**
 * SQL Query Validation
 *
 * Ensures only safe SELECT queries are executed.
 * Prevents SQL injection and destructive operations.
 */
interface QueryValidationResult {
    valid: boolean;
    error?: string;
    normalizedQuery?: string;
}
/**
 * Validates that a query is safe to execute.
 *
 * Rules:
 * 1. Must start with SELECT
 * 2. Cannot contain forbidden keywords
 * 3. Cannot contain suspicious patterns
 * 4. Cannot contain multiple statements
 *
 * @param query - The SQL query to validate
 * @returns Validation result with error message if invalid
 */
declare function validateQuery(query: string): QueryValidationResult;
/**
 * Executes a query after validation.
 *
 * @param query - SQL query to execute
 * @param executeQuery - Function to execute the query against the database
 * @returns Query result or error
 */
declare function executeSafeQuery(query: string, executeQuery: (sql: string) => Promise<unknown[]>): Promise<{
    success: boolean;
    data?: unknown[];
    error?: string;
}>;

/**
 * Usage Tracking Utility
 *
 * Tracks token usage and costs for billing and analytics.
 */

/**
 * Calculate cost in USD for a given token usage
 */
declare function calculateCost(inputTokens: number, outputTokens: number, model: string): number;
/**
 * Creates a usage tracker instance for accumulating stats
 */
declare function createUsageTracker(): {
    /**
     * Record usage from a request
     */
    record(usage: UsageData): void;
    /**
     * Get current stats
     */
    getStats(): UsageStats;
    /**
     * Reset all stats
     */
    reset(): void;
};
/**
 * Create UsageData object from Anthropic API response
 */
declare function createUsageData(params: {
    tenantId: string;
    userId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    toolsUsed: string[];
}): UsageData;

/**
 * Prompt Builder
 *
 * Constructs dynamic system prompts based on tenant configuration.
 */

/**
 * Build the system prompt for Claude
 */
declare function buildSystemPrompt(config: TenantConfig, context?: AgentContext): string;
/**
 * Build a compact version of the prompt for token optimization
 */
declare function buildCompactPrompt(config: TenantConfig, context?: AgentContext): string;

/**
 * Tool Registry
 *
 * Manages tools available to the Claude agent.
 * Tools are dynamically enabled based on TenantConfig.
 */

/**
 * Get Claude tool definitions for a tenant
 */
declare function getToolDefinitions(config: TenantConfig): Anthropic.Tool[];
/**
 * Execute a tool by name
 */
declare function executeTool(toolName: string, toolInput: Record<string, unknown>, config: TenantConfig): Promise<ToolExecutionResult>;
/**
 * Check if a tool is enabled for a tenant
 */
declare function isToolEnabled(toolName: ToolName, config: TenantConfig): boolean;

export { type AgentContext, type ConversationMessage, type EcoNovaAgent, type GetBusinessSummaryInput, type GetExchangeRateInput, type QueryDatabaseInput, type SearchResult, type TenantConfig, type ToolExecutionResult, type ToolName, type UsageData, type UsageStats, buildCompactPrompt, buildSystemPrompt, calculateCost, createEcoNovaAgent, createUsageData, createUsageTracker, executeSafeQuery, executeTool, getToolDefinitions, isToolEnabled, validateQuery };
