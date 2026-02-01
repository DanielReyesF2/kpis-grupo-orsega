/**
 * Nova Agent — Core AI Engine
 *
 * Reemplaza @econova/agent usando @anthropic-ai/sdk directamente,
 * conectado a los 39 MCP tools de server/mcp/.
 *
 * Implementa un agentic loop: mensaje → tool_use → executeTool → tool_result → repite.
 */

import Anthropic from '@anthropic-ai/sdk';
import { executeTool } from '../mcp/index';
import type { MCPToolResult } from '../mcp/index';
import { buildNovaSystemPrompt } from './nova-system-prompt';
import { getToolsForContext } from './nova-tool-router';

// ============================================================================
// TYPES
// ============================================================================

export interface NovaContext {
  userId?: string;
  companyId?: number;
  conversationHistory?: NovaConversationMessage[];
  pageContext?: string;
  /** Additional context (e.g. parsed file data) injected into the user message */
  additionalContext?: string;
  /** Base64-encoded image blocks for Claude multimodal vision */
  imageBlocks?: Array<{
    type: 'image';
    source: { type: 'base64'; media_type: string; data: string };
  }>;
}

export interface NovaConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NovaResponse {
  answer: string;
  toolsUsed: string[];
  source: string;
  data?: unknown;
}

export interface NovaStreamCallbacks {
  onToken: (token: string) => void;
  onToolStart: (toolName: string) => void;
  onToolResult: (toolName: string, success: boolean) => void;
  onDone: (response: NovaResponse) => void;
  onError: (error: Error) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

const MAX_ITERATIONS = 8;
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;
const TOOL_TIMEOUT_MS = 30_000;

/**
 * Execute a tool with a timeout to prevent hanging.
 */
async function executeToolWithTimeout(
  toolName: string,
  toolInput: Record<string, any>,
  mcpContext: { userId?: string; companyId?: number }
): Promise<MCPToolResult> {
  return Promise.race([
    executeTool(toolName, toolInput, mcpContext),
    new Promise<MCPToolResult>((_, reject) =>
      setTimeout(() => reject(new Error(`Herramienta ${toolName} excedio el tiempo limite (${TOOL_TIMEOUT_MS / 1000}s)`)), TOOL_TIMEOUT_MS)
    ),
  ]);
}

// Singleton Anthropic client — reuses HTTP connections across calls
const anthropicClient = new Anthropic();

/**
 * Build the messages array for the Anthropic API from conversation history.
 */
function buildMessages(
  question: string,
  ctx: NovaContext
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history (limit to last 10 messages)
  if (ctx.conversationHistory?.length) {
    const history = ctx.conversationHistory.slice(-10);
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Build user message with optional additional context and images
  let userText = question;
  if (ctx.additionalContext) {
    userText = `${question}\n\n--- Datos adjuntos ---\n${ctx.additionalContext}`;
  }

  // If we have image blocks, build a multimodal content array
  if (ctx.imageBlocks && ctx.imageBlocks.length > 0) {
    const contentBlocks: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: userText },
      ...ctx.imageBlocks.map((img) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.source.media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: img.source.data,
        },
      })),
    ];
    messages.push({ role: 'user', content: contentBlocks });
  } else {
    messages.push({ role: 'user', content: userText });
  }

  return messages;
}

// ============================================================================
// CORE: novaChat — Non-streaming agentic loop
// ============================================================================

/**
 * Runs the full agentic loop (non-streaming).
 * Sends the question to Claude, handles tool_use blocks, feeds tool_results back,
 * and repeats until Claude produces a final text response or max iterations hit.
 */
