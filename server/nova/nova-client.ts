/**
 * Nova AI Client — HTTP proxy client for communicating with Nova AI 2.0 service.
 *
 * Handles:
 * - SSE streaming chat via POST /chat (JSON with base64 file attachment)
 * - Non-streaming chat for auto-analysis
 * - Health check
 * - Feature flag via env vars (NOVA_AI_URL + NOVA_AI_API_KEY)
 *
 * Files are sent as base64-encoded JSON fields (file_data, file_name,
 * file_media_type) — the EcoNova Gateway accepts this and forwards to Brain.
 *
 * When NOVA_AI_URL is not set, isConfigured() returns false.
 */

// ============================================================================
// CONFIG
// ============================================================================

const STREAM_TIMEOUT_MS = 120_000; // 2 minutes max for streaming
const CHAT_TIMEOUT_MS = 120_000;   // 2 minutes for non-streaming
const HEALTH_TIMEOUT_MS = 5_000;   // 5 seconds for health check

function getBaseUrl(): string {
  return process.env.NOVA_AI_URL || '';
}

function getApiKey(): string {
  return process.env.NOVA_AI_API_KEY || '';
}

function getTenantId(): string {
  return process.env.NOVA_AI_TENANT_ID || 'grupo-orsega';
}

// ============================================================================
// TYPES
// ============================================================================

export interface NovaAIStreamCallbacks {
  onToken: (text: string) => void;
  onToolStart: (toolName: string) => void;
  onToolResult: (toolName: string, success: boolean) => void;
  onDone: (response: { answer: string; toolsUsed: string[]; source: string; conversationId?: string }) => void;
  onError: (error: Error) => void;
}

export interface NovaAIChatContext {
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  pageContext?: string;
  userId?: string;
  companyId?: number;
  additionalContext?: string;
  /** Mismo valor en toda la conversación; Nova lo usa para Redis e import_sales. */
  conversationId?: string;
}

