/**
 * AI Assistant - Interfaz estilo ChatGPT/Claude/Notion AI
 * Se abre con Command+K o botón flotante
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
  HelpCircle
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
    { icon: TrendingUp, text: "¿Cuál es el crecimiento de ventas?", color: "text-green-500" },
    { icon: Users, text: "¿Cuántos clientes activos hay?", color: "text-blue-500" },
    { icon: Package, text: "¿Cuál es el volumen total?", color: "text-purple-500" },
    { icon: HelpCircle, text: "¿Qué métricas puedo consultar?", color: "text-orange-500" },
  ];

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating Button - Solo visible cuando está cerrado */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all group"
          >
            <Sparkles className="h-5 w-5" />
            <span className="font-medium text-sm hidden sm:inline">Asistente AI</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded ml-1">
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Chat Modal - Centered, larger, modern */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-auto sm:w-[700px] sm:max-w-[90vw] h-[calc(100vh-32px)] sm:h-[600px] sm:max-h-[85vh] bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border/50"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary to-primary/70 rounded-xl shadow-lg">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                      Asistente AI
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                        Beta
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Pregunta sobre ventas, clientes y métricas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearChat}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpiar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                {messages.length === 0 ? (
                  /* Empty State - Suggestions */
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl mb-6">
                      <Zap className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">¿En qué puedo ayudarte?</h3>
                    <p className="text-muted-foreground text-sm mb-8 max-w-md">
                      Puedo responder preguntas sobre tus datos de ventas, clientes, métricas y más.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setInput(suggestion.text);
                            inputRef.current?.focus();
                          }}
                          className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                        >
                          <div className={`p-2 rounded-lg bg-muted ${suggestion.color}`}>
                            <suggestion.icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            {suggestion.text}
                          </span>
                        </button>
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
                          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
                            message.role === "assistant"
                              ? "bg-gradient-to-br from-primary to-primary/70"
                              : "bg-muted border border-border"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <Bot className="h-5 w-5 text-white" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`max-w-[75%] ${
                            message.role === "user" ? "text-right" : ""
                          }`}
                        >
                          <div
                            className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                              message.role === "assistant"
                                ? "bg-muted text-foreground rounded-tl-md"
                                : "bg-primary text-primary-foreground rounded-tr-md"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 px-1">
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
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div className="px-4 py-3 bg-muted rounded-2xl rounded-tl-md">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Pensando...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t border-border/50 bg-muted/30">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta... (Enter para enviar)"
                    rows={1}
                    className="w-full resize-none rounded-xl border border-border/60 bg-background px-4 py-3 pr-14 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    disabled={askMutation.isPending}
                    style={{ minHeight: "48px", maxHeight: "200px" }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || askMutation.isPending}
                    className="absolute right-2 bottom-2 h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50"
                  >
                    {askMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd> para abrir ·
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono ml-1">Esc</kbd> para cerrar
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
