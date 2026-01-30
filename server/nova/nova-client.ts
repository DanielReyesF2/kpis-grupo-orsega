/**
 * Nova AI Client — HTTP proxy client for communicating with Nova AI 2.0 service.
 *
 * Handles:
 * - SSE streaming chat via POST /chat (multipart/form-data or JSON)
 * - Non-streaming chat for auto-analysis
 * - Health check
 * - Feature flag via env vars (NOVA_AI_URL + NOVA_AI_API_KEY)
 *
 * When NOVA_AI_URL is not set, isConfigured() returns false and callers
 * fall back to the local nova-agent.ts implementation.
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
  onDone: (response: { answer: string; toolsUsed: string[]; source: string }) => void;
  onError: (error: Error) => void;
}

export interface NovaAIChatContext {
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  pageContext?: string;
  userId?: string;
  companyId?: number;
  additionalContext?: string;
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
 * When false, callers should use the local nova-agent.ts fallback.
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
 * Constructs a POST request (multipart if files present, JSON otherwise),
 * reads the SSE response stream, and invokes callbacks for each event.
 * The callback interface matches novaChatStream() for drop-in replacement.
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

  // Build request — use FormData when files are present, JSON otherwise
  let body: BodyInit;
  let headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'X-Tenant-ID': tenantId,
    'Accept': 'text/event-stream',
  };

  if (files.length > 0) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('tenant_id', tenantId);

    if (context.conversationHistory) {
      formData.append('conversation_history', JSON.stringify(context.conversationHistory));
    }
    if (context.pageContext) {
      formData.append('page_context', context.pageContext);
    }
    if (context.userId) {
      formData.append('user_id', context.userId);
    }
    if (context.companyId !== undefined) {
      formData.append('company_id', String(context.companyId));
    }
    if (context.additionalContext) {
      formData.append('additional_context', context.additionalContext);
    }

    for (const file of files) {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('files', blob, file.originalname);
    }

    body = formData;
    // Don't set Content-Type — fetch sets it with boundary for multipart
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      message,
      tenant_id: tenantId,
      conversation_history: context.conversationHistory,
      page_context: context.pageContext,
      user_id: context.userId,
      company_id: context.companyId !== undefined ? String(context.companyId) : undefined,
      additional_context: context.additionalContext,
    });
  }

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

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (abortSignal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);

            switch (eventType) {
              case 'token':
                callbacks.onToken(data.text || '');
                break;
              case 'tool_start':
                callbacks.onToolStart(data.tool || '');
                break;
              case 'tool_result':
                callbacks.onToolResult(data.tool || '', data.success ?? true);
                break;
              case 'done':
                callbacks.onDone({
                  answer: data.answer || '',
                  toolsUsed: data.toolsUsed || data.tools_used || [],
                  source: data.source || 'nova-ai-2.0',
                });
                return; // Stream complete
              case 'error':
                callbacks.onError(new Error(data.message || 'Nova AI error'));
                return;
            }

            eventType = '';
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
    }

    // Stream ended without a done event — synthesize one
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