interface NovaAIChatResponse {
  answer: string;
  toolsUsed: string[];
  source: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if Nova AI 2.0 is configured via environment variables.
 * When false, Nova AI features are unavailable.
 */
function isConfigured(): boolean {
  return !!(process.env.NOVA_AI_URL && process.env.NOVA_AI_API_KEY);
}

/**
 * Health check against Nova AI 2.0.
 * Returns true if the service is reachable and healthy.
 */
async function healthCheck(): Promise<boolean> {
  if (!isConfigured()) return false;

  try {
    const response = await fetch(`${getBaseUrl()}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send a streaming chat request to Nova AI 2.0.
 *
 * Always sends JSON. Files are base64-encoded in the payload as
 * file_data / file_name / file_media_type (one file per request).
 * Reads the SSE response stream and invokes callbacks for each event.
 */
async function streamChat(
  message: string,
  files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
  context: NovaAIChatContext,
  callbacks: NovaAIStreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  const tenantId = getTenantId();
  const url = `${baseUrl}/chat`;

  // Always send JSON — files are included as base64-encoded fields.
  // EcoNova Gateway accepts file_data/file_name/file_media_type in JSON
  // and forwards them to Brain as-is. This avoids multipart compatibility
  // issues between Node.js native FormData and Hono's parser.
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };

  const payload: Record<string, unknown> = {
    message,
    tenant_id: tenantId,
    conversation_history: context.conversationHistory,
    page_context: context.pageContext,
    user_id: context.userId,
    company_id: context.companyId !== undefined ? String(context.companyId) : undefined,
    additional_context: context.additionalContext,
  };
  if (context.conversationId) {
    payload.conversation_id = context.conversationId;
  }

  // Attach first file as base64 (EcoNova handles one file per request)
  if (files.length > 0) {
    const file = files[0];
    payload.file_data = file.buffer.toString('base64');
    payload.file_name = file.originalname;
    payload.file_media_type = file.mimetype;
  }

  const body = JSON.stringify(payload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: abortSignal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Nova AI ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Nova AI response has no body');
    }

    console.log(`[NovaClient] Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`);

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let tokenCount = 0;
    let gotDoneEvent = false;

    while (true) {
      if (abortSignal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      chunkCount++;
      // Log first 3 chunks and every 50th chunk to see actual EcoNova response format
      if (chunkCount <= 3 || chunkCount % 50 === 0) {
        console.log(`[NovaClient] Chunk #${chunkCount} (${chunk.length} bytes): ${chunk.substring(0, 300)}`);
      }

      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        // Handle \r\n line endings (Windows/HTTP style)
        const cleanLine = line.replace(/\r$/, '');
        
        if (cleanLine.startsWith('event: ')) {
          eventType = cleanLine.slice(7).trim();
        } else if (cleanLine.startsWith('data: ')) {
          const dataStr = cleanLine.slice(6).trim();
          try {
            const data = JSON.parse(dataStr);

            switch (eventType) {
              case 'token':
                tokenCount++;
                callbacks.onToken(data.text || '');
                break;
              case 'tool_start':
                console.log(`[NovaClient] Tool start: ${data.tool}`);
                callbacks.onToolStart(data.tool || '');
                break;
              case 'tool_result':
                console.log(`[NovaClient] Tool result: ${data.tool}, success: ${data.success}`);
                callbacks.onToolResult(data.tool || '', data.success ?? true);
                break;
              case 'done':
                gotDoneEvent = true;
                const conversationId = data.conversationId ?? data.conversation_id;
                console.log(`[NovaClient] Done event — answer length: ${(data.answer || '').length}, toolsUsed: ${JSON.stringify(data.toolsUsed || data.tools_used || [])}, conversationId: ${conversationId ?? '—'}`);
                callbacks.onDone({
                  answer: data.answer || '',
                  toolsUsed: data.toolsUsed || data.tools_used || [],
                  source: data.source || 'nova-ai-2.0',
                  conversationId: typeof conversationId === 'string' ? conversationId : undefined,
                });
                return; // Stream complete
              case 'error':
                console.error(`[NovaClient] Error event: ${data.message}`);
                callbacks.onError(new Error(data.message || 'Nova AI error'));
                return;
              default:
                // Log unrecognized events to debug format mismatches
                if (eventType) {
                  console.warn(`[NovaClient] Unrecognized event type: "${eventType}", data: ${dataStr.substring(0, 200)}`);
                }
            }

            eventType = '';
          } catch {
            // Log parse errors to debug
            console.warn(`[NovaClient] JSON parse failed for line: ${line.substring(0, 200)}`);
          }
        } else if (line.trim() && !line.startsWith(':')) {
          // Log non-empty lines that aren't SSE format (could be raw JSON response)
          if (chunkCount <= 5) {
            console.warn(`[NovaClient] Non-SSE line: ${line.substring(0, 300)}`);
          }
        }
      }
    }

    // Stream ended without a done event
    console.warn(`[NovaClient] Stream ended without done event. Chunks: ${chunkCount}, tokens: ${tokenCount}, remaining buffer: ${buffer.substring(0, 300)}`);
    callbacks.onDone({
      answer: '',
      toolsUsed: [],
      source: 'nova-ai-2.0',
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    const err = error instanceof Error ? error : new Error('Error conectando a Nova AI');
    console.error('[NovaClient] Stream error:', err.message);
    callbacks.onError(err);
  }
}

/**
 * Send a non-streaming chat request to Nova AI 2.0.
 * Used by auto-analysis (fire-and-forget background tasks).
 */
async function chat(
  message: string,
  context: NovaAIChatContext
): Promise<NovaAIChatResponse> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  const tenantId = getTenantId();
  const url = `${baseUrl}/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      message,
      tenant_id: tenantId,
      conversation_history: context.conversationHistory,
      page_context: context.pageContext,
      user_id: context.userId,
      company_id: context.companyId !== undefined ? String(context.companyId) : undefined,
      stream: false,
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`Nova AI ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    answer: data.answer || '',
    toolsUsed: data.toolsUsed || data.tools_used || [],
    source: data.source || 'nova-ai-2.0',
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export const novaAIClient = {
  isConfigured,
  healthCheck,
  streamChat,
  chat,
};
