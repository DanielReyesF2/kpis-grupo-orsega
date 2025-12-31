/**
 * AI Assistant - Interfaz moderna estilo ChatGPT/Claude
 * Diseño luminoso y amigable
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  RefreshCw
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all group"
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
            <span className="font-semibold text-sm hidden sm:inline">Asistente AI</span>
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
            {/* Backdrop - Más suave */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md"
            />

            {/* Chat Modal - Diseño luminoso y moderno */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-auto sm:w-[720px] sm:max-w-[90vw] h-[calc(100vh-32px)] sm:h-[650px] sm:max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/20 overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
            >
              {/* Header - Gradiente luminoso */}
              <div className="relative px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-indigo-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="p-3 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/30">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h2 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                        Asistente AI
                        <span className="px-2.5 py-1 text-[10px] font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-full uppercase tracking-wide">
                          Beta
                        </span>
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Tu copiloto inteligente para datos y métricas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearChat}
                        className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Nuevo chat
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="h-5 w-5 text-slate-500" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-6 bg-slate-50/50 dark:bg-slate-950/50" ref={scrollRef}>
                {messages.length === 0 ? (
                  /* Empty State - Diseño luminoso */
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse" />
                      <div className="relative p-6 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-3xl">
                        <Lightbulb className="h-12 w-12 text-violet-600 dark:text-violet-400" />
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                      ¿En qué puedo ayudarte?
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-10 max-w-md leading-relaxed">
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
                          className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-lg hover:shadow-violet-500/10 transition-all text-left group"
                        >
                          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${suggestion.gradient} shadow-sm`}>
                            <suggestion.icon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors font-medium">
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
                          className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
                            message.role === "assistant"
                              ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600"
                              : "bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <Bot className="h-5 w-5 text-white" />
                          ) : (
                            <User className="h-5 w-5 text-white" />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`max-w-[75%] ${
                            message.role === "user" ? "text-right" : ""
                          }`}
                        >
                          <div
                            className={`inline-block px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                              message.role === "assistant"
                                ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-md border border-slate-100 dark:border-slate-700"
                                : "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-tr-md"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
                            {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    ))}

                    {/* Loading State */}
                    {askMutation.isPending && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-4"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-sm">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div className="px-5 py-4 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md border border-slate-100 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                              <motion.div
                                className="w-2 h-2 bg-violet-500 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                              />
                              <motion.div
                                className="w-2 h-2 bg-purple-500 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                              />
                              <motion.div
                                className="w-2 h-2 bg-indigo-500 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                              />
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">Analizando...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Input Area - Diseño moderno */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta aquí..."
                    rows={1}
                    className="w-full resize-none rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-4 pr-14 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-violet-500 dark:focus:border-violet-500 transition-all"
                    disabled={askMutation.isPending}
                    style={{ minHeight: "56px", maxHeight: "200px" }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || askMutation.isPending}
                    className="absolute right-3 bottom-3 h-10 w-10 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
                  >
                    {askMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <ArrowUp className="h-4 w-4 text-white" />
                    )}
                  </Button>
                </form>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">⌘K</kbd>
                    <span>abrir</span>
                  </p>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Enter</kbd>
                    <span>enviar</span>
                  </p>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Esc</kbd>
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
