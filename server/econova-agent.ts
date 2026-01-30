/**
 * EcoNova Agent — Redirect to Nova AI
 *
 * Mantiene la interfaz original para backward compatibility con /api/ask.
 * Internamente delega a novaChat() del nuevo agente Nova.
 */

import { novaChat } from './nova/index';

// ============================================================
// TYPES (compatibilidad con la interfaz anterior)
// ============================================================

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface SearchResult {
  answer: string;
  data?: unknown;
  source?: string;
  query?: string;
}

// ============================================================
// EXPORT — Mantiene la misma interfaz que antes
// ============================================================

/**
 * Funcion principal del agente — compatible con la interfaz anterior.
 * Redirige a novaChat() que usa @anthropic-ai/sdk directo con 39 MCP tools.
 */
export async function econovaSearch(
  question: string,
  context?: { userId?: string; companyId?: number; conversationHistory?: ConversationMessage[] }
): Promise<SearchResult> {
  const result = await novaChat(question, {
    userId: context?.userId?.toString() || '',
    companyId: context?.companyId,
    conversationHistory: context?.conversationHistory,
  });

  return {
    answer: result.answer,
    data: result.data,
    source: result.source,
  };
}

export default econovaSearch;
