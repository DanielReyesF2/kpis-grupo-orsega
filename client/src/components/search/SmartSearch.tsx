/**
 * Smart Search - Asistente IA estilo Grammarly
 * Se abre con Command+K
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  X,
  Send,
  Bot,
  User,
  TrendingUp,
  BarChart3,
  Users,
  FileText
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SmartSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const quickActions = [
  { icon: TrendingUp, text: "Resumen de ventas del mes", action: "Dame un resumen de las ventas de este mes" },
  { icon: BarChart3, text: "Comparar DURA vs ORSEGA", action: "Compara las ventas de DURA vs ORSEGA" },
  { icon: Users, text: "Top clientes activos", action: "¿Cuáles son los top 10 clientes?" },
  { icon: FileText, text: "Reporte ejecutivo", action: "Genera un reporte ejecutivo de ventas" },
];

export function SmartSearch({ isOpen, onClose }: SmartSearchProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

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
        content: "Lo siento, ocurrió un error. Por favor intenta de nuevo.",
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

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  const handleClose = () => {
    onClose();
  };

  // Escape to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            {/* Modal Container - Dark Theme like Grammarly */}
            <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden border border-[#333]">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-white font-medium">Asistente IA</span>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Messages Area */}
              {messages.length > 0 && (
                <div
                  ref={scrollRef}
                  className="max-h-[300px] overflow-y-auto px-5 pb-4 space-y-4"
                >
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "assistant"
                          ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                          : "bg-blue-500"
                      }`}>
                        {msg.role === "assistant"
                          ? <Bot className="h-4 w-4 text-white" />
                          : <User className="h-4 w-4 text-white" />
                        }
                      </div>
                      <div className={`max-w-[85%] ${msg.role === "user" ? "text-right" : ""}`}>
                        <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "assistant"
                            ? "bg-[#2a2a2a] text-gray-100 rounded-tl-md"
                            : "bg-blue-500 text-white rounded-tr-md"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Loading */}
                  {askMutation.isPending && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-[#2a2a2a] rounded-2xl rounded-tl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input Area */}
              <div className="px-5 pb-4">
                <div className="bg-[#2a2a2a] rounded-xl border border-[#404040] focus-within:border-emerald-500/50 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta sobre ventas, clientes, métricas..."
                    rows={1}
                    className="w-full bg-transparent text-white placeholder-gray-500 px-4 py-3 text-sm resize-none focus:outline-none"
                    disabled={askMutation.isPending}
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                  />

                  {/* Input Footer */}
                  <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1 px-2 py-1 bg-[#333] rounded">
                        <BarChart3 className="h-3 w-3" />
                        KPIs Dashboard
                      </span>
                    </div>
                    <button
                      onClick={() => handleSubmit()}
                      disabled={!input.trim() || askMutation.isPending}
                      className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-colors"
                    >
                      {askMutation.isPending
                        ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                        : <Send className="h-4 w-4 text-white" />
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions - Only show when no messages */}
              {messages.length === 0 && (
                <div className="px-5 pb-5 space-y-2">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickAction(action.action)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] border border-transparent hover:border-emerald-500/30 transition-all text-left group"
                    >
                      <div className="p-2 rounded-lg bg-[#333] group-hover:bg-emerald-500/20 transition-colors">
                        <action.icon className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-gray-300 text-sm">{action.text}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#333] flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Powered by OpenAI
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <kbd className="px-1.5 py-0.5 bg-[#333] rounded text-gray-400 font-mono">⌘K</kbd>
                  <span>para abrir</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
