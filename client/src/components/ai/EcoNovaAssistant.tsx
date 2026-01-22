/**
 * NovaAI Assistant - Branded with EcoNova colors
 * #273949 (dark slate) + #b5e951 (lime green)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  ArrowUp,
  RotateCcw
} from "lucide-react";

import { useChat, type ChatConfig } from "@/lib/econova-sdk";
import { getAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// EcoNova brand colors
const COLORS = {
  dark: '#273949',
  lime: '#b5e951',
  limeDark: '#9ed43e',
  darkLight: '#344a5c',
  darkLighter: '#3d566a'
};

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

  // Get user's first name
  const firstName = user?.name?.split(' ')[0] || 'Usuario';

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

  return (
    <>
      {/* Floating Button - EcoNova branded */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-medium transition-all"
            style={{
              backgroundColor: COLORS.dark,
              color: '#ffffff',
              boxShadow: `0 4px 20px ${COLORS.dark}50`
            }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
            >
              N
            </div>
            <span>NovaAI</span>
            <kbd
              className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded"
              style={{ backgroundColor: COLORS.darkLight, color: 'rgba(255,255,255,0.7)' }}
            >
              ⌘K
            </kbd>
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
            className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[580px] flex flex-col overflow-hidden"
              style={{
                backgroundColor: COLORS.dark,
                borderRadius: '20px',
                boxShadow: `0 25px 60px -12px rgba(0, 0, 0, 0.5)`,
                maxHeight: '75vh'
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: `1px solid ${COLORS.darkLight}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
                  >
                    N
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm">NovaAI</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: COLORS.lime }}
                      />
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Online</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={clearMessages}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = COLORS.darkLight;
                        e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                      }}
                      title="Nueva conversación"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = COLORS.darkLight;
                      e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                style={{ minHeight: '250px', maxHeight: 'calc(75vh - 160px)' }}
              >
                {messages.length === 0 ? (
                  /* Welcome State - Clean and minimal */
                  <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
                    <h2 className="text-2xl font-bold text-white mb-3">
                      ¡Hola, {firstName}! 👋
                    </h2>
                    <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Soy <span className="font-semibold" style={{ color: COLORS.lime }}>NovaAI</span>, tu asistente inteligente.
                      Pregúntame lo que necesites.
                    </p>
                  </div>
                ) : (
                  /* Messages */
                  <div className="p-5 space-y-5">
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
                            <div
                              className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md text-sm"
                              style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
                            >
                              {message.content}
                            </div>
                          ) : (
                            <div
                              className="text-sm leading-relaxed whitespace-pre-wrap"
                              style={{ color: 'rgba(255,255,255,0.9)' }}
                            >
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
                        className="flex items-center gap-2"
                        style={{ color: 'rgba(255,255,255,0.5)' }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: COLORS.lime }} />
                        <span className="text-sm">Pensando...</span>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Input */}
              <div
                className="p-4"
                style={{ borderTop: `1px solid ${COLORS.darkLight}` }}
              >
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta..."
                    rows={1}
                    disabled={isLoading}
                    className="w-full resize-none rounded-xl px-4 py-3 pr-14 text-sm focus:outline-none transition-all"
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
                    className="absolute right-2 bottom-2 p-2.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: COLORS.lime,
                      color: COLORS.dark
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = COLORS.limeDark;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = COLORS.lime;
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </form>
                <div
                  className="flex items-center justify-center gap-4 mt-3 text-[11px]"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <kbd
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                      style={{ backgroundColor: COLORS.darkLight }}
                    >
                      ↵
                    </kbd>
                    enviar
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span className="flex items-center gap-1.5">
                    <kbd
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                      style={{ backgroundColor: COLORS.darkLight }}
                    >
                      esc
                    </kbd>
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
