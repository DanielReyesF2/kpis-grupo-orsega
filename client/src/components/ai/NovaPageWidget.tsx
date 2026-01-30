/**
 * NovaPageWidget — Inline contextual AI widget per page.
 *
 * Expandable card with quick action buttons that uses the same
 * streaming Nova chat backend, scoped to a specific pageContext.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowUp,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

import { useNovaChat } from "@/lib/econova-sdk/useNovaChat";

// EcoNova brand colors
const COLORS = {
  dark: '#273949',
  lime: '#b5e951',
  limeDark: '#9ed43e',
  darkLight: '#344a5c',
  darkLighter: '#3d566a'
};

const TOOL_LABELS: Record<string, string> = {
  smart_query: 'Consultando base de datos...',
  get_sales_data: 'Obteniendo datos de ventas...',
  get_kpis: 'Consultando KPIs...',
  get_exchange_rate: 'Consultando tipo de cambio...',
  get_cash_flow: 'Calculando flujo de caja...',
  get_pending_payments: 'Buscando pagos pendientes...',
  analyze_data: 'Analizando datos...',
  get_executive_summary: 'Generando resumen ejecutivo...',
};

export interface QuickAction {
  label: string;
  prompt: string;
}

export interface NovaPageWidgetProps {
  pageContext: string;
  quickActions: QuickAction[];
  initialMessage?: string;
  collapsed?: boolean;
}

export function NovaPageWidget({
  pageContext,
  quickActions,
  initialMessage,
  collapsed: defaultCollapsed = true,
}: NovaPageWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSent = useRef(false);

  const {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    activeTools,
    clearMessages,
  } = useNovaChat({ pageContext });

  // Send initial message if provided (once)
  useEffect(() => {
    if (initialMessage && !initialSent.current && isExpanded) {
      initialSent.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage, isExpanded, sendMessage]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(msg);
  }, [input, isLoading, sendMessage]);

  const handleQuickAction = useCallback(async (prompt: string) => {
    if (isLoading) return;
    await sendMessage(prompt);
  }, [isLoading, sendMessage]);

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg"
      style={{ backgroundColor: COLORS.dark, border: `1px solid ${COLORS.darkLighter}` }}
    >
      {/* Header — click to expand/collapse */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ backgroundColor: COLORS.darkLight }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
          >
            N
          </div>
          <span className="text-sm font-semibold text-white">NovaAI</span>
          <Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.lime }} />
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
        ) : (
          <ChevronDown className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Quick actions */}
            {messages.length === 0 && !isLoading && (
              <div className="px-4 py-3 flex flex-wrap gap-2" style={{ borderBottom: `1px solid ${COLORS.darkLighter}` }}>
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: COLORS.darkLighter,
                      color: 'rgba(255,255,255,0.8)',
                      border: `1px solid ${COLORS.darkLight}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = COLORS.lime;
                      e.currentTarget.style.color = COLORS.lime;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = COLORS.darkLight;
                      e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Messages area */}
            <div
              ref={scrollRef}
              className="overflow-y-auto px-4 py-3 space-y-3"
              style={{ maxHeight: '300px', minHeight: messages.length > 0 ? '100px' : '0px' }}
            >
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[85%] px-3 py-2 rounded-xl rounded-br-sm text-xs"
                        style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="text-xs leading-relaxed nova-markdown"
                      style={{ color: 'rgba(255,255,255,0.9)' }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                      {isStreaming && msg.id === messages[messages.length - 1]?.id && (
                        <span
                          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm"
                          style={{ backgroundColor: COLORS.lime }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Tool indicator */}
              {activeTools.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <Wrench className="h-3 w-3 animate-spin" style={{ color: COLORS.lime }} />
                  {TOOL_LABELS[activeTools[activeTools.length - 1]] || `Ejecutando ${activeTools[activeTools.length - 1]}...`}
                </div>
              )}

              {/* Loading */}
              {isLoading && !isStreaming && activeTools.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Loader2 className="h-3 w-3 animate-spin" style={{ color: COLORS.lime }} />
                  Pensando...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${COLORS.darkLighter}` }}>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pregunta a Nova..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{
                    backgroundColor: COLORS.darkLight,
                    border: `1px solid ${COLORS.darkLighter}`,
                    color: '#ffffff',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = COLORS.lime}
                  onBlur={(e) => e.currentTarget.style.borderColor = COLORS.darkLighter}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 rounded-lg transition-all disabled:opacity-30"
                  style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMessages}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)', backgroundColor: COLORS.darkLight }}
                    title="Limpiar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
