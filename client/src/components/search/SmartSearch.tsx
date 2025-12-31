/**
 * Smart Search - Buscador inteligente con IA estilo ChatGPT/Claude
 * Se abre con Command+K
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Search,
  Sparkles,
  Loader2,
  TrendingUp,
  Users,
  Package,
  HelpCircle,
  X,
  ArrowUp,
  Bot,
  User,
  Zap,
  Copy,
  Check
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

const suggestions = [
  { icon: TrendingUp, text: "¿Cuál es el crecimiento de ventas?", color: "text-green-600 bg-green-50" },
  { icon: Users, text: "¿Cuántos clientes activos hay?", color: "text-blue-600 bg-blue-50" },
  { icon: Package, text: "¿Cuál es el volumen de DURA?", color: "text-purple-600 bg-purple-50" },
  { icon: HelpCircle, text: "¿Qué métricas puedo consultar?", color: "text-orange-600 bg-orange-50" },
];

// Format AI response with better styling
function formatResponse(text: string): React.ReactNode {
  // Split by double newlines for paragraphs
  const parts = text.split(/\n\n+/);

  return parts.map((part, i) => {
    // Check if it's a bullet list
    if (part.match(/^[\-\•\*]\s/m)) {
      const items = part.split(/\n/).filter(line => line.trim());
      return (
        <ul key={i} className="list-disc list-inside space-y-1 my-2">
          {items.map((item, j) => (
            <li key={j} className="text-slate-700 dark:text-slate-200">
              {item.replace(/^[\-\•\*]\s*/, '')}
            </li>
          ))}
        </ul>
      );
    }

    // Check if it's a numbered list
    if (part.match(/^\d+[\.\)]\s/m)) {
      const items = part.split(/\n/).filter(line => line.trim());
      return (
        <ol key={i} className="list-decimal list-inside space-y-1 my-2">
          {items.map((item, j) => (
            <li key={j} className="text-slate-700 dark:text-slate-200">
              {item.replace(/^\d+[\.\)]\s*/, '')}
            </li>
          ))}
        </ol>
      );
    }

    // Check for bold text like **text**
    const formattedText = part.split(/(\*\*[^*]+\*\*)/g).map((segment, j) => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={j} className="font-semibold text-slate-900 dark:text-white">{segment.slice(2, -2)}</strong>;
      }
      return segment;
    });

    // Regular paragraph
    return (
      <p key={i} className="text-slate-700 dark:text-slate-200 leading-relaxed my-2 first:mt-0 last:mb-0">
        {formattedText}
      </p>
    );
  });
}

export function SmartSearch({ isOpen, onClose }: SmartSearchProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
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

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const clearChat = () => setMessages([]);

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

  // Usar portal para renderizar fuera del Sidebar y evitar problemas de z-index/transform
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop + Modal Container */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/20">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base flex items-center gap-2 text-slate-800 dark:text-white">
                      Asistente IA
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-full">PRO</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Analiza ventas, clientes y métricas con IA</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs h-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      Limpiar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={handleClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 min-h-[300px] max-h-[50vh] bg-slate-50 dark:bg-slate-900/50" ref={scrollRef}>
                <div className="p-5">
                  {messages.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center text-center py-8">
                      <div className="p-4 bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/20 rounded-2xl mb-5 shadow-sm">
                        <Zap className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-1 text-slate-800 dark:text-white">¿En qué puedo ayudarte?</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-sm">
                        Pregunta sobre ventas, clientes, métricas y más
                      </p>

                      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(s.text)}
                            className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md transition-all text-left text-sm group"
                          >
                            <div className={`p-1.5 rounded-lg ${s.color} group-hover:scale-110 transition-transform`}>
                              <s.icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-slate-600 dark:text-slate-300 text-xs leading-tight">{s.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Messages */
                    <div className="space-y-5">
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                        >
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                            msg.role === "assistant"
                              ? "bg-gradient-to-br from-violet-500 to-purple-600"
                              : "bg-gradient-to-br from-blue-500 to-blue-600"
                          }`}>
                            {msg.role === "assistant"
                              ? <Bot className="h-5 w-5 text-white" />
                              : <User className="h-5 w-5 text-white" />
                            }
                          </div>

                          {/* Message Content */}
                          <div className={`flex-1 max-w-[85%] ${msg.role === "user" ? "text-right" : ""}`}>
                            {/* Role Label */}
                            <div className={`flex items-center gap-2 mb-1.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                {msg.role === "assistant" ? "Asistente IA" : "Tú"}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Message Bubble */}
                            <div className={`relative group ${msg.role === "user" ? "inline-block" : ""}`}>
                              <div className={`text-sm ${
                                msg.role === "assistant"
                                  ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm"
                                  : "inline-block bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm"
                              }`}>
                                {msg.role === "assistant" ? (
                                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                                    {formatResponse(msg.content)}
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                )}
                              </div>

                              {/* Copy button for assistant messages */}
                              {msg.role === "assistant" && (
                                <button
                                  onClick={() => copyToClipboard(msg.content, msg.id)}
                                  className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600"
                                  title="Copiar respuesta"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Loading */}
                      {askMutation.isPending && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Asistente IA</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm inline-block">
                              <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                  <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                  <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Analizando datos...</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta..."
                    rows={1}
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 pr-12 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500 transition-all"
                    disabled={askMutation.isPending}
                    style={{ minHeight: "44px", maxHeight: "150px" }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || askMutation.isPending}
                    className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:shadow-none"
                  >
                    {askMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ArrowUp className="h-4 w-4" />
                    }
                  </Button>
                </form>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-slate-500 dark:text-slate-400">⌘K</kbd> para abrir ·
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-slate-500 dark:text-slate-400 ml-1">Esc</kbd> para cerrar ·
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-slate-500 dark:text-slate-400 ml-1">Enter</kbd> para enviar
                </p>
              </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Renderizar en el body usando portal para evitar problemas con el sidebar
  return createPortal(modalContent, document.body);
}
