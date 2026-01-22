/**
 * EcoNova AI Assistant - Notion-style minimal design
 * Clean, simple, elegant interface
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Loader2,
  ArrowUp,
  RotateCcw
} from "lucide-react";

import { useChat, type ChatConfig } from "@/lib/econova-sdk";
import { getAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export function EcoNovaAssistant() {
  const authToken = getAuthToken();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

  const chatConfig: ChatConfig = useMemo(() => ({
    baseUrl: '',
    endpoint: '/api/ask',
    questionField: 'question',
    answerField: 'answer',
    headers: authToken ? {
      'Authorization': `Bearer ${authToken}`
    } : undefined
  }), [authToken]);

  const {
    messages,
    sendMessage,
    isLoading,
    clearMessages
  } = useChat(chatConfig);

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

    const handleOpenEcoNova = () => setIsOpen(true);

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-econova", handleOpenEcoNova);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-econova", handleOpenEcoNova);
    };
  }, [isOpen]);

  // Smart scroll
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (currentLength > prevLength && currentLength > 0) {
      const lastMessage = messages[currentLength - 1];
      if (lastMessage.role === "assistant" && lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (lastMessage.role === "user" && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessagesLengthRef.current = currentLength;
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    await sendMessage(message);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Get user's first name for personalized greeting
  const firstName = user?.name?.split(' ')[0] || 'Usuario';

  return (
    <>
      {/* Floating Button - Minimal dark style */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium transition-all"
            style={{
              backgroundColor: 'rgba(17, 17, 17, 0.95)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Ask AI</span>
            <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-white/15 rounded">⌘K</kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[600px] flex flex-col bg-white rounded-xl overflow-hidden"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                maxHeight: '70vh'
              }}
            >
              {/* Header - Simple and clean */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">EcoNova AI</span>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={clearMessages}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Nueva conversación"
                    >
                      <RotateCcw className="h-4 w-4" />
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
                style={{ minHeight: '200px', maxHeight: 'calc(70vh - 140px)' }}
              >
                {messages.length === 0 ? (
                  /* Welcome State - Personalized greeting */
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                    <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center mb-6">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      ¡Hola, {firstName}!
                    </h2>
                    <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                      Soy <span className="font-medium text-gray-700">EcoNova AI</span>, tu asistente inteligente.
                      Pregúntame sobre ventas, clientes, métricas o cualquier dato que necesites.
                    </p>
                  </div>
                ) : (
                  /* Messages - Clean minimal style */
                  <div className="p-4 space-y-4">
                    {messages.map((message, index) => {
                      const isLastAssistant = message.role === "assistant" && index === messages.length - 1;
                      const isUser = message.role === "user";

                      return (
                        <motion.div
                          key={message.id}
                          ref={isLastAssistant ? lastMessageRef : undefined}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={isUser ? "flex justify-end" : ""}
                        >
                          {isUser ? (
                            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-gray-900 text-white text-sm">
                              {message.content}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {message.content}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Loading */}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-gray-400"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Pensando...</span>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Input - Clean Notion style */}
              <div className="p-3 border-t border-gray-100">
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta algo..."
                    rows={1}
                    disabled={isLoading}
                    className="w-full resize-none rounded-lg px-4 py-3 pr-12 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-300 focus:bg-white transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 bottom-2 p-2 rounded-md bg-gray-900 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </form>
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">↵</kbd>
                    enviar
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">esc</kbd>
                    cerrar
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
