/**
 * useNovaChat — React hook for Nova AI streaming chat with file upload.
 *
 * Sends multipart/form-data to POST /api/nova/chat and consumes SSE events.
 * Supports file attachments, page context, and real-time tool tracking.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAuthToken } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

// ============================================================================
// Types
// ============================================================================

export interface NovaChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  files?: { name: string; size: number }[];
}

export interface UseNovaChatOptions {
  pageContext?: string;
}

export interface UseNovaChatReturn {
  messages: NovaChatMessage[];
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  activeTools: string[];
  error: Error | null;
  clearMessages: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useNovaChat(options: UseNovaChatOptions = {}): UseNovaChatReturn {
  const [messages, setMessages] = useState<NovaChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight stream on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) return;

    const userMessage: NovaChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
      files: files?.map((f) => ({ name: f.name, size: f.size })),
    };

    // Capture current messages for conversation history
    let currentMessages: NovaChatMessage[] = [];
    setMessages((prev) => {
      currentMessages = prev;
      return [...prev, userMessage];
    });

    setIsLoading(true);
    setIsStreaming(false);
    setActiveTools([]);
    setError(null);

    // Build conversation history for the API
    const conversationHistory = [...currentMessages, userMessage]
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    // Build FormData
    const formData = new FormData();
    formData.append('message', content);
    formData.append('conversationHistory', JSON.stringify(conversationHistory));
    if (options.pageContext) {
      formData.append('pageContext', options.pageContext);
    }
    if (files) {
      for (const file of files) {
        formData.append('files', file);
      }
    }

    // Debug: log what we're sending so we can verify files are included
    if (process.env.NODE_ENV === 'development' || files?.length) {
      console.log(`[Nova SDK] Sending: message=${content.length}chars, files=${files?.length ?? 0}, pageContext=${options.pageContext}`);
      files?.forEach((f, i) => console.log(`[Nova SDK] File[${i}]: ${f.name} (${f.type}, ${f.size} bytes)`));
    }

    const authToken = getAuthToken();

    // Prepare assistant message placeholder
    const assistantId = crypto.randomUUID();

    try {
      abortRef.current = new AbortController();

      const response = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData,
        credentials: 'include',
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error ${response.status}: ${text}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      setIsStreaming(true);

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      // Add empty assistant message to start streaming into
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', createdAt: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
                  fullText += data.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullText } : m
                    )
                  );
                  break;

                case 'tool_start':
                  setActiveTools((prev) => [...prev, data.tool]);
                  break;

                case 'tool_result':
                  setActiveTools((prev) => prev.filter((t) => t !== data.tool));
                  break;

                case 'done':
                  // Final update with complete answer
                  if (data.answer) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId ? { ...m, content: data.answer } : m
                      )
                    );
                  }
                  // Invalidate React Query caches when data-modifying tools were used
                  if (data.toolsUsed && Array.isArray(data.toolsUsed)) {
                    const dataTools = ['process_sales_excel', 'process_invoice', 'schedule_payment'];
                    const usedDataTool = data.toolsUsed.some((t: string) => dataTools.includes(t));
                    if (usedDataTool) {
                      setTimeout(() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/top-performers'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/collaborators-performance'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/payment-vouchers'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/treasury'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/treasury/payments'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/scheduled-payments'] });
                      }, 200);
                    }
                  }
                  break;

                case 'error':
                  setError(new Error(data.message || 'Error desconocido'));
                  // Update assistant message with error
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: fullText || `Error: ${data.message}` }
                        : m
                    )
                  );
                  break;
              }

              // Reset eventType after processing to prevent stale type on next data line
              eventType = '';
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errorObj = err instanceof Error ? err : new Error('Error desconocido');
      setError(errorObj);

      // Add error message if no assistant message was added yet
      setMessages((prev) => {
        const hasAssistant = prev.some((m) => m.id === assistantId);
        if (hasAssistant) {
          return prev.map((m) =>
            m.id === assistantId && !m.content
              ? { ...m, content: `Lo siento, ocurrio un error: ${errorObj.message}` }
              : m
          );
        }
        return [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: `Lo siento, ocurrio un error: ${errorObj.message}`,
            createdAt: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setActiveTools([]);
      abortRef.current = null;
    }
  }, [options.pageContext]);

  const clearMessages = useCallback(() => {
    // Abort any in-flight request
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setActiveTools([]);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    activeTools,
    error,
    clearMessages,
  };
}
