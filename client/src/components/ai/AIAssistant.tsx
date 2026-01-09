/**
 * AI Assistant - Interfaz moderna estilo ChatGPT/Claude
 * Diseño luminoso FORZADO (ignora tema oscuro del sistema)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
  TrendingUp,
  Users,
  Package,
  HelpCircle,
  MessageSquare,
  Lightbulb,
  BarChart3,
  RefreshCw,
  Wrench,
  FileText,
  DollarSign,
  Database,
  Bell
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
  const [showTools, setShowTools] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // MCP Hook
  const mcpExecute = useMCPExecute();

  // Ejecutar herramienta MCP
  const executeTool = useCallback(async (toolName: string, params?: Record<string, any>, label?: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `🔧 Ejecutando: ${label || toolName}`,
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
          : `❌ Error: ${result.error}`,
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
        content: `❌ Error ejecutando herramienta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        timestamp: new Date(),
        toolName,
        toolSuccess: false
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [mcpExecute]);

  // Formatear resultado de herramienta para mostrar
  function formatToolResult(toolName: string, data: any): string {
    if (!data) return "No se encontraron datos.";

    // Tipo de cambio
    if (toolName === 'get_exchange_rate' && data.rate) {
      return `💱 Tipo de cambio ${data.from}/${data.to}\n\n` +
        `**Tasa:** $${data.rate.toFixed(4)}\n` +
        `**Fecha:** ${data.date}\n` +
        `**Fuente:** ${data.source || 'Banxico'}`;
    }

    // Conversión de moneda
    if (toolName === 'convert_currency' && data.converted_amount) {
      return `💵 Conversión de moneda\n\n` +
        `**Original:** $${data.original_amount.toLocaleString()} ${data.original_currency}\n` +
        `**Convertido:** $${data.converted_amount.toLocaleString()} ${data.target_currency}\n` +
        `**Tipo de cambio:** ${data.exchange_rate}`;
    }

    // KPIs
    if (toolName === 'get_kpis' && data.insights) {
      return `📊 Análisis de KPIs\n\n${JSON.stringify(data.insights, null, 2).substring(0, 500)}...`;
    }

    // Si hay un mensaje
    if (data.message) {
      return data.message;
    }

    // Default: mostrar JSON formateado
    return `✅ Resultado:\n\n\`\`\`json\n${JSON.stringify(data, null, 2).substring(0, 800)}\n\`\`\``;
  }

  // Command+K hotkey
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

  // Auto-scroll and focus
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const askMutation = useMutation({
    mutationFn: async (question: string): Promise<AskResponse> => {
      const res = await apiRequest("POST", "/api/ask", { question });
      return await res.json();
    },
    onSuccess: (data: AskResponse) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Lo siento, ocurrió un error. Por favor intenta de nuevo.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || askMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    askMutation.mutate(input.trim());
    setInput("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input, askMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestions = [
    { icon: TrendingUp, text: "¿Cuál es el crecimiento de ventas?", gradient: "from-emerald-500 to-teal-500" },
    { icon: Users, text: "¿Cuántos clientes activos hay?", gradient: "from-blue-500 to-cyan-500" },
    { icon: Package, text: "¿Cuál es el volumen total?", gradient: "from-purple-500 to-pink-500" },
    { icon: BarChart3, text: "¿Qué métricas puedo consultar?", gradient: "from-orange-500 to-amber-500" },
  ];

  // Mapeo de iconos de categoría
  const categoryIcons: Record<string, any> = {
    invoices: FileText,
    treasury: DollarSign,
    database: Database,
    reports: BarChart3,
    notifications: Bell,
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating Button - Moderno y brillante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all group"
            style={{ boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)' }}
          >
            <div className="relative">
              <Sparkles className="h-5 w-5" />
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-300 rounded-full" />
              </motion.div>
            </div>
            <span className="font-semibold text-sm hidden sm:inline">Econova</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono bg-white/20 backdrop-blur-sm rounded-lg ml-1">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal Overlay + Chat Window */}
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
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
            />

            {/* Chat Modal - FORZAR TEMA CLARO */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-auto sm:w-[720px] sm:max-w-[90vw] h-[calc(100vh-32px)] sm:h-[650px] sm:max-h-[85vh] overflow-hidden flex flex-col"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0'
              }}
            >
              {/* Header - Gradiente luminoso */}
              <div
                className="relative px-6 py-5 flex items-center justify-between"
                style={{
                  background: 'linear-gradient(to right, #f5f3ff, #ede9fe, #e0e7ff)',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className="p-3 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed, #8b5cf6, #6366f1)',
                        boxShadow: '0 10px 30px rgba(139, 92, 246, 0.4)'
                      }}
                    >
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#10b981', border: '2px solid #ffffff' }}
                    >
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: '#1e293b' }}>
                      Econova
                      <span
                        className="px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide"
                        style={{ background: 'linear-gradient(to right, #10b981, #34d399)', color: '#ffffff' }}
                      >
                        MCP
                      </span>
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
                      Tu asistente inteligente con 39 herramientas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={clearChat}
                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: '#64748b', backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Nuevo chat
                    </button>
                  )}
                  <button
                    className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors"
                    style={{ color: '#64748b' }}
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div
                ref={scrollRef}
                className="flex-1 p-6 overflow-y-auto"
                style={{ backgroundColor: '#f8fafc' }}
              >
                {messages.length === 0 ? (
                  /* Empty State */
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="relative mb-8">
                      <div
                        className="absolute inset-0 rounded-full blur-2xl animate-pulse"
                        style={{ background: 'linear-gradient(to right, #a78bfa, #8b5cf6, #6366f1)', opacity: 0.2 }}
                      />
                      <div
                        className="relative p-6 rounded-3xl"
                        style={{ background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)' }}
                      >
                        <Lightbulb className="h-12 w-12" style={{ color: '#7c3aed' }} />
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold mb-3" style={{ color: '#1e293b' }}>
                      ¿En qué puedo ayudarte?
                    </h3>
                    <p className="text-sm mb-6 max-w-md leading-relaxed" style={{ color: '#64748b' }}>
                      Pregúntame sobre ventas, clientes, métricas de rendimiento,
                      o usa las herramientas rápidas.
                    </p>

                    {/* Toggle entre preguntas y herramientas */}
                    <div className="flex items-center gap-2 mb-6">
                      <button
                        onClick={() => setShowTools(false)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          !showTools ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        💬 Preguntas
                      </button>
                      <button
                        onClick={() => setShowTools(true)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                          showTools ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <Wrench className="h-4 w-4" />
                        Herramientas
                      </button>
                    </div>

                    {!showTools ? (
                      /* Sugerencias de preguntas */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                        {suggestions.map((suggestion, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => {
                              setInput(suggestion.text);
                              inputRef.current?.focus();
                            }}
                            className="flex items-center gap-3 p-4 rounded-2xl text-left group transition-all"
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#a78bfa';
                              e.currentTarget.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                            }}
                          >
                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${suggestion.gradient} shadow-sm`}>
                              <suggestion.icon className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm font-medium" style={{ color: '#475569' }}>
                              {suggestion.text}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      /* Herramientas MCP */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                        {suggestedTools.map((tool, i) => {
                          const category = toolCategories[tool.category];
                          const CategoryIcon = categoryIcons[tool.category];
                          return (
                            <motion.button
                              key={tool.name}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.08 }}
                              onClick={() => {
                                if (tool.examplePrompt) {
                                  setInput(tool.examplePrompt);
                                  inputRef.current?.focus();
                                } else {
                                  executeTool(tool.name, tool.params, tool.label);
                                }
                              }}
                              disabled={mcpExecute.isPending}
                              className="flex items-center gap-3 p-4 rounded-2xl text-left group transition-all disabled:opacity-50"
                              style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#a78bfa';
                                e.currentTarget.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                              }}
                            >
                              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${category.color} shadow-sm flex items-center justify-center`}>
                                <span className="text-lg">{tool.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium block" style={{ color: '#1e293b' }}>
                                  {tool.label}
                                </span>
                                <span className="text-xs truncate block" style={{ color: '#64748b' }}>
                                  {tool.description}
                                </span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Chat Messages */
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        {/* Avatar */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
                          style={{
                            background: message.role === "assistant"
                              ? 'linear-gradient(135deg, #7c3aed, #8b5cf6, #6366f1)'
                              : message.role === "tool"
                              ? message.toolSuccess !== false
                                ? 'linear-gradient(135deg, #10b981, #34d399)'
                                : 'linear-gradient(135deg, #ef4444, #f87171)'
                              : 'linear-gradient(135deg, #475569, #64748b)'
                          }}
                        >
                          {message.role === "assistant" ? (
                            <Bot className="h-5 w-5 text-white" />
                          ) : message.role === "tool" ? (
                            <Wrench className="h-5 w-5 text-white" />
                          ) : (
                            <User className="h-5 w-5 text-white" />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div className={`max-w-[75%] ${message.role === "user" ? "text-right" : ""}`}>
                          <div
                            className="inline-block px-5 py-3.5 text-sm leading-relaxed"
                            style={{
                              backgroundColor: message.role === "assistant" || message.role === "tool" ? '#ffffff' : undefined,
                              background: message.role === "user" ? 'linear-gradient(to right, #7c3aed, #8b5cf6, #6366f1)' : undefined,
                              color: message.role === "user" ? '#ffffff' : '#334155',
                              borderRadius: message.role === "user" ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              border: message.role !== "user" ? '1px solid #e2e8f0' : 'none',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                          >
                            {message.role === "tool" && message.toolName && (
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                                  backgroundColor: message.toolSuccess !== false ? '#d1fae5' : '#fee2e2',
                                  color: message.toolSuccess !== false ? '#065f46' : '#991b1b'
                                }}>
                                  {message.toolName}
                                </span>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className="text-[10px] mt-1.5 px-1" style={{ color: '#94a3b8' }}>
                            {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    ))}

                    {/* Loading State */}
                    {(askMutation.isPending || mcpExecute.isPending) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-4"
                      >
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6, #6366f1)' }}
                        >
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div
                          className="px-5 py-4 rounded-2xl shadow-sm"
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderTopLeftRadius: '4px'
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                              <motion.div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#8b5cf6' }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                              />
                              <motion.div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#a78bfa' }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                              />
                              <motion.div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#c4b5fd' }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                              />
                            </div>
                            <span className="text-sm" style={{ color: '#64748b' }}>Analizando...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div
                className="p-5"
                style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}
              >
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta aquí..."
                    rows={1}
                    className="w-full resize-none rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none transition-all"
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '2px solid #e2e8f0',
                      color: '#1e293b'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                    disabled={askMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || askMutation.isPending}
                    className="absolute right-3 bottom-3 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(to right, #7c3aed, #8b5cf6, #6366f1)',
                      boxShadow: '0 4px 15px rgba(139, 92, 246, 0.35)'
                    }}
                  >
                    {askMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <ArrowUp className="h-4 w-4 text-white" />
                    )}
                  </button>
                </form>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <p className="text-[11px] flex items-center gap-2" style={{ color: '#94a3b8' }}>
                    <kbd
                      className="px-2 py-1 rounded-lg text-[10px] font-mono"
                      style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
                    >⌘K</kbd>
                    <span>abrir</span>
                  </p>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <p className="text-[11px] flex items-center gap-2" style={{ color: '#94a3b8' }}>
                    <kbd
                      className="px-2 py-1 rounded-lg text-[10px] font-mono"
                      style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
                    >Enter</kbd>
                    <span>enviar</span>
                  </p>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <p className="text-[11px] flex items-center gap-2" style={{ color: '#94a3b8' }}>
                    <kbd
                      className="px-2 py-1 rounded-lg text-[10px] font-mono"
                      style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
                    >Esc</kbd>
                    <span>cerrar</span>
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
