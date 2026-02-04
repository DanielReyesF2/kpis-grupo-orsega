/**
 * NovaAI Assistant — Branded with EcoNova colors
 * #273949 (dark slate) + #b5e951 (lime green)
 *
 * Features:
 * - SSE streaming (tokens appear in real-time)
 * - File upload via paperclip + drag-and-drop
 * - Tool execution indicators
 * - Keyboard shortcuts (Ctrl+K / Cmd+K)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Loader2,
  ArrowUp,
  RotateCcw,
  Paperclip,
  FileText,
  Image as ImageIcon,
  XCircle,
  Wrench,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { useNovaChat } from "@/lib/econova-sdk/useNovaChat";
import { usePageContext } from "@/hooks/usePageContext";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, getAuthToken, queryClient } from "@/lib/queryClient";

// EcoNova brand colors
const COLORS = {
  dark: '#273949',
  lime: '#b5e951',
  limeDark: '#9ed43e',
  darkLight: '#344a5c',
  darkLighter: '#3d566a'
};

// Tool name → friendly label
const TOOL_LABELS: Record<string, string> = {
  process_sales_excel: 'Procesando Excel de ventas...',
  smart_query: 'Consultando base de datos...',
  get_sales_data: 'Obteniendo datos de ventas...',
  get_kpis: 'Consultando KPIs...',
  get_customers: 'Buscando clientes...',
  get_products: 'Buscando productos...',
  get_suppliers: 'Buscando proveedores...',
  get_exchange_rate: 'Consultando tipo de cambio...',
  get_cash_flow: 'Calculando flujo de caja...',
  get_pending_payments: 'Buscando pagos pendientes...',
  get_accounts: 'Consultando cuentas...',
  process_invoice: 'Procesando factura...',
  search_invoices: 'Buscando facturas...',
  analyze_data: 'Analizando datos...',
  generate_pdf_report: 'Generando reporte PDF...',
  get_executive_summary: 'Generando resumen ejecutivo...',
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] || `Ejecutando ${toolName}...`;
}

// Styled Markdown components for NovaAI responses
const MarkdownComponents = {
  table: ({ children }: any) => (
    <div className="my-3 overflow-x-auto rounded-lg" style={{ border: `1px solid ${COLORS.darkLighter}` }}>
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead style={{ backgroundColor: COLORS.darkLight }}>
      {children}
    </thead>
  ),
  th: ({ children }: any) => (
    <th
      className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide"
      style={{ color: COLORS.lime, borderBottom: `1px solid ${COLORS.darkLighter}` }}
    >
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td
      className="px-3 py-2"
      style={{ borderBottom: `1px solid ${COLORS.darkLighter}`, color: 'rgba(255,255,255,0.85)' }}
    >
      {children}
    </td>
  ),
  tr: ({ children }: any) => (
    <tr className="transition-colors" style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.darkLight + '40'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {children}
    </tr>
  ),
  h1: ({ children }: any) => (
    <h1 className="text-lg font-bold mt-4 mb-2" style={{ color: COLORS.lime }}>{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-base font-bold mt-3 mb-2" style={{ color: COLORS.lime }}>{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.lime }}>{children}</h3>
  ),
  ul: ({ children }: any) => (
    <ul className="my-2 ml-4 space-y-1" style={{ listStyleType: 'none' }}>
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="my-2 ml-4 space-y-1 list-decimal list-inside">
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="flex items-start gap-2">
      <span style={{ color: COLORS.lime }}>•</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ inline, children }: any) => (
    inline ? (
      <code
        className="px-1.5 py-0.5 rounded text-xs font-mono"
        style={{ backgroundColor: COLORS.darkLight, color: COLORS.lime }}
      >
        {children}
      </code>
    ) : (
      <pre
        className="my-2 p-3 rounded-lg overflow-x-auto text-xs font-mono"
        style={{ backgroundColor: COLORS.darkLight }}
      >
        <code style={{ color: 'rgba(255,255,255,0.9)' }}>{children}</code>
      </pre>
    )
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold" style={{ color: COLORS.lime }}>{children}</strong>
  ),
  em: ({ children }: any) => (
    <em style={{ color: 'rgba(255,255,255,0.95)' }}>{children}</em>
  ),
  p: ({ children }: any) => (
    <p className="my-1.5 leading-relaxed">{children}</p>
  ),
  hr: () => (
    <hr className="my-3" style={{ borderColor: COLORS.darkLighter }} />
  ),
  blockquote: ({ children }: any) => (
    <blockquote
      className="my-2 pl-3 italic"
      style={{ borderLeft: `3px solid ${COLORS.lime}`, color: 'rgba(255,255,255,0.8)' }}
    >
      {children}
    </blockquote>
  ),
};

// File icon helper
function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return <ImageIcon className="h-4 w-4" style={{ color: COLORS.lime }} />;
  }
  return <FileText className="h-4 w-4" style={{ color: COLORS.lime }} />;
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const NOVA_DATA_MODE_KEY = 'novaDataModeUnlocked';

function isExcelFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

export function EcoNovaAssistant() {
  const { user } = useAuth();
  const { page } = usePageContext();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dataModeUnlocked, setDataModeUnlocked] = useState(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(NOVA_DATA_MODE_KEY) === 'true'
  );
  const [dataModePassword, setDataModePassword] = useState("");
  const [dataModeChecking, setDataModeChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: true; data?: unknown } | { ok: false; error: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const lastExcelForImportRef = useRef<File | null>(null);

  const {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    activeTools,
    clearMessages
  } = useNovaChat({ pageContext: page, tenantId: 'grupo-orsega' });

  const firstName = user?.name?.split(' ')[0] || 'Usuario';

  // Wrap clearMessages to also reset the scroll ref y el Excel pendiente de importar
  const handleClear = useCallback(() => {
    clearMessages();
    prevMessagesLengthRef.current = 0;
    lastExcelForImportRef.current = null;
    setImportResult(null);
  }, [clearMessages]);

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

  // Smart scroll — delay slightly so ReactMarkdown content is rendered
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (currentLength > prevLength && currentLength > 0) {
      const lastMessage = messages[currentLength - 1];
      if (lastMessage.role === "assistant" && lastMessageRef.current) {
        // Wait for ReactMarkdown to finish rendering before scrolling
        requestAnimationFrame(() => {
          setTimeout(() => {
            lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        });
      } else if (lastMessage.role === "user" && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessagesLengthRef.current = currentLength;
  }, [messages]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, messages]);

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
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    const message = input.trim();
    const files = [...attachedFiles];
    // En modo datos, guardar último Excel enviado para poder importar con "actualiza" después
    if (dataModeUnlocked && files.length > 0) {
      const excelFile = files.find(isExcelFile);
      if (excelFile) {
        lastExcelForImportRef.current = excelFile;
        setImportResult(null);
      }
    }
    const excelFromCurrent = files.find(isExcelFile);
    const fileToImport = excelFromCurrent ?? lastExcelForImportRef.current;
    // Si el usuario pide actualizar (palabras clave) y hay Excel disponible, importar antes de enviar a Nova
    if (dataModeUnlocked && messageMatchesUpdateIntent(message) && fileToImport && !isImporting) {
      setIsImporting(true);
      setImportResult(null);
      try {
        const formData = new FormData();
        formData.append('file', fileToImport);
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${window.location.origin}/api/sales-data/import-from-nova`;
        const res = await fetch(url, { method: 'POST', body: formData, headers, credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setImportResult({ ok: false, error: data.details ?? data.error ?? res.statusText });
        } else {
          setImportResult({ ok: true, data });
          lastExcelForImportRef.current = null;
          queryClient.invalidateQueries({ queryKey: ['/api/sales-data'] });
          queryClient.invalidateQueries({ queryKey: ['/api/kpi-values'] });
          queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
        }
      } catch (err: unknown) {
        setImportResult({ ok: false, error: err instanceof Error ? err.message : 'Error al importar' });
      } finally {
        setIsImporting(false);
      }
    }
    setInput("");
    setAttachedFiles([]);
    if (inputRef.current) inputRef.current.style.height = "auto";
    await sendMessage(message || '(archivos adjuntos)', files.length > 0 ? files : undefined);
  }, [input, attachedFiles, isLoading, sendMessage, dataModeUnlocked]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleUnlockDataMode = useCallback(async () => {
    if (!dataModePassword.trim() || dataModeChecking) return;
    setDataModeChecking(true);
    try {
      const res = await apiRequest('POST', '/api/nova/check-data-mode', { password: dataModePassword.trim() });
      const data = await res.json();
      if (data.unlocked) {
        setDataModeUnlocked(true);
        sessionStorage.setItem(NOVA_DATA_MODE_KEY, 'true');
        setDataModePassword("");
      }
    } catch {
      // Mantener bloqueado
    } finally {
      setDataModeChecking(false);
    }
  }, [dataModePassword, dataModeChecking]);

  const handleLockDataMode = useCallback(() => {
    setDataModeUnlocked(false);
    sessionStorage.removeItem(NOVA_DATA_MODE_KEY);
  }, []);

  // File handling
  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).slice(0, 5);
    setAttachedFiles(prev => [...prev, ...fileArray].slice(0, 5));
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  return (
    <>
      {/* Floating Button */}
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
              {'\u2318'}K
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
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="w-full max-w-[580px] flex flex-col overflow-hidden relative"
              style={{
                backgroundColor: COLORS.dark,
                borderRadius: '20px',
                boxShadow: `0 25px 60px -12px rgba(0, 0, 0, 0.5)`,
                maxHeight: '75vh',
                border: isDragging ? `2px dashed ${COLORS.lime}` : '2px solid transparent',
              }}
            >
              {/* Drag overlay */}
              {isDragging && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px]"
                  style={{ backgroundColor: `${COLORS.dark}ee` }}
                >
                  <div className="text-center">
                    <Paperclip className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.lime }} />
                    <p className="text-sm font-medium" style={{ color: COLORS.lime }}>
                      Suelta archivos aqui
                    </p>
                  </div>
                </div>
              )}

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
                      onClick={handleClear}
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
                      title="Nueva conversacion"
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

              {/* Modo datos (GODINTAL): desbloquear para confirmar importaciones */}
              <div
                className="px-5 py-2 flex items-center justify-between gap-2"
                style={{ borderBottom: `1px solid ${COLORS.darkLight}`, backgroundColor: 'rgba(0,0,0,0.15)' }}
              >
                {dataModeUnlocked ? (
                  <>
                    <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: COLORS.lime }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Modo datos activo — puedes confirmar importaciones
                    </span>
                    <button
                      type="button"
                      onClick={handleLockDataMode}
                      className="text-[11px] px-2 py-1 rounded"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      Cerrar modo
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="password"
                      placeholder="Contraseña modo datos (ej. GODINTAL)"
                      value={dataModePassword}
                      onChange={(e) => setDataModePassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlockDataMode()}
                      className="flex-1 min-w-0 px-3 py-1.5 rounded text-xs bg-black/20 border"
                      style={{ color: '#fff', borderColor: COLORS.darkLight }}
                    />
                    <button
                      type="button"
                      onClick={handleUnlockDataMode}
                      disabled={!dataModePassword.trim() || dataModeChecking}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                      style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
                    >
                      {dataModeChecking ? '...' : 'Desbloquear'}
                    </button>
                  </>
                )}
              </div>

              {/* Content */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                style={{ minHeight: '250px', maxHeight: 'calc(75vh - 160px)' }}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
                    <h2 className="text-2xl font-bold text-white mb-3">
                      Hola, {firstName}!
                    </h2>
                    <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Soy <span className="font-semibold" style={{ color: COLORS.lime }}>NovaAI</span>, tu asistente inteligente.
                      Preguntame lo que necesites.
                    </p>
                    <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Puedes adjuntar archivos PDF, Excel o imagenes
                    </p>
                  </div>
                ) : (
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
                            <div className="max-w-[85%]">
                              <div
                                className="px-4 py-3 rounded-2xl rounded-br-md text-sm"
                                style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
                              >
                                {message.content}
                              </div>
                              {/* Show attached file names */}
                              {message.files && message.files.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5 justify-end">
                                  {message.files.map((f, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                                      style={{ backgroundColor: COLORS.darkLight, color: 'rgba(255,255,255,0.7)' }}
                                    >
                                      <FileIcon name={f.name} />
                                      {f.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="text-sm leading-relaxed nova-markdown"
                              style={{ color: 'rgba(255,255,255,0.9)' }}
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={MarkdownComponents}
                              >
                                {message.content}
                              </ReactMarkdown>
                              {/* Streaming cursor */}
                              {isLastAssistant && isStreaming && (
                                <span
                                  className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm"
                                  style={{ backgroundColor: COLORS.lime }}
                                />
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Tool execution indicators */}
                    {activeTools.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ backgroundColor: COLORS.darkLight }}
                      >
                        <Wrench className="h-3.5 w-3.5 animate-spin" style={{ color: COLORS.lime }} />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {getToolLabel(activeTools[activeTools.length - 1])}
                        </span>
                      </motion.div>
                    )}

                    {/* Feedback breve tras importación por palabras clave (actualiza, sube, etc.) */}
                    {importResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
                        style={{
                          backgroundColor: importResult.ok ? 'rgba(185, 233, 81, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: importResult.ok ? COLORS.lime : 'rgb(252, 165, 165)',
                        }}
                      >
                        {importResult.ok ? (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span>
                          {importResult.ok
                            ? 'Ventas actualizadas. Los KPIs se actualizarán.'
                            : importResult.error}
                        </span>
                      </motion.div>
                    )}

                    {/* Loading (before streaming starts) */}
                    {isLoading && !isStreaming && activeTools.length === 0 && (
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

              {/* Attached files preview */}
              {attachedFiles.length > 0 && (
                <div
                  className="px-4 py-2 flex flex-wrap gap-2"
                  style={{ borderTop: `1px solid ${COLORS.darkLight}` }}
                >
                  {attachedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ backgroundColor: COLORS.darkLight, color: 'rgba(255,255,255,0.8)' }}
                    >
                      <FileIcon name={file.name} />
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {formatSize(file.size)}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="ml-0.5 hover:opacity-80"
                        style={{ color: 'rgba(255,255,255,0.5)' }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                    className="w-full resize-none rounded-xl px-4 py-3 pl-11 pr-14 text-sm focus:outline-none transition-all"
                    style={{
                      backgroundColor: COLORS.darkLight,
                      border: `1px solid ${COLORS.darkLighter}`,
                      color: '#ffffff',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = COLORS.lime}
                    onBlur={(e) => e.currentTarget.style.borderColor = COLORS.darkLighter}
                  />
                  {/* Paperclip button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-3 bottom-3 p-1.5 rounded-md transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = COLORS.lime}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                    title="Adjuntar archivo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.xml,.png,.jpg,.jpeg,.webp,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
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
                      {'\u21b5'}
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
