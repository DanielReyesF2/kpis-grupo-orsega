/**
 * Nova AI — Shared TypeScript types
 */

export interface NovaContext {
  userId?: string;
  companyId?: number;
  conversationHistory?: NovaConversationMessage[];
  pageContext?: string;
  additionalContext?: string;
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

export interface NovaAnalysisResult {
  status: 'processing' | 'completed' | 'error';
  analysisId: string;
  answer?: string;
  toolsUsed?: string[];
  error?: string;
}

export interface NovaPromptContext {
  userId?: string;
  companyId?: number;
  pageContext?: string;
}
