/**
 * Smart Search - Buscador inteligente con IA estilo ChatGPT/Claude
 * Se abre con Command+K
 */

import { useState, useRef, useEffect, useCallback } from "react";
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
  Zap
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[10%] -translate-x-1/2 z-50 w-full max-w-2xl mx-4 sm:mx-auto"
          >
            <div className="bg-background rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary to-primary/70 rounded-xl">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base flex items-center gap-2">
                      Asistente AI
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">Beta</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">Pregunta sobre ventas, clientes y métricas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs h-8">
                      Limpiar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 min-h-[300px] max-h-[50vh]" ref={scrollRef}>
                <div className="p-5">
                  {messages.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center text-center py-8">
                      <div className="p-4 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl mb-5">
                        <Zap className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-1">¿En qué puedo ayudarte?</h3>
                      <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                        Pregunta sobre ventas, clientes, métricas y más
                      </p>

                      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(s.text)}
                            className="flex items-center gap-2 p-3 rounded-xl border border-border/60 hover:bg-muted/50 hover:border-primary/30 transition-all text-left text-sm"
                          >
                            <div className={`p-1.5 rounded-lg ${s.color}`}>
                              <s.icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-muted-foreground text-xs leading-tight">{s.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Messages */
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            msg.role === "assistant"
                              ? "bg-gradient-to-br from-primary to-primary/70"
                              : "bg-muted border border-border"
                          }`}>
                            {msg.role === "assistant"
                              ? <Bot className="h-4 w-4 text-white" />
                              : <User className="h-4 w-4 text-muted-foreground" />
                            }
                          </div>
                          <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                            <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm ${
                              msg.role === "assistant"
                                ? "bg-muted text-foreground rounded-tl-sm"
                                : "bg-primary text-primary-foreground rounded-tr-sm"
                            }`}>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 px-1">
                              {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                      {/* Loading */}
                      {askMutation.isPending && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                          <div className="px-4 py-2.5 bg-muted rounded-2xl rounded-tl-sm">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="text-sm text-muted-foreground">Pensando...</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border/50 bg-muted/20">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta..."
                    rows={1}
                    className="w-full resize-none rounded-xl border border-border/60 bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    disabled={askMutation.isPending}
                    style={{ minHeight: "44px", maxHeight: "150px" }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || askMutation.isPending}
                    className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
                  >
                    {askMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ArrowUp className="h-4 w-4" />
                    }
                  </Button>
                </form>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">⌘K</kbd> para abrir ·
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono ml-1">Esc</kbd> para cerrar ·
                  <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono ml-1">Enter</kbd> para enviar
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
