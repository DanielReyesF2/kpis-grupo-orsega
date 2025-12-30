/**
 * Smart Search - Buscador inteligente con IA
 * Permite hacer preguntas en lenguaje natural sobre los datos del sistema
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Sparkles,
  Loader2,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Calendar,
  ArrowRight,
  X,
  MessageSquare
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface SmartSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  answer: string;
  data?: any;
  suggestions?: string[];
  source?: string;
}

// Sugerencias predefinidas para ayudar al usuario
const QUICK_QUESTIONS = [
  {
    question: "¿Cuánto hemos vendido en DURA este mes?",
    icon: Package,
    category: "ventas"
  },
  {
    question: "¿Cuántos clientes activos tiene ORSEGA?",
    icon: Users,
    category: "clientes"
  },
  {
    question: "¿Cuál es el crecimiento de DURA vs año anterior?",
    icon: TrendingUp,
    category: "crecimiento"
  },
  {
    question: "¿Cuál es el tipo de cambio de hoy?",
    icon: DollarSign,
    category: "finanzas"
  },
  {
    question: "¿Cuáles son los top 5 clientes de ORSEGA?",
    icon: Users,
    category: "clientes"
  },
  {
    question: "¿Cuántos clientes nuevos tiene DURA este mes?",
    icon: Users,
    category: "clientes"
  }
];

export function SmartSearch({ isOpen, onClose }: SmartSearchProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<{ query: string; result: SearchResult }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Mutation para enviar preguntas
  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest('POST', '/api/ask', { question });
      return await res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (query && data) {
        setHistory(prev => [...prev.slice(-4), { query, result: data }]);
      }
    }
  });

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    askMutation.mutate(query.trim());
  }, [query, askMutation]);

  const handleQuickQuestion = useCallback((question: string) => {
    setQuery(question);
    askMutation.mutate(question);
  }, [askMutation]);

  const handleClose = useCallback(() => {
    setQuery("");
    setResult(null);
    onClose();
  }, [onClose]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!isOpen) {
          // Open is handled by parent
        }
      }
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="border-b border-border p-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pregunta lo que quieras... (ej: ¿Cuánto vendimos en DURA?)"
                  className="pl-10 pr-4 h-12 text-base border-0 bg-muted/50 focus-visible:ring-1"
                  disabled={askMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!query.trim() || askMutation.isPending}
                className="h-10 px-4"
              >
                {askMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Preguntar
                  </>
                )}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded">⌘K</kbd>
            para abrir · Pregunta en lenguaje natural sobre ventas, clientes o finanzas
          </p>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-4">
            {/* Result */}
            {result && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {query}
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {result.answer}
                      </p>
                    </div>
                    {result.data && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {result.source && (
                      <Badge variant="outline" className="text-xs">
                        Fuente: {result.source}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {askMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Analizando datos...
                  </span>
                </div>
              </div>
            )}

            {/* Error State */}
            {askMutation.isError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error al procesar la pregunta. Intenta de nuevo.
                </p>
              </div>
            )}

            {/* Quick Questions - Show when no result */}
            {!result && !askMutation.isPending && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Preguntas sugeridas
                </p>
                <div className="grid gap-2">
                  {QUICK_QUESTIONS.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleQuickQuestion(item.question)}
                        className="flex items-center gap-3 p-3 text-left rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-all group"
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          item.category === "ventas" && "bg-green-100 dark:bg-green-950/30",
                          item.category === "clientes" && "bg-blue-100 dark:bg-blue-950/30",
                          item.category === "crecimiento" && "bg-purple-100 dark:bg-purple-950/30",
                          item.category === "finanzas" && "bg-amber-100 dark:bg-amber-950/30"
                        )}>
                          <Icon className={cn(
                            "h-4 w-4",
                            item.category === "ventas" && "text-green-600",
                            item.category === "clientes" && "text-blue-600",
                            item.category === "crecimiento" && "text-purple-600",
                            item.category === "finanzas" && "text-amber-600"
                          )} />
                        </div>
                        <span className="flex-1 text-sm">{item.question}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && !result && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground">
                  Preguntas recientes
                </p>
                <div className="space-y-2">
                  {history.slice().reverse().map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(item.query)}
                      className="flex items-center gap-2 p-2 text-left rounded-lg hover:bg-muted/50 transition-all w-full text-sm"
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{item.query}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
