/**
 * Nova AI — Client-side TypeScript types
 */

export interface NovaChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  files?: { name: string; size: number }[];
}

export interface NovaStreamEvent {
  type: 'token' | 'tool_start' | 'tool_result' | 'done' | 'error';
  data: Record<string, unknown>;
}

export interface NovaAnalysisResult {
  status: 'processing' | 'completed' | 'error';
  analysisId: string;
  answer?: string;
  toolsUsed?: string[];
  error?: string;
}

export interface QuickAction {
  label: string;
  prompt: string;
}