export async function novaChat(
  question: string,
  ctx: NovaContext = {}
): Promise<NovaResponse> {
  const tools = getToolsForContext(ctx.pageContext, question);
  console.log(`[Nova] Tools selected: ${tools.length} (page: ${ctx.pageContext})`);
  const systemPrompt = buildNovaSystemPrompt({
    userId: ctx.userId,
    companyId: ctx.companyId,
    pageContext: ctx.pageContext,
  });

  const messages = buildMessages(question, ctx);
  const toolsUsed: string[] = [];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[Nova] Iteration ${iteration + 1}/${MAX_ITERATIONS}`);

      const response = await anthropicClient.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages,
      });

      // Check if there are any tool_use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ContentBlock & { type: 'tool_use' } =>
          block.type === 'tool_use'
      );

      // If stop reason is "end_turn" or no tool_use, extract final text
      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        const answer = textBlocks.map((b) => b.text).join('\n');

        return {
          answer: answer || 'No pude generar una respuesta.',
          toolsUsed,
          source: 'nova-agent',
        };
      }

      // We have tool_use blocks — add assistant message and execute tools
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const toolName = toolBlock.name;
        const toolInput = toolBlock.input as Record<string, any>;
        toolsUsed.push(toolName);

        console.log(`[Nova] [MCP] Ejecutando herramienta: ${toolName}`);

        try {
          const result: MCPToolResult = await executeToolWithTimeout(toolName, toolInput, {
            userId: ctx.userId,
            companyId: ctx.companyId,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result.success ? result.data : { error: result.error }),
            is_error: !result.success,
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Error desconocido';
          console.error(`[Nova] Error ejecutando ${toolName}:`, errMsg);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ error: errMsg }),
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    // Max iterations reached
    console.warn('[Nova] Max iterations reached');
    return {
      answer: 'He alcanzado el limite de procesamiento. Por favor intenta una pregunta mas especifica.',
      toolsUsed,
      source: 'nova-agent',
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Error desconocido en Nova');
    console.error('[Nova] API error:', err.message);
    return {
      answer: 'Ocurrio un error al procesar tu solicitud. Por favor intenta de nuevo.',
      toolsUsed,
      source: 'nova-agent',
    };
  }
}

// ============================================================================
// CORE: novaChatStream — Streaming agentic loop
// ============================================================================

/**
 * Runs the agentic loop with streaming.
 * Emits tokens as they arrive, tool start/result events,
 * and a final done event with the complete answer.
 *
 * @param abortSignal — optional AbortSignal to cancel on client disconnect
 */
export async function novaChatStream(
  question: string,
  ctx: NovaContext = {},
  callbacks: NovaStreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  const tools = getToolsForContext(ctx.pageContext, question);
  console.log(`[Nova Stream] Tools selected: ${tools.length} (page: ${ctx.pageContext})`);
  const systemPrompt = buildNovaSystemPrompt({
    userId: ctx.userId,
    companyId: ctx.companyId,
    pageContext: ctx.pageContext,
  });

  const messages = buildMessages(question, ctx);
  const toolsUsed: string[] = [];
  let fullAnswer = '';

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Check abort before each iteration
      if (abortSignal?.aborted) {
        console.log('[Nova Stream] Aborted by client');
        return;
      }

      console.log(`[Nova Stream] Iteration ${iteration + 1}/${MAX_ITERATIONS}`);

      const stream = anthropicClient.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages,
      });

      stream.on('text', (text) => {
        if (!abortSignal?.aborted) {
          fullAnswer += text;
          callbacks.onToken(text);
        }
      });

      // Wait for the complete message
      const finalMessage = await stream.finalMessage();

      // Check abort after stream completes
      if (abortSignal?.aborted) {
        console.log('[Nova Stream] Aborted by client after stream');
        return;
      }

      // Check for tool_use blocks
      const toolUseBlocks = finalMessage.content.filter(
        (block): block is Anthropic.ContentBlock & { type: 'tool_use' } =>
          block.type === 'tool_use'
      );

      // If no tool calls, we're done
      if (finalMessage.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        callbacks.onDone({
          answer: fullAnswer || 'No pude generar una respuesta.',
          toolsUsed,
          source: 'nova-agent',
        });
        return;
      }

      // Execute tools
      messages.push({ role: 'assistant', content: finalMessage.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        if (abortSignal?.aborted) {
          console.log('[Nova Stream] Aborted during tool execution');
          return;
        }

        const toolName = toolBlock.name;
        const toolInput = toolBlock.input as Record<string, any>;
        toolsUsed.push(toolName);

        callbacks.onToolStart(toolName);
        console.log(`[Nova Stream] [MCP] Ejecutando herramienta: ${toolName}`);

        try {
          const result: MCPToolResult = await executeToolWithTimeout(toolName, toolInput, {
            userId: ctx.userId,
            companyId: ctx.companyId,
          });

          callbacks.onToolResult(toolName, result.success);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result.success ? result.data : { error: result.error }),
            is_error: !result.success,
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Error desconocido';
          console.error(`[Nova Stream] Error ejecutando ${toolName}:`, errMsg);
          callbacks.onToolResult(toolName, false);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ error: errMsg }),
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    // Max iterations reached
    callbacks.onDone({
      answer: fullAnswer || 'He alcanzado el limite de procesamiento.',
      toolsUsed,
      source: 'nova-agent',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Error desconocido en Nova');
    console.error('[Nova Stream] Error:', err.message);
    callbacks.onError(err);
  }
}
