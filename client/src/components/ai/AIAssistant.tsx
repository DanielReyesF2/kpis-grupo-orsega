/**
 * AI Assistant - Diseño estilo Notion AI
 * Interfaz minimalista, elegante y refinada
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useMCPExecute, suggestedTools, toolCategories } from "@/hooks/useMCPTools";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Command,
  ArrowUp,
  Zap,
  MessageSquare,
  Wand2,
  ChevronRight,
  RotateCcw,
  FileText,
  DollarSign,
  Database,
  BarChart3,
  Bell,
  Search
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  toolName?: string;
  toolData?: any;
  toolSuccess?: boolean;
}

interface AskResponse {
  answer: string;
  data?: any;
  source?: string;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "tools">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // MCP Hook
  const mcpExecute = useMCPExecute();

  // Ejecutar herramienta MCP
  const executeTool = useCallback(async (toolName: string, params?: Record<string, any>, label?: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `Ejecutar: ${label || toolName}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await mcpExecute.mutateAsync({ toolName, params });

      const toolMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "tool",
        content: result.success
          ? formatToolResult(toolName, result.data)
          : `Error: ${result.error}`,
        timestamp: new Date(),
        toolName,
        toolData: result.data,
        toolSuccess: result.success
      };
      setMessages(prev => [...prev, toolMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "tool",
        content: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        timestamp: new Date(),
        toolName,
        toolSuccess: false
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [mcpExecute]);

  // Formatear resultado de herramienta
  function formatToolResult(toolName: string, data: any): string {
    if (!data) return "No se encontraron datos.";

    if (toolName === 'get_exchange_rate' && data.rate) {
      return `Tipo de cambio ${data.from}/${data.to}: $${data.rate.toFixed(4)} (${data.source || 'Banxico'})`;
    }

    if (toolName === 'convert_currency' && data.converted_amount) {
      return `$${data.original_amount.toLocaleString()} ${data.original_currency} = $${data.converted_amount.toLocaleString()} ${data.target_currency}`;
    }

    if (toolName === 'get_kpis' && data.insights) {
      return `Análisis de KPIs disponible`;
    }

    if (data.message) {
      return data.message;
    }

    return JSON.stringify(data, null, 2).substring(0, 500);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const askMutation = useMutation({
    mutationFn: async (question: string): Promise<AskResponse> => {
      const res = await apiRequest("POST", "/api/ask", { question });
      return await res.json();
    },
    onSuccess: (data: AskResponse) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date()
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Lo siento, ocurrió un error. Intenta de nuevo.",
        timestamp: new Date()
      }]);
    }
  });

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || askMutation.isPending) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    }]);
    askMutation.mutate(input.trim());
    setInput("");
  }, [input, askMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickActions = [
    { label: "Ventas del mes", query: "¿Cuáles son las ventas de este mes?" },
    { label: "Clientes activos", query: "¿Cuántos clientes activos hay?" },
    { label: "Top productos", query: "¿Cuáles son los productos más vendidos?" },
    { label: "KPIs actuales", query: "Muéstrame los KPIs actuales" },
  ];

  const categoryIcons: Record<string, any> = {
    invoices: FileText,
    treasury: DollarSign,
    database: Database,
    reports: BarChart3,
    notifications: Bell,
  };

  return (
    <>
      {/* Trigger Button - Notion Style */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all"
            style={{
              backgroundColor: 'rgba(15, 15, 15, 0.95)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}
          >
            <Wand2 className="h-4 w-4" />
            <span>Econova AI</span>
            <div className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 left-1/2 top-[12%] -translate-x-1/2 w-[600px] max-w-[calc(100vw-32px)]"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 16px 70px rgba(0, 0, 0, 0.2)',
                maxHeight: 'calc(100vh - 120px)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-semibold text-gray-900 text-sm">Econova AI</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-1 ml-4 p-0.5 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setActiveTab("chat")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        activeTab === "chat"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setActiveTab("tools")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        activeTab === "tools"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Acciones
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={() => setMessages([])}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                style={{ minHeight: '300px', maxHeight: '400px' }}
              >
                {messages.length === 0 ? (
                  <div className="p-4">
                    {activeTab === "chat" ? (
                      <>
                        {/* Quick Actions */}
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                          Sugerencias
                        </p>
                        <div className="space-y-1">
                          {quickActions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setInput(action.query);
                                inputRef.current?.focus();
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group"
                            >
                              <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                                <MessageSquare className="h-3 w-3 text-gray-400 group-hover:text-violet-500" />
                              </div>
                              <span className="text-sm text-gray-700">{action.label}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Tools */}
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                          Herramientas MCP
                        </p>
                        <div className="space-y-1">
                          {suggestedTools.map((tool) => {
                            const category = toolCategories[tool.category];
                            return (
                              <button
                                key={tool.name}
                                onClick={() => {
                                  if (tool.examplePrompt) {
                                    setInput(tool.examplePrompt);
                                    setActiveTab("chat");
                                    inputRef.current?.focus();
                                  } else {
                                    executeTool(tool.name, tool.params, tool.label);
                                  }
                                }}
                                disabled={mcpExecute.isPending}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group disabled:opacity-50"
                              >
                                <div
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
                                  style={{ backgroundColor: category.bgColor }}
                                >
                                  {tool.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-gray-700 block">{tool.label}</span>
                                  <span className="text-xs text-gray-400">{tool.description}</span>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Messages */
                  <div className="p-4 space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center ${
                            message.role === "assistant"
                              ? "bg-gradient-to-br from-violet-500 to-purple-600"
                              : message.role === "tool"
                              ? message.toolSuccess !== false
                                ? "bg-emerald-500"
                                : "bg-red-500"
                              : "bg-gray-700"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <Sparkles className="h-3 w-3 text-white" />
                          ) : message.role === "tool" ? (
                            <Zap className="h-3 w-3 text-white" />
                          ) : (
                            <User className="h-3 w-3 text-white" />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`max-w-[85%] ${message.role === "user" ? "text-right" : ""}`}>
                          {message.role === "tool" && message.toolName && (
                            <div className="mb-1">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                message.toolSuccess !== false
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-red-50 text-red-600"
                              }`}>
                                {message.toolName}
                              </span>
                            </div>
                          )}
                          <div
                            className={`inline-block px-3 py-2 text-sm leading-relaxed ${
                              message.role === "user"
                                ? "bg-gray-900 text-white rounded-xl rounded-tr-sm"
                                : "bg-gray-100 text-gray-800 rounded-xl rounded-tl-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Loading */}
                    {(askMutation.isPending || mcpExecute.isPending) && (
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                        <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-gray-400"
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                            />
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-gray-400"
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-gray-400"
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100">
                <form onSubmit={handleSubmit} className="relative">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Pregunta algo o escribe un comando..."
                      className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                      disabled={askMutation.isPending}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || askMutation.isPending}
                      className="p-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                    >
                      {askMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </form>

                <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500">Enter</kbd>
                    enviar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500">Esc</kbd>
                    cerrar
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
