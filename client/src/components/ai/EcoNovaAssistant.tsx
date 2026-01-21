/**
 * EcoNova AI Assistant - Powered by @econova/ai-sdk
 *
 * Este componente usa el SDK de EcoNova configurado para el backend de KPIs Grupo Orsega.
 * Mantiene el diseño visual del AIAssistant original pero usa la arquitectura del SDK.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Command,
  ArrowUp,
  TrendingUp,
  Users,
  Package,
  BarChart3,
  RefreshCw,
  Lightbulb
} from "lucide-react";

// Importar SDK de EcoNova (copia local)
import { useChat, type ChatConfig } from "@/lib/econova-sdk";
import { getAuthToken } from "@/lib/queryClient";

export function EcoNovaAssistant() {
  // Obtener token de autenticación del storage
  const authToken = getAuthToken();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Configuración del SDK para usar el backend existente
  const chatConfig: ChatConfig = useMemo(() => ({
    baseUrl: '', // Usar URL relativa
    endpoint: '/api/ask',
    questionField: 'question', // El backend espera 'question'
    answerField: 'answer', // El backend responde con 'answer'
    headers: authToken ? {
      'Authorization': `Bearer ${authToken}`
    } : undefined
  }), [authToken]);

  const {
    messages,
    sendMessage,
    isLoading,
    error,
    clearMessages
  } = useChat(chatConfig);

  // Command+K hotkey and custom event listener
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

    // Listen for custom event from sidebar search button
    const handleOpenEcoNova = () => {
      setIsOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-econova", handleOpenEcoNova);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-econova", handleOpenEcoNova);
    };
  }, [isOpen]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
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

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    await sendMessage(message);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestions = [
    { icon: TrendingUp, text: "¿Cuál es el crecimiento de ventas?", gradient: "from-emerald-500 to-teal-500" },
    { icon: Users, text: "¿Cuántos clientes activos hay?", gradient: "from-blue-500 to-cyan-500" },
    { icon: Package, text: "¿Cuál es el volumen total de DURA?", gradient: "from-purple-500 to-pink-500" },
    { icon: BarChart3, text: "Top clientes de ORSEGA en 2025", gradient: "from-orange-500 to-amber-500" },
  ];

  const handleClearChat = () => {
    clearMessages();
  };

  return (
    <>
      {/* Floating Button - EcoNova branded */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all group"
            style={{ boxShadow: '0 10px 40px rgba(16, 185, 129, 0.3)' }}
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
            <span className="font-semibold text-sm hidden sm:inline">EcoNova AI</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono bg-white/20 backdrop-blur-sm rounded-lg ml-1">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal Overlay + Chat Window */}
      <AnimatePresence>
        {isOpen && (
          /* Backdrop con flexbox para centrar */
          <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
            >
              {/* Chat Modal - EcoNova themed */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:w-[720px] sm:max-w-[90vw] h-full sm:h-[650px] sm:max-h-[85vh] overflow-hidden flex flex-col"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '24px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #e2e8f0'
                }}
              >
              {/* Header - EcoNova gradient */}
              <div
                className="relative px-6 py-5 flex items-center justify-between"
                style={{
                  background: 'linear-gradient(to right, #ecfdf5, #d1fae5, #a7f3d0)',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className="p-3 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, #059669, #10b981, #14b8a6)',
                        boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)'
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
                      EcoNova AI
                      <span
                        className="px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide"
                        style={{ background: 'linear-gradient(to right, #059669, #10b981)', color: '#ffffff' }}
                      >
                        Beta
                      </span>
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
                      Tu copiloto inteligente para datos y métricas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={handleClearChat}
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
                        style={{ background: 'linear-gradient(to right, #34d399, #10b981, #059669)', opacity: 0.2 }}
                      />
                      <div
                        className="relative p-6 rounded-3xl"
                        style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}
                      >
                        <Lightbulb className="h-12 w-12" style={{ color: '#059669' }} />
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold mb-3" style={{ color: '#1e293b' }}>
                      ¿En qué puedo ayudarte?
                    </h3>
                    <p className="text-sm mb-10 max-w-md leading-relaxed" style={{ color: '#64748b' }}>
                      Pregúntame sobre ventas, clientes, métricas de rendimiento,
                      tendencias históricas y mucho más.
                    </p>

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
                            e.currentTarget.style.borderColor = '#34d399';
                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.15)';
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
                              ? 'linear-gradient(135deg, #059669, #10b981, #14b8a6)'
                              : 'linear-gradient(135deg, #475569, #64748b)'
                          }}
                        >
                          {message.role === "assistant" ? (
                            <Bot className="h-5 w-5 text-white" />
                          ) : (
                            <User className="h-5 w-5 text-white" />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div className={`max-w-[75%] ${message.role === "user" ? "text-right" : ""}`}>
                          <div
                            className="inline-block px-5 py-3.5 text-sm leading-relaxed"
                            style={{
                              backgroundColor: message.role === "assistant" ? '#ffffff' : undefined,
                              background: message.role === "user" ? 'linear-gradient(to right, #059669, #10b981, #14b8a6)' : undefined,
                              color: message.role === "assistant" ? '#334155' : '#ffffff',
                              borderRadius: message.role === "assistant" ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                              border: message.role === "assistant" ? '1px solid #e2e8f0' : 'none',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className="text-[10px] mt-1.5 px-1" style={{ color: '#94a3b8' }}>
                            {new Date(message.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    ))}

                    {/* Loading State */}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-4"
                      >
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
                          style={{ background: 'linear-gradient(135deg, #059669, #10b981, #14b8a6)' }}
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
                                style={{ backgroundColor: '#10b981' }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                              />
                              <motion.div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#34d399' }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                              />
                              <motion.div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#6ee7b7' }}
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
                    onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-3 bottom-3 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(to right, #059669, #10b981, #14b8a6)',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    {isLoading ? (
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
                  <p className="text-[11px] flex items-center gap-1" style={{ color: '#94a3b8' }}>
                    <span>Powered by</span>
                    <span className="font-semibold" style={{ color: '#10b981' }}>EcoNova AI</span>
                  </p>
                </div>
              </div>
              </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
